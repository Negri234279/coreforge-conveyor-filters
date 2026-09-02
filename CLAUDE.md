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
npm run dev:obs:up   # local observability stack (Grafana http://127.0.0.1:13000); pair with `npm run dev:otel`
npm run dev:obs:down
npm run dev:docker:up   # obs stack + Astro dev server in docker (profile `app`, http://127.0.0.1:4300) — alternative to host `npm run dev:otel`; teardown: dev:docker:down
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

| Token                      | Value                                    | Usage                                           |
| -------------------------- | ---------------------------------------- | ----------------------------------------------- |
| Background                 | `#0d1117` (Layout) / `#0a0e14` (landing) | Page background                                 |
| **Amber — primary accent** | `#f59e0b` (`amber-500`)                  | Buttons, active nav, stat numbers, glow effects |
| Amber dim                  | `rgba(245,158,11,0.05–0.15)`             | Hover backgrounds, badge fills                  |
| Slate surface              | `bg-slate-900/30–40`                     | Cards, inputs                                   |
| Slate border               | `border-slate-800`                       | Default border                                  |
| Slate muted                | `text-slate-400–600`                     | Secondary text, inactive nav                    |

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
<span
    class="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.7)]"
/>
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

## Code style

**Control flow**

- Prefer an anonymous object map over `switch` whenever the branches map a key to a value/handler. Fall back to `switch` only when cases need fall-through or complex guards.
- Use `try / catch` with `async / await`. Don't chain `.then().catch()`; don't pass a `.catch(handler)` callback as the error path.
- Early-return on guard conditions; avoid `else` after `return`.
- No nested ternaries — extract to a variable or an object map.

**Async**

- Top-level async work must be inside `try / catch`; never let a promise reject silently.
- Run independent awaits in parallel with `Promise.all` — never sequential `await`s when there's no data dependency.
- No `async` functions without an `await` inside.

**Errors & logging**

- Throw real `Error` instances (or a subclass), never strings or plain objects.
- Catch at the boundary that can actually handle it (API route, signal commit, event handler). Don't `try / catch` just to re-throw.
- In `catch`, type the error as `unknown` and narrow before use.
- `console.error` only at the outermost boundary; lower layers throw.

**Usage events (`logEvent`)**

- Any business-meaningful action (user/auth lifecycle, create/update/delete of filters/categories/subcategories/orgs, clones, shared views, exports, landing CTAs) MUST be recorded via `logEvent` from `src/lib/events.ts`. Never `db.insert(schema.events)` directly and never emit a parallel `log.info` for the same business action — `logEvent` already writes the row, annotates the active OTel span, and emits the structured log line.
- Call it from the server-side boundary that actually performed the action (API route handler, server endpoint, auth flow), after the work has succeeded — not from Preact islands and not before the mutation commits.
- Pick the `EventType` from the union in `src/lib/events.ts`. If a new action needs tracking, extend that union first; don't pass an ad-hoc string.
- Pass `userId` / `userName` from the authenticated session, `targetId` as the primary entity id (filter/category/org id, etc.), and put any extra context in `metadata` as a small JSON-serializable object. Keep `metadata` short — the `events` table is append-only.
- `logEvent` is fire-and-forget and swallows its own errors; do not wrap the call in `try / catch` and do not `await` it.
- Client-side counterpart: interactions that never reach the server are tracked with `trackEvent` (Faro RUM) — see "Instrumenting a new feature" in the Observability section for which layer gets which signal.

**Types (TypeScript)**

- `type` for unions, primitives, and function shapes; `interface` only when declaration merging is needed (rare here).
- Never `any`. Use `unknown` + narrowing, or a precise type.
- No non-null `!` assertions — narrow with a guard or early return.
- Use `as const` for literal tuples and lookup maps so keys stay typed.
- Shared domain types live in `src/types/index.ts` — don't redeclare them in components.

**Naming**

- `camelCase` for variables, functions, signals. `PascalCase` for components, types, and classes. `SCREAMING_SNAKE_CASE` for true constants (e.g. `MAX_ITEMS_PER_FILTER`).
- Files: `PascalCase.tsx` for Preact components, `kebab-case.ts` for everything else, `.astro` pages mirror the route.
- Boolean names start with `is` / `has` / `can` / `should`.
- Event handlers: `onX` for props, `handleX` for the local function.

**File / import structure**

- Import order: node builtins → external packages → `src/...` absolute → relative `./` / `../`. Blank line between groups.
- Use the configured aliases over deep `../../../` chains.
- One default export per file at most; prefer named exports for everything else.
- Co-locate component-private helpers in the same file; promote to `src/lib/` only when reused.

**Preact / Astro / signals**

