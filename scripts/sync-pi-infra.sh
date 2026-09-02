#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Sync coreforge's infra into a pi-infra checkout, per the agreed CONTRACT.
#
# Used by .github/workflows/sync-pi-infra.yml (CI) and runnable locally to test:
#   scripts/sync-pi-infra.sh /path/to/pi-infra
#
# CONTRACT — what the central pi-infra repo consumes from this app (source → dest).
# prod's compose mounts ../observability, so both are synced side-by-side under
# apps/coreforge/ to keep that relative path valid:
#   infra/prod/                                → apps/coreforge/        (the app stack)
#   infra/observability/ (minus grafana/)      → apps/coreforge/observability/ (configs prod mounts)
#   infra/observability/grafana/dashboards/
#       coreforge-overview.json                → core/grafana/dashboards/coreforge/
#   infra/observability/grafana/provisioning/datasources/datasources.yaml
#                                              → core/grafana/provisioning/datasources/coreforge.yml
#
# NOT synced:
#   - real secrets (only coreforge.env.example is tracked / copied).
#   - infra/dev and infra/staging (they never run on the Pi).
#   - the root docker-compose.yml include line is wired idempotently below.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SRC_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:?usage: sync-pi-infra.sh <pi-infra-checkout-dir>}"
DEST="$(cd "$DEST" && pwd)"

log() { printf '[sync] %s\n' "$*"; }

# Mirror a dir (prune files removed at source). Prefer rsync (CI); cp fallback for
# local runs without rsync. Real *.env secrets are never copied nor pruned. Extra
# rsync excludes can be passed as trailing args.
mirror_dir() {
  local src="$1" dst="$2"; shift 2
  mkdir -p "$dst"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete --exclude '*.env' "$@" "$src/" "$dst/"
  else
    cp -r "$src/." "$dst/"
    find "$dst" -type f -name '*.env' ! -name '*.env.example' -delete 2>/dev/null || true
    # Honor `--exclude '<dir>/'` args by pruning them post-copy (rsync does this
    # natively). Only directory excludes are supported in the fallback.
    while [ "$#" -gt 0 ]; do
      if [ "$1" = "--exclude" ]; then
        rm -rf "$dst/${2%/}"; shift 2
      else
        shift
      fi
    done
    log "  (rsync absent: cp fallback — no stale-file pruning beyond excludes)"
  fi
}

# 1) App stack → apps/coreforge/
log "app stack: infra/prod/ → apps/coreforge/"
mirror_dir "$SRC_ROOT/infra/prod" "$DEST/apps/coreforge/prod"

# 2) Shared obs configs (minus grafana/, which goes to core) → apps/coreforge/observability/
#    (prod's compose mounts ../observability → apps/coreforge/observability after sync.)
log "obs configs: infra/observability/ (minus grafana) → apps/coreforge/observability/"
mirror_dir "$SRC_ROOT/infra/observability" "$DEST/apps/coreforge/observability" --exclude 'grafana/'

# 3) App dashboards → core/grafana/dashboards/coreforge/
log "dashboards → core/grafana/dashboards/coreforge/"
mkdir -p "$DEST/core/grafana/dashboards/coreforge"
cp "$SRC_ROOT/infra/observability/grafana/dashboards/coreforge-overview.json" \
   "$DEST/core/grafana/dashboards/coreforge/"

# 4) App datasources → core/grafana/provisioning/datasources/coreforge.yml
log "datasources → core/grafana/provisioning/datasources/coreforge.yml"
mkdir -p "$DEST/core/grafana/provisioning/datasources"
cp "$SRC_ROOT/infra/observability/grafana/provisioning/datasources/datasources.yaml" \
   "$DEST/core/grafana/provisioning/datasources/coreforge.yml"

# Wire the app into the root include (idempotent): the action manages this too,
# so a fresh pi-infra checkout needs no manual edit.
if [ -f "$DEST/docker-compose.yml" ]; then
  if ! grep -qF 'apps/coreforge/docker-compose.yml' "$DEST/docker-compose.yml"; then
    sed -i '/-[[:space:]]*core\/docker-compose.yml/a\  - apps/coreforge/docker-compose.yml' "$DEST/docker-compose.yml"
    log "added include: - apps/coreforge/docker-compose.yml to root docker-compose.yml"
  fi
else
  log "WARNING: $DEST/docker-compose.yml not found — cannot wire the include."
fi

log "done."
