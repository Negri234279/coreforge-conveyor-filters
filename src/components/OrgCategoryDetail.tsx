import { useEffect, useState } from 'preact/hooks'
import { cloneOrgCategory, fetchOrgCategoryDetail, orgIsBusy } from '../store/org'
import { deploymentTotals } from '../store/filters'
import { showToast } from './CopyToast'
import DeploymentTotals from './DeploymentTotals'
import FilterCardBase from './FilterCardBase'
import TrackedButton from './TrackedButton'
import type { OrgCategoryDetail as Detail } from '../types'

interface Props {
    categoryId: string
}

export default function OrgCategoryDetail({ categoryId }: Props) {
    const [detail, setDetail] = useState<Detail | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loaded, setLoaded] = useState(false)
    const busy = orgIsBusy.value

    useEffect(() => {
        let cancelled = false
        fetchOrgCategoryDetail(categoryId)
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
    }, [categoryId])

    async function onClone() {
        try {
            const res = await cloneOrgCategory(categoryId)
            showToast(`Cloned "${res.name}" to your categories`)
            window.location.href = '/'
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Clone failed')
        }
    }

    if (!loaded) return <p class="text-sm text-slate-500">Loading…</p>
    if (error || !detail) {
        return (
            <div class="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                {error ?? 'Category not available.'}{' '}
                <a
                    href="/org/filters"
                    class="text-amber-400 underline decoration-amber-400/40 transition-colors hover:text-amber-300 hover:decoration-amber-400"
                >
                    Back to Clan Filters
                </a>
            </div>
        )
    }

    const allFilters = [...detail.filters, ...detail.subcategories.flatMap((s) => s.filters)]
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
                            {detail.openCoreName ? (
                                <>
                                    {' · from '}
                                    <span class="text-slate-200">{detail.openCoreName}</span>
                                </>
                            ) : null}{' '}
                            · read-only
                        </p>
                    </div>
                    <TrackedButton
                        type="button"
                        track="category_clone"
                        trackAttrs={{ categoryId }}
                        onClick={onClone}
                        disabled={busy}
                        class="rounded bg-amber-500 px-4 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Clone category
                    </TrackedButton>
                </div>
            </div>

            {allFilters.length > 0 ? (
                <DeploymentTotals totals={totals} variant="stat" class="mb-6" />
            ) : null}

            {allFilters.length === 0 ? (
                <p class="text-sm text-slate-500">This category has no filters yet.</p>
            ) : (
                <div class="space-y-6">
                    {detail.filters.length > 0 ? (
                        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {detail.filters.map((f) => (
                                <FilterCardBase key={f.id} filter={f} />
                            ))}
                        </div>
                    ) : null}
                    {detail.subcategories.map((sub) => (
                        <section key={sub.id}>
                            <h2 class="border-b border-slate-800 pb-2 font-mono text-[11px] tracking-widest text-slate-500 uppercase">
                                {sub.name}
                            </h2>
                            {sub.filters.length === 0 ? (
                                <p class="mt-2 text-xs text-slate-500">No filters.</p>
                            ) : (
                                <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {sub.filters.map((f) => (
                                        <FilterCardBase key={f.id} filter={f} />
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            )}
        </div>
    )
}
