# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# GradPilot Next.js production image
# ---------------------------------------------------------------------------
# Three-stage build:
#   1. deps     — install only package.json deps (cacheable layer)
#   2. builder  — copy code and run `next build` with output: "standalone"
#   3. runner   — slim runtime container with only the standalone output
# ---------------------------------------------------------------------------

FROM node:20-alpine AS base

# ---------------------------------------------------------------------------
# 1) deps — install dependencies
# ---------------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /workspace

# Copy lock files first to leverage Docker layer caching.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# 2) builder — build the Next.js app
# ---------------------------------------------------------------------------
FROM base AS builder
WORKDIR /workspace

COPY --from=deps /workspace/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Public env vars — baked into the client bundle at build time.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_VAPI_PUBLIC_KEY
ARG NEXT_PUBLIC_VAPI_ASSISTANT_ID
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_VAPI_PUBLIC_KEY=$NEXT_PUBLIC_VAPI_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPI_ASSISTANT_ID=$NEXT_PUBLIC_VAPI_ASSISTANT_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Dummy values for backend keys at build time so API routes don't crash
# during static analysis. Real values are injected at runtime via Kubernetes.
ENV SUPABASE_SERVICE_ROLE_KEY="dummy-build-key"
ENV GROQ_API_KEY="dummy-build-key"
ENV GROQ_API_KEY_BACKUP="dummy-build-key"
ENV GROQ_FALLBACK_KEY_1="dummy-build-key"
ENV GROQ_FALLBACK_KEY_2="dummy-build-key"
ENV GEMINI_API_KEY="dummy-build-key"
ENV SERPER_API_KEY="dummy-build-key"
ENV GOOGLE_PLACES_API_KEY="dummy-build-key"
ENV VAPI_PRIVATE_KEY="dummy-build-key"
ENV EXCHANGE_RATE_API_KEY="dummy-build-key"
ENV RAPIDAPI_KEY="dummy-build-key"

RUN npm run build

# ---------------------------------------------------------------------------
# 3) runner — minimal production image
# ---------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root system user.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Public assets (logo, fonts, csv data, extension zip, etc.).
COPY --from=builder /workspace/public ./public

# Standalone server + static chunks.
RUN mkdir -p .next && chown -R nextjs:nodejs /app
COPY --from=builder --chown=nextjs:nodejs /workspace/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Default empty values — overwritten at runtime by Kubernetes Secret/ConfigMap.
ENV NEXT_PUBLIC_SUPABASE_URL=""
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ENV SUPABASE_SERVICE_ROLE_KEY=""
ENV GROQ_API_KEY=""
ENV GROQ_API_KEY_BACKUP=""
ENV GROQ_FALLBACK_KEY_1=""
ENV GROQ_FALLBACK_KEY_2=""
ENV GEMINI_API_KEY=""
ENV SERPER_API_KEY=""
ENV GOOGLE_PLACES_API_KEY=""
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
ENV NEXT_PUBLIC_VAPI_PUBLIC_KEY=""
ENV NEXT_PUBLIC_VAPI_ASSISTANT_ID=""
ENV VAPI_PRIVATE_KEY=""
ENV NEXT_PUBLIC_APP_URL=""
ENV EXCHANGE_RATE_API_KEY=""
ENV RAPIDAPI_KEY=""

# HEALTHCHECK probes the Next.js root, used by Docker and as a hint to k8s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
