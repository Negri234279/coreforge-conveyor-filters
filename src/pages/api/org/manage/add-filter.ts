// POST — create a filter inside a category that belongs to a shared Open Core.
// Requires owner or admin role.

import type { APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
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
        categoryId?: unknown
        subcategoryId?: unknown
        name?: unknown
        description?: unknown
        coverItemShortname?: unknown
        boxImagePath?: unknown
        boxCount?: unknown
        conveyorCount?: unknown
        storageAdaptorCount?: unknown
        items?: unknown
    }

    if (typeof b.categoryId !== 'string' || !b.categoryId)
        return json({ error: 'Missing categoryId' }, 400)
    if (typeof b.name !== 'string' || !b.name.trim()) return json({ error: 'Missing name' }, 400)
    if (typeof b.coverItemShortname !== 'string' || !b.coverItemShortname)
        return json({ error: 'Missing coverItemShortname' }, 400)

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

    const existingFilters = db
        .select({ id: schema.filters.id })
        .from(schema.filters)
        .where(eq(schema.filters.categoryId, b.categoryId))
        .all()

    const now = Date.now()
    const filterId = nanoid()
    const items = Array.isArray(b.items) ? (b.items as FilterItem[]) : []

    db.transaction((tx) => {
        tx.insert(schema.filters)
            .values({
                id: filterId,
                userId: user.id,
                categoryId: b.categoryId as string,
                subcategoryId:
                    typeof b.subcategoryId === 'string' && b.subcategoryId ? b.subcategoryId : null,
                name: (b.name as string).trim(),
                description:
                    typeof b.description === 'string' && b.description.trim()
                        ? b.description.trim()
                        : null,
                coverItemShortname: b.coverItemShortname as string,
                boxImagePath:
                    typeof b.boxImagePath === 'string' && b.boxImagePath ? b.boxImagePath : null,
                sharedWithOrg: 0,
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
                position: existingFilters.length,
                createdAt: now,
                updatedAt: now,
            })
            .run()
        items.slice(0, 30).forEach((it, pos) => {
            tx.insert(schema.filterItems)
                .values({
                    filterId,
                    shortname: it.shortname,
                    max: Math.max(0, Math.floor(Number(it.max) || 0)),
                    buffer: Math.max(0, Math.floor(Number(it.buffer) || 0)),
                    min: Math.max(0, Math.floor(Number(it.min) || 0)),
                    position: pos,
                })
                .run()
        })
    })

    return json({ id: filterId, categoryId: b.categoryId })
}
