// POST — create a category inside a shared Open Core.
// Requires owner or admin role.

import type { APIRoute } from 'astro'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../../../../db/client'

export const prerender = false

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
}

export const POST: APIRoute = async ({ locals, request }) => {
    const user = locals.user
    if (!user) return json({ error: 'Unauthorized' }, 401)
    if (!user.orgId) return json({ error: 'Not in a clan.' }, 403)
    if (user.orgRole !== 'owner' && user.orgRole !== 'admin')
        return json({ error: 'Only owner or admin can edit shared Open Cores.' }, 403)

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }
    const b = body as { openCoreId?: unknown; name?: unknown }
    if (typeof b.openCoreId !== 'string' || !b.openCoreId)
        return json({ error: 'Missing openCoreId' }, 400)
    if (typeof b.name !== 'string' || !b.name.trim()) return json({ error: 'Missing name' }, 400)

    const oc = db
        .select()
        .from(schema.openCores)
        .where(and(eq(schema.openCores.id, b.openCoreId), eq(schema.openCores.sharedWithOrg, 1)))
        .get()
    if (!oc) return json({ error: 'Open Core not found or not shared' }, 404)

    const ocOwner = db
        .select({ orgId: schema.users.orgId })
        .from(schema.users)
        .where(eq(schema.users.id, oc.userId))
        .get()
    if (!ocOwner || ocOwner.orgId !== user.orgId) return json({ error: 'Not available' }, 403)

    const existingCats = db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(eq(schema.categories.openCoreId, b.openCoreId))
        .all()

    const now = Date.now()
    const id = nanoid()
    db.insert(schema.categories)
        .values({
            id,
            userId: user.id,
            name: b.name.trim(),
            openCoreId: b.openCoreId,
            isOpenCoreFilter: 0,
            sharedWithOrg: 1,
            position: existingCats.length,
            createdAt: now,
            updatedAt: now,
        })
        .run()

    return json({ id, name: b.name.trim() })
}
