// OpenTelemetry bootstrap. Preloaded via `node --import` so it runs before any
// app code; the auto-instrumentations hook require/import to wrap http, fetch,
// better-sqlite3, etc. before they're cached.
//
// This file is intentionally OUTSIDE src/ so Astro/Vite don't bundle it. It
// stays as a plain ESM module that Node loads as-is.
//
// Scope: TRACES ONLY, exported straight to Tempo over OTLP http/protobuf.
//   - Logs never leave the process: src/lib/logger.ts writes JSON lines
//     (with trace_id/span_id) to stdout and Alloy tails the container → Loki.
//   - Metrics are pull-based: prom-client serves /metrics (src/pages/
//     metrics.ts) and the stack's Prometheus scrapes it.
//
// If OTEL_EXPORTER_OTLP_ENDPOINT is unset the SDK falls back to localhost,
// which spams the logs in dev — short-circuit to a no-op in that case so
// running `node dist/server/entry.mjs` locally still works without the
// observability stack.

import process from 'node:process'

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
if (!endpoint) {
    // No telemetry endpoint -> instrumentation is a no-op. Keep the file
    // side-effect free past this line so dev/CI runs are unaffected.
    process.env.OTEL_SDK_DISABLED = 'true'
} else {
    // sdk-node ≥0.200 auto-configures metric/log OTLP exporters from env and
    // defaults both to "otlp" when unset — but OTEL_EXPORTER_OTLP_ENDPOINT
    // points at Tempo, which only accepts traces (/v1/metrics|logs → 404
    // "Not Found" every export interval). Metrics are pull-based (prom-client
    // /metrics) and logs go stdout → Alloy → Loki, so force both push
    // pipelines off unless explicitly overridden.
    process.env.OTEL_METRICS_EXPORTER ??= 'none'
    process.env.OTEL_LOGS_EXPORTER ??= 'none'

    const { NodeSDK } = await import('@opentelemetry/sdk-node')
    const { getNodeAutoInstrumentations } =
        await import('@opentelemetry/auto-instrumentations-node')
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-proto')
    const { trace, SpanStatusCode } = await import('@opentelemetry/api')
    const { resourceFromAttributes } = await import('@opentelemetry/resources')
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } =
        await import('@opentelemetry/semantic-conventions')

    // Pull the app version out of package.json so Grafana/Tempo can split
    // telemetry by release. package.json is copied into the runtime image
    // alongside node_modules/ and dist/. The CI gate guarantees one tag = one
    // version = one git SHA, so service.version stays clean ("1.7.0", not
    // "1.7.0+8f3c2a1").
    let serviceVersion = process.env.OTEL_SERVICE_VERSION
    if (!serviceVersion) {
        try {
            const pkg = await import('../package.json', { with: { type: 'json' } })
            serviceVersion = pkg.default?.version
        } catch {
            // package.json not present in this layout; leave undefined.
        }
    }

    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'coreforge',
        ...(serviceVersion ? { [ATTR_SERVICE_VERSION]: serviceVersion } : {}),
    })

    const sdk = new NodeSDK({
        resource,
        traceExporter: new OTLPTraceExporter(),
        instrumentations: [
            getNodeAutoInstrumentations({
                // The fs instrumentation is extremely noisy and rarely useful.
                // Static asset reads in particular create a span per request.
                '@opentelemetry/instrumentation-fs': { enabled: false },
                // Drop traces for the Docker liveness probe and the Prometheus
                // scrape — every 15-30s would otherwise inflate request rate
                // and skew P95 toward "trivial GET".
                '@opentelemetry/instrumentation-http': {
                    ignoreIncomingRequestHook: (req) =>
                        req.url === '/api/healthz' || req.url === '/metrics',
                },
            }),
        ],
    })

    sdk.start()

    // ----- Uncaught error capture ----------------------------------------
    // Astro catches request-scoped errors itself, but anything thrown outside
    // a request (background timers, unawaited promises) lands here. Mark the
    // active span (if any) and write a FATAL JSON line to stderr — Alloy tails
    // the container, so it reaches Loki like every other log.
    const captureFatal = (kind, err) => {
        try {
            const span = trace.getActiveSpan()
            if (span && err instanceof Error) {
                span.recordException(err)
                span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
            }
            const body = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
            process.stderr.write(
                JSON.stringify({
                    severity: 'FATAL',
                    message: body,
                    'exception.kind': kind,
                    time: new Date().toISOString(),
                }) + '\n',
            )
        } catch {}
    }
    process.on('uncaughtException', (err) => captureFatal('uncaughtException', err))
    process.on('unhandledRejection', (err) => captureFatal('unhandledRejection', err))

    // Best-effort flush on shutdown so the last second of telemetry isn't
    // lost when the container receives SIGTERM.
    const shutdown = async (signal) => {
        try {
            await sdk.shutdown()
        } catch {}
        process.kill(process.pid, signal)
    }
    process.once('SIGTERM', () => shutdown('SIGTERM'))
    process.once('SIGINT', () => shutdown('SIGINT'))
}
