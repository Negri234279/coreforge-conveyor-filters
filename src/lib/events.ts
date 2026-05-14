// Generic usage-event logger. Writes one row per event into `events`. Reads
// happen exclusively from the admin dashboard (aggregated). The metadata
// payload is a small JSON blob — keep it short, this table is append-only
// and grows linearly with usage.
//
// Catch-all error swallow: instrumentation must never break a user-facing
// request. If the DB write fails we log to stderr and move on.

import { db, schema } from '../db/client'

export type EventType =
    | 'user_register'
    | 'user_login'
    | 'category_clone'
    | 'filter_clone'
    | 'filter_create'
    | 'filter_update'
    | 'filter_delete'
    | 'category_create'
    | 'category_update'
    | 'category_delete'
    | 'filter_export_json'
    | 'filter_view_shared'
    | 'category_view_shared'
    | 'org_create'
    | 'org_join'
    | 'org_leave'
    | 'org_delete'

export function logEvent(
    type: EventType,
    opts: { userId?: string | null; targetId?: string | null; metadata?: unknown } = {},
): void {
    try {
        const meta = opts.metadata === undefined ? null : JSON.stringify(opts.metadata)
        db.insert(schema.events)
            .values({
                userId: opts.userId ?? null,
                type,
                targetId: opts.targetId ?? null,
                metadata: meta,
                createdAt: Date.now(),
            })
            .run()
    } catch (err) {
        console.error('[events] failed to log', type, err)
    }
}
