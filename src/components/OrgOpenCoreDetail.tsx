import { useEffect, useState } from 'preact/hooks'
import { cloneOrgOpenCore, fetchOrgOpenCoreDetail, orgIsBusy } from '../store/org'
import { deploymentTotals } from '../store/filters'
import { showToast } from './CopyToast'
import OpenCoreBoxesView from './OpenCoreBoxesView'
import DeploymentTotals from './DeploymentTotals'
import type { OrgOpenCoreDetail as Detail } from '../types'

interface Props {
    openCoreId: string
}

export default function OrgOpenCoreDetail({ openCoreId }: Props) {
    const [detail, setDetail] = useState<Detail | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loaded, setLoaded] = useState(false)
    const busy = orgIsBusy.value

    useEffect(() => {
        let cancelled = false
        fetchOrgOpenCoreDetail(openCoreId)
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

    if (!loaded) return <p class="text-sm text-slate-500">Loading…</p>
    if (error || !detail) {
        return (
            <div class="rounded-md border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                {error ?? 'Open Core not available.'}{' '}
                <a href="/org/filters" class="underline">
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
                    class="text-xs font-semibold tracking-wider text-slate-500 uppercase hover:text-slate-200"
                >
                    &larr; Back to Clan Filters
                </a>
                <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 class="text-2xl font-bold tracking-tight text-slate-100">
                            {detail.name}
                        </h1>
                        <p class="mt-1 text-sm text-slate-400">
                            Shared by <span class="text-slate-200">{detail.owner.username}</span> ·
                            read-only
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClone}
                        disabled={busy}
                        class="rounded-md bg-teal-500/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Clone entire Open Core
                    </button>
                </div>
            </div>

            {allFilters.length > 0 ? (
                <DeploymentTotals totals={totals} variant="stat" class="mb-6" />
            ) : null}

            <OpenCoreBoxesView categories={detail.categories} />
        </div>
    )
}
