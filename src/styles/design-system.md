# CoreForge Design System

Source of truth extracted from `src/pages/index.astro` and `src/layouts/Layout.astro`.

---

## Colour Tokens

### Backgrounds
| Name | Value | Usage |
|---|---|---|
| Page (Layout) | `#0d1117` | Authenticated pages, `<body>` bg, header |
| Page (Landing) | `#0a0e14` | Unauthenticated landing page `<body>` |
| Card surface | `rgba(15,23,42,0.4)` | Feature cards, filter cards (`slate-950/40`) |
| Header | `rgba(10,14,20,0.96)` with `backdrop-filter: blur(10px)` | Landing sticky header |
| Header (Layout) | `bg-[#0d1117]/95 backdrop-blur` | Authenticated sticky header |
| Ticker strip | `rgba(245,158,11,0.016)` | Scrolling item ticker background |
| Bottom CTA gradient | `linear-gradient(to bottom, transparent, rgba(245,158,11,0.012))` | CTA section fade |

### Borders
| Name | Value | Usage |
|---|---|---|
| Default | `rgba(30,41,59,0.8)` / `border-slate-800` | Cards, dividers |
| Header bottom | `rgba(30,41,59,0.7)` / `border-slate-800/80` | Sticky header underline |
| Accent left | `2px solid rgba(245,158,11,0.32)` | Feature card left accent stripe |
| Card hover | `rgba(245,158,11,0.40)` / `hover:border-amber-500/40` | Hover state for filter/feature cards |
| Ticker strip | `rgba(245,158,11,0.08)` top + bottom | Item ticker border |
| Section rule | `rgba(30,41,59,0.45)` | Bottom CTA section top border |
| Footer | `rgba(30,41,59,0.4)` | Landing footer top border |
| Nav separator | `border-slate-800` + `border-l` or `border-t` | Username / logout divider |
| Secondary button border | `rgba(71,85,105,0.5)` (`slate-600/50`) | Inactive / secondary CTA |

### Amber — Primary Accent
| Usage | Value |
|---|---|
| Solid accent | `#f59e0b` (`amber-500`) |
| Primary button bg | `#f59e0b` → hover `#fbbf24` (`amber-400`) |
| Primary button text | `#0a0e14` (dark bg colour — not pure black) |
| Pulse dot shadow | `rgba(245,158,11,0.7)` |
| Status dot glow | `0 0 7px rgba(245,158,11,0.9)` |
| Dim tint (5%) | `rgba(245,158,11,0.05)` — status pill bg, icon well bg |
| Dim tint (8%) | `rgba(245,158,11,0.08)` — icon well bg |
| Dim tint (10%) | `rgba(245,158,11,0.10)` → `bg-amber-500/10` — active nav bg |
| Hero glow | `0 0 80px rgba(245,158,11,0.45), 0 0 180px rgba(245,158,11,0.15)` — "FORGE" title |
| Dot grid dots | `rgba(245,158,11,0.055)` |
| Ambient radial glow (top-right) | `radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 68%)` |
| Ambient radial glow (bottom-left) | `radial-gradient(circle, rgba(234,88,12,0.05) 0%, transparent 68%)` — orange tint |
| Primary button box-shadow | `0 0 20px rgba(245,158,11,0.22)` (header) / `0 0 40px rgba(245,158,11,0.3)` (hero) |
| Primary button hover shadow | `0 0 48px rgba(245,158,11,0.5)` |
| Card hover shadow | `0_0_20px_rgba(245,158,11,0.08)` → `hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]` |
| Feature card hover shadow | `0 0 28px rgba(245,158,11,0.06)` |

### Text Colours
| Name | Value / Class | Usage |
|---|---|---|
| Primary | `#f1f5f9` / `text-slate-100` | Headings, wordmark |
| Secondary | `#e2e8f0` / `text-slate-200` | Body default |
| Muted | `#94a3b8` / `text-slate-400` | Descriptions, inactive nav |
| Dimmer | `#64748b` / `text-slate-500` | Feature card body copy |
| Faint | `#475569` / `text-slate-600` | Footer, subtitle |
| Inactive nav | `text-slate-400` | Nav links default |
| Amber text | `text-amber-400` | Nav hover/active, icon hover |
| Amber dim | `rgba(245,158,11,0.55)` | Tagline |
| Amber very dim | `rgba(245,158,11,0.45)` | Section eyebrows |
| Amber status | `rgba(245,158,11,0.8)` | Status pill label |
| Amber ticker | `rgba(245,158,11,0.32)` | Scrolling ticker text |
| Admin nav | `text-amber-300/80` → hover `text-amber-200` | Admin-only link |

---

## Typography

