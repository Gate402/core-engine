# Base Image - using Node for better native module compatibility
FROM node:20-slim AS base
WORKDIR /app

# Install bun
RUN npm install -g bun

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN apt-get update && apt-get install -y python3 build-essential
RUN bun install

# Build stage - includes Prisma generation and TypeScript compilation
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma Client
RUN bunx prisma generate

# Build TypeScript
RUN bun run build

# Production stage
FROM base AS prod

# Install required runtime dependencies (OpenSSL for Prisma) + Build tools for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
  openssl \
  ca-certificates \
  python3 \
  build-essential && \
  rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package.json bun.lock ./
RUN bun install --production

# Copy Prisma schema, migrations, and generated client
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
  useradd --system --uid 1001 --gid nodejs bunjs

USER bunjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

CMD ["bun", "dist/src/index.js"]
