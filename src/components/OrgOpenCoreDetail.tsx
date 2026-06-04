import { useEffect, useRef, useState } from 'preact/hooks'
import {
    cloneOrgOpenCore,
    fetchOrgOpenCoreDetail,
    orgIsBusy,
    createOrgCategory,
    deleteOrgCategory,
    createOrgSubcategory,
    deleteOrgSubcategory,
    deleteOrgFilter,
    deleteOrgOpenCore,
} from '../store/org'
import { getCurrentUser } from '../store/auth'
import { deploymentTotals } from '../store/filters'
import { itemImage, getItem } from '../store/items'
import { boxImage } from '../store/boxes'
import { buildConveyorJson } from '../lib/conveyor'
import { copyToClipboard } from '../lib/clipboard'
import { showToast } from './CopyToast'
import OpenCoreBoxesView from './OpenCoreBoxesView'
import DeploymentTotals from './DeploymentTotals'
import OpenCoreViewer from './openCore3D/OpenCoreViewer'
import type { Category, Filter, OrgOpenCoreDetail as Detail } from '../types'

type View = 'conveyors' | 'boxes' | '3d'

interface Props {
    openCoreId: string
}

interface FilterRowProps {
    filter: Filter
    canEdit: boolean
    openCoreId: string
    onDeleted: () => void
}

function FilterRow({ filter, canEdit, openCoreId, onDeleted }: FilterRowProps) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [itemsModalOpen, setItemsModalOpen] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
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

    function onViewItems() {
        setMenuOpen(false)
        setItemsModalOpen(true)
    }

    function onEditFilter() {
        window.location.href = `/org/opencore/${openCoreId}/filter/edit?filterId=${encodeURIComponent(filter.id)}`
    }

    async function onDeleteFilter() {
        setDeleting(true)
        try {
            await deleteOrgFilter(filter.id)
            onDeleted()
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Delete failed')
        } finally {
            setDeleting(false)
            setConfirmDelete(false)
        }
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
                        {canEdit ? (
                            <>
                                <button
                                    type="button"
                                    onClick={onEditFilter}
                                    class="block w-full px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMenuOpen(false)
                                        setConfirmDelete(true)
                                    }}
                                    class="block w-full px-3 py-2 text-left text-sm text-rose-400 transition-colors hover:bg-slate-800"
                                >
                                    Delete
                                </button>
                            </>
                        ) : null}
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

            {confirmDelete ? (
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div
                        class="w-full max-w-sm rounded-lg border border-slate-800 p-6 shadow-xl"
                        style="background:rgba(15,23,42,0.97); border-left:2px solid rgba(245,158,11,0.32)"
                    >
                        <h2
                            class="text-xl text-slate-100"
                            style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                        >
                            Delete filter?
                        </h2>
                        <p class="mt-2 text-sm text-slate-400">
                            "{filter.name}" will be permanently removed.
                        </p>
                        <div class="mt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(false)}
                                class="rounded px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onDeleteFilter}
                                disabled={deleting}
                                class="rounded bg-rose-600 px-4 py-2 text-sm font-bold tracking-wide text-slate-50 uppercase transition-colors hover:bg-rose-500 disabled:opacity-60"
                            >
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </li>
    )
}

function filterMatches(f: Filter, q: string): boolean {
    if (f.name.toLowerCase().includes(q)) return true

    return f.items.some((item) => {
        if (item.shortname.toLowerCase().includes(q)) return true

        const resolved = getItem(item.shortname)
        return resolved?.name.toLowerCase().includes(q) ?? false
    })
}

function applySearch(cats: Category[], q: string): Category[] {
    if (!q) return cats

    return cats
        .map((cat) => ({
            ...cat,
            filters: cat.filters.filter((f) => filterMatches(f, q)),
            subcategories: cat.subcategories
                .map((sub) => ({ ...sub, filters: sub.filters.filter((f) => filterMatches(f, q)) }))
                .filter((sub) => sub.filters.length > 0),
        }))
        .filter((cat) => cat.filters.length > 0 || cat.subcategories.length > 0)
}