### Font Families
```css
/* Display / headings — Bebas Neue */
font-family: 'Bebas Neue', sans-serif;

/* Mono accents / labels / eyebrows — JetBrains Mono */
font-family: 'JetBrains Mono', monospace;

/* Body — Inter with system fallbacks */
font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```
Loaded from Bunny Fonts: `bebas-neue:400|jetbrains-mono:400,500`

### Type Scale
| Role | Size | Family | Additional |
|---|---|---|---|
| Hero title | `clamp(5rem, 16vw, 9.5rem)` | Bebas Neue | `line-height: 0.91`, `letter-spacing: 0.025em` |
| Section heading (h2) | `clamp(2.25rem, 6vw, 3.5rem)` | Bebas Neue | `letter-spacing: 0.05em` |
| Page title (h1, authenticated) | `text-4xl` (2.25rem) | Bebas Neue | `letter-spacing: 0.05em` |
| Feature card heading (h3) | `1.375rem` | Bebas Neue | `letter-spacing: 0.07em` |
| Wordmark | `text-sm` (0.875rem) | Inter bold | `tracking-[0.18em] uppercase` |
| Eyebrow / label | `10px` | JetBrains Mono | `letter-spacing: 0.16em; text-transform: uppercase` |
| Command Center label | `text-[11px]` | JetBrains Mono | `tracking-widest uppercase` |
| Tagline | `0.8rem` | JetBrains Mono | `letter-spacing: 0.22em; text-transform: uppercase` |
| Ticker | `0.6875rem` (11px) | JetBrains Mono | `letter-spacing: 0.07em` |
| Body copy | `1.0625rem` | Inter | `line-height: 1.78` |
| Feature card body | `0.9rem` | Inter | `line-height: 1.68` |
| Button text | `0.8125rem`–`0.9375rem` | Inter bold | `uppercase`, `letter-spacing: 0.05–0.07em` |
| Secondary button (header) | `0.8125rem` | Inter semibold | — |
| Nav links | `text-sm` | Inter | — |
| Footer | `text-xs` (0.75rem) | Inter | — |

---

## Component Patterns

### Logo Dot
```html
<!-- Static (Layout.astro) -->
<span class="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.7)]"></span>

<!-- Animated (landing page) -->
<span class="cf-pulse-dot" style="display:inline-block; height:8px; width:8px; border-radius:50%; background:#f59e0b; flex-shrink:0"></span>
```

### Nav Link States
```
inactive : rounded px-3 py-2 md:py-1.5 text-slate-400 hover:bg-slate-800/60 hover:text-amber-400
active   : rounded px-3 py-2 md:py-1.5 bg-amber-500/10 text-amber-400
admin    : rounded px-3 py-2 md:py-1.5 text-amber-300/80 hover:bg-slate-800 hover:text-amber-200
```

### Sticky Header
```
Layout:  sticky top-0 z-30 border-b border-slate-800/80 bg-[#0d1117]/95 backdrop-blur
Landing: position:sticky; top:0; z-index:30; border-bottom:1px solid rgba(30,41,59,0.7);
         background:rgba(10,14,20,0.96); backdrop-filter:blur(10px)
```

### Primary Button
```html
<!-- Tailwind (authenticated pages) -->
<a class="rounded bg-amber-500 px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-amber-400">

<!-- Landing page inline + .cf-btn-primary class for hover enhancement -->
style="padding:0.8125rem 2rem; border-radius:4px; background:#f59e0b; color:#0a0e14;
       font-weight:700; font-size:0.9375rem; text-transform:uppercase; letter-spacing:0.07em;
       box-shadow:0 0 40px rgba(245,158,11,0.3); transition:all 0.2s"
```
Hover (via `.cf-btn-primary`): `bg-amber-400 (#fbbf24)` + `box-shadow: 0 0 48px rgba(245,158,11,0.5)` + `translateY(-1px)`

### Secondary Button
```html
style="padding:0.8125rem 2rem; border-radius:4px; border:1px solid rgba(71,85,105,0.5);
       color:#cbd5e1; font-weight:600; font-size:0.9375rem; transition:all 0.2s"
```
Hover (via `.cf-btn-secondary`): `border-color:rgba(148,163,184,0.5)` + `color:#f1f5f9`

### Feature Card
```html
class="cf-feature-card"
style="border:1px solid rgba(30,41,59,0.8); border-left:2px solid rgba(245,158,11,0.32);
       background:rgba(15,23,42,0.4); border-radius:8px; padding:1.625rem; transition:all 0.22s"
```
Hover (via `.cf-feature-card`): `border-color:rgba(245,158,11,0.28)` + `box-shadow:0 0 28px rgba(245,158,11,0.06)`

