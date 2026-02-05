# Multi-stage build for minimal image size
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace root package files
COPY package*.json ./

# Copy shared and ingest package files
COPY shared ./shared
COPY ingest ./ingest

# Install workspace dependencies (triggers postinstall → builds shared)
RUN npm ci

# Install Chromium ONLY (no system deps here)
RUN cd ingest && npx playwright install chromium

# Build ingest
RUN cd ingest && npm run build

# Production stage
FROM node:20-slim

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

# Copy workspace root package files
COPY package*.json ./

# Copy shared package
COPY shared ./shared

# Copy ingest package files
COPY ingest/package*.json ./ingest/

# Install only production dependencies
RUN npm ci --production

# Copy Playwright browser cache
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

# Copy built shared package dist folder
COPY --from=builder /app/shared/dist ./shared/dist

# Copy only the built JavaScript files and necessary runtime files
COPY --from=builder /app/ingest/dist ./ingest/dist
COPY --from=builder /app/ingest/package*.json ./ingest/
COPY --from=builder /app/ingest/prompts ./ingest/prompts
COPY --from=builder /app/ingest/crawlers ./ingest/crawlers

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

WORKDIR /app/ingest

CMD ["npm", "run", "prebuilt:crawl", "--", "--help"]
