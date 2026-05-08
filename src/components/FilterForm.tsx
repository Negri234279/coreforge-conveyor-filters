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
import { getItem, itemImage } from '../store/items'
import { getBox, boxImage, searchBoxes } from '../store/boxes'
import ItemCombobox, { type ComboboxSource } from './ItemCombobox'

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
import type { ConveyorItem, FilterItem } from '../types'

interface Props {
    filterId?: string
}

const MAX_ITEMS = 30
type NumField = 'max' | 'buffer' | 'min'

function toNonNegInt(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v ?? 0)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.floor(n)
}

function buildConveyorJson(items: FilterItem[]): ConveyorItem[] {
    return items.map((it) => ({
        TargetCategory: null,
        MaxAmountInOutput: it.max,
        BufferAmount: it.buffer,
        MinAmountInInput: it.min,
        IsBlueprint: false,
        BufferTransferRemaining: 0,
        TargetItemName: it.shortname,
    }))
}

interface ImportResult {
    items: FilterItem[]
    unknown: number
    skipped: number
}

function parseConveyorJson(raw: string): ImportResult {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
        throw new Error('Expected a JSON array of conveyor items.')
    }
    const seen = new Set<string>()
    const out: FilterItem[] = []
    let unknown = 0
    let skipped = 0
    for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') {
            skipped++
            continue
        }
        const o = entry as Record<string, unknown>
        const shortname = typeof o.TargetItemName === 'string' ? o.TargetItemName : ''
        if (!shortname) {
            skipped++
            continue
        }
        if (seen.has(shortname)) {
            skipped++
            continue
        }
        seen.add(shortname)
        if (!getItem(shortname)) unknown++
        out.push({
            shortname,
            max: toNonNegInt(o.MaxAmountInOutput),
            buffer: toNonNegInt(o.BufferAmount),
            min: toNonNegInt(o.MinAmountInInput),
        })
        if (out.length >= MAX_ITEMS) break
    }
    return { items: out, unknown, skipped }
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

export default function FilterForm({ filterId }: Props) {
    const editing = !!filterId
    const cats = categories.value

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [coverItem, setCoverItem] = useState('')
    const [boxImagePath, setBoxImagePath] = useState('')
    const [selection, setSelection] = useState('')
    const [items, setItems] = useState<FilterItem[]>([])
    const [error, setError] = useState<string | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const [importOpen, setImportOpen] = useState(false)
    const [importText, setImportText] = useState('')
    const [importError, setImportError] = useState<string | null>(null)
    const [importReplace, setImportReplace] = useState(true)

    // When editing, hydrate from API once data is loaded.
    useEffect(() => {
        if (!editing) {
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
            setLoaded(true)
        })
        return () => {
            cancelled = true
        }
    }, [editing, filterId])

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
            setImportError('No valid items found in JSON.')
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
        if (result.unknown > 0) parts.push(`${result.unknown} unknown`)
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
        const cat = cats.find((c) => c.id === decoded.catId)
        if (!cat) {
            setError('Selected category no longer exists.')
            return
        }
        let subName: string | undefined
        if (decoded.subId) {
            const sub = cat.subcategories.find((s) => s.id === decoded.subId)
            if (!sub) {
                setError('Selected subcategory no longer exists.')
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
        }

        setSubmitting(true)
        try {
            if (editing && filterId) {
                await updateFilter(filterId, draft)
            } else {
                await createFilter(draft)
            }
            window.location.href = '/'
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save filter.')
            setSubmitting(false)
        }
    }

    if (editing && !loaded) {
        return <p class="text-sm text-slate-400">Loading filter…</p>
    }

    if (editing && loaded && !findFilter(filterId!)) {
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

    const noCategories = cats.length === 0

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
                                : 'Search and add items...'
                        }
                        disabledShortnames={items.map((it) => it.shortname)}
                        resetOnSelect
                    />
                </div>

                {items.length > 0 ? (
                    <ul class="mt-3 flex flex-wrap gap-3">
                        {items.map((it) => {
                            const meta = getItem(it.shortname)
                            return (
                                <li
                                    key={it.shortname}
                                    class="w-full max-w-[280px] flex-1 basis-[280px] rounded-md border border-slate-800 bg-slate-900/40 p-3"
                                >
                                    <div class="flex items-start gap-3">
                                        <img
                                            src={itemImage(it.shortname)}
                                            alt=""
                                            class="h-12 w-12 flex-shrink-0 rounded bg-slate-800 object-contain"
                                            loading="lazy"
                                        />
                                        <div class="flex min-w-0 flex-1 flex-col">
                                            <span class="truncate text-sm font-medium text-slate-100">
                                                {meta?.name ?? it.shortname}
                                            </span>
                                            <span class="truncate text-xs text-slate-500">
                                                {it.shortname}
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
                        href="/"
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
                                    Paste a Rust industrial conveyor JSON array (TargetItemName +
                                    Max/Buffer/Min). Up to {MAX_ITEMS} items.
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
