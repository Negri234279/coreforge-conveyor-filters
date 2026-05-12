// GET — Open Cores shared by anyone in the caller's clan, with category/filter counts.

import type { APIRoute } from 'astro'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../../../../db/client'
import type { OrgOpenCoreView } from '../../../../types'

export const prerender = false

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
}

export const GET: APIRoute = ({ locals }) => {
    const user = locals.user!
    if (!user.orgId) return json({ openCores: [] })

    const members = db
        .select({ id: schema.users.id, username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.orgId, user.orgId))
        .all()
    const memberIds = members.map((m) => m.id)
    if (memberIds.length === 0) return json({ openCores: [] })
    const memberById = new Map(members.map((m) => [m.id, m]))

    const ocRows = db
        .select()
        .from(schema.openCores)
        .where(
            and(inArray(schema.openCores.userId, memberIds), eq(schema.openCores.sharedWithOrg, 1)),
        )
        .all()
    if (ocRows.length === 0) return json({ openCores: [] })

    const ocIds = ocRows.map((o) => o.id)
    const catRows = db
        .select({ id: schema.categories.id, openCoreId: schema.categories.openCoreId })
        .from(schema.categories)
        .where(inArray(schema.categories.openCoreId, ocIds))
        .all()

    const catIdsByOc = new Map<string, string[]>()
    for (const c of catRows) {
        if (!c.openCoreId) continue
        const list = catIdsByOc.get(c.openCoreId) ?? []
        list.push(c.id)
        catIdsByOc.set(c.openCoreId, list)
    }

    const allCatIds = catRows.map((c) => c.id)
    const filterCountByCat = new Map<string, number>()
    if (allCatIds.length) {
        const fr = db
            .select({ categoryId: schema.filters.categoryId })
            .from(schema.filters)
            .where(inArray(schema.filters.categoryId, allCatIds))
            .all()
        for (const f of fr) {
            filterCountByCat.set(f.categoryId, (filterCountByCat.get(f.categoryId) ?? 0) + 1)
        }
    }

    const out: OrgOpenCoreView[] = ocRows.map((o) => {
        const catIds = catIdsByOc.get(o.id) ?? []
        const filterCount = catIds.reduce((acc, cid) => acc + (filterCountByCat.get(cid) ?? 0), 0)
        const owner = memberById.get(o.userId)!
        return {
            id: o.id,
            name: o.name,
            owner: { id: owner.id, username: owner.username },
            categoryCount: catIds.length,
            filterCount,
        }
    })
    out.sort(
        (a, b) => a.name.localeCompare(b.name) || a.owner.username.localeCompare(b.owner.username),
    )

    return json({ openCores: out })
}
