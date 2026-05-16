// Browser RUM bootstrap. Mounted from Layout.astro as a `<script>` block so
// Vite bundles it into a client-side chunk. The collector endpoint is passed
// at render time via `window.__cf_otel` (runtime-configurable through the
// PUBLIC_OTEL_RUM_ENDPOINT env var on the server container).
//
// Sends traces + logs to <endpoint>/v1/traces and <endpoint>/v1/logs over
// OTLP/HTTP+JSON. No metrics from the browser — the metrics SDK is heavier
// and SigNoz already gets RED metrics from the backend's HTTP spans.

import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { ZoneContextManager } from '@opentelemetry/context-zone'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { logs } from '@opentelemetry/api-logs'

declare global {
    interface Window {
        __cf_otel?: { endpoint: string; serviceName: string; serviceVersion?: string }
    }
}

const cfg = window.__cf_otel
if (cfg && cfg.endpoint) {
    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: cfg.serviceName,
        ...(cfg.serviceVersion ? { [ATTR_SERVICE_VERSION]: cfg.serviceVersion } : {}),
        'browser.user_agent': navigator.userAgent,
    })

    // ----- Traces --------------------------------------------------------
    const traceProvider = new WebTracerProvider({
        resource,
        spanProcessors: [
            new BatchSpanProcessor(new OTLPTraceExporter({ url: `${cfg.endpoint}/v1/traces` })),
        ],
    })
    // ZoneContextManager keeps the active span across async boundaries
    // (Preact effects, fetch handlers, event listeners).
    traceProvider.register({ contextManager: new ZoneContextManager() })

    registerInstrumentations({
        instrumentations: [
            getWebAutoInstrumentations({
                '@opentelemetry/instrumentation-document-load': {},
                '@opentelemetry/instrumentation-fetch': {
                    // Only propagate trace headers to our own backend; otherwise
                    // every CDN/3rd-party CORS request gets W3C trace headers
                    // and may reject the preflight.
                    propagateTraceHeaderCorsUrls: [/^https:\/\/[^/]*\.negri\.es\//],
                    clearTimingResources: true,
                },
                '@opentelemetry/instrumentation-xml-http-request': {
                    propagateTraceHeaderCorsUrls: [/^https:\/\/[^/]*\.negri\.es\//],
                },
                '@opentelemetry/instrumentation-user-interaction': {
                    eventNames: ['click', 'submit'],
                },
            }),
        ],
    })

    // ----- Logs (window.onerror + unhandledrejection) --------------------
    const loggerProvider = new LoggerProvider({
        resource,
        processors: [
            new BatchLogRecordProcessor(new OTLPLogExporter({ url: `${cfg.endpoint}/v1/logs` })),
        ],
    })
    logs.setGlobalLoggerProvider(loggerProvider)
    const logger = logs.getLogger('coreforge.browser', cfg.serviceVersion ?? '0.0.0')

    window.addEventListener('error', (ev) => {
        const err = ev.error
        logger.emit({
            severityNumber: 17,
            severityText: 'ERROR',
            body: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(ev.message),
            attributes: {
                'browser.error.source': ev.filename ?? '',
                'browser.error.lineno': ev.lineno ?? 0,
                'browser.error.colno': ev.colno ?? 0,
                'browser.url': location.href,
            },
        })
    })
    window.addEventListener('unhandledrejection', (ev) => {
        const reason = ev.reason
        logger.emit({
            severityNumber: 17,
            severityText: 'ERROR',
            body:
                reason instanceof Error
                    ? `${reason.message}\n${reason.stack ?? ''}`
                    : typeof reason === 'string'
                      ? reason
                      : JSON.stringify(reason),
            attributes: {
                'exception.kind': 'unhandledrejection',
                'browser.url': location.href,
            },
        })
    })

    // Flush on page hide — sendBeacon is the only reliable transport here,
    // but the OTLP HTTP exporter already falls back to it on `pagehide`.
    addEventListener('pagehide', () => {
        traceProvider.forceFlush().catch(() => {})
        loggerProvider.forceFlush().catch(() => {})
    })
}
