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
npm run optimize:boxes                                    # public/boxes-raw → public/boxes (WebP); originals kept
node scripts/optimize-images.mjs public/items-raw --out=public/items --quality=85
```

There are no tests. Node 24 (`.nvmrc`); `package.json` engines require `>=22.12.0`.

## Stack

Astro 6 with `output: 'server'` + `@astrojs/node` standalone adapter · Preact 10 islands + `@preact/signals` for client state · Tailwind CSS 4 (Vite plugin) · file-based JSON persistence. TypeScript is `astro/tsconfigs/strict` with `jsxImportSource: "preact"`. Prettier: no semicolons, single quotes, 4-space indent, 100 cols, trailing commas everywhere.

## Architecture

**Persistence is a single JSON file, mutated client-side and PUT back wholesale.**

- `src/pages/api/filters.ts` is the only API route: `GET /api/filters` returns `{ categories, source }`, `PUT /api/filters` overwrites with `{ categories: Category[] }`. File is `filters.dev.json` under `import.meta.env.DEV`, else `filters.prod.json`. Location = `process.env.DATA_DIR` (defaults to `<cwd>/src/data`). The route also accepts a bare top-level array for backward compat — keep that path if you touch the schema.
- `src/store/filters.ts` is the client-side source of truth: a `categories` signal plus `isHydrated` / `isSyncing` / `lastError` / `dataSource` signals. `ensureLoaded()` fetches once on first browser import. Every mutation (`addCategory`, `createFilter`, `updateFilter`, `deleteFilter`, …) does `cloneCategories()` → mutate the clone → `commit`/`commitFireAndForget`, which optimistically updates the signal and PUTs the whole tree. `normalizeFilter` here migrates legacy fields (e.g. `boxItemShortname` → `boxImagePath`), backfills the per-filter deployment counts (`boxCount` / `conveyorCount` / `storageAdaptorCount`, each defaulting to `1` — see `normalizeCounts`), and clamps items to `MAX_ITEMS_PER_FILTER` (30) — preserve these migrations when changing `Filter`. The SQLite side mirrors this: `filters.box_count` / `conveyor_count` / `storage_adaptor_count` (`NOT NULL DEFAULT 1`), with a forward `ALTER TABLE` in `src/db/client.ts`'s `migrate()` so existing prod rows backfill to 1. Open Core cards/detail show the summed totals via `deploymentTotalsForOpenCore` + the `DeploymentTotals` component.
- `src/store/items.ts` and `src/store/boxes.ts` are read-only lookups over static seed JSON (`src/data/items.json` = Rust item dump with `shortname`/`name`/`imagePath`/`category`; `src/data/box.json`; `src/data/categories.json` = seed category names). Images live at `public/items/{tiny,small,medium,full}/<imagePath>.webp` and `public/boxes/<imagePath>.webp`; resolve them via `itemImage()` (uses `/items/medium/...`) and `boxImage()`, never hardcode paths.
- **Game JSON interchange** lives in `src/components/FilterForm.tsx`: `buildConveyorJson` maps the app's `FilterItem` (`{shortname, max, buffer, min}`) to Rust's `ConveyorItem` (`TargetItemName`, `MaxAmountInOutput`, `BufferAmount`, `MinAmountInInput`, plus fixed `TargetCategory: null` / `IsBlueprint: false` / `BufferTransferRemaining: 0`); `parseConveyorJson` does the reverse — dedupes by `TargetItemName`, caps at 30, counts unknown shortnames. Shared types are in `src/types/index.ts`.
- **Pages & islands**: `src/pages/index.astro` (home — categories list), `filters/new.astro`, `filters/edit.astro` (reads `?id=` and `?categoryId=`/`?subcategoryId=` query params). Astro pages are thin shells; all interactivity is Preact components in `src/components/` mounted with `client:only="preact"`. Single layout: `src/layouts/Layout.astro` (dark theme, header/footer, imports `src/styles/global.css`).

## UI design system

**Aesthetic:** dark industrial control panel — raw metal, amber/orange accent glow. Not generic SaaS.

### Colour palette

| Token | Value | Usage |
|---|---|---|
| Background | `#0d1117` (Layout) / `#0a0e14` (landing) | Page background |
| **Amber — primary accent** | `#f59e0b` (`amber-500`) | Buttons, active nav, stat numbers, glow effects |
| Amber dim | `rgba(245,158,11,0.05–0.15)` | Hover backgrounds, badge fills |
| Slate surface | `bg-slate-900/30–40` | Cards, inputs |
| Slate border | `border-slate-800` | Default border |
| Slate muted | `text-slate-400–600` | Secondary text, inactive nav |