- Astro pages stay thin shells — all interactivity in Preact islands mounted with `client:only="preact"`.
- Read signals with `.value` inside components; never destructure a signal.
- Mutations to the filters tree go through `src/store/filters.ts` (clone → mutate → commit). Never mutate `categories.value` in place from a component.
- Don't introduce a second state library (Zustand/Redux/etc.) — signals are the store.
- Keep components pure: side effects in `useEffect` or in store actions, never at module top level.
- Props: destructure in the signature, type them with a local `type Props = { ... }`.

## Observability (Grafana · Prometheus · Alloy · Tempo · Loki · Alertmanager)

Single-source configs live in `infra/observability/` and are shared unchanged by `infra/dev|staging|prod` — every service is named `coreforge-*` so the same URLs resolve in all envs (consequence: dev and staging can't run at the same time; container names collide). Full architecture in `infra/observability/README.md`. The split:

- **Traces** — `otel/instrumentation.mjs` (preloaded via `node --import`) exports traces ONLY, straight to Tempo over OTLP http/protobuf. No log/metric exporters in the SDK.
- **Logs** — `src/lib/logger.ts` writes one JSON line per record to stdout including the active span's `trace_id`/`span_id`; Alloy tails the container → Loki; Grafana derived fields link log↔trace. Never add an in-process log exporter.
- **Metrics** — pull-based via prom-client: `src/lib/metrics.ts` (global-registry singleton, HMR-safe) + `src/pages/metrics.ts` (`GET /metrics`, gated in `src/middleware.ts` to in-network hostnames — it must never be reachable through the public proxy). Custom metrics: `http_request_duration_seconds{method,route,status}` (observed in middleware, labelled by `ctx.routePattern`), `coreforge_events_total{type}` + `coreforge_events_persist_failures_total` (from `logEvent`), SQLite-on-scrape gauges — `coreforge_{users,filters,categories,orgs,subcategories,open_cores,opencore_layouts,events_rows}_total`, `coreforge_active_users{window="1d|7d|30d"}` (from `users.last_seen_at`), `coreforge_sessions_active`, `coreforge_shared_with_org_total{kind}`, `coreforge_db_size_bytes` — and `coreforge_build_info`. Tempo's metrics_generator adds RED span-metrics to Prometheus.
- **Browser RUM** — Grafana Faro (`@grafana/faro-web-sdk` + `-tracing`). `src/otel-web/init.ts` boots it from `window.__cf_faro` (built by `src/lib/faro-config.ts` from `FARO_COLLECTOR_URL` / `FARO_APP_NAME`; unset = RUM off) and POSTs to Alloy's CORS-gated `faro.receiver` (`:12347/collect`), which fans out logs/events/measurements→Loki (labels `job=faro`, `app`, `kind`) and traces→Tempo. Collects web vitals, errors, sessions, page views and fetch/XHR traces with W3C propagation to `*.negri.es`. Custom client events: `trackEvent` from `src/otel-web/track.ts` in islands (typed by `EventType`), `window.__cfTrack` in inline scripts — both mirror business events that also hit `/api/events/log`. The landing mounts RUM itself (it renders its own `<html>`, no Layout).
- **Liveness probes** — `coreforge-blackbox` (blackbox-exporter, `infra/observability/blackbox/blackbox.yml`) is driven by Prometheus to probe the app's real `/api/healthz` (`job=blackbox-app`, target in each env's `scrape.d/` since the app address differs) plus Loki/Tempo `/ready` (`job=blackbox-http`, in the shared `prometheus.yml`). Produces `probe_success` / `probe_duration_seconds{name}`; surfaced in the "Liveness · probes" dashboard row and alerted by `CoreforgeProbeDown` / `CoreforgeProbeSlow`. This is a stronger signal than `up` (which only means `/metrics` was scraped).
- **Alerts** — Prometheus rules (`infra/observability/prometheus/rules/`) → per-app Alertmanager → Discord; the webhook comes from `COREFORGE_DISCORD_WEBHOOK_URL` in the env file, written to a secret file by an init container — never commit it.
- Grafana runs locally in dev (`127.0.0.1:13000`, anonymous) and staging (`:13001`, auth on); prod has NO Grafana — the central pi-infra Grafana provisions the `*-coreforge` datasources and the `coreforge-overview` dashboard (both single-sourced under `infra/observability/grafana/`).
- `.github/workflows/sync-pi-infra.yml` mirrors `infra/prod` + `infra/observability` into the `pi-infra` repo (PR + automerge) on every push to master touching `infra/**` — prod deploys from that repo, so infra changes here ARE prod changes.

### Instrumenting a new feature (checklist)

When building a feature, pick the right signal per layer — one signal per question, never the same thing in two layers:

