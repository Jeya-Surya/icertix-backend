# =============================================================================
# iCertiX Backend — Production Multi-Stage Dockerfile
# Optimized for AWS ECS (Fargate), AWS App Runner, or AWS EC2
# =============================================================================

# --- Stage 1: Build & Bundle ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build bundled server.js
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# --- Stage 2: Minimal Production Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for Docker health check
RUN apk add --no-cache curl

# Copy production package manifests and install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled production bundle
COPY --from=builder /app/dist ./dist

# Run as non-root user for container security
USER node

EXPOSE 3000

# Health check matching AWS ALB / ECS target group
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
