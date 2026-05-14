// POST — deep-clone a clan member's shared category (its subcategories,
// filters and items) into the caller's personal space, with fresh IDs.
// The clone lands as a loose category in the caller's space; share flags reset.

import type { APIRoute } from 'astro'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../../../../db/client'
import { logEvent } from '../../../../lib/events'

export const prerender = false

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
}

export const POST: APIRoute = async ({ locals, request }) => {
    const user = locals.user!
    if (!user.orgId) return json({ error: 'You are not in a clan.' }, 400)

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }
    const id = body && typeof body === 'object' ? (body as { id?: unknown }).id : null
    if (typeof id !== 'string' || !id) return json({ error: 'Missing category id' }, 400)

    const srcCat = db
        .select()
        .from(schema.categories)
        .where(and(eq(schema.categories.id, id), eq(schema.categories.sharedWithOrg, 1)))
        .get()
    if (!srcCat) return json({ error: 'Category not found' }, 404)

    const owner = db
        .select({ orgId: schema.users.orgId })
        .from(schema.users)
        .where(eq(schema.users.id, srcCat.userId))
        .get()
    if (!owner || owner.orgId !== user.orgId) return json({ error: 'Not available' }, 403)

    const srcSubs = db
        .select()
        .from(schema.subcategories)
        .where(eq(schema.subcategories.categoryId, srcCat.id))
        .all()
    const srcFilters = db
        .select()
        .from(schema.filters)
        .where(eq(schema.filters.categoryId, srcCat.id))
        .all()
    const srcFilterIds = srcFilters.map((f) => f.id)
    const srcItems = srcFilterIds.length
        ? db
              .select()
              .from(schema.filterItems)
              .where(inArray(schema.filterItems.filterId, srcFilterIds))
              .all()
        : []

    // Unique-ish name in the caller's category space (case-insensitive).
    const myCats = db
        .select({ name: schema.categories.name })
        .from(schema.categories)
        .where(eq(schema.categories.userId, user.id))
        .all()
    const taken = new Set(myCats.map((c) => c.name.trim().toLowerCase()))
    let newName = srcCat.name
    if (taken.has(newName.trim().toLowerCase())) {
        let n = 2
        while (taken.has(`${srcCat.name} (${n})`.toLowerCase())) n++
        newName = `${srcCat.name} (${n})`
    }

    const now = Date.now()
    const newCatId = nanoid()
    const subIdMap = new Map<string, string>()
    for (const s of srcSubs) subIdMap.set(s.id, nanoid())

    db.transaction((tx) => {
        tx.insert(schema.categories)
            .values({
                id: newCatId,
                userId: user.id,
                name: newName,
                openCoreId: null,
                isOpenCoreFilter: 0,
                sharedWithOrg: 0,
                position: myCats.length,
                createdAt: now,
                updatedAt: now,
            })
            .run()

        srcSubs.forEach((s, si) => {
            tx.insert(schema.subcategories)
                .values({
                    id: subIdMap.get(s.id)!,
                    categoryId: newCatId,
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
                    categoryId: newCatId,
                    subcategoryId: f.subcategoryId ? (subIdMap.get(f.subcategoryId) ?? null) : null,
                    name: f.name,
                    description: f.description,
                    coverItemShortname: f.coverItemShortname,
                    boxImagePath: f.boxImagePath,
                    sharedWithOrg: 0,
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

    logEvent('category_clone', {
        userId: user.id,
        targetId: srcCat.id,
        metadata: { ownerId: srcCat.userId, newCategoryId: newCatId },
    })

    return json({ ok: true, id: newCatId, name: newName })
}
