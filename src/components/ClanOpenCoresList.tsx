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
            <div class="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-[11px] text-rose-300">
                {error}
            </div>
        )
    }
    if (!hydrated) {
        return (
            <p class="font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                Loading clan Open Cores…
            </p>
        )
    }
    if (cores.length === 0) {
        return (
            <p class="font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                No shared Open Cores yet. A member can share one from its card on My Conveyors.
            </p>
        )
    }

    return (
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cores.map((oc) => (
                <div
                    key={oc.id}
                    class="flex flex-col rounded-lg border border-l-2 border-slate-800 border-l-amber-500/30 bg-slate-900/30 p-4 transition-all duration-[220ms] hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]"
                >
                    <h3
                        class="truncate text-xl text-slate-100"
                        style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                    >
                        {oc.name}
                    </h3>
                    <p class="mt-1 font-mono text-[11px] text-slate-500">
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
                            class="rounded border border-slate-700/50 px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:border-slate-600 hover:text-amber-400"
                        >
                            View
                        </a>
                        <button
                            type="button"
                            onClick={() => onClone(oc)}
                            disabled={busy}
                            class="rounded bg-amber-500 px-3 py-1.5 text-xs font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Clone entire
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
