# Base Image
FROM oven/bun:latest AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
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

# Install curl for healthchecks (Bun image is based on Debian)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
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
