import categoriesData from '../data/categories.json'
import { ALL_ITEMS } from './items'
import type { CategorySeed, Item } from '../types'

export const ALL_GAME_CATEGORIES: CategorySeed[] = (categoriesData as CategorySeed[]).slice()

const byId = new Map<number, CategorySeed>()
const byNameLower = new Map<string, CategorySeed>()
for (const c of ALL_GAME_CATEGORIES) {
    byId.set(c.id, c)
    byNameLower.set(c.name.toLowerCase(), c)
}

// items.json uses slightly different category strings than the game's
// ItemCategory enum names — map ItemCategory id -> the `Item.category` values
// that belong to it. Multiple item-categories can map to a single game
// category (e.g. "Other" buckets Misc).
const ITEM_LABELS_BY_GAME_ID: Record<number, string[]> = {
    0: ['Weapon'],
    1: ['Construction'],
    2: ['Items'],
    3: ['Resources'],
    4: ['Attire'],
    5: ['Tool'],
    6: ['Medical'],
    7: ['Food'],
    8: ['Ammunition'],
    9: ['Traps'],
    10: ['Misc'],
    13: ['Component'],
    16: ['Electrical'],
    17: ['Fun'],
}

const itemsByGameId = new Map<number, Item[]>()
for (const cat of ALL_GAME_CATEGORIES) {
    const labels = new Set(ITEM_LABELS_BY_GAME_ID[cat.id] ?? [])
    itemsByGameId.set(
        cat.id,
        ALL_ITEMS.filter((it) => labels.has(it.category)),
    )
}

export function getGameCategory(id: number): CategorySeed | undefined {
    return byId.get(id)
}

export function getGameCategoryByName(name: string): CategorySeed | undefined {
    return byNameLower.get(name.trim().toLowerCase())
}

export function itemsInGameCategory(id: number): Item[] {
    return itemsByGameId.get(id) ?? []
}

export function searchGameCategories(query: string, limit = 60): CategorySeed[] {
    const q = query.trim().toLowerCase()
    if (!q) return ALL_GAME_CATEGORIES.slice(0, limit)
    const out: CategorySeed[] = []
    for (const c of ALL_GAME_CATEGORIES) {
        if (c.name.toLowerCase().includes(q)) {
            out.push(c)
            if (out.length >= limit) break
        }
    }
    return out
}
