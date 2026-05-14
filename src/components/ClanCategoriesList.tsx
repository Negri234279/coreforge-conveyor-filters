import {
    cloneOrgCategory,
    ensureOrgCategoriesLoaded,
    orgCategories,
    orgCategoriesError,
    orgCategoriesHydrated,
    orgIsBusy,
} from '../store/org'
import { showToast } from './CopyToast'
import DeploymentTotals from './DeploymentTotals'
import type { OrgCategoryView } from '../types'

export default function ClanCategoriesList() {
    void ensureOrgCategoriesLoaded()
    const hydrated = orgCategoriesHydrated.value
    const error = orgCategoriesError.value
    const cats = orgCategories.value
    const busy = orgIsBusy.value

    async function onClone(c: OrgCategoryView) {
        try {
            const res = await cloneOrgCategory(c.id)
            showToast(`Cloned "${res.name}" to your categories`)
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Clone failed')
        }
    }

    if (error) {
        return (
            <div class="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
            </div>
        )
    }
    if (!hydrated) return <p class="text-sm text-slate-500">Loading clan categories…</p>
    if (cats.length === 0) {
        return (
            <p class="text-xs text-slate-500">
                No shared categories yet. A member can share one from its section on My Conveyors.
            </p>
        )
    }

    return (
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cats.map((c) => (
                <div
                    key={c.id}
                    class="flex flex-col rounded-lg border border-slate-700/80 bg-slate-900/40 p-4"
                >
                    <h3 class="truncate text-base font-bold tracking-wide text-slate-100 uppercase">
                        {c.name}
                    </h3>
                    <p class="mt-1 text-xs text-slate-500">
                        {c.subcategoryCount}{' '}
                        {c.subcategoryCount === 1 ? 'subcategory' : 'subcategories'} ·{' '}
                        {c.filterCount} {c.filterCount === 1 ? 'filter' : 'filters'} · by{' '}
                        <span class="text-slate-400">{c.owner.username}</span>
                        {c.openCoreName ? (
                            <>
                                {' · '}
                                <span class="text-slate-400">{c.openCoreName}</span>
                            </>
                        ) : null}
                    </p>
                    {c.filterCount > 0 ? (
                        <DeploymentTotals
                            totals={{
                                boxTotal: c.boxTotal,
                                boxLargeTotal: c.boxLargeTotal,
                                boxSmallTotal: c.boxSmallTotal,
                                boxLockerTotal: c.boxLockerTotal,
                                boxFridgeTotal: c.boxFridgeTotal,
                                conveyorTotal: c.conveyorTotal,
                                storageAdaptorTotal: c.storageAdaptorTotal,
                            }}
                            class="mt-2"
                        />
                    ) : null}
                    <div class="mt-3 flex items-center gap-2">
                        <a
                            href={`/org/category/${encodeURIComponent(c.id)}`}
                            class="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-teal-500/60 hover:text-teal-200"
                        >
                            View
                        </a>
                        <button
                            type="button"
                            onClick={() => onClone(c)}
                            disabled={busy}
                            class="rounded-md bg-teal-500/90 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Clone category
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
