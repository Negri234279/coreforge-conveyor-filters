// Per-user replacement for the legacy GET/PUT /api/filters wholesale endpoint.
// Keeps the "load the entire tree, mutate locally, PUT back" client model —
// scoped to locals.user.id, persisted in SQLite. State shape:
//   { openCores: OpenCore[], categories: Category[] }
// where every category carries an optional openCoreId pointing into openCores
// (or null = a "loose" category).

import type { APIRoute } from 'astro'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '../../../db/client'
import { logEvent } from '../../../lib/events'
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

/** Per-filter deployment count: non-negative integer; defaults to 1 when missing/invalid. */
function countInt(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v ?? NaN)
    if (!Number.isFinite(n) || n < 0) return 1
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
            sharedWithOrg: c.sharedWithOrg === 1,
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
    sharedWithOrg: boolean
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

        out.push({
            id,
            name,
            openCoreId,
            sharedWithOrg: o.sharedWithOrg === true,
            subcategories: subs,
            filters: rootFilters,
        })
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
            c.sharedWithOrg = false
            for (const f of c.filters) f.sharedWithOrg = false
            for (const s of c.subcategories) for (const f of s.filters) f.sharedWithOrg = false
        }
    }

    // Diff prep — we need to know which ids are new, deleted, or unchanged so we
    // can (1) keep updated_at stable on unchanged rows and (2) emit usage
    // events. Reads happen before the transaction; that's fine because we hold
    // the only writer (SQLite single-writer + the user is scoped to themselves).
    const now = Date.now()

    const prevFilterRows = db
        .select()
        .from(schema.filters)
        .where(eq(schema.filters.userId, user.id))
        .all()
    const prevFilterIds = prevFilterRows.map((r) => r.id)
    const prevFilterItems = prevFilterIds.length
        ? db
              .select()
              .from(schema.filterItems)
              .where(inArray(schema.filterItems.filterId, prevFilterIds))
              .all()
        : []
    const prevItemsByFilter = new Map<string, FilterItem[]>()
    for (const it of prevFilterItems) {
        const list = prevItemsByFilter.get(it.filterId) ?? []
        list.push({ shortname: it.shortname, max: it.max, buffer: it.buffer, min: it.min })
        prevItemsByFilter.set(it.filterId, list)
    }

    const prevCatRows = db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.userId, user.id))
        .all()
    const prevCatIds = prevCatRows.map((c) => c.id)
    const prevSubRows = prevCatIds.length
        ? db
              .select()
              .from(schema.subcategories)
              .where(inArray(schema.subcategories.categoryId, prevCatIds))
              .all()
        : []
    const prevOcRows = db
        .select()
        .from(schema.openCores)
        .where(eq(schema.openCores.userId, user.id))
        .all()

    const prevFiltersById = new Map(prevFilterRows.map((r) => [r.id, r]))
    const prevCatsById = new Map(prevCatRows.map((r) => [r.id, r]))
    const prevSubsById = new Map(prevSubRows.map((r) => [r.id, r]))
    const prevOcsById = new Map(prevOcRows.map((r) => [r.id, r]))

    // Stable content hashes — position is excluded so pure reorders don't bump
    // updated_at. Items are sorted by shortname for stability.
    function hashItems(items: FilterItem[]): string {
        return JSON.stringify(
            [...items]
                .sort((a, b) => a.shortname.localeCompare(b.shortname))
                .map((it) => [it.shortname, it.max, it.buffer, it.min]),
        )
    }
    function prevFilterHash(id: string): string | null {
        const row = prevFiltersById.get(id)
        if (!row) return null
        const items = prevItemsByFilter.get(id) ?? []
        return [
            row.categoryId,
            row.subcategoryId ?? '',
            row.name,
            row.description ?? '',
            row.coverItemShortname,
            row.boxImagePath ?? '',
            row.sharedWithOrg,
            row.boxCount,
            row.conveyorCount,
            row.storageAdaptorCount,
            hashItems(items),
        ].join('|')
    }
    function nextFilterHash(
        f: InFilter,
        categoryId: string,
        subcategoryId: string | null,
    ): string {
        return [
            categoryId,
            subcategoryId ?? '',
            f.name,
            f.description ?? '',
            f.coverItemShortname,
            f.boxImagePath ?? '',
            f.sharedWithOrg ? 1 : 0,
            f.boxCount,
            f.conveyorCount,
            f.storageAdaptorCount,
            hashItems(f.items),
        ].join('|')
    }

    // Collect events to emit *after* the transaction commits (logEvent does its
    // own writes — running them inside the same tx is fine but logging them
    // post-commit means a rollback won't leave orphan event rows).
    const createdFilterIds: string[] = []
    const deletedFilterIds: string[] = []
    const updatedFilterIds: string[] = []
    const createdCategoryIds: string[] = []
    const deletedCategoryIds: string[] = []
    const updatedCategoryIds: string[] = []
    const createdSubcategoryIds: string[] = []
    const deletedSubcategoryIds: string[] = []
    const updatedSubcategoryIds: string[] = []

    // Flatten incoming filters once for diffing.
    const incomingFilters: { f: InFilter; categoryId: string; subcategoryId: string | null }[] = []
    for (const cat of cats) {
        for (const f of cat.filters) {
            incomingFilters.push({ f, categoryId: cat.id, subcategoryId: null })
        }
        for (const sub of cat.subcategories) {
            for (const f of sub.filters) {
                incomingFilters.push({ f, categoryId: cat.id, subcategoryId: sub.id })
            }
        }
    }
    const incomingFilterIds = new Set(incomingFilters.map((x) => x.f.id))
    for (const id of prevFilterIds) {
        if (!incomingFilterIds.has(id)) deletedFilterIds.push(id)
    }

    const incomingCatIds = new Set(cats.map((c) => c.id))
    for (const id of prevCatIds) {
        if (!incomingCatIds.has(id)) deletedCategoryIds.push(id)
    }
    for (const c of cats) {
        if (!prevCatsById.has(c.id)) createdCategoryIds.push(c.id)
    }
    for (const x of incomingFilters) {
        if (!prevFiltersById.has(x.f.id)) createdFilterIds.push(x.f.id)
    }

    const incomingSubIds = new Set<string>()
    for (const c of cats) for (const s of c.subcategories) incomingSubIds.add(s.id)
    for (const id of prevSubsById.keys()) {
        if (!incomingSubIds.has(id)) deletedSubcategoryIds.push(id)
    }

    db.transaction((tx) => {
        // Wipe this user's tree, then rebuild it. updated_at on each row is
        // either preserved (no change) or stamped with `now` (new or changed).
        if (prevFilterIds.length) {
            tx.delete(schema.filterItems)
                .where(inArray(schema.filterItems.filterId, prevFilterIds))
                .run()
        }
        tx.delete(schema.filters).where(eq(schema.filters.userId, user.id)).run()
        if (prevCatIds.length) {
            tx.delete(schema.subcategories)
                .where(inArray(schema.subcategories.categoryId, prevCatIds))
                .run()
        }
        tx.delete(schema.categories).where(eq(schema.categories.userId, user.id)).run()
        tx.delete(schema.openCores).where(eq(schema.openCores.userId, user.id)).run()

        openCores.forEach((oc, i) => {
            const prev = prevOcsById.get(oc.id)
            const sharedFlag = oc.sharedWithOrg ? 1 : 0
            const changed = !prev || prev.name !== oc.name || prev.sharedWithOrg !== sharedFlag
            tx.insert(schema.openCores)
                .values({
                    id: oc.id,
                    userId: user.id,
                    name: oc.name,
                    sharedWithOrg: sharedFlag,
                    position: i,
                    createdAt: prev?.createdAt ?? now,
                    updatedAt: changed ? now : (prev?.updatedAt ?? now),
                })
                .run()
        })

        const insertFilter = (
            f: InFilter,
            categoryId: string,
            subcategoryId: string | null,
            position: number,
        ) => {
            const prev = prevFiltersById.get(f.id)
            const newHash = nextFilterHash(f, categoryId, subcategoryId)
            const oldHash = prevFilterHash(f.id)
            const changed = !prev || newHash !== oldHash
            // `changed && prev` = it existed before and the hash differs ->
            // an update. (`changed && !prev` is a create, already tracked
            // above by the diff against prevFiltersById.)
            if (changed && prev) updatedFilterIds.push(f.id)
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
                    createdAt: prev?.createdAt ?? parseCreatedAt(f.createdAt, now),
                    updatedAt: changed ? now : (prev?.updatedAt ?? now),
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
            const prev = prevCatsById.get(cat.id)
            const sharedFlag = cat.sharedWithOrg ? 1 : 0
            const changed =
                !prev ||
                prev.name !== cat.name ||
                (prev.openCoreId ?? null) !== (cat.openCoreId ?? null) ||
                prev.sharedWithOrg !== sharedFlag
            if (changed && prev) updatedCategoryIds.push(cat.id)
            tx.insert(schema.categories)
                .values({
                    id: cat.id,
                    userId: user.id,
                    name: cat.name,
                    openCoreId: cat.openCoreId,
                    isOpenCoreFilter: 0,
                    sharedWithOrg: sharedFlag,
                    position: ci,
                    createdAt: prev?.createdAt ?? now,
                    updatedAt: changed ? now : (prev?.updatedAt ?? now),
                })
                .run()
            cat.subcategories.forEach((sub, si) => {
                const psub = prevSubsById.get(sub.id)
                const subChanged = !psub || psub.name !== sub.name || psub.categoryId !== cat.id
                if (!psub) createdSubcategoryIds.push(sub.id)
                else if (subChanged) updatedSubcategoryIds.push(sub.id)
                tx.insert(schema.subcategories)
                    .values({
                        id: sub.id,
                        categoryId: cat.id,
                        name: sub.name,
                        position: si,
                        createdAt: psub?.createdAt ?? now,
                        updatedAt: subChanged ? now : (psub?.updatedAt ?? now),
                    })
                    .run()
                sub.filters.forEach((f, fi) => insertFilter(f, cat.id, sub.id, fi))
            })
            cat.filters.forEach((f, fi) => insertFilter(f, cat.id, null, fi))
        })
    })

    for (const id of createdFilterIds)
        logEvent('filter_create', { userId: user.id, userName: user.username, targetId: id })
    for (const id of updatedFilterIds)
        logEvent('filter_update', { userId: user.id, userName: user.username, targetId: id })
    for (const id of deletedFilterIds)
        logEvent('filter_delete', { userId: user.id, userName: user.username, targetId: id })
    for (const id of createdCategoryIds) {
        logEvent('category_create', { userId: user.id, userName: user.username, targetId: id })
    }
    for (const id of updatedCategoryIds) {
        logEvent('category_update', { userId: user.id, userName: user.username, targetId: id })
    }
    for (const id of deletedCategoryIds) {
        logEvent('category_delete', { userId: user.id, userName: user.username, targetId: id })
    }
    for (const id of createdSubcategoryIds) {
        logEvent('subcategory_create', { userId: user.id, userName: user.username, targetId: id })
    }
    for (const id of updatedSubcategoryIds) {
        logEvent('subcategory_update', { userId: user.id, userName: user.username, targetId: id })
    }
    for (const id of deletedSubcategoryIds) {
        logEvent('subcategory_delete', { userId: user.id, userName: user.username, targetId: id })
    }

    return json({ ok: true, source: 'sqlite' })
}
