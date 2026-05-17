import type { Category, Filter } from '../types'
import { itemImage } from '../store/items'
import { boxImage } from '../store/boxes'
import { buildConveyorJson } from '../lib/conveyor'
import { copyToClipboard } from '../lib/clipboard'
import { showToast } from './CopyToast'

function FilterTile({ filter }: { filter: Filter }) {
    async function onCopy() {
        const ok = await copyToClipboard(JSON.stringify(buildConveyorJson(filter.items)))
        showToast(ok ? 'Copied · Shift in-game' : 'Copy failed')
    }
    const imgSrc = filter.boxImagePath
        ? boxImage(filter.boxImagePath)
        : itemImage(filter.coverItemShortname)
    return (
        <button
            type="button"
            onClick={onCopy}
            class="flex w-24 flex-shrink-0 flex-col items-center gap-1.5 rounded border border-slate-800 bg-slate-900/30 p-2 text-center transition hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]"
            title="Copy conveyor JSON"
        >
            <img
                src={imgSrc}
                alt=""
                class="h-14 w-14 rounded bg-slate-800/80 object-contain"
                loading="lazy"
            />
            <span class="w-full truncate text-[11px] font-medium text-slate-200">
                {filter.name}
            </span>
        </button>
    )
}

function Row({ label, indent, filters }: { label: string; indent?: boolean; filters: Filter[] }) {
    return (
        <div
            class={`flex items-start gap-4 border-b border-slate-800 p-3 ${indent ? 'pl-4' : ''}`}
        >
            <div class="w-36 flex-shrink-0 pl-1 text-left">
                <span
                    class={`block truncate font-mono text-[11px] font-bold tracking-widest uppercase ${
                        indent ? 'text-slate-400' : 'text-slate-100'
                    }`}
                >
                    {indent ? '↳ ' : ''}
                    {label}
                </span>
                <span class="text-[11px] text-slate-500">
                    {filters.length} {filters.length === 1 ? 'filter' : 'filters'}
                </span>
            </div>
            <div class="flex flex-1 flex-wrap gap-2">
                {filters.length === 0 ? (
                    <span class="pt-2 text-xs text-slate-600">—</span>
                ) : (
                    filters.map((f) => <FilterTile key={f.id} filter={f} />)
                )}
            </div>
        </div>
    )
}

export default function OpenCoreBoxesView({ categories }: { categories: Category[] }) {
    if (categories.length === 0) {
        return <p class="text-sm text-slate-500">No categories in this Open Core yet.</p>
    }
    return (
        <div class="rounded-lg border border-slate-800 bg-slate-900/30">
            {categories.map((c) => (
                <div key={c.id}>
                    <Row label={c.name} filters={c.filters} />
                    {c.subcategories.map((s) => (
                        <Row key={s.id} label={s.name} indent filters={s.filters} />
                    ))}
                </div>
            ))}
        </div>
    )
}
