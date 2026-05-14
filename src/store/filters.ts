import { signal } from '@preact/signals'
import { nanoid } from 'nanoid'
import { classifyBox } from '../lib/boxKind'
import type { Category, Filter, FilterCounts, FilterItem, OpenCore, Subcategory } from '../types'

const MAX_ITEMS_PER_FILTER = 30

function toNonNegInt(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v ?? 0)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.floor(n)
}

/** Deployment counts are at least 1; missing/garbage values default to 1. */
function toCount(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v ?? NaN)
    if (!Number.isFinite(n) || n < 1) return 1
    return Math.floor(n)
}

function normalizeCounts(raw: Partial<FilterCounts> | undefined): FilterCounts {
    return {
        boxCount: toCount(raw?.boxCount),
        conveyorCount: toCount(raw?.conveyorCount),
        storageAdaptorCount: toCount(raw?.storageAdaptorCount),
    }
}

function normalizeItem(raw: unknown): FilterItem | null {
    if (typeof raw === 'string') {
        return { shortname: raw, max: 0, buffer: 0, min: 0 }
    }
    if (raw && typeof raw === 'object') {
        const o = raw as Record<string, unknown>
        const shortname = typeof o.shortname === 'string' ? o.shortname : ''
        if (!shortname) return null
        return {
            shortname,
            max: toNonNegInt(o.max),
            buffer: toNonNegInt(o.buffer),
            min: toNonNegInt(o.min),
        }
    }
    return null
}

function normalizeFilter(raw: Filter): Filter {
    const items = Array.isArray(raw.items)
        ? (raw.items as unknown[])
              .map(normalizeItem)
              .filter((x): x is FilterItem => x !== null)
              .slice(0, MAX_ITEMS_PER_FILTER)
        : []
    // Legacy field migration: boxItemShortname -> boxImagePath
    const legacy = (raw as unknown as { boxItemShortname?: string }).boxItemShortname
    const boxImagePath = raw.boxImagePath ?? legacy
    return {
        ...raw,
        items,
        boxImagePath,
        sharedWithOrg: raw.sharedWithOrg === true,
        ...normalizeCounts(raw),
    }
}

function normalizeCategories(cats: Category[]): Category[] {
    return cats.map((c) => ({
        ...c,
        openCoreId: c.openCoreId ?? null,
        filters: (c.filters ?? []).map(normalizeFilter),
        subcategories: (c.subcategories ?? []).map((s) => ({
            ...s,
            filters: (s.filters ?? []).map(normalizeFilter),
        })),
    }))
}

export const categories = signal<Category[]>([])
export const openCores = signal<OpenCore[]>([])
export const isHydrated = signal<boolean>(false)
export const isSyncing = signal<boolean>(false)
export const lastError = signal<string | null>(null)
export const dataSource = signal<string | null>(null)

let loadPromise: Promise<void> | null = null

async function fetchState(): Promise<void> {
    try {
        const res = await fetch('/api/me/state', { cache: 'no-store' })
        if (!res.ok) throw new Error(`GET /api/me/state failed (${res.status})`)
        const body = (await res.json()) as {
            openCores?: OpenCore[]
            categories: Category[]
            source?: string
        }
        categories.value = Array.isArray(body.categories)
            ? normalizeCategories(body.categories)
            : []
        openCores.value = Array.isArray(body.openCores)
            ? body.openCores.map((o) => ({
                  id: o.id,
                  name: o.name,
                  sharedWithOrg: o.sharedWithOrg === true,
              }))
            : []
        dataSource.value = body.source ?? null
        lastError.value = null
    } catch (err) {
        lastError.value = err instanceof Error ? err.message : 'Failed to load filters'
    } finally {
        isHydrated.value = true
    }
}

export function ensureLoaded(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    if (!loadPromise) loadPromise = fetchState()
    return loadPromise
}

if (typeof window !== 'undefined') {
    void ensureLoaded()
}

async function persist(nextCats: Category[], nextOc: OpenCore[]): Promise<void> {
    if (typeof window === 'undefined') return
    isSyncing.value = true
    try {
        const res = await fetch('/api/me/state', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ openCores: nextOc, categories: nextCats }),
        })
        if (!res.ok) throw new Error(`PUT /api/me/state failed (${res.status})`)
        lastError.value = null
    } catch (err) {
        lastError.value = err instanceof Error ? err.message : 'Failed to save filters'
        throw err
    } finally {
        isSyncing.value = false
    }
}

