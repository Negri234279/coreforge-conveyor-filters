// POST — reorder the filters of one list (a category's own filters when
// subcategoryId is null, otherwise a subcategory's) inside a shared Open Core.
// Requires owner or admin role.

import type { APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
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
    const b = body as { categoryId?: unknown; subcategoryId?: unknown; orderedIds?: unknown }
    if (typeof b.categoryId !== 'string' || !b.categoryId)
        return json({ error: 'Missing categoryId' }, 400)
    if (!Array.isArray(b.orderedIds)) return json({ error: 'Missing orderedIds' }, 400)
    const categoryId = b.categoryId
    const subcategoryId =
        typeof b.subcategoryId === 'string' && b.subcategoryId ? b.subcategoryId : null
    const orderedIds = b.orderedIds.filter((x): x is string => typeof x === 'string')

    const cat = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, categoryId))
        .get()
    if (!cat || !cat.openCoreId) return json({ error: 'Category not found or not in OC' }, 404)

    const oc = db
        .select()
        .from(schema.openCores)
        .where(eq(schema.openCores.id, cat.openCoreId))
        .get()
    if (!oc || !oc.sharedWithOrg) return json({ error: 'Open Core not shared' }, 403)

    const ocOwner = db
        .select({ orgId: schema.users.orgId })
        .from(schema.users)
        .where(eq(schema.users.id, oc.userId))
        .get()
    if (!ocOwner || ocOwner.orgId !== user.orgId) return json({ error: 'Not available' }, 403)

    // Only reorder filters that actually belong to this exact list.
    const listRows = db
        .select({ id: schema.filters.id, subcategoryId: schema.filters.subcategoryId })
        .from(schema.filters)
        .where(eq(schema.filters.categoryId, categoryId))
        .all()
    const validIds = new Set(
        listRows.filter((r) => (r.subcategoryId ?? null) === subcategoryId).map((r) => r.id),
    )

    const now = Date.now()
    db.transaction((tx) => {
        orderedIds.forEach((id, i) => {
            if (!validIds.has(id)) return
            tx.update(schema.filters)
                .set({ position: i, updatedAt: now })
                .where(eq(schema.filters.id, id))
                .run()
        })
    })

    return json({ ok: true })
}
