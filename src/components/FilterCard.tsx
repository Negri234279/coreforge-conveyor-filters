import { useEffect, useRef, useState } from 'preact/hooks'
import type { Filter } from '../types'
import { itemImage, getItem } from '../store/items'
import { boxImage } from '../store/boxes'
import { deleteFilter } from '../store/filters'
import { buildConveyorJson } from '../lib/conveyor'
import { copyToClipboard } from '../lib/clipboard'
import { showToast } from './CopyToast'
import ConfirmDeleteModal from './ConfirmDeleteModal'

interface Props {
    filter: Filter
}

export default function FilterCard({ filter }: Props) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
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
        const json = JSON.stringify(buildConveyorJson(filter.items))
        const ok = await copyToClipboard(json)
        showToast(ok ? 'Copied!' : 'Copy failed')
    }

    function onDelete() {
        setMenuOpen(false)
        setConfirmDeleteOpen(true)
    }

    function confirmDelete() {
        setConfirmDeleteOpen(false)
        deleteFilter(filter.id)
    }

    function onEdit() {
        setMenuOpen(false)
        window.location.href = `/filters/edit?id=${encodeURIComponent(filter.id)}`
    }

    function onViewItems() {
        setMenuOpen(false)
        setItemsModalOpen(true)
    }

    return (
        <div class="group flex items-center gap-3 rounded-md border border-slate-700/80 bg-slate-900/40 p-2 pr-2 transition hover:border-amber-500/60 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.2)]">
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
                    {filter.sharedWithOrg ? (
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
                class="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-amber-400"
                aria-label="Copy conveyor JSON"
                title="Copy conveyor JSON"
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
                    class="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
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
                        class="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl"
                    >
                        <button
                            type="button"
                            onClick={onViewItems}
                            class="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                        >
                            View items
                        </button>
                        <button
                            type="button"
                            onClick={onEdit}
                            class="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            class="block w-full px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10"
                        >
                            Delete
                        </button>
                    </div>
                ) : null}
            </div>

            <ConfirmDeleteModal
                open={confirmDeleteOpen}
                title="Delete filter"
                message={`Delete filter "${filter.name}"? This can't be undone.`}
                onCancel={() => setConfirmDeleteOpen(false)}
                onConfirm={confirmDelete}
            />

            {itemsModalOpen ? (
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
                    <div class="w-full max-h-[90vh] max-w-4xl rounded-lg border border-slate-700 bg-slate-900 shadow-xl flex flex-col">
                        <div class="border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4">
                            <h2 class="text-lg font-semibold text-slate-100">{filter.name}</h2>
                            <p class="mt-1 text-xs text-slate-400">
                                {filter.items.length} {filter.items.length === 1 ? 'item' : 'items'}
                            </p>
                        </div>
                        <div class="flex-1 overflow-y-auto p-2 sm:p-3">
                            {filter.items.length === 0 ? (
                                <p class="text-sm text-slate-400">No items in this filter.</p>
                            ) : (
                                <div class="grid grid-cols-3 gap-1.5 sm:gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                                    {filter.items.map((item, idx) => {
                                        const itemData = getItem(item.shortname)
                                        const itemName = itemData?.name ?? item.shortname
                                        return (
                                            <div
                                                key={idx}
                                                class="flex flex-col items-center gap-1 rounded border border-slate-700/50 bg-slate-800/40 p-1.5 sm:p-2 text-center"
                                            >
                                                <img
                                                    src={itemImage(item.shortname)}
                                                    alt={itemName}
                                                    class="h-10 w-10 sm:h-12 sm:w-12 rounded bg-slate-800 object-contain"
                                                    loading="lazy"
                                                />
                                                <div class="text-[9px] sm:text-[11px] font-semibold text-slate-200 line-clamp-2">
                                                    {itemName}
                                                </div>
                                                <div class="w-full text-[8px] sm:text-[9px] text-slate-400">
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
                                class="w-full rounded bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600"
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
