import { useRef, useState } from 'preact/hooks'
import {
    addCategory,
    categoriesForOpenCore,
    categories as categoriesSignal,
    deploymentTotalsForOpenCore,
    findCategoryByName,
    findOpenCore,
    isHydrated,
    openCores,
    renameOpenCore,
    setOpenCoreShared,
} from '../store/filters'
import { shareOpenCoreWithClan } from '../store/org'
import { getCurrentUser } from '../store/auth'
import { getItem } from '../store/items'
import type { Category, Filter } from '../types'
import CategorySection from './CategorySection'
import DeploymentTotals from './DeploymentTotals'
import CategoryFormModal from './CategoryFormModal'
import OpenCoreFormModal from './OpenCoreFormModal'
import OpenCoreBoxesView from './OpenCoreBoxesView'
import ConfirmDeleteModal from './ConfirmDeleteModal'

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

interface Props {
    openCoreId: string
}

type View = 'conveyors' | 'boxes'

export default function OpenCoreDetail({ openCoreId }: Props) {
    const hydrated = isHydrated.value
    // Touch signals so we re-render on changes.
    openCores.value
    categoriesSignal.value

    const oc = findOpenCore(openCoreId)
    const cats = categoriesForOpenCore(openCoreId)
    const inOrg = !!getCurrentUser()?.orgId

    const [view, setView] = useState<View>('conveyors')
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
    const [catCreateOpen, setCatCreateOpen] = useState(false)
    const [renameOpen, setRenameOpen] = useState(false)
    const [confirmShareOpen, setConfirmShareOpen] = useState(false)
    const [sharing, setSharing] = useState(false)

    if (!hydrated) return <p class="text-sm text-slate-500">Loading…</p>
    if (!oc) {
        return (
            <div class="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                Open Core not found.{' '}
                <a
                    href="/"
                    class="text-amber-400 underline decoration-amber-400/40 transition-colors hover:text-amber-300 hover:decoration-amber-400"
                >
                    Go home
                </a>
                .
            </div>
        )
    }

    function handleCreateCategory(values: {
        name: string
        openCoreId: string | null
        sharedWithOrg: boolean
    }) {
        addCategory(values.name, values.openCoreId, values.sharedWithOrg)
        setCatCreateOpen(false)
    }
    function validateNewCategoryName(name: string): string | null {
        return findCategoryByName(name) ? `A category named "${name}" already exists.` : null
    }
    function handleRename(values: { name: string }) {
        renameOpenCore(openCoreId, values.name)
        setRenameOpen(false)
    }
    function validateRenameName(name: string): string | null {
        const dup = openCores.value.some(
            (o) => o.id !== openCoreId && o.name.trim().toLowerCase() === name.toLowerCase(),
        )
        return dup ? `An Open Core named "${name}" already exists.` : null
    }
    function confirmToggleShare() {
        setConfirmShareOpen(false)
        if (oc) setOpenCoreShared(openCoreId, !oc.sharedWithOrg)
    }

    async function confirmShareWithClan() {
        setConfirmShareOpen(false)
        setSharing(true)
        try {
            await shareOpenCoreWithClan(openCoreId)
        } catch (e) {
            // Re-open with no built-in toast component here — show via alert as fallback.
            alert(e instanceof Error ? e.message : 'Share failed')
        } finally {
            setSharing(false)
        }
    }

    return (
        <div>
            <div class="mb-6">
                <a
                    href="/"
                    class="text-xs font-semibold tracking-wider text-slate-500 uppercase transition-colors hover:text-amber-400"
                >
                    &larr; Back to My Conveyors
                </a>
                <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <h1
                            class="text-3xl text-slate-100"
                            style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                        >
                            {oc.name}
                        </h1>
                        {oc.sharedWithOrg ? (
                            <span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wider text-amber-400 uppercase">
                                Shared
                            </span>
                        ) : null}
                    </div>
                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setRenameOpen(true)}
                            class="rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                        >
                            Rename
                        </button>
                        {inOrg ? (
                            oc.sharedWithOrg ? (
                                <button
                                    type="button"
                                    onClick={() => setConfirmShareOpen(true)}
                                    class="rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                                >
                                    Unshare from clan
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmShareOpen(true)}
                                    disabled={sharing}
                                    class="rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-500/40 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {sharing ? 'Sharing…' : 'Share with clan'}
                                </button>
                            )
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setCatCreateOpen(true)}
                            class="rounded bg-amber-500 px-3 py-1.5 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400"
                        >
                            + Category
                        </button>
                    </div>
                </div>
            </div>

            {cats.length > 0 ? (
                <DeploymentTotals
                    totals={deploymentTotalsForOpenCore(openCoreId)}
                    variant="stat"
                    class="mb-6"
                />
            ) : null}

            {/* View toggle */}
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
                <a
                    href={`/opencore/${openCoreId}/viewer`}
                    class="rounded px-3 py-1.5 font-semibold text-slate-400 transition-colors hover:text-amber-400"
                >
                    3D
                </a>
            </div>

            {/* Search bar */}
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

            {cats.length === 0 ? (
                <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
                    <p class="text-sm text-slate-400">This Open Core has no categories yet.</p>
                    <button
                        type="button"
                        onClick={() => setCatCreateOpen(true)}
                        class="mt-4 rounded bg-amber-500 px-3 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400"
                    >
                        + Add Category
                    </button>
                </div>
            ) : view === 'conveyors' ? (
                (() => {
                    const filteredCats = applySearch(cats, query)
                    return filteredCats.length > 0 ? (
                        filteredCats.map((c) => (
                            <CategorySection key={c.id} category={c} forceExpand={!!query} />
                        ))
                    ) : (
                        <p class="font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                            No filters match your search.
                        </p>
                    )
                })()
            ) : (
                <OpenCoreBoxesView categories={cats} />
            )}

            <CategoryFormModal
                open={catCreateOpen}
                mode="create"
                lockedOpenCoreId={openCoreId}
                canShareWithOrg={inOrg}
                onCancel={() => setCatCreateOpen(false)}
                onSubmit={handleCreateCategory}
                validateName={validateNewCategoryName}
            />
            <OpenCoreFormModal
                open={renameOpen}
                mode="edit"
                initialName={oc.name}
                onCancel={() => setRenameOpen(false)}
                onSubmit={handleRename}
                validateName={validateRenameName}
            />
            <ConfirmDeleteModal
                open={confirmShareOpen}
                title={oc.sharedWithOrg ? 'Unshare from clan' : 'Share with clan'}
                message={
                    oc.sharedWithOrg
                        ? `Stop sharing "${oc.name}" with your clan? Clan members will no longer see it.`
                        : `Create a clan copy of "${oc.name}"? Your personal Open Core stays private and is not affected. Clan owners and admins will be able to edit the shared copy independently.`
                }
                confirmLabel={oc.sharedWithOrg ? 'Unshare' : 'Share'}
                confirmTone="primary"
                onCancel={() => setConfirmShareOpen(false)}
                onConfirm={oc.sharedWithOrg ? confirmToggleShare : confirmShareWithClan}
            />
        </div>
    )
}
