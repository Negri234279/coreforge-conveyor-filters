// Browser RUM bootstrap — Grafana Faro. Mounted as a `<script>` block from
// Layout.astro and the unauthenticated landing (index.astro) so Vite bundles
// it into a client-side chunk. Config is passed at render time via
// `window.__cf_faro` (built server-side by src/lib/faro-config.ts from the
// FARO_COLLECTOR_URL / FARO_APP_NAME env vars) and points at Alloy's
// CORS-gated faro.receiver, which fans out logs/events/measurements → Loki
// and traces → Tempo.
//
// What Faro collects out of the box: Web Vitals (LCP/CLS/INP/FCP/TTFB),
// unhandled errors + rejections, console warnings/errors, session tracking,
// page views, and — via the tracing instrumentation — fetch/XHR spans with
// W3C traceparent propagation to our own backend, so browser traces join the
// server traces in Tempo. Custom business events go through
// src/otel-web/track.ts (islands) or window.__cfTrack (inline scripts).

declare global {
    interface Window {
        __cf_faro?: { url: string; appName: string; appVersion?: string; environment?: string }
        __cf_user?: {
            id: string
            username: string
            orgId: string | null
            orgRole: string | null
        } | null
        __cfTrack?: (name: string, attributes?: Record<string, string>) => void
    }
}

// The Faro SDK is ~57 KiB gzipped. Importing it statically pulls it into the
// Layout script chunk that every page loads, so it shows up as unused JS on the
// critical path. Instead, dynamically import it when the browser is idle: the
// heavy SDK becomes its own chunk fetched off the critical path, and Web Vitals
// are still captured accurately because Faro's instrumentation reads buffered
// PerformanceObserver entries (LCP/FCP/CLS recorded before init are not lost).
async function bootFaro(): Promise<void> {
    const cfg = window.__cf_faro
    if (!cfg || !cfg.url) return

    try {
        const [{ getWebInstrumentations, initializeFaro, faro }, { TracingInstrumentation }] =
            await Promise.all([
                import('@grafana/faro-web-sdk'),
                import('@grafana/faro-web-tracing'),
            ])

        const user = window.__cf_user

        initializeFaro({
            url: cfg.url,
            app: {
                name: cfg.appName,
                version: cfg.appVersion,
                environment: cfg.environment,
            },
            ...(user ? { user: { id: user.id, username: user.username } } : {}),
            instrumentations: [
                ...getWebInstrumentations(),
                new TracingInstrumentation({
                    instrumentationOptions: {
                        // Only propagate trace headers to our own backend; otherwise
                        // every CDN/3rd-party CORS request gets W3C trace headers
                        // and may reject the preflight.
                        propagateTraceHeaderCorsUrls: [/^https:\/\/[^/]*\.negri\.es\//],
                    },
                }),
            ],
        })

        // Hook for inline (non-module) scripts like the landing CTA tracker,
        // which can't import from the bundle.
        window.__cfTrack = (name, attributes) => {
            try {
                faro.api?.pushEvent(name, attributes)
            } catch {
                // RUM must never break the page.
            }
        }
    } catch {
        // RUM is best-effort; a failed chunk load must never break the page.
    }
}

// Defer to idle so RUM never competes with first paint. `requestIdleCallback`
// isn't in Safari — fall back to a macrotask. The timeout caps how long we wait
// on a busy main thread so sessions aren't silently dropped.
if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => void bootFaro(), { timeout: 3000 })
} else {
    setTimeout(() => void bootFaro(), 1)
}
