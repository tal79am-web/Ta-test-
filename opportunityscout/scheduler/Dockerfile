FROM node:22-alpine AS base
WORKDIR /app

# Install Chromium for Playwright (LinkedIn scraper)
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY scheduler/package.json ./scheduler/
COPY scraper/package.json ./scraper/
COPY ai/package.json ./ai/
COPY db/package.json ./db/
RUN npm ci --workspace=scheduler --workspace=scraper --workspace=ai --workspace=db --ignore-scripts

# Build
FROM deps AS builder
COPY tsconfig.base.json ./
COPY scheduler/ ./scheduler/
COPY scraper/ ./scraper/
COPY ai/ ./ai/
COPY db/ ./db/
RUN npm run build --workspace=db
RUN npm run build --workspace=scraper
RUN npm run build --workspace=ai
RUN npm run build --workspace=scheduler

# Runtime
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 scout

COPY --from=builder /app/scheduler/dist ./scheduler/dist
COPY --from=builder /app/scraper/dist ./scraper/dist
COPY --from=builder /app/ai/dist ./ai/dist
COPY --from=builder /app/db/dist ./db/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scheduler/node_modules ./scheduler/node_modules
COPY --from=builder /app/scraper/node_modules ./scraper/node_modules
COPY --from=builder /app/ai/node_modules ./ai/node_modules
COPY --from=builder /app/db/node_modules ./db/node_modules

USER scout
CMD ["node", "scheduler/dist/index.js"]
