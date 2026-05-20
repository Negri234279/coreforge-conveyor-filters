# syntax=docker/dockerfile:1.7

# Pin the Node major + variant. For reproducible/secure builds consider
# pinning to a digest in CI (e.g. node:24-slim@sha256:<digest>).
ARG NODE_IMAGE=node:24-slim

############################
# Base                     #
############################
FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

############################
# Production deps          #
# (also enough to build —  #
# astro/tailwind/preact    #
# are all runtime deps).   #
# better-sqlite3 and       #
# @node-rs/argon2 install  #
# from prebuilt binaries,  #
# so no compiler toolchain #
# is needed here.          #
############################
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev
# Note: don't `npm cache clean` — the cache is a build mount, not a layer.

############################
# Build the Astro app      #
############################
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

############################
# Runtime image            #
############################
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ARG VERSION="unknown"
ARG VCS_REF="unknown"
ARG BUILD_DATE="unknown"
ARG DESCRIPTION="Web app for designing and sharing Rust industrial conveyor filter presets"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    DATA_DIR=/data

# /data is the only writable state: the SQLite DB (coreforge.prod.db + its
# -wal/-shm sidecars). Pre-create it owned by the unprivileged `node` user so
# a fresh named volume inherits the right perms. /app stays root-owned and is
# read-only at runtime — the app never writes there.
RUN mkdir -p /data && chown node:node /data

COPY --from=deps  --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist          ./dist
COPY              --chown=node:node package.json       ./
# OpenTelemetry bootstrap. Kept outside src/ so Astro/Vite don't bundle it —
# Node loads it as a plain ESM module via --import below. It's a no-op when
# OTEL_EXPORTER_OTLP_ENDPOINT is unset, so removing the env still works.
COPY              --chown=node:node otel               ./otel
# Versioned one-shot migrations. run-migration.mjs checks if a
# migration-{version}.mjs exists, runs it once, and records it in
# _applied_migrations before Astro starts. Safe to re-run: skipped if already applied.
COPY --from=build --chown=node:node /app/src/db/migrations ./src/db/migrations
COPY --from=build --chown=node:node /app/scripts/run-migration.mjs ./scripts/run-migration.mjs

USER node
EXPOSE 4321
VOLUME ["/data"]

# Dedicated liveness endpoint — no DB, no auth, no middleware work.
# Node 22+ ships fetch built-in; we expect a literal "ok" body so a half-
# broken proxy returning 200 with empty body still fails the check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/healthz').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# No bundled init: run with `--init` (docker run) or `init: true` (compose) so
# signals are forwarded and zombies reaped. Keeps the image one layer leaner.
# --import preloads the OTel SDK so auto-instrumentation can patch http,
# better-sqlite3, fetch, etc. before the app imports them.
CMD ["/bin/sh", "-c", "node scripts/run-migration.mjs && exec node --import ./otel/instrumentation.mjs dist/server/entry.mjs"]

LABEL org.opencontainers.image.title="CoreForge — Conveyor Filters" \
    org.opencontainers.image.description="${DESCRIPTION}" \
    org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.revision="${VCS_REF}" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.source="" \
    org.opencontainers.image.licenses=""
