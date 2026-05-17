// Client store for the "Clan" views: individual shared filters + shared Open
// Cores. Loads on import in the browser, mirroring src/store/filters.ts.

import { signal } from '@preact/signals'
import type {
    FilterItem,
    OrgCategoryDetail,
    OrgCategoryView,
    OrgFilterView,
    OrgOpenCoreDetail,
    OrgOpenCoreView,
} from '../types'

// ---- shared filters ----------------------------------------------------

export const orgFilters = signal<OrgFilterView[]>([])
export const orgIsHydrated = signal<boolean>(false)
export const orgIsBusy = signal<boolean>(false)
export const orgError = signal<string | null>(null)

let filtersLoadPromise: Promise<void> | null = null

async function fetchOrgFilters(): Promise<void> {
    try {
        const res = await fetch('/api/org/filters', { cache: 'no-store' })
        if (!res.ok) throw new Error(`GET /api/org/filters failed (${res.status})`)
        const body = (await res.json()) as { filters: OrgFilterView[] }
        orgFilters.value = Array.isArray(body.filters) ? body.filters : []
        orgError.value = null
    } catch (err) {
        orgError.value = err instanceof Error ? err.message : 'Failed to load clan filters'
    } finally {
        orgIsHydrated.value = true
    }
}

export function ensureOrgLoaded(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    if (!filtersLoadPromise) filtersLoadPromise = fetchOrgFilters()
    return filtersLoadPromise
}

export async function cloneOrgFilter(id: string): Promise<string> {
    orgIsBusy.value = true
    try {
        const res = await fetch('/api/org/filters/clone', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id }),
        })
        if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(text || `Clone failed (${res.status})`)
        }
        const body = (await res.json()) as { id: string }
        return body.id
    } finally {
        orgIsBusy.value = false
    }
}

// ---- shared Open Cores -------------------------------------------------

export const orgOpenCores = signal<OrgOpenCoreView[]>([])
export const orgOpenCoresHydrated = signal<boolean>(false)
export const orgOpenCoresError = signal<string | null>(null)

let ocLoadPromise: Promise<void> | null = null

async function fetchOrgOpenCores(): Promise<void> {
    try {
        const res = await fetch('/api/org/opencores', { cache: 'no-store' })
        if (!res.ok) throw new Error(`GET /api/org/opencores failed (${res.status})`)
        const body = (await res.json()) as { openCores: OrgOpenCoreView[] }
        orgOpenCores.value = Array.isArray(body.openCores) ? body.openCores : []
        orgOpenCoresError.value = null
    } catch (err) {
        orgOpenCoresError.value =
            err instanceof Error ? err.message : 'Failed to load clan Open Cores'
    } finally {
        orgOpenCoresHydrated.value = true
    }
}

export function ensureOrgOpenCoresLoaded(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    if (!ocLoadPromise) ocLoadPromise = fetchOrgOpenCores()
    return ocLoadPromise
}

// ---- shared categories -------------------------------------------------

export const orgCategories = signal<OrgCategoryView[]>([])
export const orgCategoriesHydrated = signal<boolean>(false)
export const orgCategoriesError = signal<string | null>(null)

let catLoadPromise: Promise<void> | null = null

async function fetchOrgCategories(): Promise<void> {
    try {
        const res = await fetch('/api/org/categories', { cache: 'no-store' })
        if (!res.ok) throw new Error(`GET /api/org/categories failed (${res.status})`)
        const body = (await res.json()) as { categories: OrgCategoryView[] }
        orgCategories.value = Array.isArray(body.categories) ? body.categories : []
        orgCategoriesError.value = null
    } catch (err) {
        orgCategoriesError.value =
            err instanceof Error ? err.message : 'Failed to load clan categories'
    } finally {
        orgCategoriesHydrated.value = true
    }
}

export function ensureOrgCategoriesLoaded(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    if (!catLoadPromise) catLoadPromise = fetchOrgCategories()
    return catLoadPromise
}

export async function fetchOrgCategoryDetail(id: string): Promise<OrgCategoryDetail> {
    const res = await fetch(`/api/org/categories/${encodeURIComponent(id)}`, { cache: 'no-store' })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Failed to load category (${res.status})`)
    }
    return (await res.json()) as OrgCategoryDetail
}

export async function cloneOrgCategory(id: string): Promise<{ id: string; name: string }> {
    orgIsBusy.value = true
    try {
        const res = await fetch('/api/org/categories/clone', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id }),
        })
        if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(text || `Clone failed (${res.status})`)
        }
        return (await res.json()) as { id: string; name: string }
    } finally {
        orgIsBusy.value = false
    }
}

if (typeof window !== 'undefined') {
    void ensureOrgLoaded()
    void ensureOrgOpenCoresLoaded()
    void ensureOrgCategoriesLoaded()
}

export async function fetchOrgOpenCoreDetail(id: string): Promise<OrgOpenCoreDetail> {
    const res = await fetch(`/api/org/opencores/${encodeURIComponent(id)}`, { cache: 'no-store' })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Failed to load Open Core (${res.status})`)
    }
    return (await res.json()) as OrgOpenCoreDetail
}

export async function cloneOrgOpenCore(id: string): Promise<{ id: string; name: string }> {
    orgIsBusy.value = true
    try {
        const res = await fetch('/api/org/opencores/clone', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id }),
        })
        if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(text || `Clone failed (${res.status})`)
        }
        return (await res.json()) as { id: string; name: string }
    } finally {
        orgIsBusy.value = false
    }
}

// ---- org Open Core mutation (owner/admin only) --------------------------

async function managePost(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`/api/org/manage/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Request failed (${res.status})`)
    }
    return res.json()
}

export async function createOrgCategory(
    openCoreId: string,
    name: string,
): Promise<{ id: string; name: string }> {
    return managePost('add-category', { openCoreId, name }) as Promise<{ id: string; name: string }>
}

export async function deleteOrgCategory(categoryId: string): Promise<void> {
    await managePost('del-category', { categoryId })
}

export async function createOrgSubcategory(
    categoryId: string,
    name: string,
): Promise<{ id: string; name: string }> {
    return managePost('add-subcategory', { categoryId, name }) as Promise<{
        id: string
        name: string
    }>
}

export async function deleteOrgSubcategory(subcategoryId: string): Promise<void> {
    await managePost('del-subcategory', { subcategoryId })
}

export interface OrgFilterDraft {
    categoryId: string
    subcategoryId?: string
    name: string
    description?: string
    coverItemShortname: string
    boxImagePath?: string
    boxCount: number
    conveyorCount: number
    storageAdaptorCount: number
    items: FilterItem[]
}

export async function createOrgFilter(
    draft: OrgFilterDraft,
): Promise<{ id: string; categoryId: string }> {
    return managePost('add-filter', draft) as Promise<{ id: string; categoryId: string }>
}

export async function updateOrgFilter(filterId: string, draft: OrgFilterDraft): Promise<void> {
    await managePost('update-filter', { filterId, ...draft })
}

export async function deleteOrgFilter(filterId: string): Promise<void> {
    await managePost('del-filter', { filterId })
}

export async function shareOpenCoreWithClan(
    openCoreId: string,
): Promise<{ id: string; name: string }> {
    return managePost('share-opencore', { openCoreId }) as Promise<{ id: string; name: string }>
}

export async function deleteOrgOpenCore(openCoreId: string): Promise<void> {
    await managePost('del-opencore', { openCoreId })
}
