import itemsData from '../data/items.json'
import type { Item } from '../types'

export const ALL_ITEMS: Item[] = itemsData as Item[]

const byShortname = new Map<string, Item>()
for (const it of ALL_ITEMS) byShortname.set(it.shortname, it)

export function getItem(shortname: string): Item | undefined {
    return byShortname.get(shortname)
}

export function itemImage(shortname: string): string {
    const item = byShortname.get(shortname)
    const file = item?.imagePath ?? shortname
    return `/items/medium/${file}.webp`
}

export function searchItems(query: string, limit = 60): Item[] {
    const q = query.trim().toLowerCase()
    if (!q) return ALL_ITEMS.slice(0, limit)
    const out: Item[] = []
    for (const it of ALL_ITEMS) {
        if (it.name.toLowerCase().includes(q) || it.shortname.toLowerCase().includes(q)) {
            out.push(it)
            if (out.length >= limit) break
        }
    }
    return out
}
