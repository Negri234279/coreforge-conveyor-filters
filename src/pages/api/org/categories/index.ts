// GET — categories shared by anyone in the caller's clan, with filter counts
// and deployment totals. Sister endpoint to /api/org/opencores.

import type { APIRoute } from 'astro'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db, schema } from '../../../../db/client'
import { classifyBox } from '../../../../lib/boxKind'
import type { OrgCategoryView } from '../../../../types'

export const prerender = false

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
}

export const GET: APIRoute = ({ locals }) => {
    const user = locals.user!
    if (!user.orgId) return json({ categories: [] })

    const members = db
        .select({ id: schema.users.id, username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.orgId, user.orgId))
        .all()
    const memberIds = members.map((m) => m.id)
    if (memberIds.length === 0) return json({ categories: [] })
    const memberById = new Map(members.map((m) => [m.id, m]))

    const catRows = db
        .select()
        .from(schema.categories)
        .where(
            and(
                inArray(schema.categories.userId, memberIds),
                eq(schema.categories.sharedWithOrg, 1),
                isNull(schema.categories.openCoreId),
            ),
        )
        .all()
    if (catRows.length === 0) return json({ categories: [] })

    const catIds = catRows.map((c) => c.id)
    const subRows = db
        .select({ id: schema.subcategories.id, categoryId: schema.subcategories.categoryId })
        .from(schema.subcategories)
        .where(inArray(schema.subcategories.categoryId, catIds))
        .all()
    const subCountByCat = new Map<string, number>()
    for (const s of subRows) {
        subCountByCat.set(s.categoryId, (subCountByCat.get(s.categoryId) ?? 0) + 1)
    }

    const filterRows = db
        .select({
            categoryId: schema.filters.categoryId,
            boxImagePath: schema.filters.boxImagePath,
            boxCount: schema.filters.boxCount,
            conveyorCount: schema.filters.conveyorCount,
            storageAdaptorCount: schema.filters.storageAdaptorCount,
        })
        .from(schema.filters)
        .where(inArray(schema.filters.categoryId, catIds))
        .all()
    const filterCountByCat = new Map<string, number>()
    const boxByCat = new Map<string, number>()
    const boxLargeByCat = new Map<string, number>()
    const boxSmallByCat = new Map<string, number>()
    const boxLockerByCat = new Map<string, number>()
    const boxFridgeByCat = new Map<string, number>()
    const conveyorByCat = new Map<string, number>()
    const adaptorByCat = new Map<string, number>()
    const kindMaps: Record<NonNullable<ReturnType<typeof classifyBox>>, Map<string, number>> = {
        large: boxLargeByCat,
        small: boxSmallByCat,
        locker: boxLockerByCat,
        fridge: boxFridgeByCat,
    }
    for (const f of filterRows) {
        filterCountByCat.set(f.categoryId, (filterCountByCat.get(f.categoryId) ?? 0) + 1)
        boxByCat.set(f.categoryId, (boxByCat.get(f.categoryId) ?? 0) + f.boxCount)
        const kind = classifyBox(f.boxImagePath)
        if (kind) {
            const m = kindMaps[kind]
            m.set(f.categoryId, (m.get(f.categoryId) ?? 0) + f.boxCount)
        }
        conveyorByCat.set(f.categoryId, (conveyorByCat.get(f.categoryId) ?? 0) + f.conveyorCount)
        adaptorByCat.set(
            f.categoryId,
            (adaptorByCat.get(f.categoryId) ?? 0) + f.storageAdaptorCount,
        )
    }

    // Optional Open Core name lookup, purely informative.
    const ocIds = Array.from(
        new Set(catRows.map((c) => c.openCoreId).filter((x): x is string => !!x)),
    )
    const ocNames = ocIds.length
        ? new Map(
              db
                  .select({ id: schema.openCores.id, name: schema.openCores.name })
                  .from(schema.openCores)
                  .where(inArray(schema.openCores.id, ocIds))
                  .all()
                  .map((o) => [o.id, o.name]),
          )
        : new Map<string, string>()

    const out: OrgCategoryView[] = catRows.map((c) => {
        const owner = memberById.get(c.userId)!
        return {
            id: c.id,
            name: c.name,
            owner: { id: owner.id, username: owner.username },
            openCoreName: c.openCoreId ? ocNames.get(c.openCoreId) : undefined,
            subcategoryCount: subCountByCat.get(c.id) ?? 0,
            filterCount: filterCountByCat.get(c.id) ?? 0,
            boxTotal: boxByCat.get(c.id) ?? 0,
            boxLargeTotal: boxLargeByCat.get(c.id) ?? 0,
            boxSmallTotal: boxSmallByCat.get(c.id) ?? 0,
            boxLockerTotal: boxLockerByCat.get(c.id) ?? 0,
            boxFridgeTotal: boxFridgeByCat.get(c.id) ?? 0,
            conveyorTotal: conveyorByCat.get(c.id) ?? 0,
            storageAdaptorTotal: adaptorByCat.get(c.id) ?? 0,
        }
    })
    out.sort(
        (a, b) => a.name.localeCompare(b.name) || a.owner.username.localeCompare(b.owner.username),
    )

    return json({ categories: out })
}
