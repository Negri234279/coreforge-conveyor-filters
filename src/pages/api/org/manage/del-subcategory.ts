// POST — delete a subcategory from a shared OC; its filters move to the parent category.
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
    const b = body as { subcategoryId?: unknown }
    if (typeof b.subcategoryId !== 'string' || !b.subcategoryId)
        return json({ error: 'Missing subcategoryId' }, 400)

    const sub = db
        .select()
        .from(schema.subcategories)
        .where(eq(schema.subcategories.id, b.subcategoryId))
        .get()
    if (!sub) return json({ error: 'Subcategory not found' }, 404)

    const cat = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, sub.categoryId))
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

    db.transaction((tx) => {
        // Move filters to parent category (no subcategory)
        tx.update(schema.filters)
            .set({ subcategoryId: null })
            .where(eq(schema.filters.subcategoryId, b.subcategoryId as string))
            .run()
        tx.delete(schema.subcategories)
            .where(eq(schema.subcategories.id, b.subcategoryId as string))
            .run()
    })

    return json({ ok: true })
}
