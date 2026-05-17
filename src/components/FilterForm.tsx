import { useEffect, useState } from 'preact/hooks'
import {
    categories,
    createFilter,
    ensureLoaded,
    isHydrated,
    updateFilter,
    findFilter,
    type FilterDraft,
} from '../store/filters'
import { itemImage } from '../store/items'
import { getBox, boxImage, searchBoxes } from '../store/boxes'
import { ALL_GAME_CATEGORIES, itemsInGameCategory } from '../store/gameCategories'
import { categorySlotShortname, describeSlot } from '../lib/filterSlots'
import { buildConveyorJson, parseConveyorJson, type ImportResult } from '../lib/conveyor'
import ItemCombobox, { type ComboboxEntry, type ComboboxSource } from './ItemCombobox'

const BOX_SOURCE: ComboboxSource = {
    emptyText: 'No boxes match.',
    search: (q, limit = 30) =>
        searchBoxes(q, limit).map((b) => ({
            key: b.imagePath,
            label: b.name,
            imageUrl: boxImage(b.imagePath),
        })),
    resolve: (key) => {
        const b = getBox(key)
        if (!b) return undefined
        return {
            key: b.imagePath,
            label: b.name,
            imageUrl: boxImage(b.imagePath),
        }
    },
}
import { copyToClipboard } from '../lib/clipboard'
import { showToast } from './CopyToast'
import { getCurrentUser } from '../store/auth'
import type { FilterItem } from '../types'

interface Props {
    filterId?: string
    /** Pre-populate and lock category in org-mode. */
    initialData?: {
        name: string
        description?: string
        coverItemShortname: string
        boxImagePath?: string
        categoryId: string
        subcategoryId?: string
        boxCount: number
        conveyorCount: number
        storageAdaptorCount: number
        items: FilterItem[]
    }
    /** When provided, replaces createFilter/updateFilter with custom save logic (org-mode). */
    onSave?: (draft: {
        name: string
        description?: string
        coverItemShortname: string
        boxImagePath?: string
        categoryId: string
        subcategoryId?: string
        boxCount: number
        conveyorCount: number
        storageAdaptorCount: number
        items: FilterItem[]
    }) => Promise<void>
    /** Where Cancel/back redirects to (org-mode). Defaults to '/'. */
    cancelHref?: string
}

const MAX_ITEMS = 30
type NumField = 'max' | 'buffer' | 'min'

// Combobox source for the filter's item list. Results are grouped by game
// category (Weapons, Medical, …) — each group starts with a clickable category
// header that adds it as a category-level filter, followed by the items that
// belong to that category. Items keep their item-level shortname; categories
// use the synthetic `category:<id>` shortname.
const ITEMS_AND_CATEGORIES_SOURCE: ComboboxSource = {
    emptyText: 'No items or categories match.',
    // No artificial limit — there are ~14 groups and the list is virtually
    // scrolled inside a max-h container. The combobox passes 30 by default;
    // ignore it and return the whole grouped tree so categories aren't cut off
    // arbitrarily in the middle.
    search: (q): ComboboxEntry[] => {
        const query = q.trim().toLowerCase()
        const out: ComboboxEntry[] = []
        for (const cat of ALL_GAME_CATEGORIES) {
            const catMatches = !query || cat.name.toLowerCase().includes(query)
            const items = itemsInGameCategory(cat.id).filter((it) => {
                if (!query) return true
                if (catMatches) return true
                return (
                    it.name.toLowerCase().includes(query) ||
                    it.shortname.toLowerCase().includes(query)
                )
            })
            if (!catMatches && items.length === 0) continue
            out.push({
                key: categorySlotShortname(cat.id),
                label: cat.name,
                hint: 'Click to add as a category filter',
                badge: 'Category',
                group: cat.name,
                isHeader: true,
            })
            for (const it of items) {
                out.push({
                    key: it.shortname,
                    label: it.name,
                    hint: it.shortname,
                    imageUrl: itemImage(it.shortname),
                    group: cat.name,
                })
            }
        }
        return out
    },
    resolve: (key): ComboboxEntry | undefined => {
        const meta = describeSlot(key)
        if (meta.isCategory) {
            return {
                key,
                label: meta.label,
                hint: meta.hint,
                badge: 'Category',
            }
        }
        if (meta.unknown) return undefined
        return {
            key,
            label: meta.label,
            hint: meta.hint,
            imageUrl: meta.imageUrl,
        }
    },
}

const SEP = '|'

function encodeSelection(catId: string, subId?: string): string {
    return subId ? `${catId}${SEP}${subId}` : catId
}

