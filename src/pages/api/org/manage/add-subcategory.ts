// POST — add a subcategory to a category in a shared Open Core.
// Requires owner or admin role.

import type { APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
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
    const b = body as { categoryId?: unknown; name?: unknown }
    if (typeof b.categoryId !== 'string' || !b.categoryId)
        return json({ error: 'Missing categoryId' }, 400)
    if (typeof b.name !== 'string' || !b.name.trim()) return json({ error: 'Missing name' }, 400)

    const cat = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, b.categoryId))
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

    const existingSubs = db
        .select({ id: schema.subcategories.id })
        .from(schema.subcategories)
        .where(eq(schema.subcategories.categoryId, b.categoryId))
        .all()

    const now = Date.now()
    const id = nanoid()
    db.insert(schema.subcategories)
        .values({
            id,
            categoryId: b.categoryId,
            name: b.name.trim(),
            position: existingSubs.length,
            createdAt: now,
            updatedAt: now,
        })
        .run()

    return json({ id, name: b.name.trim() })
}
