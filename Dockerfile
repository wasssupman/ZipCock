# Stage 1: Dependencies
FROM node:22-slim AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Install Playwright Chromium + system deps
RUN npx playwright install chromium --with-deps

# Stage 2: Build
FROM node:22-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client + run migrations + build Next.js
ENV DATABASE_URL="file:./data/prod.db"
RUN mkdir -p data && \
    npx prisma migrate deploy && \
    npm run build

# Stage 3: Production
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL="file:./data/prod.db"
ENV PORT=3000

# Install Playwright system dependencies (Chromium libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libatspi2.0-0 libwayland-client0 \
    && rm -rf /var/lib/apt/lists/*

# Copy built app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/playwright-core ./node_modules/playwright-core
COPY --from=builder /app/node_modules/playwright ./node_modules/playwright
COPY --from=deps /root/.cache/ms-playwright /root/.cache/ms-playwright

# Data volume for SQLite persistence
VOLUME /app/data

EXPOSE 3000

CMD ["node", "server.js"]
