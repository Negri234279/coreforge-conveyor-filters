import { useEffect, useRef, useState } from 'preact/hooks'
import { cloneOrgCategory, fetchOrgCategoryDetail, orgIsBusy } from '../store/org'
import { deploymentTotals } from '../store/filters'
import { itemImage, getItem } from '../store/items'
import { boxImage } from '../store/boxes'
import { buildConveyorJson } from '../lib/conveyor'
import { copyToClipboard } from '../lib/clipboard'
import { showToast } from './CopyToast'
import DeploymentTotals from './DeploymentTotals'
import type { Filter, OrgCategoryDetail as Detail } from '../types'

interface Props {
    categoryId: string
}

function FilterRow({ filter }: { filter: Filter }) {
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
        showToast(ok ? 'Copied!' : 'Copy failed')
    }

    function onViewItems() {
        setMenuOpen(false)
        setItemsModalOpen(true)
    }
    return (
        <li class="flex items-center gap-3 rounded border border-slate-800 bg-slate-900/30 p-2">
            <div class="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-slate-800">
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
                        class="absolute right-0.5 bottom-0.5 h-7 w-7 rounded border border-slate-800 bg-slate-900/90 object-contain p-0.5"
                        loading="lazy"
                    />
                ) : null}
            </div>
            <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-semibold tracking-wide text-slate-100 uppercase">
                    {filter.name}
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
                            onClick={onViewItems}
                            class="block w-full px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
                        >
                            View items
                        </button>
                    </div>
                ) : null}
            </div>

            {itemsModalOpen ? (
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4">
                    <div
                        class="w-full max-h-[90vh] max-w-4xl rounded-lg border border-slate-800 shadow-xl flex flex-col"
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
                                <div class="grid grid-cols-3 gap-1.5 sm:gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                                    {filter.items.map((item, idx) => {
                                        const itemData = getItem(item.shortname)
                                        const itemName = itemData?.name ?? item.shortname
                                        return (
                                            <div
                                                key={idx}
                                                class="flex flex-col items-center gap-1 rounded border border-slate-800/50 bg-slate-800/30 p-1.5 sm:p-2 text-center"
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
                                class="w-full rounded bg-amber-500 px-3 py-2 text-sm font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-amber-400"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </li>
    )
}

export default function OrgCategoryDetail({ categoryId }: Props) {
    const [detail, setDetail] = useState<Detail | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loaded, setLoaded] = useState(false)
    const busy = orgIsBusy.value

    useEffect(() => {
        let cancelled = false
        fetchOrgCategoryDetail(categoryId)
            .then((d) => {
                if (!cancelled) setDetail(d)
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
            })
            .finally(() => {
                if (!cancelled) setLoaded(true)
            })
        return () => {
            cancelled = true
        }
    }, [categoryId])

    async function onClone() {
        try {
            const res = await cloneOrgCategory(categoryId)
            showToast(`Cloned "${res.name}" to your categories`)
            window.location.href = '/'
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Clone failed')
        }
    }

    if (!loaded) return <p class="text-sm text-slate-500">Loading…</p>
    if (error || !detail) {
        return (
            <div class="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                {error ?? 'Category not available.'}{' '}
                <a
                    href="/org/filters"
                    class="text-amber-400 underline decoration-amber-400/40 transition-colors hover:text-amber-300 hover:decoration-amber-400"
                >
                    Back to Clan Filters
                </a>
            </div>
        )
    }

    const allFilters = [...detail.filters, ...detail.subcategories.flatMap((s) => s.filters)]
    const totals = deploymentTotals(allFilters)

    return (
        <div>
            <div class="mb-6">
                <a
                    href="/org/filters"
                    class="text-xs font-semibold tracking-wider text-slate-500 uppercase transition-colors hover:text-amber-400"
                >
                    &larr; Back to Clan Filters
                </a>
                <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1
                            class="text-3xl text-slate-100"
                            style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                        >
                            {detail.name}
                        </h1>
                        <p class="mt-1 text-sm text-slate-400">
                            Shared by <span class="text-slate-200">{detail.owner.username}</span>
                            {detail.openCoreName ? (
                                <>
                                    {' · from '}
                                    <span class="text-slate-200">{detail.openCoreName}</span>
                                </>
                            ) : null}{' '}
                            · read-only
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClone}
                        disabled={busy}
                        class="rounded bg-amber-500 px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Clone category
                    </button>
                </div>
            </div>

            {allFilters.length > 0 ? (
                <DeploymentTotals totals={totals} variant="stat" class="mb-6" />
            ) : null}

            {allFilters.length === 0 ? (
                <p class="text-sm text-slate-500">This category has no filters yet.</p>
            ) : (
                <div class="space-y-6">
                    {detail.filters.length > 0 ? (
                        <ul class="grid gap-3 sm:grid-cols-2">
                            {detail.filters.map((f) => (
                                <FilterRow key={f.id} filter={f} />
                            ))}
                        </ul>
                    ) : null}
                    {detail.subcategories.map((sub) => (
                        <section key={sub.id}>
                            <h2 class="font-mono text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
                                {sub.name}
                            </h2>
                            {sub.filters.length === 0 ? (
                                <p class="mt-2 text-xs text-slate-500">No filters.</p>
                            ) : (
                                <ul class="mt-2 grid gap-3 sm:grid-cols-2">
                                    {sub.filters.map((f) => (
                                        <FilterRow key={f.id} filter={f} />
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            )}
        </div>
    )
}
