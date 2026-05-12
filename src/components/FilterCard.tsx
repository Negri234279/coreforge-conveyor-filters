import { useEffect, useRef, useState } from 'preact/hooks'
import type { Filter, ConveyorItem } from '../types'
import { itemImage } from '../store/items'
import { boxImage } from '../store/boxes'
import { deleteFilter } from '../store/filters'
import { copyToClipboard } from '../lib/clipboard'
import { showToast } from './CopyToast'
import ConfirmDeleteModal from './ConfirmDeleteModal'

interface Props {
    filter: Filter
}

function buildConveyorJson(filter: Filter): ConveyorItem[] {
    return filter.items.map((it) => ({
        TargetCategory: null,
        MaxAmountInOutput: it.max,
        BufferAmount: it.buffer,
        MinAmountInInput: it.min,
        IsBlueprint: false,
        BufferTransferRemaining: 0,
        TargetItemName: it.shortname,
    }))
}

export default function FilterCard({ filter }: Props) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
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
        const json = JSON.stringify(buildConveyorJson(filter))
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

    return (
        <div class="group flex items-center gap-3 rounded-md border border-slate-700/80 bg-slate-900/40 p-2 pr-2 transition hover:border-teal-500/60 hover:shadow-[0_0_0_1px_rgba(20,184,166,0.25)]">
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
                            class="rounded bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-teal-300 uppercase"
                            title="Shared with your clan"
                        >
                            Shared
                        </span>
                    ) : null}
                </span>
                <span class="truncate text-xs text-slate-500">
                    {filter.items.length} {filter.items.length === 1 ? 'item' : 'items'}
                </span>
            </div>

            <button
                type="button"
                onClick={onCopy}
                class="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-teal-300"
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
                        class="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl"
                    >
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
        </div>
    )
}
