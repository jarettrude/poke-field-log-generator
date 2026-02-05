# Production Dockerfile for Next.js with native dependencies
FROM node:22-alpine AS base

# Install build dependencies for native modules (better-sqlite3) and ffmpeg
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM base AS runner

# Don't run as root for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone .
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create data directory and set permissions
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

# Expose Next.js production server port
EXPOSE 3333

# Environment variables for production
ENV NODE_ENV=production
ENV PORT=3333

# Start the production server
CMD ["node", "server.js"]
