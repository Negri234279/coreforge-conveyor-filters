import {
    cloneOrgOpenCore,
    ensureOrgOpenCoresLoaded,
    orgIsBusy,
    orgOpenCores,
    orgOpenCoresError,
    orgOpenCoresHydrated,
} from '../store/org'
import { showToast } from './CopyToast'
import DeploymentTotals from './DeploymentTotals'
import type { OrgOpenCoreView } from '../types'

export default function ClanOpenCoresList() {
    void ensureOrgOpenCoresLoaded()
    const hydrated = orgOpenCoresHydrated.value
    const error = orgOpenCoresError.value
    const cores = orgOpenCores.value
    const busy = orgIsBusy.value

    async function onClone(oc: OrgOpenCoreView) {
        try {
            const res = await cloneOrgOpenCore(oc.id)
            showToast(`Cloned "${res.name}" to your Open Cores`)
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
    if (!hydrated) return <p class="text-sm text-slate-500">Loading clan Open Cores…</p>
    if (cores.length === 0) {
        return (
            <p class="text-xs text-slate-500">
                No shared Open Cores yet. A member can share one from its card on My Conveyors.
            </p>
        )
    }

    return (
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cores.map((oc) => (
                <div
                    key={oc.id}
                    class="flex flex-col rounded-lg border border-slate-700/80 bg-slate-900/40 p-4"
                >
                    <h3 class="truncate text-base font-bold tracking-wide text-slate-100 uppercase">
                        {oc.name}
                    </h3>
                    <p class="mt-1 text-xs text-slate-500">
                        {oc.categoryCount} {oc.categoryCount === 1 ? 'category' : 'categories'} ·{' '}
                        {oc.filterCount} {oc.filterCount === 1 ? 'filter' : 'filters'} · by{' '}
                        <span class="text-slate-400">{oc.owner.username}</span>
                    </p>
                    {oc.filterCount > 0 ? (
                        <DeploymentTotals
                            totals={{
                                boxTotal: oc.boxTotal,
                                boxLargeTotal: oc.boxLargeTotal,
                                boxSmallTotal: oc.boxSmallTotal,
                                boxLockerTotal: oc.boxLockerTotal,
                                boxFridgeTotal: oc.boxFridgeTotal,
                                conveyorTotal: oc.conveyorTotal,
                                storageAdaptorTotal: oc.storageAdaptorTotal,
                            }}
                            class="mt-2"
                        />
                    ) : null}
                    <div class="mt-3 flex items-center gap-2">
                        <a
                            href={`/org/opencore/${encodeURIComponent(oc.id)}`}
                            class="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-teal-500/60 hover:text-teal-200"
                        >
                            View
                        </a>
                        <button
                            type="button"
                            onClick={() => onClone(oc)}
                            disabled={busy}
                            class="rounded-md bg-teal-500/90 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Clone entire
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
