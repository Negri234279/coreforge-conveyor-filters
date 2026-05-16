// GET — full read-only contents of a clan member's shared category.

import type { APIRoute } from 'astro'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../../../../db/client'
import { logEvent } from '../../../../lib/events'
import type { Filter, FilterItem, Subcategory } from '../../../../types'

export const prerender = false

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
}

export const GET: APIRoute = ({ locals, params }) => {
    const user = locals.user!
    if (!user.orgId) return json({ error: 'You are not in a clan.' }, 400)
    const id = params.id
    if (!id) return json({ error: 'Missing id' }, 400)

    const cat = db
        .select()
        .from(schema.categories)
        .where(and(eq(schema.categories.id, id), eq(schema.categories.sharedWithOrg, 1)))
        .get()
    if (!cat) return json({ error: 'Category not found' }, 404)

    const owner = db
        .select({ id: schema.users.id, username: schema.users.username, orgId: schema.users.orgId })
        .from(schema.users)
        .where(eq(schema.users.id, cat.userId))
        .get()
    if (!owner || owner.orgId !== user.orgId) return json({ error: 'Not available' }, 403)

    // Only count views from someone other than the owner — self-views aren't
    // engagement.
    if (owner.id !== user.id) {
        logEvent('category_view_shared', {
            userId: user.id,
            userName: user.username,
            targetId: cat.id,
            metadata: { ownerId: owner.id },
        })
    }

    const subRows = db
        .select()
        .from(schema.subcategories)
        .where(eq(schema.subcategories.categoryId, cat.id))
        .all()
    const filterRows = db
        .select()
        .from(schema.filters)
        .where(eq(schema.filters.categoryId, cat.id))
        .all()
    const filterIds = filterRows.map((f) => f.id)
    const itemRows = filterIds.length
        ? db
              .select()
              .from(schema.filterItems)
              .where(inArray(schema.filterItems.filterId, filterIds))
              .all()
        : []

    const itemsByFilter = new Map<string, FilterItem[]>()
    for (const it of itemRows.sort((a, b) => a.position - b.position)) {
        const list = itemsByFilter.get(it.filterId) ?? []
        list.push({ shortname: it.shortname, max: it.max, buffer: it.buffer, min: it.min })
        itemsByFilter.set(it.filterId, list)
    }

    const buildFilter = (row: (typeof filterRows)[number]): Filter => ({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        coverItemShortname: row.coverItemShortname,
        boxImagePath: row.boxImagePath ?? undefined,
        categoryId: row.categoryId,
        subcategoryId: row.subcategoryId ?? undefined,
        items: itemsByFilter.get(row.id) ?? [],
        boxCount: row.boxCount,
        conveyorCount: row.conveyorCount,
        storageAdaptorCount: row.storageAdaptorCount,
        createdAt: new Date(row.createdAt).toISOString(),
    })

    const subById = new Map<string, Subcategory>()
    const subcategories: Subcategory[] = subRows
        .sort((a, b) => a.position - b.position)
        .map((s) => {
            const sub: Subcategory = { id: s.id, name: s.name, filters: [] }
            subById.set(s.id, sub)
            return sub
        })

    const rootFilters: Filter[] = []
    for (const row of filterRows.sort((a, b) => a.position - b.position)) {
        const f = buildFilter(row)
        if (row.subcategoryId && subById.has(row.subcategoryId)) {
            subById.get(row.subcategoryId)!.filters.push(f)
        } else {
            rootFilters.push(f)
        }
    }

    const openCoreName = cat.openCoreId
        ? (db
              .select({ name: schema.openCores.name })
              .from(schema.openCores)
              .where(eq(schema.openCores.id, cat.openCoreId))
              .get()?.name ?? undefined)
        : undefined

    return json({
        id: cat.id,
        name: cat.name,
        owner: { id: owner.id, username: owner.username },
        openCoreName,
        subcategories,
        filters: rootFilters,
    })
}
