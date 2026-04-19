# ---- Stage 1: Build ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (cache-friendly layer ordering)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ---- Stage 2: Production ----
FROM node:22-alpine AS production

LABEL org.opencontainers.image.title="DocuHog" \
      org.opencontainers.image.description="A MailHog-style mock server for the DocuSign eSignature REST API" \
      org.opencontainers.image.url="https://github.com/docusign/docuhog" \
      org.opencontainers.image.source="https://github.com/docusign/docuhog" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /app/dist/ ./dist/

# Copy static UI assets (HTML/CSS/JS served by Express)
# These are not compiled by TypeScript so they must be copied separately
COPY src/ui/ ./dist/ui/

# Create non-root user
RUN addgroup -g 1001 docuhog && \
    adduser -u 1001 -G docuhog -s /bin/sh -D docuhog

# Data directory for JSON file storage (ephemeral unless volume-mounted)
ENV DATA_DIR=/data
RUN mkdir -p /data && chown docuhog:docuhog /data

ENV PORT=8025
EXPOSE 8025

# Health check using wget (curl is not available in alpine by default)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8025/api/v1/health || exit 1

USER docuhog

CMD ["node", "dist/index.js"]
