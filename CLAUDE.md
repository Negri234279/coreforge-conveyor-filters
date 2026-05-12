# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CoreForge — Conveyor Filters: a web app to design/organize/share **Rust industrial conveyor** filter presets. Users build presets in a browser UI (categories → subcategories → filters → up to 30 items with Max/Buffer/Min per slot) and copy/paste the exact JSON the game produces. No database — the entire app state is one JSON file on disk.

## Commands

```sh
npm install
npm run dev          # Astro dev server + HMR on http://localhost:4321
npm run build        # production bundle → ./dist (dist/server/entry.mjs is the prod entrypoint)
npm run preview      # run the built bundle locally
npx astro check      # type-check (use this — there is no test suite)
npm run format       # prettier --write . (run before committing)
npm run format:check
npm run optimize:boxes                                    # PNG→WebP for public/boxes
node scripts/optimize-images.mjs public/items --quality=85 # same for any image dir
```

There are no tests. Node 24 (`.nvmrc`); `package.json` engines require `>=22.12.0`.

## Stack

Astro 6 with `output: 'server'` + `@astrojs/node` standalone adapter · Preact 10 islands + `@preact/signals` for client state · Tailwind CSS 4 (Vite plugin) · file-based JSON persistence. TypeScript is `astro/tsconfigs/strict` with `jsxImportSource: "preact"`. Prettier: no semicolons, single quotes, 4-space indent, 100 cols, trailing commas everywhere.

## Architecture

**Persistence is a single JSON file, mutated client-side and PUT back wholesale.**

- `src/pages/api/filters.ts` is the only API route: `GET /api/filters` returns `{ categories, source }`, `PUT /api/filters` overwrites with `{ categories: Category[] }`. File is `filters.dev.json` under `import.meta.env.DEV`, else `filters.prod.json`. Location = `process.env.DATA_DIR` (defaults to `<cwd>/src/data`). The route also accepts a bare top-level array for backward compat — keep that path if you touch the schema.
- `src/store/filters.ts` is the client-side source of truth: a `categories` signal plus `isHydrated` / `isSyncing` / `lastError` / `dataSource` signals. `ensureLoaded()` fetches once on first browser import. Every mutation (`addCategory`, `createFilter`, `updateFilter`, `deleteFilter`, …) does `cloneCategories()` → mutate the clone → `commit`/`commitFireAndForget`, which optimistically updates the signal and PUTs the whole tree. `normalizeFilter` here migrates legacy fields (e.g. `boxItemShortname` → `boxImagePath`) and clamps items to `MAX_ITEMS_PER_FILTER` (30) — preserve these migrations when changing `Filter`.
- `src/store/items.ts` and `src/store/boxes.ts` are read-only lookups over static seed JSON (`src/data/items.json` = Rust item dump with `shortname`/`name`/`imagePath`/`category`; `src/data/box.json`; `src/data/categories.json` = seed category names). Images live at `public/items/{tiny,small,medium,full}/<imagePath>.webp` and `public/boxes/<imagePath>.webp`; resolve them via `itemImage()` (uses `/items/medium/...`) and `boxImage()`, never hardcode paths.
- **Game JSON interchange** lives in `src/components/FilterForm.tsx`: `buildConveyorJson` maps the app's `FilterItem` (`{shortname, max, buffer, min}`) to Rust's `ConveyorItem` (`TargetItemName`, `MaxAmountInOutput`, `BufferAmount`, `MinAmountInInput`, plus fixed `TargetCategory: null` / `IsBlueprint: false` / `BufferTransferRemaining: 0`); `parseConveyorJson` does the reverse — dedupes by `TargetItemName`, caps at 30, counts unknown shortnames. Shared types are in `src/types/index.ts`.
- **Pages & islands**: `src/pages/index.astro` (home — categories list), `filters/new.astro`, `filters/edit.astro` (reads `?id=` and `?categoryId=`/`?subcategoryId=` query params). Astro pages are thin shells; all interactivity is Preact components in `src/components/` mounted with `client:only="preact"`. Single layout: `src/layouts/Layout.astro` (dark theme, header/footer, imports `src/styles/global.css`).

## Production deploy

`Dockerfile` is a multi-stage Node 24 image (deps → build → runner with `tini`), runs as the `node` user, serves `node dist/server/entry.mjs` on `PORT` (4321), and reads/writes `filters.prod.json` in the `/data` volume. `docker-compose.yml` runs that app container (no host port) plus an `nginx:1.27-alpine` sidecar that is the only public entrypoint — it does HTTP basic auth via `secrets/htpasswd` (bind-mounted, **required** — compose won't start without it; gitignored), exposes host port `${COREFORGE_PORT:-8080}`, and bypasses auth on `/healthz` (`nginx/conf.d/default.conf`). Designed to sit behind an existing Nginx Proxy Manager owning 80/443.

CI: `.github/workflows/docker-publish.yml` builds `linux/amd64` + `linux/arm64` on native runners and publishes `negrii/coreforge-conveyor-filters:<package.json version>` and `:latest` to Docker Hub on every push to `main`/`master`. To release: bump `version` in `package.json`, commit, push. Requires repo secrets `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`.
