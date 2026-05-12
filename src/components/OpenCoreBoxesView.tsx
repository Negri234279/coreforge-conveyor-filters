import type { Category, ConveyorItem, Filter } from '../types'
import { itemImage } from '../store/items'
import { boxImage } from '../store/boxes'
import { copyToClipboard } from '../lib/clipboard'
import { showToast } from './CopyToast'

function buildConveyorJson(filter: Filter): ConveyorItem[] {
    return filter.items.map((it) => ({
        TargetCategory: null,
        MaxAmountInOutput: it.max,
        BufferAmount: it.buffer,
        MinAmountInInput: it.min,
        IsBlueprint: false,
        BufferTransferRemaining: 0,
        TargetItemName: it.shortname,
    }))
}

function FilterTile({ filter }: { filter: Filter }) {
    async function onCopy() {
        const ok = await copyToClipboard(JSON.stringify(buildConveyorJson(filter)))
        showToast(ok ? 'Copied!' : 'Copy failed')
    }
    const imgSrc = filter.boxImagePath
        ? boxImage(filter.boxImagePath)
        : itemImage(filter.coverItemShortname)
    return (
        <button
            type="button"
            onClick={onCopy}
            class="flex w-24 flex-shrink-0 flex-col items-center gap-1.5 rounded-md border border-slate-700/70 bg-slate-900/50 p-2 text-center hover:border-teal-500/60"
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
            class={`flex items-start gap-4 border-b border-slate-800/70 p-3 ${indent ? 'pl-4' : ''}`}
        >
            <div class="w-36 flex-shrink-0 pl-1 text-left">
                <span
                    class={`block truncate text-xs font-bold tracking-[0.16em] uppercase ${
                        indent ? 'text-slate-300' : 'text-slate-100'
                    }`}
                >
                    {indent ? '↳ ' : ''}
                    {label}
                </span>
                <span class="text-[10px] text-slate-500">
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
