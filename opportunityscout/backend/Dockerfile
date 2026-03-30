FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY db/package.json ./db/
RUN npm ci --workspace=backend --workspace=db --ignore-scripts

# Build
FROM deps AS builder
COPY tsconfig.base.json ./
COPY backend/ ./backend/
COPY db/ ./db/
RUN npm run build --workspace=db
RUN npm run build --workspace=backend

# Runtime
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 scout

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/db/dist ./db/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/db/node_modules ./db/node_modules

USER scout
EXPOSE 3001
CMD ["node", "backend/dist/index.js"]
