// OpenTelemetry bootstrap. Preloaded via `node --import` so it runs before any
// app code; the auto-instrumentations hook require/import to wrap http, fetch,
// pino, better-sqlite3, etc. before they're cached.
//
// This file is intentionally OUTSIDE src/ so Astro/Vite don't bundle it. It
// stays as a plain ESM module that Node loads as-is.
//
// If OTEL_EXPORTER_OTLP_ENDPOINT is unset the SDK falls back to localhost,
// which spams the logs in dev — short-circuit to a no-op in that case so
// running `node dist/server/entry.mjs` locally still works without SigNoz.

import process from 'node:process'

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
if (!endpoint) {
    // No telemetry endpoint -> instrumentation is a no-op. Keep the file
    // side-effect free past this line so dev/CI runs are unaffected.
    process.env.OTEL_SDK_DISABLED = 'true'
} else {
    const { NodeSDK } = await import('@opentelemetry/sdk-node')
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node')
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-grpc')
    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-grpc')
    const { OTLPLogExporter } = await import('@opentelemetry/exporter-logs-otlp-grpc')
    const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics')
    const { BatchLogRecordProcessor } = await import('@opentelemetry/sdk-logs')
    const { logs } = await import('@opentelemetry/api-logs')
    const { trace, SpanStatusCode } = await import('@opentelemetry/api')
    const { resourceFromAttributes } = await import('@opentelemetry/resources')
    const {
        ATTR_SERVICE_NAME,
        ATTR_SERVICE_VERSION,
    } = await import('@opentelemetry/semantic-conventions')

    // Pull the app version out of package.json so SigNoz can split metrics
    // by release. package.json is copied into the runtime image alongside
    // node_modules/ and dist/. The CI gate guarantees one tag = one version =
    // one git SHA, so the SHA itself lives only in the image OCI label
    // (`docker inspect` to retrieve) — keeping service.version clean ("1.7.0"
    // not "1.7.0+8f3c2a1") makes SigNoz dashboards readable at a glance.
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
        metricReader: new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter(),
            exportIntervalMillis: 30_000,
        }),
        logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
        instrumentations: [
            getNodeAutoInstrumentations({
                // The fs instrumentation is extremely noisy and rarely useful.
                // Static asset reads in particular create a span per request.
                '@opentelemetry/instrumentation-fs': { enabled: false },
                // Drop traces for the Docker liveness probe — every 30s would
                // otherwise inflate request rate and skew P95 toward "trivial
                // GET". Filtering by exact path is robust across loopback,
                // reverse-proxy and orchestrator-injected callers alike.
                '@opentelemetry/instrumentation-http': {
                    ignoreIncomingRequestHook: (req) => req.url === '/api/healthz',
                },
            }),
        ],
    })

    sdk.start()

    // ----- Boot heartbeat ------------------------------------------------
    // Emit one INFO log right after the SDK starts so you can verify the
    // logs pipeline end-to-end in SigNoz without having to trigger an error
    // first. Visible in the Logs view within ~5-10s (BatchLogRecordProcessor
    // flush interval).
    const bootLogger = logs.getLogger('coreforge.boot', serviceVersion ?? '0.0.0')
    bootLogger.emit({
        severityNumber: 9, // INFO
        severityText: 'INFO',
        body: 'coreforge.otel: SDK started',
        attributes: {
            'service.name': process.env.OTEL_SERVICE_NAME ?? 'coreforge',
            'service.version': serviceVersion ?? 'unknown',
            'deployment.environment':
                process.env.NODE_ENV === 'production' ? 'production' : 'development',
            'process.pid': process.pid,
        },
    })

    // ----- console.* -> OTel logs bridge ---------------------------------
    // Auto-instrumentation covers pino/winston/bunyan but not raw console.
    // CoreForge uses console.error in a couple of places (e.g. lib/events.ts);
    // mirror those to OTel so they show up in SigNoz Logs alongside everything
    // else, while preserving stdout/stderr for `docker logs`.
    const otelLogger = logs.getLogger('coreforge.console', serviceVersion ?? '0.0.0')
    const severityFor = {
        debug: 5, // DEBUG
        log: 9, // INFO
        info: 9,
        warn: 13, // WARN
        error: 17, // ERROR
    }
    for (const method of /** @type {const} */ (['debug', 'log', 'info', 'warn', 'error'])) {
        const original = console[method].bind(console)
        console[method] = (...args) => {
            try {
                otelLogger.emit({
                    severityNumber: severityFor[method],
                    severityText: method.toUpperCase(),
                    body: args
                        .map((a) =>
                            a instanceof Error
                                ? `${a.message}\n${a.stack ?? ''}`
                                : typeof a === 'string'
                                  ? a
                                  : safeStringify(a),
                        )
                        .join(' '),
                })
            } catch {
                // Never let the logger crash the app.
            }
            original(...args)
        }
    }

    // ----- Uncaught error capture ----------------------------------------
    // Astro catches request-scoped errors itself, but anything thrown outside
    // a request (background timers, unawaited promises) lands here. Emit an
    // OTel exception event + log so SigNoz surfaces it.
    const captureFatal = (kind, err) => {
        try {
            const span = trace.getActiveSpan()
            if (span && err instanceof Error) {
                span.recordException(err)
                span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
            }
            otelLogger.emit({
                severityNumber: 21, // FATAL
                severityText: 'FATAL',
                body: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err),
                attributes: { 'exception.kind': kind },
            })
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

function safeStringify(value) {
    try {
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}
