import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Global Express error handler.
 * Must be registered AFTER all routes (4 params signature).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const timestamp = new Date().toISOString();
  const path = req.path;

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Request validation failed',
      details: err.flatten(),
      statusCode: 400,
      timestamp,
      path,
    });
    return;
  }

  // Application-defined errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.errorCode,
      message: err.message,
      statusCode: err.statusCode,
      timestamp,
      path,
    });
    return;
  }

  // Unknown / unexpected errors
  const message =
    err instanceof Error ? err.message : 'An unexpected error occurred';

  console.error('[ErrorHandler]', err);

  res.status(500).json({
    error: 'InternalServerError',
    message:
      process.env['NODE_ENV'] === 'production'
        ? 'An unexpected error occurred'
        : message,
    statusCode: 500,
    timestamp,
    path,
  });
}

/** Convenience wrapper to pass async route errors to Express error handler */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
