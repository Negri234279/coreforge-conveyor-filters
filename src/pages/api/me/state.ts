// Per-user replacement for the legacy GET/PUT /api/filters wholesale endpoint.
// Keeps the "load the entire tree, mutate locally, PUT back" client model —
// scoped to locals.user.id, persisted in SQLite. State shape:
//   { openCores: OpenCore[], categories: Category[] }
// where every category carries an optional openCoreId pointing into openCores
// (or null = a "loose" category).

import type { APIRoute } from 'astro'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '../../../db/client'
import type { Category, Filter, FilterItem, OpenCore, Subcategory } from '../../../types'

export const prerender = false

const MAX_ITEMS_PER_FILTER = 30
const MAX_OPEN_CORES = 100
const MAX_CATEGORIES = 300
const MAX_SUBCATEGORIES_PER_CATEGORY = 50
const MAX_FILTERS_PER_CATEGORY = 500
const MAX_STR = 200

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
        },
    })
}

function nonNegInt(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v ?? 0)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.floor(n)
}

/** Per-filter deployment count: integer, at least 1; defaults to 1. */
function countInt(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v ?? NaN)
    if (!Number.isFinite(n) || n < 1) return 1
    return Math.min(Math.floor(n), 10000)
}

function trimmedStr(v: unknown, max = MAX_STR): string {
    if (typeof v !== 'string') return ''
    return v.trim().slice(0, max)
}

function parseCreatedAt(v: unknown, fallback: number): number {
    if (typeof v === 'string') {
        const t = Date.parse(v)
        if (!Number.isNaN(t)) return t
    }
    if (typeof v === 'number' && Number.isFinite(v)) return v
    return fallback
}

// ---- GET ---------------------------------------------------------------

export const GET: APIRoute = ({ locals }) => {
    const user = locals.user!

    const openCoreRows = db
        .select()
        .from(schema.openCores)
        .where(eq(schema.openCores.userId, user.id))
        .all()

    const catRows = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.userId, user.id))
        .all()
    const catIds = catRows.map((c) => c.id)

    const subRows = catIds.length
        ? db
              .select()
              .from(schema.subcategories)
              .where(inArray(schema.subcategories.categoryId, catIds))
              .all()
        : []

    const filterRows = db
        .select()
        .from(schema.filters)
        .where(eq(schema.filters.userId, user.id))
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
        sharedWithOrg: row.sharedWithOrg === 1,
        boxCount: row.boxCount,
        conveyorCount: row.conveyorCount,
        storageAdaptorCount: row.storageAdaptorCount,
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
        if (row.subcategoryId) {
            const sub = subById.get(row.subcategoryId)
            if (sub) sub.filters.push(f)
            else {
                const list = filtersByCatRoot.get(row.categoryId) ?? []
                list.push(f)
                filtersByCatRoot.set(row.categoryId, list)
            }
        } else {
            const list = filtersByCatRoot.get(row.categoryId) ?? []
            list.push(f)
            filtersByCatRoot.set(row.categoryId, list)
        }
    }

    const knownOcIds = new Set(openCoreRows.map((o) => o.id))
    const categories: Category[] = catRows
        .sort((a, b) => a.position - b.position)
        .map((c) => ({
            id: c.id,
            name: c.name,
            openCoreId: c.openCoreId && knownOcIds.has(c.openCoreId) ? c.openCoreId : null,
            subcategories: subsByCat.get(c.id) ?? [],
            filters: filtersByCatRoot.get(c.id) ?? [],
        }))

    const openCores: OpenCore[] = openCoreRows
        .sort((a, b) => a.position - b.position)
        .map((o) => ({ id: o.id, name: o.name, sharedWithOrg: o.sharedWithOrg === 1 }))

    return json({ openCores, categories, source: 'sqlite' })
}

// ---- PUT ---------------------------------------------------------------

interface InFilter extends Filter {
    items: FilterItem[]
}
interface InSub {
    id: string
    name: string
    filters: InFilter[]
}
interface InCategory {
    id: string
    name: string
    openCoreId: string | null
    subcategories: InSub[]
    filters: InFilter[]
}
interface InOpenCore {
    id: string
    name: string
    sharedWithOrg: boolean
}