**Never use teal/green as a primary accent.** Teal is retired; amber is the single accent colour across all interactive states.

### Interactive states

**Nav links** (in `Layout.astro`):
```
inactive : text-slate-400 hover:bg-slate-800/60 hover:text-amber-400
active   : bg-amber-500/10 text-amber-400
```

**Cards** (filter cards, stat tiles, feature cards):
```
default : border-slate-800 bg-slate-900/30
hover   : hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]
```

**Buttons — primary** (CTA, new filter):
```
bg-amber-500 text-slate-950 font-bold uppercase tracking-wide
hover:bg-amber-400
```

**Buttons — icon/ghost** (copy, menu actions):
```
text-slate-400–600  hover:bg-slate-800  hover:text-amber-400
```

**Badges** (e.g. "Shared"):
```
bg-amber-500/15 text-amber-400
```

### Typography

Fonts loaded from Bunny Fonts in `Layout.astro` (and inline in the landing `<head>`):
- **Bebas Neue** — display/headings (`font-family: 'Bebas Neue', sans-serif`). Use for page titles, section headers, large stat numbers, and the COREFORGE wordmark.
- **JetBrains Mono** — mono accents (`font-family: 'JetBrains Mono', monospace`). Use for labels, tags, status pills, tickers, and `text-[11px] uppercase tracking-widest` eyebrow text.
- **Inter / system-ui** — body text. Already set on `<body>` via Layout.

### Logo dot

The `CoreForge` wordmark uses an amber pulsing dot:
```html
<span class="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.7)]" />
```

### Landing page (unauthenticated `/`)

The landing page renders a fully custom `<html>` structure (no Layout) with:
- Dot-grid hero background: `radial-gradient(rgba(245,158,11,0.055) 1px, transparent 1px) / 24px 24px`
- Radial amber/orange glow blobs (absolute, `pointer-events: none`)
- `CORE` in `#f1f5f9`, `FORGE` in `#f59e0b` with `text-shadow: 0 0 80px rgba(245,158,11,0.45)`
- Scrolling item-name ticker (CSS `@keyframes cf-ticker`, 60 s, pauses on hover) — the signature visual detail
- Feature cards with `border-left: 2px solid rgba(245,158,11,0.32)` accent

### Authenticated home (`/` when logged in)

Uses `Layout.astro` + two islands:
1. `HomeDashboard` (`client:only="preact"`) — stat tiles (Filters / Categories / Clan) + recent-6 filter grid + ASCII empty state
2. `MyConveyors` (`client:only="preact"`) — full arsenal management, below an "ARSENAL" divider

## Production deploy

`Dockerfile` is a multi-stage Node 24 slim image (base → deps → build → runner), runs as the unprivileged `node` user, and serves `node dist/server/entry.mjs` on `PORT` (4321). The only writable path at runtime is the `/data` volume, which holds the SQLite DB (`coreforge.prod.db` + `-wal`/`-shm`); `DATA_DIR` defaults to `/data`. `better-sqlite3` and `@node-rs/argon2` install from prebuilt binaries, so no compiler toolchain is in the image. There's no bundled init — run with `--init` / `init: true`. `docker-compose.yml` pulls the published image `negrii/coreforge-conveyor-filters:latest` (no `build:`), runs just that one container published on host port `8080` → `4321`, hardened with `read_only: true` (+ tmpfs for `/tmp` and `/app/.astro`), `no-new-privileges`, `cap_drop: ALL`, a memory/cpu limit, and a `/login` healthcheck. The app does its own session auth, CSRF (Origin checks) and security headers (`src/middleware.ts`), so there is no reverse-proxy sidecar — point an existing TLS-terminating proxy (e.g. Nginx Proxy Manager owning 80/443) at it.

CI: `.github/workflows/docker-publish.yml` runs on every push to `main`/`master`. A `gate` job diffs `package.json`'s `version` against the previous commit; the `verify` job (`astro check`) runs regardless, but the `build` (`linux/amd64` + `linux/arm64` on native runners) and `merge` jobs only run when the version changed — they publish `negrii/coreforge-conveyor-filters:<version>` and `:latest` to Docker Hub. So pushing code with no version change type-checks but ships nothing. To release: bump `version` in `package.json`, commit, push. Requires repo secrets `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`.
