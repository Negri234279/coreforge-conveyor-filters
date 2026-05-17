// POST — clone the caller's personal Open Core as an independent clan copy.
// The original remains private (sharedWithOrg = 0). The clone gets
// sharedWithOrg = 1 and is editable by clan owner/admin.
// Requires the caller to be in a clan.

import type { APIRoute } from 'astro'
import { eq, inArray } from 'drizzle-orm'
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

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }
    const b = body as { openCoreId?: unknown }
    if (typeof b.openCoreId !== 'string' || !b.openCoreId)
        return json({ error: 'Missing openCoreId' }, 400)

    const srcOc = db
        .select()
        .from(schema.openCores)
        .where(eq(schema.openCores.id, b.openCoreId))
        .get()
    if (!srcOc || srcOc.userId !== user.id)
        return json({ error: 'Open Core not found' }, 404)

    // Fetch the full tree
    const srcCats = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.openCoreId, srcOc.id))
        .all()
    const srcCatIds = srcCats.map((c) => c.id)
    const srcSubs = srcCatIds.length
        ? db
              .select()
              .from(schema.subcategories)
              .where(inArray(schema.subcategories.categoryId, srcCatIds))
              .all()
        : []
    const srcFilters = srcCatIds.length
        ? db
              .select()
              .from(schema.filters)
              .where(inArray(schema.filters.categoryId, srcCatIds))
              .all()
        : []
    const srcFilterIds = srcFilters.map((f) => f.id)
    const srcItems = srcFilterIds.length
        ? db
              .select()
              .from(schema.filterItems)
              .where(inArray(schema.filterItems.filterId, srcFilterIds))
              .all()
        : []

    const now = Date.now()
    const newOcId = nanoid()
    const catIdMap = new Map<string, string>()
    const subIdMap = new Map<string, string>()
    for (const c of srcCats) catIdMap.set(c.id, nanoid())
    for (const s of srcSubs) subIdMap.set(s.id, nanoid())

    const existingCatCount = db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(eq(schema.categories.userId, user.id))
        .all().length

    db.transaction((tx) => {
        tx.insert(schema.openCores)
            .values({
                id: newOcId,
                userId: user.id,
                name: srcOc.name,
                sharedWithOrg: 1,
                position: 0,
                createdAt: now,
                updatedAt: now,
            })
            .run()

        srcCats.forEach((c, ci) => {
            tx.insert(schema.categories)
                .values({
                    id: catIdMap.get(c.id)!,
                    userId: user.id,
                    name: c.name,
                    openCoreId: newOcId,
                    sharedWithOrg: 1,
                    isOpenCoreFilter: 0,
                    position: existingCatCount + ci,
                    createdAt: now,
                    updatedAt: now,
                })
                .run()
        })

        srcSubs.forEach((s, si) => {
            tx.insert(schema.subcategories)
                .values({
                    id: subIdMap.get(s.id)!,
                    categoryId: catIdMap.get(s.categoryId)!,
                    name: s.name,
                    position: si,
                    createdAt: now,
                    updatedAt: now,
                })
                .run()
        })

        const newFilterIdByOld = new Map<string, string>()
        srcFilters.forEach((f, fi) => {
            const newId = nanoid()
            newFilterIdByOld.set(f.id, newId)
            tx.insert(schema.filters)
                .values({
                    id: newId,
                    userId: user.id,
                    categoryId: catIdMap.get(f.categoryId)!,
                    subcategoryId: f.subcategoryId ? (subIdMap.get(f.subcategoryId) ?? null) : null,
                    name: f.name,
                    description: f.description,
                    coverItemShortname: f.coverItemShortname,
                    boxImagePath: f.boxImagePath,
                    sharedWithOrg: 1,
                    boxCount: f.boxCount,
                    conveyorCount: f.conveyorCount,
                    storageAdaptorCount: f.storageAdaptorCount,
                    position: fi,
                    createdAt: now,
                    updatedAt: now,
                })
                .run()
        })

        srcItems
            .sort((a, b) => a.position - b.position)
            .forEach((it) => {
                const newFid = newFilterIdByOld.get(it.filterId)
                if (!newFid) return
                tx.insert(schema.filterItems)
                    .values({
                        filterId: newFid,
                        shortname: it.shortname,
                        max: it.max,
                        buffer: it.buffer,
                        min: it.min,
                        position: it.position,
                    })
                    .run()
            })
    })

    return json({ id: newOcId, name: srcOc.name })
}
