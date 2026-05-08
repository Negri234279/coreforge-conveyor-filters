import boxesData from '../data/box.json'
import type { Box } from '../types'

export const ALL_BOXES: Box[] = (boxesData as Box[]).filter(
    (b) => b && typeof b.imagePath === 'string' && b.imagePath.length > 0,
)

const byImagePath = new Map<string, Box>()
for (const b of ALL_BOXES) byImagePath.set(b.imagePath, b)

export function getBox(imagePath: string): Box | undefined {
    return byImagePath.get(imagePath)
}

export function boxImage(imagePath: string): string {
    return `/boxes/${imagePath}.webp`
}

export function searchBoxes(query: string, limit = 60): Box[] {
    const q = query.trim().toLowerCase()
    if (!q) return ALL_BOXES.slice(0, limit)
    const out: Box[] = []
    for (const b of ALL_BOXES) {
        if (b.name.toLowerCase().includes(q) || b.imagePath.toLowerCase().includes(q)) {
            out.push(b)
            if (out.length >= limit) break
        }
    }
    return out
}
