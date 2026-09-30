import { useEffect, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import type { Filter } from '../types'

interface Props {
    filters: Filter[]
    reordering: boolean
    onReorder: (orderedIds: string[]) => void
    /** How each filter renders as a card (personal FilterCard vs clan FilterRow). */
    renderCard: (filter: Filter) => ComponentChildren
}

const GRID_CLASS = 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'

export default function ReorderableFilterGrid({
    filters,
    reordering,
    onReorder,
    renderCard,
}: Props) {
    const [order, setOrder] = useState<Filter[]>(filters)
    const [dragId, setDragId] = useState<string | null>(null)

    // Mirror the source list into local state — but never while a drag is in
    // flight, so the live preview isn't clobbered by an unrelated re-render.
    useEffect(() => {
        if (dragId) return
        setOrder(filters)
    }, [filters, dragId])

    if (!reordering) {
        return (
            <div class={GRID_CLASS}>
                {filters.map((f) => (
                    <div key={f.id}>{renderCard(f)}</div>
                ))}
            </div>
        )
    }

    function handleDragStart(e: DragEvent, id: string) {
        setDragId(id)
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', id)
        }
    }

    function handleDragOver(e: DragEvent, overId: string) {
        if (!dragId) return
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
        if (overId === dragId) return
        setOrder((cur) => {
            const from = cur.findIndex((f) => f.id === dragId)
            const to = cur.findIndex((f) => f.id === overId)
            if (from === -1 || to === -1 || from === to) return cur
            const nextOrder = [...cur]
            const [moved] = nextOrder.splice(from, 1)
            nextOrder.splice(to, 0, moved)
            return nextOrder
        })
    }

    function finish() {
        if (dragId) {
            const orderedIds = order.map((f) => f.id)
            const changed = orderedIds.some((id, i) => filters[i]?.id !== id)
            if (changed) onReorder(orderedIds)
        }
        setDragId(null)
    }

    return (
        <div class={GRID_CLASS}>
            {order.map((f) => (
                <div
                    key={f.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, f.id)}
                    onDragOver={(e) => handleDragOver(e, f.id)}
                    onDrop={(e) => {
                        e.preventDefault()
                        finish()
                    }}
                    onDragEnd={finish}
                    class={`relative cursor-grab rounded-md ring-2 ring-amber-500/25 transition active:cursor-grabbing ${
                        dragId === f.id ? 'opacity-40' : ''
                    }`}
                >
                    <div
                        class="pointer-events-none absolute top-1 left-1 z-20 rounded bg-slate-950/80 px-1 py-0.5 text-amber-400"
                        aria-hidden="true"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            class="h-4 w-4"
                        >
                            <circle cx="9" cy="6" r="1.6" />
                            <circle cx="15" cy="6" r="1.6" />
                            <circle cx="9" cy="12" r="1.6" />
                            <circle cx="15" cy="12" r="1.6" />
                            <circle cx="9" cy="18" r="1.6" />
                            <circle cx="15" cy="18" r="1.6" />
                        </svg>
                    </div>
                    {/* Suppress the card's own buttons while dragging is active. */}
                    <div class="pointer-events-none">{renderCard(f)}</div>
                </div>
            ))}
        </div>
    )
}
