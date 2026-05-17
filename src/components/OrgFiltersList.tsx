import {
    cloneOrgFilter,
    ensureOrgLoaded,
    orgError,
    orgFilters,
    orgIsBusy,
    orgIsHydrated,
} from '../store/org'
import { itemImage } from '../store/items'
import { boxImage } from '../store/boxes'
import { buildConveyorJson } from '../lib/conveyor'
import { copyToClipboard } from '../lib/clipboard'
import { showToast } from './CopyToast'
import type { OrgFilterView } from '../types'

export default function OrgFiltersList() {
    void ensureOrgLoaded()
    const hydrated = orgIsHydrated.value
    const error = orgError.value
    const filters = orgFilters.value
    const busy = orgIsBusy.value

    async function onCopy(f: OrgFilterView) {
        const ok = await copyToClipboard(JSON.stringify(buildConveyorJson(f.items)))
        showToast(ok ? 'Copied · Shift in-game' : 'Copy failed')
    }
    async function onClone(f: OrgFilterView) {
        try {
            await cloneOrgFilter(f.id)
            showToast(`Cloned "${f.name}" to your filters`)
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Clone failed')
        }
    }

    if (error) {
        return (
            <div class="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
            </div>
        )
    }
    if (!hydrated) {
        return <p class="text-sm text-slate-500">Loading clan filters…</p>
    }
    if (filters.length === 0) {
        return (
            <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
                <p class="text-sm text-slate-400">No shared filters yet.</p>
                <p class="mt-1 text-xs text-slate-500">
                    Members can mark any of their filters as "Share with my clan" to appear here.
                </p>
            </div>
        )
    }

    // Group by category name for visual scanning.
    const groups = new Map<string, OrgFilterView[]>()
    for (const f of filters) {
        const list = groups.get(f.categoryName) ?? []
        list.push(f)
        groups.set(f.categoryName, list)
    }

    return (
        <div class="space-y-6">
            {Array.from(groups.entries()).map(([catName, list]) => (
                <section key={catName}>
                    <h2 class="font-mono text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
                        {catName}
                    </h2>
                    <ul class="mt-2 grid gap-3 sm:grid-cols-2">
                        {list.map((f) => (
                            <li
                                key={f.id}
                                class="flex items-center gap-3 rounded border border-slate-800 bg-slate-900/30 p-2"
                            >
                                <div class="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-slate-800">
                                    <img
                                        src={itemImage(f.coverItemShortname)}
                                        alt=""
                                        class="h-full w-full object-contain"
                                        loading="lazy"
                                    />
                                    {f.boxImagePath ? (
                                        <img
                                            src={boxImage(f.boxImagePath)}
                                            alt=""
                                            class="absolute right-0.5 bottom-0.5 h-7 w-7 rounded border border-slate-800 bg-slate-900/90 object-contain p-0.5"
                                            loading="lazy"
                                        />
                                    ) : null}
                                </div>
                                <div class="flex min-w-0 flex-1 flex-col">
                                    <span class="truncate text-sm font-semibold tracking-wide text-slate-100 uppercase">
                                        {f.name}
                                    </span>
                                    <span class="truncate text-xs text-slate-500">
                                        {f.items.length} {f.items.length === 1 ? 'item' : 'items'}
                                        {f.subcategoryName ? ` · ${f.subcategoryName}` : ''} · by{' '}
                                        <span class="text-slate-400">{f.owner.username}</span>
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onCopy(f)}
                                    class="rounded p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
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
                                <button
                                    type="button"
                                    onClick={() => onClone(f)}
                                    disabled={busy}
                                    class="rounded border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-amber-500/40 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Clone to your filters"
                                >
                                    Clone
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    )
}
