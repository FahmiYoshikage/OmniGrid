# ─────────────────────────────────────────────────────────────────────────────
# OmniGrid – Production Dockerfile
# Multi-stage build: deps → build → runtime
# Produces a minimal image (~180 MB) with only production artifacts.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN apk add --no-cache python3 make g++ linux-headers

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: Build Next.js ───────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ linux-headers

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects telemetry by default – disable in CI/Docker
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Rebuild native modules (better-sqlite3) for production without dev deps
RUN npm ci --omit=dev && npm rebuild better-sqlite3

# ── Stage 3: Production runtime ──────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache tini

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 omnigrid && \
    adduser --system --uid 1001 omnigrid

# Copy built assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server ./server
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/public ./public

# Data directory for SQLite – mount a volume here
RUN mkdir -p /app/data && chown omnigrid:omnigrid /app/data

USER omnigrid

EXPOSE 3000

# Use tini as init process for proper signal handling
ENTRYPOINT ["tini", "--"]

CMD ["node", "--import", "tsx", "server/index.ts"]
