# syntax=docker/dockerfile:1.7

# Pin Node major + variant. Bump as needed; consider pinning to a digest in CI
# (e.g. node:24-slim@sha256:<digest>) for reproducible/secure builds.
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
# (also enough for build:  #
# astro/tailwind/preact    #
# all live in dependencies)#
############################
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev && \
    npm cache clean --force

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

# tini gives proper PID 1 / signal handling.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    DATA_DIR=/data

# /data is the writable volume for filters.prod.json.
# Pre-create + chown so a fresh named volume inherits the right perms.
RUN mkdir -p /data && chown -R node:node /data /app

COPY --from=deps  --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist          ./dist
COPY              --chown=node:node package.json       ./

USER node
EXPOSE 4321
VOLUME ["/data"]

# Healthcheck: hits the app over loopback. Node 22+ has fetch built-in.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server/entry.mjs"]

LABEL org.opencontainers.image.title="CoreForge — Conveyor Filters" \
      org.opencontainers.image.description="CoreForge web app for managing Rust industrial conveyor filter presets." \
      org.opencontainers.image.source="" \
      org.opencontainers.image.licenses=""