function normalizeItems(raw: unknown): FilterItem[] {
    if (!Array.isArray(raw)) return []
    const seen = new Set<string>()
    const out: FilterItem[] = []
    for (const r of raw) {
        if (!r || typeof r !== 'object') continue
        const o = r as Record<string, unknown>
        const shortname = trimmedStr(o.shortname, 80)
        if (!shortname || seen.has(shortname)) continue
        seen.add(shortname)
        out.push({
            shortname,
            max: nonNegInt(o.max),
            buffer: nonNegInt(o.buffer),
            min: nonNegInt(o.min),
        })
        if (out.length >= MAX_ITEMS_PER_FILTER) break
    }
    return out
}

function normalizeFilter(raw: unknown): InFilter | null {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    const id = trimmedStr(o.id, 64)
    const name = trimmedStr(o.name)
    const coverItemShortname = trimmedStr(o.coverItemShortname, 80)
    if (!id || !name || !coverItemShortname) return null
    return {
        id,
        name,
        description: o.description ? trimmedStr(o.description, 500) : undefined,
        coverItemShortname,
        boxImagePath: o.boxImagePath ? trimmedStr(o.boxImagePath, 200) : undefined,
        categoryId: '',
        subcategoryId: undefined,
        sharedWithOrg: o.sharedWithOrg === true,
        boxCount: countInt(o.boxCount),
        conveyorCount: countInt(o.conveyorCount),
        storageAdaptorCount: countInt(o.storageAdaptorCount),
        items: normalizeItems(o.items),
        createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    }
}

function normalizeOpenCores(raw: unknown): InOpenCore[] {
    if (!Array.isArray(raw)) return []
    const out: InOpenCore[] = []
    const seen = new Set<string>()
    for (const r of raw) {
        if (!r || typeof r !== 'object') continue
        const o = r as Record<string, unknown>
        const id = trimmedStr(o.id, 64)
        const name = trimmedStr(o.name)
        if (!id || !name || seen.has(id)) continue
        seen.add(id)
        out.push({ id, name, sharedWithOrg: o.sharedWithOrg === true })
        if (out.length >= MAX_OPEN_CORES) break
    }
    return out
}

function normalizeCategories(raw: unknown, validOpenCoreIds: Set<string>): InCategory[] {
    if (!Array.isArray(raw)) return []
    const out: InCategory[] = []
    const seenIds = new Set<string>()
    for (const r of raw) {
        if (!r || typeof r !== 'object') continue
        const o = r as Record<string, unknown>
        const id = trimmedStr(o.id, 64)
        const name = trimmedStr(o.name)
        if (!id || !name || seenIds.has(id)) continue
        seenIds.add(id)

        const rawOc = trimmedStr(o.openCoreId, 64)
        const openCoreId = rawOc && validOpenCoreIds.has(rawOc) ? rawOc : null

        const subRaw = Array.isArray(o.subcategories) ? o.subcategories : []
        const seenSub = new Set<string>()
        const subs: InSub[] = []
        for (const sr of subRaw) {
            if (!sr || typeof sr !== 'object') continue
            const so = sr as Record<string, unknown>
            const sid = trimmedStr(so.id, 64)
            const sname = trimmedStr(so.name)
            if (!sid || !sname || seenSub.has(sid)) continue
            seenSub.add(sid)
            const sfilters = (Array.isArray(so.filters) ? so.filters : [])
                .map(normalizeFilter)
                .filter((f): f is InFilter => f !== null)
                .slice(0, MAX_FILTERS_PER_CATEGORY)
            subs.push({ id: sid, name: sname, filters: sfilters })
            if (subs.length >= MAX_SUBCATEGORIES_PER_CATEGORY) break
        }

        const rootFilters = (Array.isArray(o.filters) ? o.filters : [])
            .map(normalizeFilter)
            .filter((f): f is InFilter => f !== null)
            .slice(0, MAX_FILTERS_PER_CATEGORY)

        out.push({ id, name, openCoreId, subcategories: subs, filters: rootFilters })
        if (out.length >= MAX_CATEGORIES) break
    }
    return out
}