function decodeSelection(value: string): { catId: string; subId?: string } | null {
    if (!value) return null
    const [catId, subId] = value.split(SEP)
    if (!catId) return null
    return { catId, subId: subId || undefined }
}

export default function FilterForm({ filterId, initialData, onSave, cancelHref }: Props) {
    const editing = !!filterId || !!initialData
    const orgMode = !!onSave
    const cats = categories.value

    const me = getCurrentUser()
    const inOrg = !!me?.orgId

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [coverItem, setCoverItem] = useState('')
    const [boxImagePath, setBoxImagePath] = useState('')
    const [selection, setSelection] = useState('')
    const [items, setItems] = useState<FilterItem[]>([])
    const [sharedWithOrg, setSharedWithOrg] = useState(false)
    const [boxCount, setBoxCount] = useState(1)
    const [conveyorCount, setConveyorCount] = useState(1)
    const [storageAdaptorCount, setStorageAdaptorCount] = useState(1)
    const [error, setError] = useState<string | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const [importOpen, setImportOpen] = useState(false)
    const [importText, setImportText] = useState('')
    const [importError, setImportError] = useState<string | null>(null)
    const [importReplace, setImportReplace] = useState(true)

    // When editing, hydrate from API once data is loaded.
    useEffect(() => {
        // org-mode: pre-fill from initialData directly
        if (initialData) {
            setName(initialData.name)
            setDescription(initialData.description ?? '')
            setCoverItem(initialData.coverItemShortname)
            setBoxImagePath(initialData.boxImagePath ?? '')
            setSelection(encodeSelection(initialData.categoryId, initialData.subcategoryId))
            setItems([...initialData.items])
            setBoxCount(initialData.boxCount)
            setConveyorCount(initialData.conveyorCount)
            setStorageAdaptorCount(initialData.storageAdaptorCount)
            setLoaded(true)
            return
        }
        if (!filterId) {
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search)
                const catId = params.get('categoryId')
                const subId = params.get('subcategoryId')
                if (catId) {
                    setSelection(encodeSelection(catId, subId ?? undefined))
                }
            }
            setLoaded(true)
            return
        }
        let cancelled = false
        ensureLoaded().then(() => {
            if (cancelled) return
            if (!isHydrated.value) return
            const filter = findFilter(filterId!)
            if (!filter) {
                setLoaded(true)
                return
            }
            setName(filter.name)
            setDescription(filter.description ?? '')
            setCoverItem(filter.coverItemShortname)
            setBoxImagePath(filter.boxImagePath ?? '')
            setSelection(encodeSelection(filter.categoryId, filter.subcategoryId))
            setItems([...filter.items])
            setSharedWithOrg(filter.sharedWithOrg === true)
            setBoxCount(filter.boxCount ?? 1)
            setConveyorCount(filter.conveyorCount ?? 1)
            setStorageAdaptorCount(filter.storageAdaptorCount ?? 1)
            setLoaded(true)
        })
        return () => {
            cancelled = true
        }
    }, [filterId, initialData])

    function addItem(shortname: string) {
        if (items.length >= MAX_ITEMS) return
        if (items.some((it) => it.shortname === shortname)) return
        setItems([...items, { shortname, max: 0, buffer: 0, min: 0 }])
    }

    function removeItem(shortname: string) {
        setItems(items.filter((it) => it.shortname !== shortname))
    }

    function updateItem(shortname: string, field: NumField, value: number) {
        const safe = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
        setItems(items.map((it) => (it.shortname === shortname ? { ...it, [field]: safe } : it)))
    }

    async function onExport() {
        if (items.length === 0) {
            showToast('Nothing to export')
            return
        }
        const json = JSON.stringify(buildConveyorJson(items))
        const ok = await copyToClipboard(json)
        showToast(ok ? 'Conveyor config copied!' : 'Copy failed')
        if (ok) {
            // Fire-and-forget usage beacon. Failure is non-fatal — server-side
            // logEvent already swallows its own errors.
            void fetch('/api/events/log', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    type: 'filter_export_json',
                    targetId: filterId ?? null,
                    metadata: { itemCount: items.length },
                }),
            }).catch(() => {})
        }
    }

    function openImport() {
        setImportError(null)
        setImportText('')
        setImportReplace(true)
        setImportOpen(true)
    }

    function applyImport() {
        setImportError(null)
        let result: ImportResult
        try {
            result = parseConveyorJson(importText)
        } catch (err) {
            setImportError(err instanceof Error ? err.message : 'Could not parse JSON.')
            return
        }
        if (result.items.length === 0) {
            setImportError('No valid items or categories found in JSON.')
            return
        }

        let next: FilterItem[]
        if (importReplace) {
            next = result.items
        } else {
            const existing = new Set(items.map((it) => it.shortname))
            const additions = result.items.filter((it) => !existing.has(it.shortname))
            next = [...items, ...additions].slice(0, MAX_ITEMS)
        }
        setItems(next)
        setImportOpen(false)

        const parts = [`Imported ${result.items.length}`]
        const unknown = result.unknownItems + result.unknownCategories
        if (unknown > 0) parts.push(`${unknown} unknown`)
        if (result.skipped > 0) parts.push(`${result.skipped} skipped`)
        showToast(parts.join(' · '))
    }

    async function onSubmit(e: Event) {
        e.preventDefault()
        setError(null)

        if (!name.trim()) {
            setError('Name is required.')
            return
        }
        if (!coverItem) {
            setError('Cover image is required.')
            return
        }

        const decoded = decodeSelection(selection)
        if (!decoded) {
            setError('Category is required.')
            return
        }

        setSubmitting(true)
        try {
            if (orgMode && onSave) {
                await onSave({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    coverItemShortname: coverItem,
                    boxImagePath: boxImagePath || undefined,
                    categoryId: decoded.catId,
                    subcategoryId: decoded.subId,
                    boxCount,
                    conveyorCount,
                    storageAdaptorCount,
                    items,
                })
                window.location.href = cancelHref ?? (document.referrer || '/org/filters')
                return
            }

            const cat = cats.find((c) => c.id === decoded.catId)
            if (!cat) {
                setError('Selected category no longer exists.')
                setSubmitting(false)
                return
            }
            let subName: string | undefined
            if (decoded.subId) {
                const sub = cat.subcategories.find((s) => s.id === decoded.subId)
                if (!sub) {
                    setError('Selected subcategory no longer exists.')
                    setSubmitting(false)
                    return
                }
                subName = sub.name
            }

            const draft: FilterDraft = {
                name: name.trim(),
                description: description.trim() || undefined,
                coverItemShortname: coverItem,
                boxImagePath: boxImagePath || undefined,
                categoryName: cat.name,
                subcategoryName: subName,
                items,
                sharedWithOrg: inOrg ? sharedWithOrg : false,
                boxCount,
                conveyorCount,
                storageAdaptorCount,
            }

            if (editing && filterId) {
                await updateFilter(filterId, draft)
            } else {
                await createFilter(draft)
            }
            window.location.href = cat.openCoreId
                ? `/opencore/${encodeURIComponent(cat.openCoreId)}`
                : '/'
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save filter.')
            setSubmitting(false)
        }
    }

    if ((editing && !orgMode) && !loaded) {
        return <p class="text-sm text-slate-400">Loading filter…</p>
    }

    if ((editing && !orgMode) && loaded && !findFilter(filterId!)) {
        return (
            <div class="rounded-md border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                Filter not found.{' '}
                <a href="/" class="underline">
                    Go home
                </a>
                .
            </div>
        )
    }

    const noCategories = !orgMode && cats.length === 0

    return (
        <form onSubmit={onSubmit} class="space-y-6">
            {error ? (
                <div class="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {error}
                </div>
            ) : null}

            <div>
                <label class="block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Name <span class="text-rose-400">*</span>
                </label>
                <input
                    type="text"
                    required
                    value={name}
                    onInput={(e) => setName((e.target as HTMLInputElement).value)}
                    class="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/40"
                    placeholder="e.g. HQ, Cloth & Leather, Frags"
                />
            </div>

            <div>
                <label class="block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Description
                </label>
                <input
                    type="text"
                    value={description}
                    onInput={(e) => setDescription((e.target as HTMLInputElement).value)}
                    class="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/40"
                    placeholder="Optional"
                />
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <div>
                    <label class="block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                        Cover Image <span class="text-rose-400">*</span>
                    </label>
                    <div class="mt-1">
                        <ItemCombobox
                            value={coverItem || undefined}
                            onSelect={setCoverItem}
                            onClear={() => setCoverItem('')}
                            placeholder="Search items..."
                            hideHint
                        />
                    </div>
                </div>
                <div>
                    <div class="flex flex-wrap items-baseline gap-2">
                        <label class="block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                            Box / Container
                        </label>
                        <span class="text-[10px] tracking-normal text-slate-500 normal-case">
                            Select the box this conveyor feeds into
                        </span>
                    </div>
                    <div class="mt-1">
                        <ItemCombobox
                            value={boxImagePath || undefined}
                            onSelect={setBoxImagePath}
                            onClear={() => setBoxImagePath('')}
                            placeholder="Search boxes..."
                            source={BOX_SOURCE}
                        />
                    </div>
                </div>
            </div>

            <div>
                <label class="block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                    Deployment
                </label>
                <p class="mt-1 text-xs text-slate-500">
                    How many of each you run with this filter. Used for the totals shown on the Open
                    Core.
                </p>
                <div class="mt-2 grid gap-3 sm:grid-cols-3">
                    {(
                        [
                            ['Boxes', boxCount, setBoxCount],
                            ['Conveyors', conveyorCount, setConveyorCount],
                            ['Storage adaptors', storageAdaptorCount, setStorageAdaptorCount],
                        ] as const
                    ).map(([label, value, setter]) => (
                        <label
                            key={label}
                            class="flex items-stretch overflow-hidden rounded-md border border-slate-700 bg-slate-900/60 focus-within:border-teal-500/60 focus-within:ring-1 focus-within:ring-teal-500/40"
                        >
                            <span class="flex flex-1 items-center bg-slate-800/60 px-3 py-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                                {label}
                            </span>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                value={value}
                                onInput={(e) => {
                                    const n = Math.floor(
                                        Number((e.target as HTMLInputElement).value),
                                    )
                                    setter(Number.isFinite(n) && n >= 1 ? n : 1)
                                }}
                                class="w-20 bg-transparent px-2 py-2 text-right text-sm text-slate-100 outline-none"
                            />
                        </label>
                    ))}
                </div>
            </div>

            {inOrg && !orgMode ? (
                <label class="flex cursor-pointer items-start gap-3 rounded-md border border-slate-800 bg-slate-900/40 p-3 hover:border-teal-500/40">
                    <input
                        type="checkbox"
                        checked={sharedWithOrg}
                        onChange={(e) => setSharedWithOrg((e.target as HTMLInputElement).checked)}
                        class="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900"
                    />
                    <span class="flex flex-col">
                        <span class="text-sm font-medium text-slate-200">Share with my clan</span>
                        <span class="text-xs text-slate-500">
                            Other members will see this filter (read-only) on the Clan Filters page
                            and can clone it to their own space.
                        </span>
                    </span>
                </label>
            ) : null}

            {!orgMode ? (
                <div>
                    <label class="block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                        Category <span class="text-rose-400">*</span>
                    </label>
                    <p class="mt-1 text-xs text-slate-500">
                        Pick a parent category, or one of its subcategories.
                    </p>
                    <select
                        required
                        value={selection}
                        disabled={noCategories}
                        onChange={(e) => setSelection((e.target as HTMLSelectElement).value)}
                        class="mt-1 w-full appearance-none rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value="">— Select a category —</option>
                        {cats.map((cat) => (
                            <optgroup key={cat.id} label={cat.name}>
                                <option value={cat.id}>{cat.name} (no subcategory)</option>
                                {cat.subcategories.map((sub) => (
                                    <option key={sub.id} value={encodeSelection(cat.id, sub.id)}>
                                        {'  ↳ '}
                                        {sub.name}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                    {noCategories ? (
                        <p class="mt-2 text-xs text-amber-300">
                            No categories yet.{' '}
                            <a href="/" class="underline">
                                Create one from the home page
                            </a>{' '}
                            first.
                        </p>
                    ) : null}
                </div>
            ) : null}

            <div>
                <div class="flex items-center justify-between">
                    <label class="block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                        Conveyor Filter Items
                    </label>
                    <span class="text-xs text-slate-500">
                        {items.length}/{MAX_ITEMS} filters
                    </span>
                </div>
                <div class="mt-1">
                    <ItemCombobox
                        onSelect={addItem}
                        placeholder={
                            items.length >= MAX_ITEMS
                                ? 'Maximum of 30 items reached'
                                : 'Search items or categories...'
                        }
                        disabledShortnames={items.map((it) => it.shortname)}
                        source={ITEMS_AND_CATEGORIES_SOURCE}
                        resetOnSelect
                    />
                </div>

                {items.length > 0 ? (
                    <ul class="mt-3 flex flex-wrap gap-3">
                        {items.map((it) => {
                            const meta = describeSlot(it.shortname)
                            const letter =
                                meta.label.trim().charAt(0).toUpperCase() || '?'
                            return (
                                <li
                                    key={it.shortname}
                                    class="w-full max-w-[280px] flex-1 basis-[280px] rounded-md border border-slate-800 bg-slate-900/40 p-3"
                                >
                                    <div class="flex items-start gap-3">
                                        <div class="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-slate-800">
                                            {meta.isCategory ? (
                                                <span class="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-500/30 to-indigo-500/30 text-base font-bold tracking-wider text-teal-100 uppercase">
                                                    {letter}
                                                </span>
                                            ) : (
                                                <img
                                                    src={meta.imageUrl}
                                                    alt=""
                                                    class="h-full w-full object-contain"
                                                    loading="lazy"
                                                />
                                            )}
                                        </div>
                                        <div class="flex min-w-0 flex-1 flex-col">
                                            <span class="flex items-center gap-1.5 truncate text-sm font-medium text-slate-100">
                                                {meta.label}
                                                {meta.isCategory ? (
                                                    <span class="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-teal-200 uppercase">
                                                        Category
                                                    </span>
                                                ) : null}
                                            </span>
                                            <span class="truncate text-xs text-slate-500">
                                                {meta.hint ?? it.shortname}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeItem(it.shortname)}
                                            class="rounded p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                                            aria-label={`Remove ${it.shortname}`}
                                            title="Remove"
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
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div class="mt-3 flex flex-col gap-2">
                                        {(['max', 'buffer', 'min'] as const).map((field) => (
                                            <label
                                                key={field}
                                                class="flex items-stretch overflow-hidden rounded-md border border-slate-700 bg-slate-900/60 focus-within:border-teal-500/60 focus-within:ring-1 focus-within:ring-teal-500/40"
                                            >
                                                <span class="flex w-20 flex-shrink-0 items-center justify-center bg-slate-800/60 px-2 py-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                                                    {field}
                                                </span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step={1}
                                                    inputMode="numeric"
                                                    value={it[field]}
                                                    onInput={(e) =>
                                                        updateItem(
                                                            it.shortname,
                                                            field,
                                                            Number(
                                                                (e.target as HTMLInputElement)
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    class="w-full bg-transparent px-2 py-1.5 text-right text-sm text-slate-100 outline-none"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <p class="mt-3 text-xs text-slate-500">
                        No items yet. Add up to {MAX_ITEMS} items to this filter.
                    </p>
                )}
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={openImport}
                        class="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-teal-500/60 hover:text-teal-200"
                        title="Import conveyor JSON"
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
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Import
                    </button>
                    <button
                        type="button"
                        onClick={onExport}
                        disabled={items.length === 0}
                        class="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-teal-500/60 hover:text-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Copy conveyor JSON to clipboard"
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
                        Export
                    </button>
                </div>
                <div class="flex items-center gap-3">
                    <a
                        href={cancelHref ?? '/'}
                        class="rounded-md px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    >
                        Cancel
                    </a>
                    <button
                        type="submit"
                        disabled={submitting || noCategories}
                        class="rounded-md bg-teal-500/90 px-4 py-2 text-sm font-semibold text-slate-950 shadow hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? 'Saving…' : editing ? 'Save Filter' : 'Create Filter'}
                    </button>
                </div>
            </div>

            {importOpen ? (
                <div
                    class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setImportOpen(false)
                    }}
                >
                    <div class="w-full max-w-xl rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <h3 class="text-base font-semibold text-slate-100">
                                    Import conveyor config
                                </h3>
                                <p class="mt-1 text-xs text-slate-500">
                                    Paste a Rust industrial conveyor JSON array. Item slots
                                    (TargetItemName) and category slots (TargetCategory) are both
                                    supported. Up to {MAX_ITEMS} slots.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setImportOpen(false)}
                                class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                                aria-label="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <textarea
                            value={importText}
                            onInput={(e) => setImportText((e.target as HTMLTextAreaElement).value)}
                            spellcheck={false}
                            rows={10}
                            placeholder='[{"TargetItemName":"metal.fragments","MaxAmountInOutput":0,"BufferAmount":0,"MinAmountInInput":0, ...}]'
                            class="mt-3 w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/40"
                        />

                        {importError ? (
                            <div class="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                                {importError}
                            </div>
                        ) : null}

                        <div class="mt-3 flex items-center justify-between gap-3">
                            <label class="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                                <input
                                    type="checkbox"
                                    checked={importReplace}
                                    onChange={(e) =>
                                        setImportReplace((e.target as HTMLInputElement).checked)
                                    }
                                    class="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900"
                                />
                                Replace current items
                            </label>
                            <div class="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setImportOpen(false)}
                                    class="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={applyImport}
                                    disabled={!importText.trim()}
                                    class="rounded-md bg-teal-500/90 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Import
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </form>
    )
}
