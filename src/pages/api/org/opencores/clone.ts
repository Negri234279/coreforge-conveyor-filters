// POST — deep-clone a clan member's shared Open Core (all its categories,
// subcategories, filters and items) into the caller's personal space, with
// fresh IDs and sharing flags reset.

import type { APIRoute } from 'astro'
import { and, eq, inArray } from 'drizzle-orm'
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
    const user = locals.user!
    if (!user.orgId) return json({ error: 'You are not in a clan.' }, 400)

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }
    const id = body && typeof body === 'object' ? (body as { id?: unknown }).id : null
    if (typeof id !== 'string' || !id) return json({ error: 'Missing Open Core id' }, 400)

    const oc = db
        .select()
        .from(schema.openCores)
        .where(and(eq(schema.openCores.id, id), eq(schema.openCores.sharedWithOrg, 1)))
        .get()
    if (!oc) return json({ error: 'Open Core not found' }, 404)

    const owner = db
        .select({ orgId: schema.users.orgId })
        .from(schema.users)
        .where(eq(schema.users.id, oc.userId))
        .get()
    if (!owner || owner.orgId !== user.orgId) return json({ error: 'Not available' }, 403)

    const srcCats = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.openCoreId, oc.id))
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

    // Unique-ish name in the caller's space.
    const myOcs = db
        .select({ name: schema.openCores.name })
        .from(schema.openCores)
        .where(eq(schema.openCores.userId, user.id))
        .all()
    const taken = new Set(myOcs.map((o) => o.name.trim().toLowerCase()))
    let newName = oc.name
    if (taken.has(newName.trim().toLowerCase())) {
        let n = 2
        while (taken.has(`${oc.name} (${n})`.toLowerCase())) n++
        newName = `${oc.name} (${n})`
    }

    const now = Date.now()
    const newOcId = nanoid()
    const catIdMap = new Map<string, string>() // src catId -> new catId
    const subIdMap = new Map<string, string>() // src subId -> new subId
    for (const c of srcCats) catIdMap.set(c.id, nanoid())
    for (const s of srcSubs) subIdMap.set(s.id, nanoid())

    const myCatCount = db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(eq(schema.categories.userId, user.id))
        .all().length

    db.transaction((tx) => {
        tx.insert(schema.openCores)
            .values({
                id: newOcId,
                userId: user.id,
                name: newName,
                sharedWithOrg: 0,
                position: myOcs.length,
                createdAt: now,
            })
            .run()

        srcCats.forEach((c, ci) => {
            tx.insert(schema.categories)
                .values({
                    id: catIdMap.get(c.id)!,
                    userId: user.id,
                    name: c.name,
                    openCoreId: newOcId,
                    isOpenCoreFilter: 0,
                    position: myCatCount + ci,
                    createdAt: now,
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
                    sharedWithOrg: 0,
                    boxCount: f.boxCount,
                    conveyorCount: f.conveyorCount,
                    storageAdaptorCount: f.storageAdaptorCount,
                    position: fi,
                    createdAt: now,
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

    return json({ ok: true, id: newOcId, name: newName })
}
