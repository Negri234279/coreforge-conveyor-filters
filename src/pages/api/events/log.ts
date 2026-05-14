// POST /api/events/log — client-side event beacon. Strict allowlist of event
// types so a malicious client can't fill the table with garbage. Optional
// targetId points at the entity the event is about (filter id, category id…).

import type { APIRoute } from 'astro'
import { logEvent, type EventType } from '../../../lib/events'

export const prerender = false

const CLIENT_ALLOWED: ReadonlySet<EventType> = new Set([
    'filter_export_json',
    'filter_view_shared',
])

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
}

export const POST: APIRoute = async ({ locals, request }) => {
    const user = locals.user!
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }
    const p = (body ?? {}) as { type?: unknown; targetId?: unknown; metadata?: unknown }
    const type = typeof p.type === 'string' ? (p.type as EventType) : null
    if (!type || !CLIENT_ALLOWED.has(type)) return json({ error: 'Unknown event type' }, 400)

    const targetId =
        typeof p.targetId === 'string' && p.targetId.length <= 64 ? p.targetId : null

    // Keep metadata small — this is a beacon, not a payload pipe.
    let metadata: unknown = undefined
    if (p.metadata && typeof p.metadata === 'object') {
        const s = JSON.stringify(p.metadata)
        if (s.length <= 1000) metadata = p.metadata
    }

    logEvent(type, { userId: user.id, targetId, metadata })
    return json({ ok: true })
}
