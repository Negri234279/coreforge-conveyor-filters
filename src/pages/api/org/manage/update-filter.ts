// POST — update a filter that belongs to a shared Open Core.
// Requires owner or admin role.

import type { APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../../../db/client'
import type { FilterItem } from '../../../../types'

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
    const b = body as {
        filterId?: unknown
        name?: unknown
        description?: unknown
        coverItemShortname?: unknown
        boxImagePath?: unknown
        boxCount?: unknown
        conveyorCount?: unknown
        storageAdaptorCount?: unknown
        items?: unknown
    }

    if (typeof b.filterId !== 'string' || !b.filterId)
        return json({ error: 'Missing filterId' }, 400)
    if (typeof b.name !== 'string' || !b.name.trim()) return json({ error: 'Missing name' }, 400)
    if (typeof b.coverItemShortname !== 'string' || !b.coverItemShortname)
        return json({ error: 'Missing coverItemShortname' }, 400)

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

    const items = Array.isArray(b.items) ? (b.items as FilterItem[]) : []

    db.transaction((tx) => {
        tx.update(schema.filters)
            .set({
                name: (b.name as string).trim(),
                description:
                    typeof b.description === 'string' && b.description.trim()
                        ? b.description.trim()
                        : null,
                coverItemShortname: b.coverItemShortname as string,
                boxImagePath:
                    typeof b.boxImagePath === 'string' && b.boxImagePath ? b.boxImagePath : null,
                boxCount:
                    typeof b.boxCount === 'number' && b.boxCount >= 0 ? Math.floor(b.boxCount) : 1,
                conveyorCount:
                    typeof b.conveyorCount === 'number' && b.conveyorCount >= 0
                        ? Math.floor(b.conveyorCount)
                        : 1,
                storageAdaptorCount:
                    typeof b.storageAdaptorCount === 'number' && b.storageAdaptorCount >= 0
                        ? Math.floor(b.storageAdaptorCount)
                        : 1,
                updatedAt: Date.now(),
            })
            .where(eq(schema.filters.id, b.filterId as string))
            .run()
        tx.delete(schema.filterItems)
            .where(eq(schema.filterItems.filterId, b.filterId as string))
            .run()
        items.slice(0, 30).forEach((it, pos) => {
            tx.insert(schema.filterItems)
                .values({
                    filterId: b.filterId as string,
                    shortname: it.shortname,
                    max: Math.max(0, Math.floor(Number(it.max) || 0)),
                    buffer: Math.max(0, Math.floor(Number(it.buffer) || 0)),
                    min: Math.max(0, Math.floor(Number(it.min) || 0)),
                    position: pos,
                })
                .run()
        })
    })

    return json({ ok: true })
}
