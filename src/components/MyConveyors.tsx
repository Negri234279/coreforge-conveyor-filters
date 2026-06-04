import { useState } from 'preact/hooks'
import {
    addCategory,
    addOpenCore,
    categories,
    findCategoryByName,
    findOpenCore,
    isHydrated,
    isSyncing,
    lastError,
    looseCategories,
    openCores,
    renameOpenCore,
} from '../store/filters'
import { getCurrentUser } from '../store/auth'
import CategorySection from './CategorySection'
import CategoryFormModal from './CategoryFormModal'
import OpenCoreCard from './OpenCoreCard'
import OpenCoreFormModal from './OpenCoreFormModal'

export default function MyConveyors() {
    const hydrated = isHydrated.value
    const syncing = isSyncing.value
    const error = lastError.value
    // Only show personal (non-shared) Open Cores here. The shared clones created
    // by share-opencore.ts live in the clan view (/org/filters) and are managed
    // by clan owner/admin from there.
    const ocs = openCores.value.filter((oc) => !oc.sharedWithOrg)
    // Touch the categories signal so this component re-renders on category changes.
    categories.value
    const loose = looseCategories()

    const [catCreateOpen, setCatCreateOpen] = useState(false)
    const [ocCreateOpen, setOcCreateOpen] = useState(false)
    const [ocRenameId, setOcRenameId] = useState<string | null>(null)
    const [view, setView] = useState<'opencores' | 'categories'>('opencores')

    function handleCreateCategory(values: {
        name: string
        openCoreId: string | null
        sharedWithOrg: boolean
    }) {
        addCategory(values.name, values.openCoreId, values.sharedWithOrg)
        setCatCreateOpen(false)
    }
    const inOrg = !!getCurrentUser()?.orgId
    function validateNewCategoryName(name: string): string | null {
        return findCategoryByName(name) ? `A category named "${name}" already exists.` : null
    }

    function handleCreateOpenCore(values: { name: string }) {
        addOpenCore(values.name)
        setOcCreateOpen(false)
    }
    function validateNewOpenCoreName(name: string): string | null {
        return ocs.some((o) => o.name.trim().toLowerCase() === name.toLowerCase())
            ? `An Open Core named "${name}" already exists.`
            : null
    }
    function handleRenameOpenCore(values: { name: string }) {
        if (!ocRenameId) return
        renameOpenCore(ocRenameId, values.name)
        setOcRenameId(null)
    }
    function validateRenameOpenCoreName(name: string): string | null {
        const dup = ocs.some(
            (o) => o.id !== ocRenameId && o.name.trim().toLowerCase() === name.toLowerCase(),
        )
        return dup ? `An Open Core named "${name}" already exists.` : null
    }
    const ocToRename = ocRenameId ? findOpenCore(ocRenameId) : undefined

    return (
        <div>
            <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3 text-xs text-slate-500">
                    <span class="inline-flex items-center gap-1.5">
                        <span
                            class={`inline-block h-1.5 w-1.5 rounded-full ${
                                syncing
                                    ? 'animate-pulse bg-amber-300'
                                    : error
                                      ? 'bg-rose-400'
                                      : 'bg-emerald-400'
                            }`}
                        />
                        {syncing ? 'Saving…' : error ? 'Sync error' : 'Saved'}
                    </span>
                </div>
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setOcCreateOpen(true)}
                        class="inline-flex items-center gap-1 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400"
                    >
                        <span aria-hidden="true">+</span> Open Core
                    </button>
                    <button
                        type="button"
                        onClick={() => setCatCreateOpen(true)}
                        class="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-slate-300 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                    >
                        <span aria-hidden="true">+</span> Category
                    </button>
                </div>
            </div>

            {error ? (
                <div class="mb-6 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {error}
                </div>
            ) : null}

            {!hydrated ? (
                <p class="text-sm text-slate-500">Loading…</p>
            ) : (
                <>
                    {/* View toggle */}
                    <div class="mb-6 inline-flex rounded-md border border-slate-700 bg-slate-900/60 p-0.5 text-sm">
                        <button
                            type="button"
                            onClick={() => setView('opencores')}
                            class={`rounded px-3 py-1.5 font-semibold transition-colors ${
                                view === 'opencores'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'text-slate-400 hover:text-amber-400'
                            }`}
                        >
                            Open Cores
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('categories')}
                            class={`rounded px-3 py-1.5 font-semibold transition-colors ${
                                view === 'categories'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'text-slate-400 hover:text-amber-400'
                            }`}
                        >
                            Other categories
                        </button>
                    </div>

                    {/* Open Cores */}
                    <section class={view === 'opencores' ? '' : 'hidden'}>
                        {ocs.length === 0 ? (
                            <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center">
                                <p class="text-sm text-slate-300">No Open Cores yet.</p>
                                <p class="mt-1 text-xs text-slate-500">
                                    An Open Core groups categories into one base setup.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setOcCreateOpen(true)}
                                    class="mt-4 rounded-md bg-amber-500 px-3 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400"
                                >
                                    + Create Open Core
                                </button>
                            </div>
                        ) : (
                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {ocs.map((oc) => (
                                    <OpenCoreCard
                                        key={oc.id}
                                        openCore={oc}
                                        onRename={() => setOcRenameId(oc.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Loose categories */}
                    <section class={view === 'categories' ? '' : 'hidden'}>
                        {loose.length === 0 ? (
                            <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center">
                                <p class="text-sm text-slate-300">No loose categories.</p>
                                <p class="mt-1 text-xs text-slate-500">
                                    Categories not assigned to any Open Core show up here.
                                </p>
                                <div class="mt-4 flex items-center justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCatCreateOpen(true)}
                                        class="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                                    >
                                        + Add Category
                                    </button>
                                    <a
                                        href="/filters/new"
                                        class="rounded-md bg-amber-500 px-3 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400"
                                    >
                                        + New Filter
                                    </a>
                                </div>
                            </div>
                        ) : (
                            loose.map((c) => <CategorySection key={c.id} category={c} />)
                        )}
                    </section>
                </>
            )}

            <CategoryFormModal
                open={catCreateOpen}
                mode="create"
                openCores={ocs}
                canShareWithOrg={inOrg}
                onCancel={() => setCatCreateOpen(false)}
                onSubmit={handleCreateCategory}
                validateName={validateNewCategoryName}
            />
            <OpenCoreFormModal
                open={ocCreateOpen}
                mode="create"
                onCancel={() => setOcCreateOpen(false)}
                onSubmit={handleCreateOpenCore}
                validateName={validateNewOpenCoreName}
            />
            <OpenCoreFormModal
                open={!!ocToRename}
                mode="edit"
                initialName={ocToRename?.name ?? ''}
                onCancel={() => setOcRenameId(null)}
                onSubmit={handleRenameOpenCore}
                validateName={validateRenameOpenCoreName}
            />
        </div>
    )
}
