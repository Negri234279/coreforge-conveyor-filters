// POST — delete a filter from a shared Open Core.
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
    const b = body as { filterId?: unknown }
    if (typeof b.filterId !== 'string' || !b.filterId)
        return json({ error: 'Missing filterId' }, 400)

    const filter = db.select().from(schema.filters).where(eq(schema.filters.id, b.filterId)).get()
    if (!filter) return json({ error: 'Filter not found' }, 404)

    const cat = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, filter.categoryId))
        .get()
    if (!cat || !cat.openCoreId) return json({ error: 'Not in an Open Core' }, 400)

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
        tx.delete(schema.filterItems)
            .where(eq(schema.filterItems.filterId, b.filterId as string))
            .run()
        tx.delete(schema.filters)
            .where(eq(schema.filters.id, b.filterId as string))
            .run()
    })

    return json({ ok: true })
}
