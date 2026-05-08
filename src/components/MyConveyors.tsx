import { useState } from 'preact/hooks'
import {
    addCategory,
    categories,
    dataSource,
    findCategoryByName,
    isHydrated,
    isSyncing,
    lastError,
} from '../store/filters'
import CategorySection from './CategorySection'
import CategoryFormModal from './CategoryFormModal'

export default function MyConveyors() {
    const cats = categories.value
    const hydrated = isHydrated.value
    const syncing = isSyncing.value
    const error = lastError.value

    const [createOpen, setCreateOpen] = useState(false)

    function handleCreate(values: { name: string; isOpenCoreFilter: boolean }) {
        addCategory(values.name, values.isOpenCoreFilter)
        setCreateOpen(false)
    }

    function validateNewName(name: string): string | null {
        if (findCategoryByName(name)) {
            return `A category named "${name}" already exists.`
        }
        return null
    }

    return (
        <div>
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
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
                <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    class="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:border-teal-500/60 hover:text-teal-200"
                >
                    <span aria-hidden="true">+</span> Add Category
                </button>
            </div>

            {error ? (
                <div class="mb-6 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {error}
                </div>
            ) : null}

            {!hydrated ? (
                <p class="text-sm text-slate-500">Loading filters…</p>
            ) : cats.length === 0 ? (
                <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
                    <p class="text-sm text-slate-300">No filters yet.</p>
                    <p class="mt-1 text-xs text-slate-500">
                        Create a category or jump straight to your first filter.
                    </p>
                    <div class="mt-4 flex items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCreateOpen(true)}
                            class="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-teal-500/60 hover:text-teal-200"
                        >
                            + Add Category
                        </button>
                        <a
                            href="/filters/new"
                            class="rounded-md bg-teal-500/90 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
                        >
                            + New Filter
                        </a>
                    </div>
                </div>
            ) : (
                cats.map((c) => <CategorySection key={c.id} category={c} />)
            )}

            <CategoryFormModal
                open={createOpen}
                mode="create"
                onCancel={() => setCreateOpen(false)}
                onSubmit={handleCreate}
                validateName={validateNewName}
            />
        </div>
    )
}
