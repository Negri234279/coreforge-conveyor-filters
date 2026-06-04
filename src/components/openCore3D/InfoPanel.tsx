import { useEffect, useState } from 'preact/hooks'

import { buildConveyorJson } from '../../lib/conveyor'
import { copyToClipboard } from '../../lib/clipboard'
import { itemImage } from '../../store/items'
import { boxImage } from '../../store/boxes'
import type { Filter, SceneEntity, ViewerMode } from '../../types'
import { showToast } from '../CopyToast'

type Props = {
    entity: SceneEntity | null
    assignedFilter: Filter | null
    mode: ViewerMode
    canEdit: boolean
    availableFilters: Filter[]
    filterUsedCounts: Map<string, number>
    onAssign: (boxKey: string, filterId: string | null) => void
    onClose: () => void
}

export default function InfoPanel({
    entity,
    assignedFilter,
    mode,
    canEdit,
    availableFilters,
    filterUsedCounts,
    onAssign,
    onClose,
}: Props) {
    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')

    useEffect(() => {
        setSearchInput('')
        setSearch('')
    }, [entity?.boxKey])

    useEffect(() => {
        const id = setTimeout(() => setSearch(searchInput), 200)
        return () => clearTimeout(id)
    }, [searchInput])

    if (!entity) {
        return (
            <div class="flex h-full items-center justify-center p-4">
                <span class="font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                    Select a box
                </span>
            </div>
        )
    }

    async function handleCopy() {
        if (!assignedFilter) return
        const ok = await copyToClipboard(JSON.stringify(buildConveyorJson(assignedFilter.items)))
        showToast(ok ? 'Copied · Shift in-game' : 'Copy failed')
    }

    const skinId = entity.skinId
    const { x, y, z } = entity.prefab.size

    const imgSrc = assignedFilter
        ? assignedFilter.boxImagePath
            ? boxImage(assignedFilter.boxImagePath)
            : itemImage(assignedFilter.coverItemShortname)
        : null

    const searchLower = search.toLowerCase()
    const visibleFilters = availableFilters.filter((f) => {
        const used = filterUsedCounts.get(f.id) ?? 0
        const remaining = f.boxCount - used
        const matchesSearch = !searchLower || f.name.toLowerCase().includes(searchLower)
        return (remaining > 0 || f.id === assignedFilter?.id) && matchesSearch
    })

    return (
        <div class="flex h-full flex-col gap-4 p-4">
            {/* Header */}
            <div class="flex items-start justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2">
                    <h2
                        class="text-2xl leading-none text-slate-100"
                        style="font-family:'Bebas Neue',sans-serif;letter-spacing:0.05em"
                    >
                        {entity.prefab.displayName}
                    </h2>
                    <span class="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-widest text-amber-400 uppercase">
                        {entity.prefab.kind}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    class="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-amber-400"
                    aria-label="Close panel"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="h-4 w-4"
                    >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {/* Meta rows */}
            <div class="flex flex-col gap-1.5 text-sm">
                <div class="flex items-center gap-2">
                    <span class="w-16 shrink-0 font-mono text-[11px] tracking-widest text-slate-500 uppercase">
                        Skin ID
                    </span>
                    <span class="font-mono text-slate-300">
                        {skinId === 0 ? (
                            'Default'
                        ) : (
                            <a
                                href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${skinId}`}
                                target="_blank"
                                rel="noopener"
                                class="text-amber-400 underline decoration-amber-400/40 hover:decoration-amber-400"
                            >
                                {skinId} — View skin on Workshop
                            </a>
                        )}
                    </span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="w-16 shrink-0 font-mono text-[11px] tracking-widest text-slate-500 uppercase">
                        Prefab
                    </span>
                    <span class="font-mono text-[11px] break-all text-slate-400">
                        {entity.prefab.prefabName}
                    </span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="w-16 shrink-0 font-mono text-[11px] tracking-widest text-slate-500 uppercase">
                        Size
                    </span>
                    <span class="font-mono text-[11px] text-slate-400">
                        {x}×{y}×{z} m
                    </span>
                </div>
            </div>

            {/* Assigned filter block */}
            <div class="flex flex-col gap-3 rounded border border-slate-800 bg-slate-900/40 p-3">
                {assignedFilter ? (
                    <>
                        <div class="flex items-center gap-3">
                            <img
                                src={imgSrc ?? ''}
                                alt=""
                                class="h-12 w-12 rounded bg-slate-800/80 object-contain"
                                loading="lazy"
                            />
                            <div class="min-w-0">
                                <p class="truncate text-sm font-semibold text-slate-200">
                                    {assignedFilter.name}
                                </p>
                                <p class="font-mono text-[11px] text-slate-500">
                                    {assignedFilter.items.length}{' '}
                                    {assignedFilter.items.length === 1 ? 'item' : 'items'}
                                </p>
                            </div>
                        </div>
                        {assignedFilter.items.length > 0 && (
                            <div class="flex flex-wrap gap-1.5">
                                {assignedFilter.items.map((item) => (
                                    <div
                                        key={item.shortname}
                                        title={`${item.shortname} — max:${item.max} buf:${item.buffer} min:${item.min}`}
                                        class="flex flex-col items-center gap-0.5"
                                    >
                                        <img
                                            src={itemImage(item.shortname)}
                                            alt={item.shortname}
                                            class="h-8 w-8 rounded bg-slate-800/80 object-contain"
                                            loading="lazy"
                                        />
                                        <span class="font-mono text-[9px] text-slate-500">
                                            {item.max}/{item.buffer}/{item.min}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div class="flex gap-2">
                            <button
                                type="button"
                                onClick={handleCopy}
                                class="flex-1 rounded bg-amber-500 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400"
                            >
                                Copy conveyor JSON
                            </button>
                            {canEdit && mode === 'edit' && (
                                <button
                                    type="button"
                                    onClick={() => onAssign(entity.boxKey, null)}
                                    title="Unassign filter"
                                    class="rounded border border-slate-700 bg-slate-800/60 px-2.5 text-slate-400 transition-colors hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        class="h-4 w-4"
                                    >
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <span class="font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                        No filter assigned
                    </span>
                )}
            </div>

            {/* Edit-mode filter picker */}
            {canEdit && mode === 'edit' && (
                <div class="flex flex-col gap-1.5">
                    <label class="font-mono text-[11px] tracking-widest text-slate-500 uppercase">
                        Assign filter
                    </label>
                    <div class="relative">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            class="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search filters…"
                            value={searchInput}
                            onInput={(e) => setSearchInput((e.target as HTMLInputElement).value)}
                            class="w-full rounded border border-slate-800 bg-slate-900/40 py-1.5 pr-3 pl-8 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500/40 focus:outline-none"
                        />
                    </div>
                    <div class="flex max-h-52 flex-col gap-0.5 overflow-y-auto rounded border border-slate-800 bg-slate-950/60 p-1">
                        {assignedFilter && (
                            <button
                                type="button"
                                onClick={() => onAssign(entity.boxKey, null)}
                                class="rounded px-2 py-1.5 text-left font-mono text-[11px] tracking-widest text-slate-500 uppercase hover:bg-slate-800 hover:text-rose-400"
                            >
                                — Unassign —
                            </button>
                        )}
                        {visibleFilters.map((f) => {
                            const used = filterUsedCounts.get(f.id) ?? 0
                            const remaining = f.boxCount - used
                            const isAssigned = f.id === assignedFilter?.id
                            const img = f.boxImagePath
                                ? boxImage(f.boxImagePath)
                                : itemImage(f.coverItemShortname)
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => onAssign(entity.boxKey, f.id)}
                                    class={`flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${
                                        isAssigned
                                            ? 'bg-amber-500/15 text-amber-300'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                                    }`}
                                >
                                    <img
                                        src={img}
                                        alt=""
                                        class="h-6 w-6 shrink-0 rounded bg-slate-800 object-contain"
                                        loading="lazy"
                                    />
                                    <span class="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                                    <span
                                        class={`shrink-0 font-mono text-[10px] ${
                                            isAssigned
                                                ? 'text-amber-500'
                                                : remaining <= 1
                                                  ? 'text-rose-400'
                                                  : 'text-slate-500'
                                        }`}
                                    >
                                        {remaining}×
                                    </span>
                                </button>
                            )
                        })}
                        {visibleFilters.length === 0 && (
                            <span class="px-2 py-2 font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                                {search ? 'No results' : 'No filters available'}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
