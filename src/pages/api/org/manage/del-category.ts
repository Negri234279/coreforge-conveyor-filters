// POST — delete a category (and all its subcategories/filters) from a shared OC.
// Requires owner or admin role.

import type { APIRoute } from 'astro'
import { eq, inArray } from 'drizzle-orm'
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
    const b = body as { categoryId?: unknown }
    if (typeof b.categoryId !== 'string' || !b.categoryId)
        return json({ error: 'Missing categoryId' }, 400)

    const cat = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, b.categoryId))
        .get()
    if (!cat) return json({ error: 'Category not found' }, 404)
    if (!cat.openCoreId) return json({ error: 'Not an Open Core category' }, 400)

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

    const filters = db
        .select({ id: schema.filters.id })
        .from(schema.filters)
        .where(eq(schema.filters.categoryId, b.categoryId))
        .all()
    const filterIds = filters.map((f) => f.id)

    db.transaction((tx) => {
        if (filterIds.length) {
            tx.delete(schema.filterItems).where(inArray(schema.filterItems.filterId, filterIds)).run()
            tx.delete(schema.filters).where(inArray(schema.filters.id, filterIds)).run()
        }
        tx.delete(schema.subcategories)
            .where(eq(schema.subcategories.categoryId, b.categoryId as string))
            .run()
        tx.delete(schema.categories).where(eq(schema.categories.id, b.categoryId as string)).run()
    })

    return json({ ok: true })
}
