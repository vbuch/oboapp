# Multi-stage build for minimal image size
FROM node:20-slim AS builder

WORKDIR /app

# Copy only dependency manifests
COPY package*.json ./

# Install ALL deps (needed for tsx + playwright install)
RUN npm ci

# Install Chromium ONLY (no system deps here)
RUN npx playwright install chromium

# Copy source code
COPY . .

# Use docker-specific tsconfig (uses ./docker-shared instead of ../shared)
RUN npm run build:docker

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

# Install only production dependencies
COPY package*.json ./
RUN npm ci --production

# Copy Playwright browser cache
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

# Copy only the built JavaScript files and necessary runtime files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/crawlers ./crawlers

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

CMD ["npm", "run", "prebuilt:crawl", "--", "--help"]
