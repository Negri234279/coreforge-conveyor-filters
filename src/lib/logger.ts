// Thin structured-logging facade over the OpenTelemetry Logs API.
//
// Why not just use `console`? The console bridge in otel/instrumentation.mjs
// stringifies every argument into the log body, which loses structure: SigNoz
// can't filter by `user_id` or `event_type` if they're baked into one string.
// Here we emit OTel LogRecords with explicit attributes, so SigNoz indexes
// them as columns you can query/aggregate on.
//
// Falls back to plain console output when the SDK hasn't been preloaded
// (`npm run dev` without `:otel`, or tests). No telemetry, no crash.

import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { trace } from '@opentelemetry/api'

const otelLogger = logs.getLogger('coreforge.app')

type Attrs = Record<string, string | number | boolean | null | undefined>

interface LogOpts {
    /** Free-form message. Indexed full-text in SigNoz. */
    message: string
    /** Structured attributes. Stringly-typed values land as columns in ClickHouse. */
    attrs?: Attrs
    /** Attaches the error stack + sets the active span to ERROR if present. */
    err?: unknown
}

function emit(severity: SeverityNumber, severityText: string, opts: LogOpts): void {
    const attributes: Attrs = { ...opts.attrs }
    if (opts.err instanceof Error) {
        attributes['exception.type'] = opts.err.name
        attributes['exception.message'] = opts.err.message
        if (opts.err.stack) attributes['exception.stacktrace'] = opts.err.stack
    } else if (opts.err !== undefined) {
        attributes['exception.message'] = String(opts.err)
    }

    try {
        otelLogger.emit({
            severityNumber: severity,
            severityText,
            body: opts.message,
            attributes: attributes as Record<string, string | number | boolean>,
        })
    } catch {
        // Logger errors must never break the request.
    }

    // Mirror to stdout/stderr so `docker logs` keeps its tail. Don't go
    // through console.* directly because the OTel bridge in instrumentation
    // .mjs would re-emit the same record.
    const line = JSON.stringify({ severity: severityText, message: opts.message, ...attributes })
    if (severity >= SeverityNumber.ERROR) process.stderr.write(line + '\n')
    else process.stdout.write(line + '\n')
}

export const log = {
    debug: (opts: LogOpts) => emit(SeverityNumber.DEBUG, 'DEBUG', opts),
    info: (opts: LogOpts) => emit(SeverityNumber.INFO, 'INFO', opts),
    warn: (opts: LogOpts) => emit(SeverityNumber.WARN, 'WARN', opts),
    error: (opts: LogOpts) => {
        // Promote the active span to ERROR so SigNoz's trace view highlights
        // the request that produced this log, not just the log entry.
        if (opts.err instanceof Error) {
            const span = trace.getActiveSpan()
            if (span) {
                span.recordException(opts.err)
                span.setStatus({ code: 2 /* ERROR */, message: opts.err.message })
            }
        }
        emit(SeverityNumber.ERROR, 'ERROR', opts)
    },
}
