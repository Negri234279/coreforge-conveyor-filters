// GET — full read-only contents of a clan member's shared Open Core.

import type { APIRoute } from 'astro'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../../../../db/client'
import type { Category, Filter, FilterItem, Subcategory } from '../../../../types'

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

    const oc = db
        .select()
        .from(schema.openCores)
        .where(and(eq(schema.openCores.id, id), eq(schema.openCores.sharedWithOrg, 1)))
        .get()
    if (!oc) return json({ error: 'Open Core not found' }, 404)

    const owner = db
        .select({ id: schema.users.id, username: schema.users.username, orgId: schema.users.orgId })
        .from(schema.users)
        .where(eq(schema.users.id, oc.userId))
        .get()
    if (!owner || owner.orgId !== user.orgId) return json({ error: 'Not available' }, 403)

    const catRows = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.openCoreId, oc.id))
        .all()
    const catIds = catRows.map((c) => c.id)
    const subRows = catIds.length
        ? db
              .select()
              .from(schema.subcategories)
              .where(inArray(schema.subcategories.categoryId, catIds))
              .all()
        : []
    const filterRows = catIds.length
        ? db.select().from(schema.filters).where(inArray(schema.filters.categoryId, catIds)).all()
        : []
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
        createdAt: new Date(row.createdAt).toISOString(),
    })

    const subsByCat = new Map<string, Subcategory[]>()
    for (const sr of subRows.sort((a, b) => a.position - b.position)) {
        const list = subsByCat.get(sr.categoryId) ?? []
        list.push({ id: sr.id, name: sr.name, filters: [] })
        subsByCat.set(sr.categoryId, list)
    }
    const subById = new Map<string, Subcategory>()
    for (const list of subsByCat.values()) for (const s of list) subById.set(s.id, s)

    const filtersByCatRoot = new Map<string, Filter[]>()
    for (const row of filterRows.sort((a, b) => a.position - b.position)) {
        const f = buildFilter(row)
        if (row.subcategoryId && subById.has(row.subcategoryId)) {
            subById.get(row.subcategoryId)!.filters.push(f)
        } else {
            const list = filtersByCatRoot.get(row.categoryId) ?? []
            list.push(f)
            filtersByCatRoot.set(row.categoryId, list)
        }
    }

    const categories: Category[] = catRows
        .sort((a, b) => a.position - b.position)
        .map((c) => ({
            id: c.id,
            name: c.name,
            subcategories: subsByCat.get(c.id) ?? [],
            filters: filtersByCatRoot.get(c.id) ?? [],
        }))

    return json({
        id: oc.id,
        name: oc.name,
        owner: { id: owner.id, username: owner.username },
        categories,
    })
}
