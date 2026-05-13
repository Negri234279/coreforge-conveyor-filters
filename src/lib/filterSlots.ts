// Slot encoding for FilterItem.shortname.
//
// A filter slot is either:
//   - an item slot:     shortname = the Rust item shortname (e.g. "metal.fragments")
//   - a category slot:  shortname = `category:<id>` where <id> is the numeric
//                       ItemCategory id from src/data/categories.json
//
// Storing both as a `shortname` string keeps the existing SQLite schema, the
// `(filter_id, shortname)` unique index and the `/api/me/state` normalizer
// untouched — they treat the value as opaque.

import { getItem, itemImage } from '../store/items'
import { getGameCategory } from '../store/gameCategories'

export const CATEGORY_PREFIX = 'category:'

export function categorySlotShortname(id: number): string {
    return `${CATEGORY_PREFIX}${id}`
}

export function isCategorySlot(shortname: string): boolean {
    return shortname.startsWith(CATEGORY_PREFIX)
}

export function categoryIdFromSlot(shortname: string): number | null {
    if (!isCategorySlot(shortname)) return null
    const n = Number(shortname.slice(CATEGORY_PREFIX.length))
    return Number.isFinite(n) ? n : null
}

export interface SlotMeta {
    isCategory: boolean
    /** Display title (item name or category name). Falls back to shortname. */
    label: string
    /** Secondary line: item shortname for items, "Game category" for categories. */
    hint?: string
    /** Image URL if any. Categories return undefined — the caller renders a chip. */
    imageUrl?: string
    /** True if the shortname can't be resolved to a known item/category. */
    unknown: boolean
}

export function describeSlot(shortname: string): SlotMeta {
    const catId = categoryIdFromSlot(shortname)
    if (catId !== null) {
        const cat = getGameCategory(catId)
        return {
            isCategory: true,
            label: cat?.name ?? `Category ${catId}`,
            hint: 'Game category',
            imageUrl: undefined,
            unknown: !cat,
        }
    }
    const it = getItem(shortname)
    return {
        isCategory: false,
        label: it?.name ?? shortname,
        hint: shortname,
        imageUrl: itemImage(shortname),
        unknown: !it,
    }
}
