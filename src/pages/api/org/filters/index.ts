// GET — flat list of filters shared by anyone in the current user's clan.
// Built in 3 indexed queries (members → filters → items) and joined in memory.

import type { APIRoute } from 'astro'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../../../../db/client'
import type { FilterItem, OrgFilterView } from '../../../../types'

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

export const GET: APIRoute = ({ locals }) => {
    const user = locals.user!
    if (!user.orgId) return json({ filters: [] })

    const members = db
        .select({ id: schema.users.id, username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.orgId, user.orgId))
        .all()
    const memberIds = members.map((m) => m.id)
    if (memberIds.length === 0) return json({ filters: [] })

    const memberById = new Map(members.map((m) => [m.id, m]))

    const filterRows = db
        .select()
        .from(schema.filters)
        .where(and(inArray(schema.filters.userId, memberIds), eq(schema.filters.sharedWithOrg, 1)))
        .all()
    if (filterRows.length === 0) return json({ filters: [] })

    const filterIds = filterRows.map((f) => f.id)
    const items = db
        .select()
        .from(schema.filterItems)
        .where(inArray(schema.filterItems.filterId, filterIds))
        .all()
    const itemsByFilter = new Map<string, FilterItem[]>()
    for (const it of items.sort((a, b) => a.position - b.position)) {
        const list = itemsByFilter.get(it.filterId) ?? []
        list.push({ shortname: it.shortname, max: it.max, buffer: it.buffer, min: it.min })
        itemsByFilter.set(it.filterId, list)
    }

    const categoryIds = Array.from(new Set(filterRows.map((f) => f.categoryId)))
    const subIds = Array.from(
        new Set(filterRows.map((f) => f.subcategoryId).filter((x): x is string => !!x)),
    )
    const catNames = new Map(
        db
            .select({ id: schema.categories.id, name: schema.categories.name })
            .from(schema.categories)
            .where(inArray(schema.categories.id, categoryIds))
            .all()
            .map((c) => [c.id, c.name]),
    )
    const subNames = subIds.length
        ? new Map(
              db
                  .select({ id: schema.subcategories.id, name: schema.subcategories.name })
                  .from(schema.subcategories)
                  .where(inArray(schema.subcategories.id, subIds))
                  .all()
                  .map((s) => [s.id, s.name]),
          )
        : new Map<string, string>()

    const out: OrgFilterView[] = filterRows.map((f) => {
        const owner = memberById.get(f.userId)!
        return {
            id: f.id,
            name: f.name,
            description: f.description ?? undefined,
            coverItemShortname: f.coverItemShortname,
            boxImagePath: f.boxImagePath ?? undefined,
            items: itemsByFilter.get(f.id) ?? [],
            owner: { id: owner.id, username: owner.username },
            categoryName: catNames.get(f.categoryId) ?? '—',
            subcategoryName: f.subcategoryId ? subNames.get(f.subcategoryId) : undefined,
            createdAt: new Date(f.createdAt).toISOString(),
        }
    })

    // Stable sort: category, subcategory, then name.
    out.sort(
        (a, b) =>
            a.categoryName.localeCompare(b.categoryName) ||
            (a.subcategoryName ?? '').localeCompare(b.subcategoryName ?? '') ||
            a.name.localeCompare(b.name),
    )

    return json({ filters: out })
}
