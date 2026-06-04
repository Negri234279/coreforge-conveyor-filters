import type { APIRoute } from 'astro'
import { eq } from 'drizzle-orm'

import { db, schema } from '../../../db/client'
import { logEvent } from '../../../lib/events'
import { canEditLayout, canViewLayout } from '../../../lib/openCore/access'
import type { BoxAssignment, OpenCoreLayout } from '../../../types'

export const prerender = false

const MAX_ASSIGNMENTS = 500
const MAX_NAME = 120
const MAX_SOURCE_JSON_BYTES = 2 * 1024 * 1024 // 2 MB

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
        },
    })
}

function trimStr(v: unknown, max = MAX_NAME): string {
    if (typeof v !== 'string') return ''
    return v.trim().slice(0, max)
}

function parseAssignments(raw: string): BoxAssignment[] {
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed as BoxAssignment[]
    } catch {
        // ignore
    }
    return []
}

function buildLayout(
    row: typeof schema.openCoreLayouts.$inferSelect,
    owner: { id: string; username: string },
    canEdit: boolean,
): OpenCoreLayout {
    return {
        id: row.id,
        openCoreId: row.openCoreId ?? null,
        name: row.name,
        sharedWithOrg: row.sharedWithOrg === 1,
        sourceJson: row.sourceJson,
        assignments: parseAssignments(row.assignmentsJson),
        owner,
        canEdit,
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),
    }
}

export const GET: APIRoute = ({ locals, params }) => {
    const user = locals.user!
    const { id } = params
    if (!id) return json({ error: 'Missing id' }, 400)

    const row = db
        .select()
        .from(schema.openCoreLayouts)
        .where(eq(schema.openCoreLayouts.id, id))
        .get()
    if (!row) return json({ error: 'Not found' }, 404)

    // Resolve owner's orgId for permission checks
    const ownerUser = db
        .select({ id: schema.users.id, username: schema.users.username, orgId: schema.users.orgId })
        .from(schema.users)
        .where(eq(schema.users.id, row.userId))
        .get()
    const ownerOrgId = ownerUser?.orgId ?? null

    // Visibility inherits from the open core's sharedWithOrg if not set on the layout itself
    let isShared = row.sharedWithOrg === 1
    if (!isShared && row.openCoreId) {
        const oc = db
            .select({ sharedWithOrg: schema.openCores.sharedWithOrg })
            .from(schema.openCores)
            .where(eq(schema.openCores.id, row.openCoreId))
            .get()
        isShared = (oc?.sharedWithOrg ?? 0) === 1
    }

    const canView = canViewLayout({
        layoutUserId: row.userId,
        layoutSharedWithOrg: isShared,
        ownerOrgId,
        user: { id: user.id, orgId: user.orgId },
    })
    if (!canView) return json({ error: 'Forbidden' }, 403)

    const canEdit = canEditLayout({
        layoutUserId: row.userId,
        layoutSharedWithOrg: isShared,
        ownerOrgId,
        user: { id: user.id, orgId: user.orgId, orgRole: user.orgRole },
    })

    const owner = ownerUser
        ? { id: ownerUser.id, username: ownerUser.username }
        : { id: row.userId, username: '' }

    // Log shared view for non-owners
    if (user.id !== row.userId && row.sharedWithOrg === 1) {
        logEvent('opencore_layout_view_shared', {
            userId: user.id,
            userName: user.username,
            targetId: id,
        })
    }

    return json({ layout: buildLayout(row, owner, canEdit) })
}