function commit(nextCats: Category[], nextOc: OpenCore[] = openCores.value): Promise<void> {
    categories.value = nextCats
    openCores.value = nextOc
    return persist(nextCats, nextOc)
}

function commitFireAndForget(nextCats: Category[], nextOc: OpenCore[] = openCores.value): void {
    categories.value = nextCats
    openCores.value = nextOc
    void persist(nextCats, nextOc)
}

function cloneCategories(): Category[] {
    return categories.value.map((c) => ({
        ...c,
        subcategories: c.subcategories.map((s) => ({ ...s, filters: [...s.filters] })),
        filters: [...c.filters],
    }))
}

function cloneOpenCores(): OpenCore[] {
    return openCores.value.map((o) => ({ ...o }))
}

// ---- queries -----------------------------------------------------------

export function countFiltersInCategory(c: Category): number {
    return c.filters.length + c.subcategories.reduce((acc, s) => acc + s.filters.length, 0)
}

export function categoriesForOpenCore(openCoreId: string): Category[] {
    return categories.value.filter((c) => c.openCoreId === openCoreId)
}

export function looseCategories(): Category[] {
    return categories.value.filter((c) => !c.openCoreId)
}

export function countFiltersForOpenCore(openCoreId: string): number {
    return categoriesForOpenCore(openCoreId).reduce((acc, c) => acc + countFiltersInCategory(c), 0)
}

export interface DeploymentTotals {
    /** Sum of all box deployment counts, regardless of kind. */
    boxTotal: number
    /** Subset of boxTotal whose boxImagePath classifies as a large box. */
    boxLargeTotal: number
    /** Subset of boxTotal whose boxImagePath classifies as a small box. */
    boxSmallTotal: number
    /** Subset of boxTotal whose boxImagePath classifies as a locker. */
    boxLockerTotal: number
    /** Subset of boxTotal whose boxImagePath classifies as a fridge. */
    boxFridgeTotal: number
    conveyorTotal: number
    storageAdaptorTotal: number
}

function filtersOfCategory(c: Category): Filter[] {
    return [...c.filters, ...c.subcategories.flatMap((s) => s.filters)]
}

export function deploymentTotals(filters: Filter[]): DeploymentTotals {
    return filters.reduce<DeploymentTotals>(
        (acc, f) => {
            const boxes = f.boxCount || 0
            const kind = classifyBox(f.boxImagePath)
            return {
                boxTotal: acc.boxTotal + boxes,
                boxLargeTotal: acc.boxLargeTotal + (kind === 'large' ? boxes : 0),
                boxSmallTotal: acc.boxSmallTotal + (kind === 'small' ? boxes : 0),
                boxLockerTotal: acc.boxLockerTotal + (kind === 'locker' ? boxes : 0),
                boxFridgeTotal: acc.boxFridgeTotal + (kind === 'fridge' ? boxes : 0),
                conveyorTotal: acc.conveyorTotal + (f.conveyorCount || 0),
                storageAdaptorTotal: acc.storageAdaptorTotal + (f.storageAdaptorCount || 0),
            }
        },
        {
            boxTotal: 0,
            boxLargeTotal: 0,
            boxSmallTotal: 0,
            boxLockerTotal: 0,
            boxFridgeTotal: 0,
            conveyorTotal: 0,
            storageAdaptorTotal: 0,
        },
    )
}

export function deploymentTotalsForCategory(c: Category): DeploymentTotals {
    return deploymentTotals(filtersOfCategory(c))
}

export function deploymentTotalsForOpenCore(openCoreId: string): DeploymentTotals {
    return deploymentTotals(categoriesForOpenCore(openCoreId).flatMap(filtersOfCategory))
}

export function findOpenCore(id: string): OpenCore | undefined {
    return openCores.value.find((o) => o.id === id)
}

export function getAllFilters(): Filter[] {
    const out: Filter[] = []
    for (const cat of categories.value) {
        for (const f of cat.filters) out.push(f)
        for (const sc of cat.subcategories) for (const f of sc.filters) out.push(f)
    }
    return out
}

