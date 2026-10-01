// A tiny in-app "filter clipboard": copy a filter from any Open Core (personal
// or clan) and paste it into a category/subcategory as a brand-new, unrelated
// filter. Backed by sessionStorage so the copy survives page navigation (the
// clan "new filter" and personal "edit" flows navigate away and back).

import { signal } from '@preact/signals'
import type { Filter, FilterItem } from '../types'

export interface CopiedFilter {
    name: string
    description?: string
    coverItemShortname: string
    boxImagePath?: string
    boxCount: number
    conveyorCount: number
    storageAdaptorCount: number
    items: FilterItem[]
}

const STORAGE_KEY = 'cf:filter-clipboard'

function readInitial(): CopiedFilter | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        return JSON.parse(raw) as CopiedFilter
    } catch {
        return null
    }
}

export const copiedFilter = signal<CopiedFilter | null>(readInitial())

export function copyFilter(filter: Filter): void {
    const payload: CopiedFilter = {
        name: filter.name,
        description: filter.description,
        coverItemShortname: filter.coverItemShortname,
        boxImagePath: filter.boxImagePath,
        boxCount: filter.boxCount ?? 1,
        conveyorCount: filter.conveyorCount ?? 1,
        storageAdaptorCount: filter.storageAdaptorCount ?? 1,
        items: filter.items.map((it) => ({
            shortname: it.shortname,
            max: it.max,
            buffer: it.buffer,
            min: it.min,
        })),
    }
    copiedFilter.value = payload
    if (typeof window !== 'undefined') {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
        } catch {
            // sessionStorage may be unavailable (private mode); the in-memory
            // signal still works for the current page.
        }
    }
}

export function clearCopiedFilter(): void {
    copiedFilter.value = null
    if (typeof window !== 'undefined') {
        try {
            sessionStorage.removeItem(STORAGE_KEY)
        } catch {
            // ignore
        }
    }
}
