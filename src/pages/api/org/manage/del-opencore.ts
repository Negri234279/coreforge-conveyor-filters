// POST — permanently delete a clan-shared Open Core and all its data.
// Allowed for: the OC owner, or a clan owner/admin in the same org.

import type { APIRoute } from 'astro'
import { and, eq, inArray } from 'drizzle-orm'
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

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }
    const b = body as { openCoreId?: unknown }
    if (typeof b.openCoreId !== 'string' || !b.openCoreId)
        return json({ error: 'Missing openCoreId' }, 400)

    const oc = db
        .select()
        .from(schema.openCores)
        .where(and(eq(schema.openCores.id, b.openCoreId), eq(schema.openCores.sharedWithOrg, 1)))
        .get()
    if (!oc) return json({ error: 'Open Core not found' }, 404)

    // Verify requester is the owner OR a clan owner/admin in the same org.
    const ocOwner = db
        .select({ orgId: schema.users.orgId })
        .from(schema.users)
        .where(eq(schema.users.id, oc.userId))
        .get()
    if (!ocOwner || ocOwner.orgId !== user.orgId) return json({ error: 'Not available' }, 403)

    const isOwnerOfOc = oc.userId === user.id
    const isOrgAdmin = user.orgRole === 'owner' || user.orgRole === 'admin'
    if (!isOwnerOfOc && !isOrgAdmin) return json({ error: 'Forbidden' }, 403)

    // Delete full tree inside a transaction.
    const cats = db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(eq(schema.categories.openCoreId, oc.id))
        .all()
    const catIds = cats.map((c) => c.id)

    const filterIds = catIds.length
        ? db
              .select({ id: schema.filters.id })
              .from(schema.filters)
              .where(inArray(schema.filters.categoryId, catIds))
              .all()
              .map((f) => f.id)
        : []

    db.transaction((tx) => {
        if (filterIds.length) {
            tx.delete(schema.filterItems)
                .where(inArray(schema.filterItems.filterId, filterIds))
                .run()
            tx.delete(schema.filters).where(inArray(schema.filters.id, filterIds)).run()
        }
        if (catIds.length) {
            tx.delete(schema.subcategories)
                .where(inArray(schema.subcategories.categoryId, catIds))
                .run()
            tx.delete(schema.categories).where(inArray(schema.categories.id, catIds)).run()
        }
        tx.delete(schema.openCores).where(eq(schema.openCores.id, oc.id)).run()
    })

    return json({ ok: true })
}
