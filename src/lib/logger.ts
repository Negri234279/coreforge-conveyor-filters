// Thin structured-logging facade: one JSON line per record to stdout/stderr.
//
// The container's stdout is tailed by Alloy and pushed to Loki, so this IS the
// log pipeline — there is no in-process log exporter. Each line carries the
// active span's trace_id/span_id, which the Loki datasource's derived field
// turns into a "View trace" link (Tempo), and `docker logs` stays readable.
//
// Works identically with or without the OTel SDK preloaded (`npm run dev`
// without `:otel`, tests): the span lookup just returns nothing.

import { trace } from '@opentelemetry/api'

type Attrs = Record<string, string | number | boolean | null | undefined>

interface LogOpts {
    /** Free-form message. Full-text searchable in Loki. */
    message: string
    /** Structured attributes. Queryable in Loki via `| json`. */
    attrs?: Attrs
    /** Attaches the error stack + sets the active span to ERROR if present. */
    err?: unknown
}

function emit(severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', opts: LogOpts): void {
    const attributes: Attrs = { ...opts.attrs }
    if (opts.err instanceof Error) {
        attributes['exception.type'] = opts.err.name
        attributes['exception.message'] = opts.err.message
        if (opts.err.stack) attributes['exception.stacktrace'] = opts.err.stack
    } else if (opts.err !== undefined) {
        attributes['exception.message'] = String(opts.err)
    }

    const spanContext = trace.getActiveSpan()?.spanContext()

    const line = JSON.stringify({
        severity,
        message: opts.message,
        time: new Date().toISOString(),
        ...(spanContext ? { trace_id: spanContext.traceId, span_id: spanContext.spanId } : {}),
        ...attributes,
    })

    if (severity === 'ERROR') {
        process.stderr.write(line + '\n')
    } else {
        process.stdout.write(line + '\n')
    }
}

export const log = {
    debug: (opts: LogOpts) => emit('DEBUG', opts),
    info: (opts: LogOpts) => emit('INFO', opts),
    warn: (opts: LogOpts) => emit('WARN', opts),
    error: (opts: LogOpts) => {
        // Promote the active span to ERROR so the trace view highlights the
        // request that produced this log, not just the log entry.
        if (opts.err instanceof Error) {
            const span = trace.getActiveSpan()
            if (span) {
                span.recordException(opts.err)
                span.setStatus({ code: 2 /* ERROR */, message: opts.err.message })
            }
        }
        emit('ERROR', opts)
    },
}
