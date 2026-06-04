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
            <div class="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-[11px] text-rose-300">
                {error}
            </div>
        )
    }
    if (!hydrated) {
        return (
            <p class="font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                Loading clan categories…
            </p>
        )
    }
    if (cats.length === 0) {
        return (
            <p class="font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                No shared categories yet. A member can share one from its section on My Conveyors.
            </p>
        )
    }

    return (
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cats.map((c) => (
                <div
                    key={c.id}
                    class="flex flex-col rounded-lg border border-l-2 border-slate-800 border-l-amber-500/30 bg-slate-900/30 p-4 transition-all duration-[220ms] hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]"
                >
                    <h3
                        class="truncate text-xl text-slate-100"
                        style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                    >
                        {c.name}
                    </h3>
                    <p class="mt-1 font-mono text-[11px] text-slate-500">
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
                            class="rounded border border-slate-700/50 px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:border-slate-600 hover:text-amber-400"
                        >
                            View
                        </a>
                        <button
                            type="button"
                            onClick={() => onClone(c)}
                            disabled={busy}
                            class="rounded bg-amber-500 px-3 py-1.5 text-xs font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Clone category
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
