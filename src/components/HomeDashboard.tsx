import { useEffect } from 'preact/hooks'
import { categories, isHydrated, getAllFilters, ensureLoaded } from '../store/filters'
import { itemImage } from '../store/items'
import { buildConveyorJson } from '../lib/conveyor'
import { copyToClipboard } from '../lib/clipboard'
import { showToast } from './CopyToast'
import type { Filter } from '../types'

interface Props {
    username: string
    orgId: string | null
}

function CopyIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-3.5 w-3.5"
        >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    )
}

function FilterMiniCard({ filter }: { filter: Filter }) {
    async function handleCopy() {
        const json = JSON.stringify(buildConveyorJson(filter.items))
        const ok = await copyToClipboard(json)
        showToast(ok ? 'Copied!' : 'Copy failed')
    }

    return (
        <div class="group flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/30 p-3 transition-all hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]">
            <div class="h-9 w-9 flex-shrink-0 overflow-hidden rounded bg-slate-800/80">
                <img
                    src={itemImage(filter.coverItemShortname)}
                    alt=""
                    class="h-full w-full object-contain"
                    loading="lazy"
                />
            </div>
            <div class="min-w-0 flex-1">
                <div class="truncate text-xs font-bold uppercase tracking-wider text-slate-100">
                    {filter.name}
                </div>
                <div class="text-[11px] text-slate-500">
                    {filter.items.length} {filter.items.length === 1 ? 'item' : 'items'}
                </div>
            </div>
            <button
                type="button"
                onClick={handleCopy}
                class="flex-shrink-0 rounded p-1.5 text-slate-600 transition-colors hover:bg-slate-800 hover:text-amber-400"
                title="Copy conveyor JSON"
            >
                <CopyIcon />
            </button>
        </div>
    )
}

function StatTile({
    label,
    value,
    dim = false,
}: {
    label: string
    value: string
    dim?: boolean
}) {
    return (
        <div class="rounded-lg border border-slate-800 bg-slate-900/30 p-3 sm:p-4">
            <div
                class={
                    dim ? 'text-xl font-bold text-slate-600' : 'text-2xl font-bold text-amber-400'
                }
                style="font-family: 'Bebas Neue', sans-serif"
            >
                {value}
            </div>
            <div class="mt-0.5 text-[11px] uppercase tracking-widest text-slate-500">{label}</div>
        </div>
    )
}

function Skeleton() {
    return (
        <div class="animate-pulse space-y-6">
            <div class="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} class="h-16 rounded-lg bg-slate-800/40" />
                ))}
            </div>
            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} class="h-[60px] rounded-lg bg-slate-800/40" />
                ))}
            </div>
        </div>
    )
}

function EmptyState() {
    return (
        <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/20 px-6 py-12 text-center">
            <pre class="mx-auto mb-5 select-none font-mono text-[11px] leading-relaxed text-slate-700">{`┌────────────────────────┐
│   CONVEYOR  OFFLINE    │
│                        │
│   [ ] no presets       │
│   [ ] no categories    │
│   [ ] awaiting input   │
│                        │
│   STATUS: STANDBY      │
└────────────────────────┘`}</pre>
            <p class="mb-4 text-sm text-slate-500">Your arsenal is empty. Build your first preset.</p>
            <a
                href="/filters/new"
                class="inline-block rounded bg-amber-500 px-5 py-2 text-sm font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-amber-400"
            >
                Build First Filter
            </a>
        </div>
    )
}

export default function HomeDashboard({ orgId }: Props) {
    useEffect(() => {
        void ensureLoaded()
    }, [])

    const hydrated = isHydrated.value
    const cats = categories.value

    if (!hydrated) return <Skeleton />

    const allFilters = getAllFilters()
    const totalFilters = allFilters.length
    const totalCategories = cats.length

    const recentFilters = [...allFilters]
        .sort(
            (a, b) =>
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        )
        .slice(0, 6)

    return (
        <div class="space-y-6">
            <div class="grid grid-cols-3 gap-3">
                <StatTile label="Filters" value={String(totalFilters)} />
                <StatTile label="Categories" value={String(totalCategories)} />
                {orgId ? (
                    <a
                        href="/org"
                        class="group block rounded-lg border border-slate-800 bg-slate-900/30 p-3 transition-all hover:border-amber-500/40 sm:p-4"
                    >
                        <div class="text-sm font-bold text-amber-400 transition-colors group-hover:text-amber-300">
                            CLAN
                        </div>
                        <div class="mt-0.5 text-[11px] uppercase tracking-widest text-slate-500">
                            Member →
                        </div>
                    </a>
                ) : (
                    <StatTile label="Clan" value="—" dim />
                )}
            </div>

            {totalFilters > 0 ? (
                <div>
                    <div class="mb-3">
                        <span class="font-mono text-[11px] uppercase tracking-widest text-slate-600">
                            Recent
                        </span>
                    </div>
                    <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {recentFilters.map((f) => (
                            <FilterMiniCard key={f.id} filter={f} />
                        ))}
                    </div>
                </div>
            ) : (
                <EmptyState />
            )}
        </div>
    )
}
