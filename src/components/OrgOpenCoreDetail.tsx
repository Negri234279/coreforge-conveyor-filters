import { useEffect, useState } from 'preact/hooks'
import { cloneOrgOpenCore, fetchOrgOpenCoreDetail, orgIsBusy } from '../store/org'
import { deploymentTotals } from '../store/filters'
import { itemImage } from '../store/items'
import { boxImage } from '../store/boxes'
import { buildConveyorJson } from '../lib/conveyor'
import { copyToClipboard } from '../lib/clipboard'
import { showToast } from './CopyToast'
import OpenCoreBoxesView from './OpenCoreBoxesView'
import DeploymentTotals from './DeploymentTotals'
import type { Filter, OrgOpenCoreDetail as Detail } from '../types'

type View = 'conveyors' | 'boxes'

interface Props {
    openCoreId: string
}

function FilterRow({ filter }: { filter: Filter }) {
    async function onCopy() {
        const ok = await copyToClipboard(JSON.stringify(buildConveyorJson(filter.items)))
        showToast(ok ? 'Copied!' : 'Copy failed')
    }
    return (
        <li class="flex items-center gap-3 rounded-md border border-slate-700/80 bg-slate-900/40 p-2">
            <div class="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-slate-800/80">
                <img
                    src={itemImage(filter.coverItemShortname)}
                    alt=""
                    class="h-full w-full object-contain"
                    loading="lazy"
                />
                {filter.boxImagePath ? (
                    <img
                        src={boxImage(filter.boxImagePath)}
                        alt=""
                        class="absolute right-0.5 bottom-0.5 h-7 w-7 rounded border border-slate-700 bg-slate-900/90 object-contain p-0.5"
                        loading="lazy"
                    />
                ) : null}
            </div>
            <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm font-semibold tracking-wide text-slate-100 uppercase">
                    {filter.name}
                </span>
                <span class="truncate text-xs text-slate-500">
                    {filter.items.length} {filter.items.length === 1 ? 'item' : 'items'}
                    {' · '}
                    <span title="Boxes / Conveyors / Storage adaptors">
                        {filter.boxCount ?? 1}/{filter.conveyorCount ?? 1}/
                        {filter.storageAdaptorCount ?? 1}
                    </span>
                </span>
            </div>
            <button
                type="button"
                onClick={onCopy}
                class="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-teal-300"
                aria-label="Copy conveyor JSON"
                title="Copy conveyor JSON"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="h-4 w-4"
                >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
            </button>
        </li>
    )
}

export default function OrgOpenCoreDetail({ openCoreId }: Props) {
    const [detail, setDetail] = useState<Detail | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [view, setView] = useState<View>('conveyors')
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

            <div class="mb-6 inline-flex rounded-md border border-slate-700 bg-slate-900/60 p-0.5 text-sm">
                <button
                    type="button"
                    onClick={() => setView('conveyors')}
                    class={`rounded px-3 py-1.5 font-semibold ${
                        view === 'conveyors'
                            ? 'bg-slate-700 text-slate-100'
                            : 'text-slate-400 hover:text-slate-100'
                    }`}
                >
                    Conveyors
                </button>
                <button
                    type="button"
                    onClick={() => setView('boxes')}
                    class={`rounded px-3 py-1.5 font-semibold ${
                        view === 'boxes'
                            ? 'bg-slate-700 text-slate-100'
                            : 'text-slate-400 hover:text-slate-100'
                    }`}
                >
                    Boxes
                </button>
            </div>

            {allFilters.length === 0 ? (
                <p class="text-sm text-slate-500">This Open Core has no filters yet.</p>
            ) : view === 'conveyors' ? (
                <div class="space-y-8">
                    {detail.categories.map((cat) => (
                        <section key={cat.id} class="mb-4">
                            <h2 class="mb-3 border-b border-slate-800 pb-3 text-sm font-bold tracking-[0.18em] text-slate-100 uppercase">
                                {cat.name}
                            </h2>
                            {cat.filters.length === 0 && cat.subcategories.length === 0 ? (
                                <p class="text-xs text-slate-500">No filters in this category.</p>
                            ) : null}
                            {cat.filters.length > 0 ? (
                                <ul class="grid gap-3 sm:grid-cols-2">
                                    {cat.filters.map((f) => (
                                        <FilterRow key={f.id} filter={f} />
                                    ))}
                                </ul>
                            ) : null}
                            {cat.subcategories.map((sub) => (
                                <div key={sub.id} class="mt-6">
                                    <h3 class="mb-2 border-b border-slate-800/70 pb-2 text-xs font-bold tracking-[0.18em] text-slate-200 uppercase">
                                        {sub.name}
                                    </h3>
                                    {sub.filters.length === 0 ? (
                                        <p class="text-xs text-slate-500">No filters.</p>
                                    ) : (
                                        <ul class="grid gap-3 sm:grid-cols-2">
                                            {sub.filters.map((f) => (
                                                <FilterRow key={f.id} filter={f} />
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </section>
                    ))}
                </div>
            ) : (
                <OpenCoreBoxesView categories={detail.categories} />
            )}
        </div>
    )
}