1. **Server-side business action** (create/update/delete, auth, share, clone, export…) → extend the `EventType` union and call `logEvent` at the server boundary (rules under "Usage events" above). That single call already feeds `coreforge_events_total{type}`, a span event, and the Loki business feed — "how often does X happen" needs NO extra metric, panel data comes free via the "Events by type" / "Top events" panels.
2. **Client-only interaction** the server never sees (copy to clipboard, UI toggles, abandoned flows) → in islands, prefer the wrappers over hand-rolled tracking: `<TrackedButton track="…">` / `<TrackedLink track="…">` (drop-in `button`/`a` from `src/components/`, fire the RUM event then delegate to `onClick`), and for confirm-modal flows pass `track` to `ConfirmDeleteModal` so the CONFIRM click is tracked, not the modal opening. When the outcome is conditional (async success/failure), call `trackEvent` from the success path instead — see `FilterForm.onExport`. Inline scripts use `window.__cfTrack(...)`. Names are typed by `TrackName` (`src/otel-web/track.ts`): reuse the `EventType` union for business actions, or a `ui_`-prefixed literal for UI-only interactions — never an arbitrary string. All are safe no-ops when RUM is off. If the event must also be queryable in SQL/admin, ALSO beacon `POST /api/events/log` (its handler allowlists types). `TrackedLink` is only for links with meaning beyond navigation — Faro already tracks page views.
3. **New backend metric** (`src/lib/metrics.ts`) → only when events/spans can't answer the question: durations → `Histogram`, failure counts → `Counter` (`_total` suffix), current state → `Gauge` with a `collect()` callback. Current-state totals derived from SQLite are one line in `businessGauges` (or a `collect()` + `scalarQuery(...)` for filtered counts) — cheap at the 15s scrape, and `scalarQuery` already swallows table errors. Naming: `coreforge_<noun>_<total|_bytes|_seconds>`; labels must be a small closed set (enum-like: `type`, `kind`, `window`) — NEVER user/org/filter ids or URLs as label values. The `globalThis.__cfMetrics` HMR guard means new metrics only appear after a dev-server restart, not on hot reload.
4. **RUM / frontend performance** → web vitals, JS errors, console errors, sessions, page views and fetch/XHR traces are collected automatically by Faro — never hand-instrument those, and don't add page-timing code. The only manual RUM API is `trackEvent` (point 2).
5. **Make it visible** → add a panel to `infra/observability/grafana/dashboards/coreforge-overview.json` (single-sourced: dev + staging + prod pi-infra all provision this file; local Grafana re-reads it every 30s, no restart). Prometheus queries filter `{job="coreforge-app"}`. Faro data is LogQL over `{job="faro", kind="event|measurement|exception"}`: extract only needed fields (`| logfmt event_name`, not bare `| logfmt` — every extracted field becomes a series label), and global percentiles need a `by ()` grouping (pattern: `quantile_over_time(0.75, {job="faro", kind="measurement"} | logfmt type, value_lcp | type="web-vitals" | unwrap value_lcp | __error__="" [$__auto]) by ()`).
6. **Alert only on actionable signals** → `infra/observability/prometheus/rules/coreforge-alerts.yml`, always labelled `app: coreforge`; exprs must work unchanged in all three envs (only use the `job` labels defined in every env's `scrape.d/`).

## Production deploy

`Dockerfile` is a multi-stage Node 24 slim image (base → deps → build → runner), runs as the unprivileged `node` user, and serves `node dist/server/entry.mjs` on `PORT` (4321). The only writable path at runtime is the `/data` volume, which holds the SQLite DB (`coreforge.prod.db` + `-wal`/`-shm`); `DATA_DIR` defaults to `/data`. `better-sqlite3` and `@node-rs/argon2` install from prebuilt binaries, so no compiler toolchain is in the image. There's no bundled init — run with `--init` / `init: true`. `infra/prod/docker-compose.yml` is the prod stack (app + observability, synced to `pi-infra/apps/coreforge/`): it pulls the published image `negrii/coreforge-conveyor-filters:latest` (no `build:`), publishes NO host ports (nginx-proxy-manager reaches `coreforge-app:4321` over the external `monitoring` network), and hardens the app with `read_only: true` (+ tmpfs for `/tmp` and `/app/.astro`), `no-new-privileges`, `cap_drop: ALL`, a memory/cpu limit, and an `/api/healthz` healthcheck. The app does its own session auth, CSRF (Origin checks) and security headers (`src/middleware.ts`), so there is no reverse-proxy sidecar — the TLS-terminating proxy (Nginx Proxy Manager owning 80/443) points at it.

CI: `.github/workflows/docker-publish.yml` runs on every push to `main`/`master`. A `gate` job diffs `package.json`'s `version` against the previous commit; the `verify` job (`astro check`) runs regardless, but the `build` (`linux/amd64` + `linux/arm64` on native runners) and `merge` jobs only run when the version changed — they publish `negrii/coreforge-conveyor-filters:<version>` and `:latest` to Docker Hub. So pushing code with no version change type-checks but ships nothing. To release: bump `version` in `package.json`, commit, push. Requires repo secrets `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`.