export default function OrgOpenCoreDetail({ openCoreId }: Props) {
    const [detail, setDetail] = useState<Detail | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [view, setView] = useState<View>('conveyors')
    const busy = orgIsBusy.value

    const user = getCurrentUser()
    const canEdit = user?.orgRole === 'owner' || user?.orgRole === 'admin'

    // Add Category modal
    const [addCatOpen, setAddCatOpen] = useState(false)
    const [addCatName, setAddCatName] = useState('')
    const [addCatBusy, setAddCatBusy] = useState(false)

    // Add Subcategory modal
    const [addSubOpen, setAddSubOpen] = useState(false)
    const [addSubCatId, setAddSubCatId] = useState('')
    const [addSubName, setAddSubName] = useState('')
    const [addSubBusy, setAddSubBusy] = useState(false)

    // Category action menu
    const [catMenuOpen, setCatMenuOpen] = useState<string | null>(null)
    const [subMenuOpen, setSubMenuOpen] = useState<string | null>(null)
    const ssCollapseKey = `cf:oc:${openCoreId}:collapsed`
    const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => {
        try {
            const stored = sessionStorage.getItem(ssCollapseKey)
            return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>()
        } catch {
            return new Set<string>()
        }
    })

    function toggleCatCollapsed(id: string) {
        setCollapsedCats((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            sessionStorage.setItem(ssCollapseKey, JSON.stringify([...next]))
            return next
        })
    }

    // Search
    const [rawQuery, setRawQuery] = useState('')
    const [query, setQuery] = useState('')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    function handleSearch(val: string) {
        setRawQuery(val)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => setQuery(val.trim().toLowerCase()), 250)
    }

    function clearSearch() {
        setRawQuery('')
        setQuery('')
        if (debounceRef.current) clearTimeout(debounceRef.current)
    }

    // Confirm delete
    const [confirmDeleteCat, setConfirmDeleteCat] = useState<{ id: string; name: string } | null>(
        null,
    )
    const [confirmDeleteSub, setConfirmDeleteSub] = useState<{ id: string; name: string } | null>(
        null,
    )
    const [deletingCat, setDeletingCat] = useState(false)
    const [deletingSub, setDeletingSub] = useState(false)

    // Delete clan OC
    const [confirmDeleteOc, setConfirmDeleteOc] = useState(false)
    const [deletingOc, setDeletingOc] = useState(false)

    function loadDetail() {
        fetchOrgOpenCoreDetail(openCoreId)
            .then((d) => setDetail(d))
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
            .finally(() => setLoaded(true))
    }

    useEffect(() => {
        loadDetail()
    }, [openCoreId])

    async function onClone() {
        try {
            const res = await cloneOrgOpenCore(openCoreId)
            showToast(`Cloned "${res.name}" to your Open Cores`)
            window.location.href = `/opencore/${encodeURIComponent(res.id)}`
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Clone failed')
        }
    }

    async function onAddCategory() {
        if (!addCatName.trim()) return
        setAddCatBusy(true)
        try {
            await createOrgCategory(openCoreId, addCatName.trim())
            setAddCatOpen(false)
            setAddCatName('')
            loadDetail()
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to create category')
        } finally {
            setAddCatBusy(false)
        }
    }

    async function onAddSubcategory() {
        if (!addSubName.trim()) return
        setAddSubBusy(true)
        try {
            await createOrgSubcategory(addSubCatId, addSubName.trim())
            setAddSubOpen(false)
            setAddSubName('')
            loadDetail()
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to create subcategory')
        } finally {
            setAddSubBusy(false)
        }
    }

    async function onDeleteCat() {
        if (!confirmDeleteCat) return
        setDeletingCat(true)
        try {
            await deleteOrgCategory(confirmDeleteCat.id)
            setConfirmDeleteCat(null)
            loadDetail()
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Delete failed')
        } finally {
            setDeletingCat(false)
        }
    }

    async function onDeleteSub() {
        if (!confirmDeleteSub) return
        setDeletingSub(true)
        try {
            await deleteOrgSubcategory(confirmDeleteSub.id)
            setConfirmDeleteSub(null)
            loadDetail()
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Delete failed')
        } finally {
            setDeletingSub(false)
        }
    }

    async function onDeleteOc() {
        setDeletingOc(true)
        try {
            await deleteOrgOpenCore(openCoreId)
            window.location.href = '/org/filters'
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Delete failed')
            setDeletingOc(false)
            setConfirmDeleteOc(false)
        }
    }

    if (!loaded) return <p class="text-sm text-slate-500">Loading…</p>
    if (error || !detail) {
        return (
            <div class="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                {error ?? 'Open Core not available.'}{' '}
                <a
                    href="/org/filters"
                    class="text-amber-400 underline decoration-amber-400/40 transition-colors hover:text-amber-300 hover:decoration-amber-400"
                >
                    Back to Clan Filters
                </a>
            </div>
        )
    }

    const allFilters = detail.categories.flatMap((c) => [
        ...c.filters,
        ...c.subcategories.flatMap((s) => s.filters),
    ])
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
                            {canEdit ? (
                                <span class="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
                                    editable
                                </span>
                            ) : (
                                ' · read-only'
                            )}
                        </p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        {canEdit ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setAddCatName('')
                                    setAddCatOpen(true)
                                }}
                                class="rounded border border-slate-800 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                            >
                                + Category
                            </button>
                        ) : null}
                        {canEdit || detail.owner.id === user?.id ? (
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteOc(true)}
                                class="rounded border border-rose-500/40 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-rose-400 transition-colors hover:border-rose-500/60 hover:text-rose-300"
                            >
                                Delete from clan
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClone}
                            disabled={busy}
                            class="rounded bg-amber-500 px-4 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Clone entire Open Core
                        </button>
                    </div>
                </div>
            </div>

            {allFilters.length > 0 ? (
                <DeploymentTotals totals={totals} variant="stat" class="mb-6" />
            ) : null}

            <div class="mb-4 inline-flex rounded border border-slate-800 bg-slate-900/40 p-0.5 text-sm">
                <button
                    type="button"
                    onClick={() => setView('conveyors')}
                    class={`rounded px-3 py-1.5 font-semibold transition-colors ${
                        view === 'conveyors'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'text-slate-400 hover:text-amber-400'
                    }`}
                >
                    Conveyors
                </button>
                <button
                    type="button"
                    onClick={() => setView('boxes')}
                    class={`rounded px-3 py-1.5 font-semibold transition-colors ${
                        view === 'boxes'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'text-slate-400 hover:text-amber-400'
                    }`}
                >
                    Boxes
                </button>
                <button
                    type="button"
                    onClick={() => setView('3d')}
                    class={`rounded px-3 py-1.5 font-semibold transition-colors ${
                        view === '3d'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'text-slate-400 hover:text-amber-400'
                    }`}
                >
                    3D
                </button>
            </div>

            {/* Search bar */}
            {view !== '3d' && (
            <div class="relative mb-6">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500"
                >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    type="text"
                    placeholder="Search filters or items…"
                    value={rawQuery}
                    onInput={(e) => handleSearch((e.target as HTMLInputElement).value)}
                    class="w-full rounded border border-slate-800 bg-slate-900/40 py-2 pr-9 pl-9 font-mono text-sm text-slate-200 placeholder-slate-600 transition-colors focus:border-amber-500/40 focus:outline-none"
                />
                {rawQuery ? (
                    <button
                        type="button"
                        onClick={clearSearch}
                        class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                        aria-label="Clear search"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            class="h-4 w-4"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                ) : null}
            </div>
            )}

            {view === '3d' ? (
                <OpenCoreViewer
                    openCoreId={openCoreId}
                    initialFilters={allFilters}
                    canCreate={canEdit}
                    sharedWithOrg={true}
                />
            ) : allFilters.length === 0 && !canEdit ? (
                <p class="text-sm text-slate-500">This Open Core has no filters yet.</p>
            ) : view === 'conveyors' ? (
                (() => {
                    const filteredCats = applySearch(detail.categories, query)
                    return (
                        <div class="space-y-8">
                            {filteredCats.length === 0 && query ? (
                                <p class="font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                                    No filters match your search.
                                </p>
                            ) : null}
                            {filteredCats.map((cat) => {
                                const catCollapsed = !query && collapsedCats.has(cat.id)
                                const catFilterCount =
                                    cat.filters.length +
                                    cat.subcategories.reduce((a, s) => a + s.filters.length, 0)
                                return (
                                    <section key={cat.id} class="mb-4">
                                        <div class="mb-3 flex items-center justify-between border-b border-slate-800 pb-3">
                                            <div class="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCatCollapsed(cat.id)}
                                                    class="rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-amber-400"
                                                    aria-label={
                                                        catCollapsed
                                                            ? 'Expand category'
                                                            : 'Collapse category'
                                                    }
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="2"
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        class={`h-4 w-4 transition-transform ${catCollapsed ? '-rotate-90' : ''}`}
                                                    >
                                                        <polyline points="6 9 12 15 18 9" />
                                                    </svg>
                                                </button>
                                                <div class="flex items-center gap-2">
                                                    <h2
                                                        class="text-lg text-slate-100"
                                                        style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                                                    >
                                                        {cat.name}
                                                    </h2>
                                                    {catCollapsed && catFilterCount > 0 ? (
                                                        <span class="font-mono text-[11px] text-slate-600">
                                                            {catFilterCount} filter
                                                            {catFilterCount !== 1 ? 's' : ''}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                            {canEdit ? (
                                                <div class="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setCatMenuOpen(
                                                                catMenuOpen === cat.id
                                                                    ? null
                                                                    : cat.id,
                                                            )
                                                        }
                                                        class="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                                                        aria-label="Category actions"
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
                                                    {catMenuOpen === cat.id ? (
                                                        <div class="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded border border-slate-800 bg-[#0d1117] shadow-xl">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setCatMenuOpen(null)
                                                                    window.location.href = `/org/opencore/${openCoreId}/filter/new?categoryId=${encodeURIComponent(cat.id)}`
                                                                }}
                                                                class="block w-full px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
                                                            >
                                                                New Filter
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setCatMenuOpen(null)
                                                                    setAddSubCatId(cat.id)
                                                                    setAddSubName('')
                                                                    setAddSubOpen(true)
                                                                }}
                                                                class="block w-full px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
                                                            >
                                                                + Subcategory
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setCatMenuOpen(null)
                                                                    setConfirmDeleteCat({
                                                                        id: cat.id,
                                                                        name: cat.name,
                                                                    })
                                                                }}
                                                                class="block w-full px-3 py-2 text-left text-sm text-rose-400 transition-colors hover:bg-slate-800"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                        {!catCollapsed ? (
                                            <>
                                                {cat.filters.length === 0 &&
                                                cat.subcategories.length === 0 ? (
                                                    <p class="text-xs text-slate-500">
                                                        No filters in this category.
                                                    </p>
                                                ) : null}
                                                {cat.filters.length > 0 ? (
                                                    <ul class="grid gap-3 sm:grid-cols-3">
                                                        {cat.filters.map((f) => (
                                                            <FilterRow
                                                                key={f.id}
                                                                filter={f}
                                                                canEdit={canEdit}
                                                                openCoreId={openCoreId}
                                                                onDeleted={loadDetail}
                                                            />
                                                        ))}
                                                    </ul>
                                                ) : null}
                                                {cat.subcategories.map((sub) => (
                                                    <div key={sub.id} class="mt-6">
                                                        <div class="mb-2 flex items-center justify-between border-b border-slate-800/70 pb-2">
                                                            <h3 class="font-mono text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                                                                {sub.name}
                                                            </h3>
                                                            {canEdit ? (
                                                                <div class="relative">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setSubMenuOpen(
                                                                                subMenuOpen ===
                                                                                    sub.id
                                                                                    ? null
                                                                                    : sub.id,
                                                                            )
                                                                        }
                                                                        class="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                                                                        aria-label="Subcategory actions"
                                                                    >
                                                                        <svg
                                                                            xmlns="http://www.w3.org/2000/svg"
                                                                            viewBox="0 0 24 24"
                                                                            fill="currentColor"
                                                                            class="h-3.5 w-3.5"
                                                                        >
                                                                            <circle
                                                                                cx="12"
                                                                                cy="5"
                                                                                r="1.7"
                                                                            />
                                                                            <circle
                                                                                cx="12"
                                                                                cy="12"
                                                                                r="1.7"
                                                                            />
                                                                            <circle
                                                                                cx="12"
                                                                                cy="19"
                                                                                r="1.7"
                                                                            />
                                                                        </svg>
                                                                    </button>
                                                                    {subMenuOpen === sub.id ? (
                                                                        <div class="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded border border-slate-800 bg-[#0d1117] shadow-xl">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setSubMenuOpen(
                                                                                        null,
                                                                                    )
                                                                                    window.location.href = `/org/opencore/${openCoreId}/filter/new?categoryId=${encodeURIComponent(cat.id)}&subcategoryId=${encodeURIComponent(sub.id)}`
                                                                                }}
                                                                                class="block w-full px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
                                                                            >
                                                                                New Filter
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setSubMenuOpen(
                                                                                        null,
                                                                                    )
                                                                                    setConfirmDeleteSub(
                                                                                        {
                                                                                            id: sub.id,
                                                                                            name: sub.name,
                                                                                        },
                                                                                    )
                                                                                }}
                                                                                class="block w-full px-3 py-2 text-left text-sm text-rose-400 transition-colors hover:bg-slate-800"
                                                                            >
                                                                                Delete
                                                                            </button>
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        {sub.filters.length === 0 ? (
                                                            <p class="text-xs text-slate-500">
                                                                No filters.
                                                            </p>
                                                        ) : (
                                                            <ul class="grid gap-3 sm:grid-cols-3">
                                                                {sub.filters.map((f) => (
                                                                    <FilterRow
                                                                        key={f.id}
                                                                        filter={f}
                                                                        canEdit={canEdit}
                                                                        openCoreId={openCoreId}
                                                                        onDeleted={loadDetail}
                                                                    />
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </div>
                                                ))}
                                            </>
                                        ) : null}
                                    </section>
                                )
                            })}
                            {canEdit && detail.categories.length === 0 ? (
                                <p class="text-sm text-slate-500">
                                    No categories yet. Add one to get started.
                                </p>
                            ) : null}
                        </div>
                    )
                })()
            ) : (
                <OpenCoreBoxesView categories={detail.categories} />
            )}

            {/* Add Category modal */}
            {addCatOpen ? (
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div
                        class="w-full max-w-sm rounded-lg border border-slate-800 p-6 shadow-xl"
                        style="background:rgba(15,23,42,0.97); border-left:2px solid rgba(245,158,11,0.32)"
                    >
                        <h2
                            class="text-xl text-slate-100"
                            style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                        >
                            New Category
                        </h2>
                        <input
                            type="text"
                            value={addCatName}
                            onInput={(e) => setAddCatName((e.target as HTMLInputElement).value)}
                            placeholder="Category name"
                            class="mt-3 w-full rounded border border-slate-800 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') void onAddCategory()
                            }}
                            autoFocus
                        />
                        <div class="mt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setAddCatOpen(false)}
                                class="rounded px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onAddCategory}
                                disabled={addCatBusy || !addCatName.trim()}
                                class="rounded bg-amber-500 px-4 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400 disabled:opacity-60"
                            >
                                {addCatBusy ? 'Creating…' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Add Subcategory modal */}
            {addSubOpen ? (
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div
                        class="w-full max-w-sm rounded-lg border border-slate-800 p-6 shadow-xl"
                        style="background:rgba(15,23,42,0.97); border-left:2px solid rgba(245,158,11,0.32)"
                    >
                        <h2
                            class="text-xl text-slate-100"
                            style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                        >
                            New Subcategory
                        </h2>
                        <input
                            type="text"
                            value={addSubName}
                            onInput={(e) => setAddSubName((e.target as HTMLInputElement).value)}
                            placeholder="Subcategory name"
                            class="mt-3 w-full rounded border border-slate-800 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition-colors outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') void onAddSubcategory()
                            }}
                            autoFocus
                        />
                        <div class="mt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setAddSubOpen(false)}
                                class="rounded px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onAddSubcategory}
                                disabled={addSubBusy || !addSubName.trim()}
                                class="rounded bg-amber-500 px-4 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400 disabled:opacity-60"
                            >
                                {addSubBusy ? 'Creating…' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Confirm delete category */}
            {confirmDeleteCat ? (
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div
                        class="w-full max-w-sm rounded-lg border border-slate-800 p-6 shadow-xl"
                        style="background:rgba(15,23,42,0.97); border-left:2px solid rgba(245,158,11,0.32)"
                    >
                        <h2
                            class="text-xl text-slate-100"
                            style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                        >
                            Delete category?
                        </h2>
                        <p class="mt-2 text-sm text-slate-400">
                            "{confirmDeleteCat.name}" and all its filters will be permanently
                            removed.
                        </p>
                        <div class="mt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteCat(null)}
                                class="rounded px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onDeleteCat}
                                disabled={deletingCat}
                                class="rounded bg-rose-600 px-4 py-2 text-sm font-bold tracking-wide text-slate-50 uppercase transition-colors hover:bg-rose-500 disabled:opacity-60"
                            >
                                {deletingCat ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Confirm delete subcategory */}
            {confirmDeleteSub ? (
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div
                        class="w-full max-w-sm rounded-lg border border-slate-800 p-6 shadow-xl"
                        style="background:rgba(15,23,42,0.97); border-left:2px solid rgba(245,158,11,0.32)"
                    >
                        <h2
                            class="text-xl text-slate-100"
                            style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                        >
                            Delete subcategory?
                        </h2>
                        <p class="mt-2 text-sm text-slate-400">
                            "{confirmDeleteSub.name}" will be removed. Filters in it will be moved
                            up to the parent category.
                        </p>
                        <div class="mt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteSub(null)}
                                class="rounded px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onDeleteSub}
                                disabled={deletingSub}
                                class="rounded bg-rose-600 px-4 py-2 text-sm font-bold tracking-wide text-slate-50 uppercase transition-colors hover:bg-rose-500 disabled:opacity-60"
                            >
                                {deletingSub ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Confirm delete clan Open Core */}
            {confirmDeleteOc ? (
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div
                        class="w-full max-w-sm rounded-lg border border-slate-800 p-6 shadow-xl"
                        style="background:rgba(15,23,42,0.97); border-left:2px solid rgba(245,158,11,0.32)"
                    >
                        <h2
                            class="text-xl text-slate-100"
                            style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                        >
                            Delete from clan?
                        </h2>
                        <p class="mt-2 text-sm text-slate-400">
                            "{detail.name}" will be permanently removed from the clan. This does not
                            affect anyone's personal copies.
                        </p>
                        <div class="mt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteOc(false)}
                                class="rounded px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onDeleteOc}
                                disabled={deletingOc}
                                class="rounded bg-rose-600 px-4 py-2 text-sm font-bold tracking-wide text-slate-50 uppercase transition-colors hover:bg-rose-500 disabled:opacity-60"
                            >
                                {deletingOc ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