### Feature Card Icon Well
```html
style="width:36px; height:36px; border-radius:6px; background:rgba(245,158,11,0.08);
       display:flex; align-items:center; justify-content:center; margin-bottom:1.125rem"
```
Icons: 18×18px SVG, `stroke="#f59e0b"`, `stroke-width="2"`, `fill="none"`

### Eyebrow / Section Label
```html
<!-- JetBrains Mono, 10px, amber, spaced caps -->
style="font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.16em;
       text-transform:uppercase; color:rgba(245,158,11,0.45)"

<!-- Tailwind equivalent (authenticated) -->
class="font-mono text-[11px] uppercase tracking-widest text-amber-500/50"
```

### Divider with Label (Arsenal separator)
```html
<div class="my-10 flex items-center gap-4">
    <div class="h-px flex-1 bg-slate-800" />
    <span class="font-mono text-[11px] uppercase tracking-widest text-slate-700">Arsenal</span>
    <div class="h-px flex-1 bg-slate-800" />
</div>
```

### Status Pill (badge)
```html
style="display:inline-flex; align-items:center; gap:0.5rem;
       border:1px solid rgba(245,158,11,0.22); background:rgba(245,158,11,0.05);
       border-radius:9999px; padding:0.3rem 1rem; margin-bottom:2rem"
<!-- dot: width:6px; height:6px; border-radius:50%; background:#f59e0b; box-shadow:0 0 7px rgba(245,158,11,0.9) -->
<!-- text: JetBrains Mono 10px, letter-spacing:0.16em, uppercase, color:rgba(245,158,11,0.8) -->
```

### Page Header Block (authenticated)
```html
<div class="mb-8">
    <div class="mb-0.5 font-mono text-[11px] uppercase tracking-widest text-amber-500/50">
        Command Center
    </div>
    <div class="flex items-end justify-between gap-4">
        <h1 class="text-4xl text-slate-100" style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em">
            ...
        </h1>
        <!-- primary button here -->
    </div>
</div>
```

---

## Background Effects

### Dot Grid (hero background)
```css
background-image: radial-gradient(rgba(245,158,11,0.055) 1px, transparent 1px);
background-size: 24px 24px;
```

### Ambient Glow Blobs
```css
/* Top-right amber */
position:absolute; top:-7rem; right:6%;
width:38rem; height:38rem; border-radius:50%;
background: radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 68%);

/* Bottom-left orange */
position:absolute; bottom:-5rem; left:8%;
width:30rem; height:30rem; border-radius:50%;
background: radial-gradient(circle, rgba(234,88,12,0.05) 0%, transparent 68%);
```

---

## Animations / Transitions

### `@keyframes cf-ticker` — scrolling item ticker
```css
@keyframes cf-ticker {
    from { transform: translateX(0) }
    to   { transform: translateX(-50%) }
}
.cf-ticker       { animation: cf-ticker 60s linear infinite; }
.cf-ticker:hover { animation-play-state: paused; }
```
Requires two identical copies of the text inline (second has `aria-hidden="true"`).

### `@keyframes cf-pulse-dot` — amber logo dot pulse
```css
@keyframes cf-pulse-dot {
    0%, 100% { box-shadow: 0 0 6px rgba(245,158,11,0.7); }
    50%       { box-shadow: 0 0 14px rgba(245,158,11,1), 0 0 28px rgba(245,158,11,0.4); }
}
.cf-pulse-dot { animation: cf-pulse-dot 2.4s ease-in-out infinite; }
```
Used only on the landing page; Layout.astro uses the static Tailwind `shadow-[0_0_10px_...]` instead.

### Standard transition durations
| Context | Value |
|---|---|
| Buttons | `transition: all 0.18s` (header) / `0.2s` (hero/CTA) |
| Feature cards | `transition: all 0.22s` |
| Tailwind nav/button | `transition-colors` |

---

## Layout / Spacing

| Token | Value |
|---|---|
| Max content width | `max-w-6xl` (`72rem`) |
| Content padding (Layout main) | `px-6 py-8` |
| Content padding (landing sections) | `padding: 6rem 1.5rem` (features) / `5rem 1.5rem` (hero, CTA) |
| Feature grid | `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem` |
| CTA button gap | `0.875rem` |
| Header inner padding | `px-4 py-3 sm:px-6 sm:py-4` |

---

## Responsive Utilities

| Class | Behaviour |
|---|---|
| `.cf-hide-sm` | `display:none` at `max-width: 640px` — hides "· Conveyor Filters" subtitle in landing header |
| `sm:inline` | Shows subtitle in Layout header above sm breakpoint |
| `md:hidden` / `md:flex` | Mobile hamburger toggle / desktop nav visibility |