export const PUT: APIRoute = async ({ locals, params, request }) => {
    const user = locals.user!
    const { id } = params
    if (!id) return json({ error: 'Missing id' }, 400)

    const row = db
        .select()
        .from(schema.openCoreLayouts)
        .where(eq(schema.openCoreLayouts.id, id))
        .get()
    if (!row) return json({ error: 'Not found' }, 404)

    const ownerUser = db
        .select({ orgId: schema.users.orgId })
        .from(schema.users)
        .where(eq(schema.users.id, row.userId))
        .get()
    const ownerOrgId = ownerUser?.orgId ?? null

    let isShared = row.sharedWithOrg === 1
    if (!isShared && row.openCoreId) {
        const oc = db
            .select({ sharedWithOrg: schema.openCores.sharedWithOrg })
            .from(schema.openCores)
            .where(eq(schema.openCores.id, row.openCoreId))
            .get()
        isShared = (oc?.sharedWithOrg ?? 0) === 1
    }

    const canEdit = canEditLayout({
        layoutUserId: row.userId,
        layoutSharedWithOrg: isShared,
        ownerOrgId,
        user: { id: user.id, orgId: user.orgId, orgRole: user.orgRole },
    })
    if (!canEdit) return json({ error: 'Forbidden' }, 403)

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }

    const b = (body ?? {}) as Record<string, unknown>

    const updates: Partial<typeof schema.openCoreLayouts.$inferInsert> = {}
    updates.updatedAt = Date.now()

    // name (optional)
    if (b.name !== undefined) {
        const name = trimStr(b.name)
        if (name.length > 0) updates.name = name
    }

    // sharedWithOrg — only the layout owner may change this
    if (b.sharedWithOrg !== undefined && user.id === row.userId) {
        updates.sharedWithOrg = user.orgId ? (b.sharedWithOrg === true ? 1 : 0) : 0
    }

    // sourceJson — owner-only "replace base file". Validated like POST: must be
    // a CopyPaste export with an entities array, capped at 2 MB.
    if (b.sourceJson !== undefined && user.id === row.userId) {
        if (typeof b.sourceJson !== 'string') {
            return json({ error: 'sourceJson must be a string' }, 400)
        }
        if (b.sourceJson.length > MAX_SOURCE_JSON_BYTES) {
            return json({ error: 'Payload too large (max 2 MB)' }, 413)
        }
        try {
            const parsed = JSON.parse(b.sourceJson)
            if (
                !parsed ||
                typeof parsed !== 'object' ||
                !Array.isArray((parsed as Record<string, unknown>).entities)
            ) {
                return json({ error: 'sourceJson must be a CopyPaste export' }, 400)
            }
        } catch {
            return json({ error: 'sourceJson is not valid JSON' }, 400)
        }
        updates.sourceJson = b.sourceJson
    }

    // assignments (optional)
    if (Array.isArray(b.assignments)) {
        const seen = new Map<string, string>()
        for (const entry of b.assignments) {
            if (!entry || typeof entry !== 'object') continue
            const e = entry as Record<string, unknown>
            const boxKey = trimStr(e.boxKey, 64)
            const filterId = trimStr(e.filterId, 64)
            if (!boxKey || !filterId) continue
            seen.set(boxKey, filterId) // last wins on duplicate boxKey
            if (seen.size >= MAX_ASSIGNMENTS) break
        }
        const assignments: BoxAssignment[] = Array.from(seen.entries()).map(
            ([boxKey, filterId]) => ({
                boxKey,
                filterId,
            }),
        )
        updates.assignmentsJson = JSON.stringify(assignments)
    }

    db.update(schema.openCoreLayouts).set(updates).where(eq(schema.openCoreLayouts.id, id)).run()

    logEvent('opencore_layout_update', {
        userId: user.id,
        userName: user.username,
        targetId: id,
    })

    return json({ ok: true })
}

export const DELETE: APIRoute = ({ locals, params }) => {
    const user = locals.user!
    const { id } = params
    if (!id) return json({ error: 'Missing id' }, 400)

    const row = db
        .select({ userId: schema.openCoreLayouts.userId })
        .from(schema.openCoreLayouts)
        .where(eq(schema.openCoreLayouts.id, id))
        .get()
    if (!row) return json({ error: 'Not found' }, 404)
    if (row.userId !== user.id) return json({ error: 'Forbidden' }, 403)

    db.delete(schema.openCoreLayouts).where(eq(schema.openCoreLayouts.id, id)).run()

    logEvent('opencore_layout_delete', {
        userId: user.id,
        userName: user.username,
        targetId: id,
    })

    return json({ ok: true })
}
