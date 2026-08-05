# Google Agent Runtime — Clawd Perps Agent
# Multi-stage build for minimal Cloud Run deployment

FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY deploy/google-agent/tsconfig.server.json ./tsconfig.json

# Install ALL dependencies (including devDependencies for TypeScript)
RUN npm ci

# Copy source
COPY src/ ./src/
COPY deploy/google-agent/google-server.ts ./src/server.ts

# Build the server
RUN npx tsc -p tsconfig.json --outDir dist

# ─── Production image ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Copy production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built server
COPY --from=builder /app/dist ./dist

# Install vulcan CLI (optional, for fallback)
RUN apk add --no-cache curl bash && \
    curl -fsSL https://github.com/Ellipsis-Labs/vulcan-cli/releases/latest/download/install.sh | sh || true

# Set runtime defaults
ENV NODE_ENV=production
ENV PORT=8080
ENV PERPS_SIM_ONLY=true

EXPOSE 8080

CMD ["node", "dist/server.js"]