export function findFilter(id: string): Filter | undefined {
    return getAllFilters().find((f) => f.id === id)
}

export function findCategoryByName(name: string): Category | undefined {
    return categories.value.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase())
}

// ---- open cores --------------------------------------------------------

export function addOpenCore(name: string): OpenCore {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Open Core name is required')
    const nextOc = cloneOpenCores()
    const created: OpenCore = { id: nanoid(), name: trimmed, sharedWithOrg: false }
    nextOc.push(created)
    commitFireAndForget(categories.value, nextOc)
    return created
}

export function renameOpenCore(id: string, name: string): void {
    const nextOc = cloneOpenCores()
    const oc = nextOc.find((o) => o.id === id)
    if (!oc) return
    oc.name = name.trim()
    commitFireAndForget(categories.value, nextOc)
}

export function setOpenCoreShared(id: string, shared: boolean): void {
    const nextOc = cloneOpenCores()
    const oc = nextOc.find((o) => o.id === id)
    if (!oc) return
    oc.sharedWithOrg = shared
    commitFireAndForget(categories.value, nextOc)
}

/** Delete an Open Core; its categories become loose (openCoreId = null). */
export function deleteOpenCore(id: string): void {
    const nextOc = cloneOpenCores().filter((o) => o.id !== id)
    const nextCats = cloneCategories().map((c) =>
        c.openCoreId === id ? { ...c, openCoreId: null } : c,
    )
    commitFireAndForget(nextCats, nextOc)
}

export function setCategoryOpenCore(categoryId: string, openCoreId: string | null): void {
    const next = cloneCategories()
    const cat = next.find((c) => c.id === categoryId)
    if (!cat) return
    cat.openCoreId = openCoreId
    commitFireAndForget(next)
}

// ---- categories / subcategories ---------------------------------------

function ensureCategoryByNameMutable(
    next: Category[],
    name: string,
    openCoreId: string | null = null,
): Category {
    const trimmed = name.trim()
    const existing = next.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing
    const created: Category = {
        id: nanoid(),
        name: trimmed,
        openCoreId,
        subcategories: [],
        filters: [],
    }
    next.push(created)
    return created
}

