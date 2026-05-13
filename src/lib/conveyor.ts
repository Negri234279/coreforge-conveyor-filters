// Shared (de)serialization for Rust's industrial conveyor JSON.
//
// In-game JSON shape per slot:
//   - item slot:     { TargetCategory: null,    TargetItemName: "<shortname>", ... }
//   - category slot: { TargetCategory: <id>,    TargetItemName: "",            ... }
//
// We normalize both into a FilterItem with `shortname` carrying either the
// Rust item shortname or a synthetic `category:<id>` (see ./filterSlots).

import type { ConveyorItem, FilterItem } from '../types'
import {
    CATEGORY_PREFIX,
    categoryIdFromSlot,
    categorySlotShortname,
    isCategorySlot,
} from './filterSlots'
import { getGameCategory } from '../store/gameCategories'
import { getItem } from '../store/items'

export const MAX_CONVEYOR_ITEMS = 30

function toNonNegInt(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v ?? 0)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.floor(n)
}

export function buildConveyorJson(items: FilterItem[]): ConveyorItem[] {
    return items.map((it) => {
        if (isCategorySlot(it.shortname)) {
            const id = categoryIdFromSlot(it.shortname) ?? 0
            return {
                TargetCategory: id,
                MaxAmountInOutput: it.max,
                BufferAmount: it.buffer,
                MinAmountInInput: it.min,
                IsBlueprint: false,
                BufferTransferRemaining: 0,
                TargetItemName: '',
            }
        }
        return {
            TargetCategory: null,
            MaxAmountInOutput: it.max,
            BufferAmount: it.buffer,
            MinAmountInInput: it.min,
            IsBlueprint: false,
            BufferTransferRemaining: 0,
            TargetItemName: it.shortname,
        }
    })
}

export interface ImportResult {
    items: FilterItem[]
    /** Item shortnames that aren't in items.json. */
    unknownItems: number
    /** Category ids that aren't in categories.json. */
    unknownCategories: number
    /** Entries that were neither item nor category (empty / malformed / dup). */
    skipped: number
}

export function parseConveyorJson(raw: string): ImportResult {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new Error('Invalid JSON. Paste the full conveyor config from the game.')
    }
    // Rust always exports an array, but accept a single object as a one-entry array.
    const entries: unknown[] = Array.isArray(parsed) ? parsed : [parsed]

    const seen = new Set<string>()
    const out: FilterItem[] = []
    let unknownItems = 0
    let unknownCategories = 0
    let skipped = 0

    for (const entry of entries) {
        if (!entry || typeof entry !== 'object') {
            skipped++
            continue
        }
        const o = entry as Record<string, unknown>

        // Resolve to a slot key. Item name takes priority — if present, it's an
        // item slot regardless of TargetCategory.
        const name = typeof o.TargetItemName === 'string' ? o.TargetItemName.trim() : ''

        let slotKey = ''
        let isCategory = false
        let unknown = false

        if (name) {
            slotKey = name
            unknown = !getItem(name)
        } else {
            const cat = o.TargetCategory
            let catId: number | null = null
            if (typeof cat === 'number' && Number.isFinite(cat)) {
                catId = Math.floor(cat)
            } else if (typeof cat === 'string' && cat.trim() !== '') {
                // Some serializers might emit the enum name instead of the number.
                const fromNum = Number(cat)
                if (Number.isFinite(fromNum)) {
                    catId = Math.floor(fromNum)
                }
            }
            if (catId !== null) {
                slotKey = categorySlotShortname(catId)
                isCategory = true
                unknown = !getGameCategory(catId)
            }
        }

        if (!slotKey) {
            skipped++
            continue
        }
        if (seen.has(slotKey)) {
            skipped++
            continue
        }
        seen.add(slotKey)

        if (unknown) {
            if (isCategory) unknownCategories++
            else unknownItems++
        }

        out.push({
            shortname: slotKey,
            max: toNonNegInt(o.MaxAmountInOutput),
            buffer: toNonNegInt(o.BufferAmount),
            min: toNonNegInt(o.MinAmountInInput),
        })
        if (out.length >= MAX_CONVEYOR_ITEMS) break
    }

    return { items: out, unknownItems, unknownCategories, skipped }
}

// Re-export for convenience so call-sites only need one import.
export { CATEGORY_PREFIX }
