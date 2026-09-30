import { useEffect, useRef, useState } from 'preact/hooks'
import type { Filter } from '../types'
import { itemImage, getItem } from '../store/items'
import { boxImage } from '../store/boxes'
import { buildConveyorJson } from '../lib/conveyor'
import { copyToClipboard } from '../lib/clipboard'
import { showToast } from './CopyToast'

export interface FilterCardAction {
    label: string
    tone?: 'danger'
    onClick: () => void
}

interface Props {
    filter: Filter
    /** Extra menu actions rendered after the built-in "View items" entry. */
    actions?: FilterCardAction[]
    /** Show the amber "Shared" badge when the filter is shared with the clan. */
    showSharedBadge?: boolean
}

/**
 * The canonical filter card used everywhere (personal + clan views). Owns the
 * card layout, the copy-to-clipboard button, the actions menu, and the
 * "View items" modal. Callers supply only the extra menu actions they need.
 */
export default function FilterCardBase({ filter, actions = [], showSharedBadge = false }: Props) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [itemsModalOpen, setItemsModalOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (!menuRef.current) return
            if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
        }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
    }, [])

    async function onCopy() {
        const ok = await copyToClipboard(JSON.stringify(buildConveyorJson(filter.items)))
        showToast(ok ? 'Copied · Shift in-game' : 'Copy failed')
    }

    return (
        <div class="group flex items-center gap-3 rounded-md border border-slate-700/80 bg-slate-900/40 p-2 transition hover:border-amber-500/60 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.2)]">
            <div class="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-slate-800/80">
                <img
                    src={itemImage(filter.coverItemShortname)}
                    alt=""
                    class="h-full w-full object-contain"
                    loading="lazy"
                />
                {filter.boxImagePath ? (
                    <img
                        src={boxImage(filter.boxImagePath)}
                        alt=""
                        class="absolute right-0.5 bottom-0.5 h-7 w-7 rounded border border-slate-700 bg-slate-900/90 object-contain p-0.5"
                        loading="lazy"
                    />
                ) : null}
            </div>

            <div class="flex min-w-0 flex-1 flex-col">
                <span class="flex items-center gap-2">
                    <span class="truncate text-sm font-semibold tracking-wide text-slate-100 uppercase">
                        {filter.name}
                    </span>
                    {showSharedBadge && filter.sharedWithOrg ? (
                        <span
                            class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wider text-amber-400 uppercase"
                            title="Shared with your clan"
                        >
                            Shared
                        </span>
                    ) : null}
                </span>
                <span class="truncate text-xs text-slate-500">
                    {filter.items.length} {filter.items.length === 1 ? 'item' : 'items'}
                    {' · '}
                    <span title="Boxes / Conveyors / Storage adaptors">
                        {filter.boxCount ?? 1}/{filter.conveyorCount ?? 1}/
                        {filter.storageAdaptorCount ?? 1}
                    </span>
                </span>
            </div>

            <button
                type="button"
                onClick={onCopy}
                class="rounded p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                aria-label="Copy conveyor JSON"
                title="Copy conveyor JSON — hold Shift in-game to paste"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="h-4 w-4"
                >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
            </button>

            <div class="relative" ref={menuRef}>
                <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    class="rounded p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        class="h-4 w-4"
                    >
                        <circle cx="12" cy="5" r="1.7" />
                        <circle cx="12" cy="12" r="1.7" />
                        <circle cx="12" cy="19" r="1.7" />
                    </svg>
                </button>
                {menuOpen ? (
                    <div
                        role="menu"
                        class="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded border border-slate-800 bg-[#0d1117] shadow-xl"
                    >
                        <button
                            type="button"
                            onClick={() => {
                                setMenuOpen(false)
                                setItemsModalOpen(true)
                            }}
                            class="block w-full px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
                        >
                            View items
                        </button>
                        {actions.map((action) => (
                            <button
                                key={action.label}
                                type="button"
                                onClick={() => {
                                    setMenuOpen(false)
                                    action.onClick()
                                }}
                                class={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-800 ${
                                    action.tone === 'danger' ? 'text-rose-400' : 'text-slate-200'
                                }`}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            {itemsModalOpen ? (
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4">
                    <div
                        class="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-slate-800 shadow-xl"
                        style="background:rgba(15,23,42,0.97); border-left:2px solid rgba(245,158,11,0.32)"
                    >
                        <div class="border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
                            <h2
                                class="text-2xl text-slate-100"
                                style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                            >
                                {filter.name}
                            </h2>
                            <p class="mt-1 text-xs text-slate-400">
                                {filter.items.length} {filter.items.length === 1 ? 'item' : 'items'}
                            </p>
                        </div>
                        <div class="flex-1 overflow-y-auto p-2 sm:p-3">
                            {filter.items.length === 0 ? (
                                <p class="text-sm text-slate-400">No items in this filter.</p>
                            ) : (
                                <div class="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 md:grid-cols-5 lg:grid-cols-6">
                                    {filter.items.map((item, idx) => {
                                        const itemData = getItem(item.shortname)
                                        const itemName = itemData?.name ?? item.shortname
                                        return (
                                            <div
                                                key={idx}
                                                class="flex flex-col items-center gap-1 rounded border border-slate-800/50 bg-slate-800/30 p-1.5 text-center sm:p-2"
                                            >
                                                <img
                                                    src={itemImage(item.shortname)}
                                                    alt={itemName}
                                                    class="h-10 w-10 rounded bg-slate-800 object-contain sm:h-12 sm:w-12"
                                                    loading="lazy"
                                                />
                                                <div class="line-clamp-2 text-[9px] font-semibold text-slate-200 sm:text-[11px]">
                                                    {itemName}
                                                </div>
                                                <div class="w-full text-[8px] text-slate-400 sm:text-[9px]">
                                                    <div class="flex justify-between gap-0.5 sm:gap-1">
                                                        <span title="Max">M:{item.max}</span>
                                                        <span title="Buffer">B:{item.buffer}</span>
                                                        <span title="Min">m:{item.min}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <div class="border-t border-slate-800 px-4 py-2 sm:px-6 sm:py-3">
                            <button
                                type="button"
                                onClick={() => setItemsModalOpen(false)}
                                class="w-full rounded bg-amber-500 px-3 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
