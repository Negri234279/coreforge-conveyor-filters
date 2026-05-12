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

USER node
EXPOSE 4321
VOLUME ["/data"]

# Hit a public route over loopback so the check doesn't depend on auth state.
# Node 22+ ships fetch built-in; it follows redirects, but /login is a 200.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# No bundled init: run with `--init` (docker run) or `init: true` (compose) so
# signals are forwarded and zombies reaped. Keeps the image one layer leaner.
CMD ["node", "dist/server/entry.mjs"]

LABEL org.opencontainers.image.title="CoreForge — Conveyor Filters" \
      org.opencontainers.image.description="CoreForge web app for managing Rust industrial conveyor filter presets." \
      org.opencontainers.image.source="" \
      org.opencontainers.image.licenses=""
