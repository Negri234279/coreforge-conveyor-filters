// Classify a box / container by its name or imagePath so deployment totals
// can split the global "Boxes" counter into separate buckets per kind.
//
// Rules (matched on a lowercased version of the input):
//   - Locker: contains 'locker'.
//   - Fridge: contains 'fridge'.
//   - Small:  contains 'small'.
//   - Large:  contains 'large', or contains 'storage' and none of the above.
//   - Otherwise: null (uncategorised — e.g. plain "Neon Med" / "Neon Elec").

export type BoxKind = 'large' | 'small' | 'locker' | 'fridge'

export function classifyBox(input: string | null | undefined): BoxKind | null {
    if (!input) return null
    const s = input.toLowerCase()
    if (s.includes('locker')) return 'locker'
    if (s.includes('fridge')) return 'fridge'
    if (s.includes('small')) return 'small'
    if (s.includes('large') || s.includes('storage')) return 'large'
    return null
}