export const PUT: APIRoute = async ({ locals, request }) => {
    const user = locals.user!

    let payload: unknown
    try {
        payload = await request.json()
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }
    if (!payload || typeof payload !== 'object') {
        return json({ error: 'Body must be { openCores, categories }' }, 400)
    }
    const p = payload as { openCores?: unknown; categories?: unknown }
    const openCores = normalizeOpenCores(p.openCores)
    const validOcIds = new Set(openCores.map((o) => o.id))
    const cats = normalizeCategories(p.categories, validOcIds)

    // A user with no clan can't have shared anything.
    if (!user.orgId) {
        for (const oc of openCores) oc.sharedWithOrg = false
        for (const c of cats) {
            for (const f of c.filters) f.sharedWithOrg = false
            for (const s of c.subcategories) for (const f of s.filters) f.sharedWithOrg = false
        }
    }

    db.transaction((tx) => {
        // Wipe this user's tree.
        const existingFilters = tx
            .select({ id: schema.filters.id })
            .from(schema.filters)
            .where(eq(schema.filters.userId, user.id))
            .all()
        const existingFilterIds = existingFilters.map((r) => r.id)
        if (existingFilterIds.length) {
            tx.delete(schema.filterItems)
                .where(inArray(schema.filterItems.filterId, existingFilterIds))
                .run()
        }
        tx.delete(schema.filters).where(eq(schema.filters.userId, user.id)).run()

        const existingCats = tx
            .select({ id: schema.categories.id })
            .from(schema.categories)
            .where(eq(schema.categories.userId, user.id))
            .all()
        const existingCatIds = existingCats.map((r) => r.id)
        if (existingCatIds.length) {
            tx.delete(schema.subcategories)
                .where(inArray(schema.subcategories.categoryId, existingCatIds))
                .run()
        }
        tx.delete(schema.categories).where(eq(schema.categories.userId, user.id)).run()
        tx.delete(schema.openCores).where(eq(schema.openCores.userId, user.id)).run()

        const now = Date.now()

        openCores.forEach((oc, i) => {
            tx.insert(schema.openCores)
                .values({
                    id: oc.id,
                    userId: user.id,
                    name: oc.name,
                    sharedWithOrg: oc.sharedWithOrg ? 1 : 0,
                    position: i,
                    createdAt: now,
                })
                .run()
        })

        const insertFilter = (
            f: InFilter,
            categoryId: string,
            subcategoryId: string | null,
            position: number,
        ) => {
            tx.insert(schema.filters)
                .values({
                    id: f.id,
                    userId: user.id,
                    categoryId,
                    subcategoryId,
                    name: f.name,
                    description: f.description ?? null,
                    coverItemShortname: f.coverItemShortname,
                    boxImagePath: f.boxImagePath ?? null,
                    sharedWithOrg: f.sharedWithOrg ? 1 : 0,
                    boxCount: f.boxCount,
                    conveyorCount: f.conveyorCount,
                    storageAdaptorCount: f.storageAdaptorCount,
                    position,
                    createdAt: parseCreatedAt(f.createdAt, now),
                })
                .run()
            f.items.forEach((it, ii) => {
                tx.insert(schema.filterItems)
                    .values({
                        filterId: f.id,
                        shortname: it.shortname,
                        max: it.max,
                        buffer: it.buffer,
                        min: it.min,
                        position: ii,
                    })
                    .run()
            })
        }

        cats.forEach((cat, ci) => {
            tx.insert(schema.categories)
                .values({
                    id: cat.id,
                    userId: user.id,
                    name: cat.name,
                    openCoreId: cat.openCoreId,
                    isOpenCoreFilter: 0,
                    position: ci,
                    createdAt: now,
                })
                .run()
            cat.subcategories.forEach((sub, si) => {
                tx.insert(schema.subcategories)
                    .values({
                        id: sub.id,
                        categoryId: cat.id,
                        name: sub.name,
                        position: si,
                        createdAt: now,
                    })
                    .run()
                sub.filters.forEach((f, fi) => insertFilter(f, cat.id, sub.id, fi))
            })
            cat.filters.forEach((f, fi) => insertFilter(f, cat.id, null, fi))
        })
    })

    return json({ ok: true, source: 'sqlite' })
}
