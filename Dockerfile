# Development Dockerfile for Next.js with native dependencies
FROM node:22-alpine

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

# Expose Next.js dev server port
EXPOSE 3333

# Default command for development
CMD ["pnpm", "dev"]
