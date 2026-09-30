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
    reorderOrgFilters,
} from '../store/org'
import { getCurrentUser } from '../store/auth'
import { deploymentTotals } from '../store/filters'
import { getItem } from '../store/items'
import { showToast } from './CopyToast'
import OpenCoreBoxesView from './OpenCoreBoxesView'
import DeploymentTotals from './DeploymentTotals'
import FilterCardBase, { type FilterCardAction } from './FilterCardBase'
import ReorderableFilterGrid from './ReorderableFilterGrid'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import NameFormModal from './NameFormModal'
import OpenCoreViewer from './openCore3D/OpenCoreViewer'
import TrackedButton from './TrackedButton'
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
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    function onEditFilter() {
        window.location.href = `/org/opencore/${openCoreId}/filter/edit?filterId=${encodeURIComponent(filter.id)}`
    }

    async function onDeleteFilter() {
        if (deleting) return
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

    const actions: FilterCardAction[] = canEdit
        ? [
              { label: 'Edit', onClick: onEditFilter },
              { label: 'Delete', tone: 'danger', onClick: () => setConfirmDelete(true) },
          ]
        : []

    return (
        <>
            <FilterCardBase filter={filter} actions={actions} />
            <ConfirmDeleteModal
                open={confirmDelete}
                title="Delete filter"
                message={`"${filter.name}" will be permanently removed.`}
                confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                onCancel={() => setConfirmDelete(false)}
                onConfirm={onDeleteFilter}
            />
        </>
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
    const [addCatBusy, setAddCatBusy] = useState(false)

    // Add Subcategory modal
    const [addSubOpen, setAddSubOpen] = useState(false)
    const [addSubCatId, setAddSubCatId] = useState('')
    const [addSubBusy, setAddSubBusy] = useState(false)

    // Category action menu
    const [catMenuOpen, setCatMenuOpen] = useState<string | null>(null)
    const [subMenuOpen, setSubMenuOpen] = useState<string | null>(null)
    // Which category is currently in filter-reorder mode (one at a time).
    const [reorderingCatId, setReorderingCatId] = useState<string | null>(null)

    async function onReorderFilters(
        categoryId: string,
        subcategoryId: string | null,
        orderedIds: string[],
    ) {
        try {
            await reorderOrgFilters(categoryId, subcategoryId, orderedIds)
            loadDetail()
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Reorder failed')
        }
    }

    // Close the category / subcategory action menus on any click outside them.
    useEffect(() => {
        if (!catMenuOpen && !subMenuOpen) return
        function onDoc(e: MouseEvent) {
            const target = e.target as Element | null
            if (target?.closest('[data-menu-root]')) return
            setCatMenuOpen(null)
            setSubMenuOpen(null)
        }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
    }, [catMenuOpen, subMenuOpen])
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

    async function onAddCategory({ name }: { name: string }) {
        setAddCatBusy(true)
        try {
            await createOrgCategory(openCoreId, name)
            setAddCatOpen(false)
            loadDetail()
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Failed to create category')
        } finally {
            setAddCatBusy(false)
        }
    }

    async function onAddSubcategory({ name }: { name: string }) {
        setAddSubBusy(true)
        try {
            await createOrgSubcategory(addSubCatId, name)
            setAddSubOpen(false)
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
                                onClick={() => setAddCatOpen(true)}
                                class="rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-500/40 hover:text-amber-400"
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
                        <TrackedButton
                            type="button"
                            track="opencore_clone"
                            trackAttrs={{ openCoreId }}
                            onClick={onClone}
                            disabled={busy}
                            class="rounded bg-amber-500 px-4 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Clone entire Open Core
                        </TrackedButton>
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
                                            <div class="flex items-center gap-3">
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
                                                <div>
                                                    <div class="mb-0.5 font-mono text-[11px] tracking-widest text-amber-500/40 uppercase">
                                                        Category
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        <h2
                                                            class="text-xl text-slate-100"
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
                                            </div>
                                            {canEdit ? (
                                                <div class="flex items-center gap-1">
                                                    {reorderingCatId === cat.id ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setReorderingCatId(null)}
                                                            class="rounded bg-amber-500 px-3 py-1 font-mono text-[11px] font-bold tracking-widest text-slate-950 uppercase transition-colors hover:bg-amber-400"
                                                        >
                                                            Done
                                                        </button>
                                                    ) : null}
                                                    <div class="relative" data-menu-root>
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
                                                                        setAddSubOpen(true)
                                                                    }}
                                                                    class="block w-full px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
                                                                >
                                                                    + Subcategory
                                                                </button>
                                                                {cat.filters.length > 1 ||
                                                                cat.subcategories.some(
                                                                    (s) => s.filters.length > 1,
                                                                ) ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setCatMenuOpen(null)
                                                                            setReorderingCatId(
                                                                                reorderingCatId ===
                                                                                    cat.id
                                                                                    ? null
                                                                                    : cat.id,
                                                                            )
                                                                        }}
                                                                        class="block w-full px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
                                                                    >
                                                                        {reorderingCatId === cat.id
                                                                            ? 'Done reordering'
                                                                            : 'Reorder filters'}
                                                                    </button>
                                                                ) : null}
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
                                                </div>
                                            ) : null}
                                        </div>
                                        {!catCollapsed || reorderingCatId === cat.id ? (
                                            <>
                                                {reorderingCatId === cat.id ? (
                                                    <div class="mb-3 flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono text-[11px] tracking-widest text-amber-400/90 uppercase">
                                                        Drag cards to rearrange · changes save
                                                        automatically
                                                    </div>
                                                ) : null}
                                                {cat.filters.length === 0 &&
                                                cat.subcategories.length === 0 ? (
                                                    <p class="text-xs text-slate-500">
                                                        No filters in this category.
                                                    </p>
                                                ) : null}
                                                {cat.filters.length > 0 ? (
                                                    <ReorderableFilterGrid
                                                        filters={cat.filters}
                                                        reordering={reorderingCatId === cat.id}
                                                        onReorder={(orderedIds) =>
                                                            onReorderFilters(
                                                                cat.id,
                                                                null,
                                                                orderedIds,
                                                            )
                                                        }
                                                        renderCard={(f) => (
                                                            <FilterRow
                                                                filter={f}
                                                                canEdit={canEdit}
                                                                openCoreId={openCoreId}
                                                                onDeleted={loadDetail}
                                                            />
                                                        )}
                                                    />
                                                ) : null}
                                                {cat.subcategories.map((sub) => (
                                                    <div key={sub.id} class="mt-6">
                                                        <div class="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
                                                            <h3 class="font-mono text-[11px] tracking-widest text-slate-500 uppercase">
                                                                {sub.name}
                                                            </h3>
                                                            {canEdit ? (
                                                                <div
                                                                    class="relative"
                                                                    data-menu-root
                                                                >
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
                                                            <ReorderableFilterGrid
                                                                filters={sub.filters}
                                                                reordering={
                                                                    reorderingCatId === cat.id
                                                                }
                                                                onReorder={(orderedIds) =>
                                                                    onReorderFilters(
                                                                        cat.id,
                                                                        sub.id,
                                                                        orderedIds,
                                                                    )
                                                                }
                                                                renderCard={(f) => (
                                                                    <FilterRow
                                                                        filter={f}
                                                                        canEdit={canEdit}
                                                                        openCoreId={openCoreId}
                                                                        onDeleted={loadDetail}
                                                                    />
                                                                )}
                                                            />
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

            {/* Create modals */}
            <NameFormModal
                open={addCatOpen}
                eyebrow="New"
                title="Category"
                placeholder="e.g. Metal, Components"
                submitLabel={addCatBusy ? 'Creating…' : 'Create'}
                busy={addCatBusy}
                onCancel={() => setAddCatOpen(false)}
                onSubmit={onAddCategory}
            />
            <NameFormModal
                open={addSubOpen}
                eyebrow="New"
                title="Subcategory"
                placeholder="e.g. ROW 1, Common"
                submitLabel={addSubBusy ? 'Creating…' : 'Create'}
                busy={addSubBusy}
                onCancel={() => setAddSubOpen(false)}
                onSubmit={onAddSubcategory}
            />

            {/* Confirm delete modals */}
            <ConfirmDeleteModal
                open={!!confirmDeleteCat}
                title="Delete category"
                message={
                    confirmDeleteCat
                        ? `"${confirmDeleteCat.name}" and all its filters will be permanently removed.`
                        : ''
                }
                confirmLabel={deletingCat ? 'Deleting…' : 'Delete'}
                onCancel={() => setConfirmDeleteCat(null)}
                onConfirm={onDeleteCat}
            />
            <ConfirmDeleteModal
                open={!!confirmDeleteSub}
                title="Delete subcategory"
                message={
                    confirmDeleteSub
                        ? `"${confirmDeleteSub.name}" will be removed. Filters in it will be moved up to the parent category.`
                        : ''
                }
                confirmLabel={deletingSub ? 'Deleting…' : 'Delete'}
                onCancel={() => setConfirmDeleteSub(null)}
                onConfirm={onDeleteSub}
            />
            <ConfirmDeleteModal
                open={confirmDeleteOc}
                title="Delete from clan"
                message={`"${detail.name}" will be permanently removed from the clan. This does not affect anyone's personal copies.`}
                confirmLabel={deletingOc ? 'Deleting…' : 'Delete'}
                onCancel={() => setConfirmDeleteOc(false)}
                onConfirm={onDeleteOc}
            />
        </div>
    )
}
