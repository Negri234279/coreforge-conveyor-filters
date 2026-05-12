// POST — copy a shared org filter into the caller's personal space. We
// find-or-create matching category & subcategory (by name, case-insensitive)
// so the clone slots into the caller's existing taxonomy when there's overlap.

import type { APIRoute } from 'astro'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../../../../db/client'

export const prerender = false

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
        },
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
    if (typeof id !== 'string' || !id) return json({ error: 'Missing filter id' }, 400)

    const source = db
        .select()
        .from(schema.filters)
        .where(and(eq(schema.filters.id, id), eq(schema.filters.sharedWithOrg, 1)))
        .get()
    if (!source) return json({ error: 'Filter not found' }, 404)

    // Confirm the source's owner is in the same org as the caller.
    const owner = db
        .select({ orgId: schema.users.orgId })
        .from(schema.users)
        .where(eq(schema.users.id, source.userId))
        .get()
    if (!owner || owner.orgId !== user.orgId) {
        return json({ error: 'Filter not available' }, 403)
    }

    // Resolve source category/subcategory names.
    const srcCat = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.id, source.categoryId))
        .get()
    if (!srcCat) return json({ error: 'Source category missing' }, 500)
    const srcSub = source.subcategoryId
        ? db
              .select()
              .from(schema.subcategories)
              .where(eq(schema.subcategories.id, source.subcategoryId))
              .get()
        : null

    const items = db
        .select()
        .from(schema.filterItems)
        .where(inArray(schema.filterItems.filterId, [source.id]))
        .all()

    const now = Date.now()
    const newFilterId = nanoid()

    db.transaction((tx) => {
        // Find-or-create category by case-insensitive name in caller's space.
        const myCats = tx
            .select()
            .from(schema.categories)
            .where(eq(schema.categories.userId, user.id))
            .all()
        let targetCat = myCats.find(
            (c) => c.name.trim().toLowerCase() === srcCat.name.trim().toLowerCase(),
        )
        if (!targetCat) {
            const id = nanoid()
            tx.insert(schema.categories)
                .values({
                    id,
                    userId: user.id,
                    name: srcCat.name,
                    isOpenCoreFilter: srcCat.isOpenCoreFilter,
                    position: myCats.length,
                    createdAt: now,
                })
                .run()
            targetCat = { ...srcCat, id, userId: user.id, position: myCats.length, createdAt: now }
        }

        let targetSubId: string | null = null
        if (srcSub) {
            const mySubs = tx
                .select()
                .from(schema.subcategories)
                .where(eq(schema.subcategories.categoryId, targetCat.id))
                .all()
            const existing = mySubs.find(
                (s) => s.name.trim().toLowerCase() === srcSub.name.trim().toLowerCase(),
            )
            if (existing) {
                targetSubId = existing.id
            } else {
                targetSubId = nanoid()
                tx.insert(schema.subcategories)
                    .values({
                        id: targetSubId,
                        categoryId: targetCat.id,
                        name: srcSub.name,
                        position: mySubs.length,
                        createdAt: now,
                    })
                    .run()
            }
        }

        tx.insert(schema.filters)
            .values({
                id: newFilterId,
                userId: user.id,
                categoryId: targetCat.id,
                subcategoryId: targetSubId,
                name: source.name,
                description: source.description,
                coverItemShortname: source.coverItemShortname,
                boxImagePath: source.boxImagePath,
                sharedWithOrg: 0,
                position: 0,
                createdAt: now,
            })
            .run()
        items.forEach((it, ii) => {
            tx.insert(schema.filterItems)
                .values({
                    filterId: newFilterId,
                    shortname: it.shortname,
                    max: it.max,
                    buffer: it.buffer,
                    min: it.min,
                    position: ii,
                })
                .run()
        })
    })

    return json({ ok: true, id: newFilterId })
}
