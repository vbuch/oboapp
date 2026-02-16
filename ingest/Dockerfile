# Multi-stage build for minimal image size
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

# Copy workspace root config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy shared, db and ingest package files
COPY shared ./shared
COPY db ./db
COPY ingest ./ingest

# Install workspace dependencies (triggers postinstall → builds shared)
RUN pnpm install --frozen-lockfile

# Install Chromium ONLY (no system deps here)
RUN cd ingest && npx playwright install chromium

# Build ingest
RUN cd ingest && pnpm build

# Production stage
FROM node:20-slim

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

# Install system dependencies for Playwright/Chromium including fonts
RUN apt-get update && apt-get install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libatspi2.0-0 \
    libxshmfence1 \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace root config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy shared and db packages
COPY shared ./shared
COPY db ./db

# Copy ingest package files
COPY ingest/package.json ./ingest/

# Install only production dependencies (skip postinstall since shared is already built)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy Playwright browser cache
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

# Copy built shared package dist folder
COPY --from=builder /app/shared/dist ./shared/dist

# Copy built db package dist folder
COPY --from=builder /app/db/dist ./db/dist

# Copy only the built JavaScript files and necessary runtime files
COPY --from=builder /app/ingest/dist ./ingest/dist
COPY --from=builder /app/ingest/package*.json ./ingest/
COPY --from=builder /app/ingest/prompts ./ingest/prompts
COPY --from=builder /app/ingest/crawlers ./ingest/crawlers
COPY --from=builder /app/ingest/localities ./ingest/localities

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

WORKDIR /app/ingest

CMD ["pnpm", "run", "prebuilt:crawl", "--", "--help"]