function ensureSubcategoryMutable(cat: Category, name: string): Subcategory {
    const trimmed = name.trim()
    const existing = cat.subcategories.find(
        (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase(),
    )
    if (existing) return existing
    const created: Subcategory = { id: nanoid(), name: trimmed, filters: [] }
    cat.subcategories.push(created)
    return created
}

export function addCategory(name: string, openCoreId: string | null = null): Category {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Category name is required')
    const next = cloneCategories()
    const before = next.length
    const cat = ensureCategoryByNameMutable(next, trimmed, openCoreId)
    if (next.length === before) {
        // Already existed — make sure its Open Core assignment matches the request.
        if (openCoreId !== undefined && cat.openCoreId !== openCoreId) {
            cat.openCoreId = openCoreId
            commitFireAndForget(next)
        }
        return cat
    }
    commitFireAndForget(next)
    return cat
}

export function addSubcategory(categoryId: string, name: string): Subcategory {
    const next = cloneCategories()
    const cat = next.find((c) => c.id === categoryId)
    if (!cat) throw new Error('Category not found')
    const sub = ensureSubcategoryMutable(cat, name)
    commitFireAndForget(next)
    return sub
}

export function removeSubcategory(categoryId: string, subcategoryId: string) {
    const next = cloneCategories()
    const cat = next.find((c) => c.id === categoryId)
    if (!cat) return
    const sub = cat.subcategories.find((s) => s.id === subcategoryId)
    if (!sub) return
    cat.filters.push(...sub.filters.map((f) => ({ ...f, subcategoryId: undefined })))
    cat.subcategories = cat.subcategories.filter((s) => s.id !== subcategoryId)
    commitFireAndForget(next)
}

export function renameCategory(categoryId: string, name: string) {
    const next = cloneCategories()
    const cat = next.find((c) => c.id === categoryId)
    if (!cat) return
    cat.name = name.trim()
    commitFireAndForget(next)
}

export function updateCategory(
    categoryId: string,
    patch: { name: string; openCoreId: string | null },
) {
    const next = cloneCategories()
    const cat = next.find((c) => c.id === categoryId)
    if (!cat) return
    cat.name = patch.name.trim()
    cat.openCoreId = patch.openCoreId
    commitFireAndForget(next)
}

export function deleteCategory(categoryId: string) {
    const next = categories.value.filter((c) => c.id !== categoryId)
    commitFireAndForget(next)
}

export function renameSubcategory(categoryId: string, subcategoryId: string, name: string) {
    const next = cloneCategories()
    const cat = next.find((c) => c.id === categoryId)
    if (!cat) return
    const sub = cat.subcategories.find((s) => s.id === subcategoryId)
    if (!sub) return
    sub.name = name.trim()
    commitFireAndForget(next)
}

// ---- filters -----------------------------------------------------------

export interface FilterDraft extends Partial<FilterCounts> {
    name: string
    description?: string
    coverItemShortname: string
    boxImagePath?: string
    categoryName: string
    subcategoryName?: string
    items: FilterItem[]
    sharedWithOrg?: boolean
    /** Optional: when creating from inside an Open Core, the new category goes there. */
    openCoreId?: string | null
}

function sanitizeDraftItems(items: FilterItem[]): FilterItem[] {
    return items.slice(0, MAX_ITEMS_PER_FILTER).map((it) => ({
        shortname: it.shortname,
        max: toNonNegInt(it.max),
        buffer: toNonNegInt(it.buffer),
        min: toNonNegInt(it.min),
    }))
}

export async function createFilter(draft: FilterDraft): Promise<Filter> {
    const next = cloneCategories()
    const cat = ensureCategoryByNameMutable(next, draft.categoryName, draft.openCoreId ?? null)
    const sub = draft.subcategoryName
        ? ensureSubcategoryMutable(cat, draft.subcategoryName)
        : undefined

    const filter: Filter = {
        id: nanoid(),
        name: draft.name.trim(),
        description: draft.description?.trim() || undefined,
        coverItemShortname: draft.coverItemShortname,
        boxImagePath: draft.boxImagePath || undefined,
        categoryId: cat.id,
        subcategoryId: sub?.id,
        items: sanitizeDraftItems(draft.items),
        sharedWithOrg: draft.sharedWithOrg === true,
        ...normalizeCounts(draft),
        createdAt: new Date().toISOString(),
    }

    if (sub) sub.filters.push(filter)
    else cat.filters.push(filter)

    await commit(next)
    return filter
}

export async function updateFilter(id: string, draft: FilterDraft): Promise<void> {
    const next = cloneCategories()

    let existing: Filter | undefined
    let origList: Filter[] | undefined
    let origIndex = -1
    for (const c of next) {
        const ci = c.filters.findIndex((f) => f.id === id)
        if (ci >= 0) {
            existing = c.filters[ci]
            origList = c.filters
            origIndex = ci
            break
        }
        for (const s of c.subcategories) {
            const si = s.filters.findIndex((f) => f.id === id)
            if (si >= 0) {
                existing = s.filters[si]
                origList = s.filters
                origIndex = si
                break
            }
        }
        if (existing) break
    }

    const cat = ensureCategoryByNameMutable(next, draft.categoryName, draft.openCoreId ?? null)
    const sub = draft.subcategoryName
        ? ensureSubcategoryMutable(cat, draft.subcategoryName)
        : undefined

    const updated: Filter = {
        id,
        name: draft.name.trim(),
        description: draft.description?.trim() || undefined,
        coverItemShortname: draft.coverItemShortname,
        boxImagePath: draft.boxImagePath || undefined,
        categoryId: cat.id,
        subcategoryId: sub?.id,
        items: sanitizeDraftItems(draft.items),
        sharedWithOrg: draft.sharedWithOrg === true,
        ...normalizeCounts(draft),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
    }

    const targetList = sub ? sub.filters : cat.filters
    if (origList === targetList && origIndex >= 0) {
        targetList[origIndex] = updated
    } else {
        if (origList && origIndex >= 0) origList.splice(origIndex, 1)
        targetList.push(updated)
    }

    await commit(next)
}

export function deleteFilter(id: string): void {
    const next = cloneCategories()
    for (const c of next) {
        c.filters = c.filters.filter((f) => f.id !== id)
        for (const s of c.subcategories) {
            s.filters = s.filters.filter((f) => f.id !== id)
        }
    }
    commitFireAndForget(next)
}
