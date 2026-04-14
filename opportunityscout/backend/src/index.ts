import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';

import opportunitiesRouter from './routes/opportunities.js';
import summariesRouter from './routes/summaries.js';
import sourcesRouter from './routes/sources.js';
import jobsRouter from './routes/jobs.js';
import settingsRouter from './routes/settings.js';
import { globalErrorHandler } from './middleware/errorHandler.js';

// =============================================================================
// Logger
// =============================================================================

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport:
    process.env['LOG_PRETTY'] === 'true'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

// =============================================================================
// Express App
// =============================================================================

const app = express();

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// CORS
const allowedOrigins = [
  process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }),
);

// Body parsing + compression
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// HTTP request logging
app.use(pinoHttp({ logger }));

// Global rate limiting (per IP)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'TooManyRequests',
      message: 'Too many requests, please try again later',
      statusCode: 429,
    },
  }),
);

// =============================================================================
// Health check
// =============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// =============================================================================
// API Routes
// =============================================================================

app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/summaries', summariesRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/settings', settingsRouter);

// =============================================================================
// 404 Handler
// =============================================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
  });
});

// =============================================================================
// Global Error Handler (must be last)
// =============================================================================

app.use(globalErrorHandler);

// =============================================================================
// Start Server
// =============================================================================

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

const server = app.listen(PORT, () => {
  logger.info(
    { port: PORT, env: process.env['NODE_ENV'] },
    'OpportunityScout backend started',
  );
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down');
  server.close(() => process.exit(0));
});

export default app;
