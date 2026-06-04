// Generic usage-event logger. Writes one row per event into `events`. Reads
// happen exclusively from the admin dashboard (aggregated). The metadata
// payload is a small JSON blob — keep it short, this table is append-only
// and grows linearly with usage.
//
// In addition to the DB write, every logged event is mirrored to the active
// trace as a span event. That makes it trivial in SigNoz to follow a single
// request across HTTP span -> SQL span -> "filter_create" event -> response,
// or to filter traces by `app.event.type`.
//
// Catch-all error swallow: instrumentation must never break a user-facing
// request. If the DB write fails we emit a structured ERROR log (which also
// marks the active span as failed) and move on.

import { trace } from '@opentelemetry/api'
import { db, schema } from '../db/client'
import { log } from './logger'

export type EventType =
    | 'user_register'
    | 'user_login'
    | 'user_login_google'
    | 'user_link_google'
    | 'user_unlink_google'
    | 'category_clone'
    | 'filter_clone'
    | 'opencore_clone'
    | 'filter_create'
    | 'filter_update'
    | 'filter_delete'
    | 'category_create'
    | 'category_update'
    | 'category_delete'
    | 'subcategory_create'
    | 'subcategory_update'
    | 'subcategory_delete'
    | 'filter_export_json'
    | 'filter_view_shared'
    | 'category_view_shared'
    | 'org_create'
    | 'org_join'
    | 'org_leave'
    | 'org_delete'
    | 'landing_google_cta'
    | 'opencore_layout_create'
    | 'opencore_layout_update'
    | 'opencore_layout_delete'
    | 'opencore_layout_view_shared'

export function logEvent(
    type: EventType,
    opts: {
        userId?: string | null
        userName?: string | null
        targetId?: string | null
        metadata?: unknown
    } = {},
): void {
    const userId = opts.userId ?? null
    const userName = opts.userName ?? null
    const targetId = opts.targetId ?? null

    // Annotate the active server span so traces carry the business event
    // alongside the auto-instrumented HTTP/SQL spans. Cheap and unconditional.
    const span = trace.getActiveSpan()
    if (span) {
        span.addEvent('app.event_logged', {
            'app.event.type': type,
            ...(userId ? { 'enduser.id': userId } : {}),
            ...(userName ? { 'enduser.username': userName } : {}),
            ...(targetId ? { 'app.target.id': targetId } : {}),
        })
    }

    try {
        const meta = opts.metadata === undefined ? null : JSON.stringify(opts.metadata)
        db.insert(schema.events)
            .values({
                userId,
                type,
                targetId,
                metadata: meta,
                createdAt: Date.now(),
            })
            .run()

        // Also surface the event as a structured log line so SigNoz's Logs
        // view doubles as a business-event feed (filterable by app.event.type
        // / enduser.username). The span event above is what you want when
        // tracing a single request; this log is what you want when sweeping
        // by user or time range.
        // Scannable single-line body: "<event> target=<id> by <user>". The
        // structured attrs duplicate the same data so SigNoz can still
        // filter/group on each field individually.
        const parts: string[] = [type]
        if (targetId) parts.push(`target=${targetId}`)
        if (userName) parts.push(`by ${userName}`)
        log.info({
            message: parts.join(' '),
            attrs: {
                'app.event.type': type,
                'enduser.id': userId,
                'enduser.username': userName,
                'app.target.id': targetId,
            },
        })
    } catch (err) {
        log.error({
            message: 'events: failed to persist usage event',
            attrs: {
                'app.event.type': type,
                'enduser.id': userId,
                'enduser.username': userName,
                'app.target.id': targetId,
            },
            err,
        })
    }
}
