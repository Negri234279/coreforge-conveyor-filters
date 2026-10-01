// A tiny in-app "filter clipboard": copy a filter from any Open Core (personal
// or clan) and paste it into a category/subcategory as a brand-new, unrelated
// filter. Backed by localStorage so the copy survives page navigation AND is
// shared across tabs/windows of the same origin — copy in one tab, paste into a
// different Open Core open in another tab. A `storage` listener keeps every
// tab's signal in sync.

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

function parse(raw: string | null): CopiedFilter | null {
    if (!raw) return null
    try {
        return JSON.parse(raw) as CopiedFilter
    } catch {
        return null
    }
}

function readInitial(): CopiedFilter | null {
    if (typeof window === 'undefined') return null
    try {
        return parse(localStorage.getItem(STORAGE_KEY))
    } catch {
        return null
    }
}

export const copiedFilter = signal<CopiedFilter | null>(readInitial())

// Other tabs write to localStorage → reflect the change here so the "Paste"
// option appears/disappears without a reload. The event only fires in tabs
// other than the one that made the change, so no echo to guard against.
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key !== STORAGE_KEY) return
        copiedFilter.value = parse(e.newValue)
    })
}

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
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
        } catch {
            // localStorage may be unavailable (private mode); the in-memory
            // signal still works for the current tab.
        }
    }
}

export function clearCopiedFilter(): void {
    copiedFilter.value = null
    if (typeof window !== 'undefined') {
        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch {
            // ignore
        }
    }
}
