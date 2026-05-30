import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { searchItems, getItem, itemImage } from '../store/items'

export interface ComboboxEntry {
    key: string
    label: string
    hint?: string
    /** Image URL. If omitted, the combobox renders a colored initial chip. */
    imageUrl?: string
    /** Optional tag shown next to the label (e.g. "Category"). */
    badge?: string
    /** Group label. Consecutive entries with the same group are rendered together. */
    group?: string
    /** When true, this entry is rendered as a clickable section header. */
    isHeader?: boolean
}

function ChipFallback({ label }: { label: string }) {
    const letter = label.trim().charAt(0).toUpperCase() || '?'
    return (
        <span class="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-500/20 to-slate-700/40 text-[11px] font-bold tracking-wider text-amber-200 uppercase">
            {letter}
        </span>
    )
}

export interface ComboboxSource {
    search: (query: string, limit?: number) => ComboboxEntry[]
    resolve: (key: string) => ComboboxEntry | undefined
    emptyText?: string
}

const ITEM_SOURCE: ComboboxSource = {
    emptyText: 'No items match.',
    search: (q, limit = 30) =>
        searchItems(q, limit).map((it) => ({
            key: it.shortname,
            label: it.name,
            hint: it.shortname,
            imageUrl: itemImage(it.shortname),
        })),
    resolve: (key) => {
        const it = getItem(key)
        if (!it) return undefined
        return {
            key: it.shortname,
            label: it.name,
            hint: it.shortname,
            imageUrl: itemImage(it.shortname),
        }
    },
}

interface Props {
    value?: string
    onSelect: (key: string) => void
    onClear?: () => void
    placeholder?: string
    /** Legacy alias for `disabledKeys`. */
    disabledShortnames?: string[]
    disabledKeys?: string[]
    resetOnSelect?: boolean
    source?: ComboboxSource
    hideHint?: boolean
}

export default function ItemCombobox({
    value,
    onSelect,
    onClear,
    placeholder = 'Search items...',
    disabledShortnames,
    disabledKeys,
    resetOnSelect = false,
    source = ITEM_SOURCE,
    hideHint = false,
}: Props) {
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const [changing, setChanging] = useState(false)
    const [active, setActive] = useState(0)
    const wrapRef = useRef<HTMLDivElement | null>(null)
    const inputRef = useRef<HTMLInputElement | null>(null)

    const selected = value ? source.resolve(value) : undefined
    const disabledSet = useMemo(
        () => new Set([...(disabledKeys ?? []), ...(disabledShortnames ?? [])]),
        [disabledKeys, disabledShortnames],
    )

    const results = useMemo(() => {
        return source.search(query, 30).filter((it) => !disabledSet.has(it.key))
    }, [query, disabledSet, source])

    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (!wrapRef.current) return
            if (!wrapRef.current.contains(e.target as Node)) {
                setOpen(false)
                setChanging(false)
            }
        }

        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [])

    function pick(entry: ComboboxEntry) {
        onSelect(entry.key)
        setChanging(false)

        if (resetOnSelect) {
            setQuery('')
            inputRef.current?.focus()
        } else {
            setQuery('')
            setOpen(false)
        }
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
        } else if (e.key === 'Enter') {
            if (open && results[active]) {
                e.preventDefault()
                pick(results[active])
            }
        } else if (e.key === 'Escape') {
            setOpen(false)
            setChanging(false)
        }
    }

    return (
        <div class="relative" ref={wrapRef}>
            {selected && !resetOnSelect && !changing ? (
                <div class="flex items-center gap-2 rounded border border-slate-800 bg-slate-900/60 px-2 py-1.5">
                    <div class="h-8 w-8 overflow-hidden rounded bg-slate-800">
                        {selected.imageUrl ? (
                            <img
                                src={selected.imageUrl}
                                alt=""
                                class="h-full w-full object-contain"
                                loading="lazy"
                            />
                        ) : (
                            <ChipFallback label={selected.label} />
                        )}
                    </div>
                    <div class="flex min-w-0 flex-1 flex-col">
                        <span class="flex items-center gap-1.5 truncate text-sm text-slate-100">
                            {selected.label}
                            {selected.badge ? (
                                <span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wider text-amber-400 uppercase">
                                    {selected.badge}
                                </span>
                            ) : null}
                        </span>
                        {selected.hint && !hideHint ? (
                            <span class="truncate text-xs text-slate-500">{selected.hint}</span>
                        ) : null}
                    </div>
                    {onClear ? (
                        <button
                            type="button"
                            onClick={onClear}
                            class="rounded px-1.5 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                            aria-label="Clear selection"
                        >
                            ✕
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => {
                            setChanging(true)
                            setOpen(true)
                            setQuery('')
                            setTimeout(() => inputRef.current?.focus(), 0)
                        }}
                        class="rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                    >
                        Change
                    </button>
                </div>
            ) : (
                <input
                    ref={inputRef}
                    type="text"
                    class="w-full rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
                    placeholder={placeholder}
                    value={query}
                    onFocus={() => setOpen(true)}
                    onInput={(e) => {
                        setQuery((e.target as HTMLInputElement).value)
                        setOpen(true)
                        setActive(0)
                    }}
                    onKeyDown={onKeyDown}
                />
            )}

            {open && (!selected || resetOnSelect || changing) && (
                <ul class="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded border border-slate-800 bg-[#0d1117] shadow-xl">
                    {results.length === 0 ? (
                        <li class="px-3 py-2 text-sm text-slate-500">
                            {source.emptyText ?? 'No matches.'}
                        </li>
                    ) : (
                        results.map((entry, i) => {
                            const isHeader = entry.isHeader === true
                            const grouped = !isHeader && !!entry.group
                            const isActive = i === active

                            return (
                                <li key={entry.key}>
                                    <button
                                        type="button"
                                        onMouseEnter={() => setActive(i)}
                                        onClick={() => pick(entry)}
                                        class={`flex w-full items-center gap-2 text-left transition-colors ${
                                            isHeader
                                                ? `border-t border-slate-800 bg-slate-950/60 px-2 py-2 first:border-t-0 ${
                                                      isActive
                                                          ? 'bg-amber-500/10'
                                                          : 'hover:bg-slate-800/60'
                                                  }`
                                                : `${grouped ? 'pl-6' : 'px-2'} py-1.5 pr-2 ${
                                                      isActive
                                                          ? 'bg-amber-500/10'
                                                          : 'hover:bg-slate-800/60'
                                                  }`
                                        }`}
                                    >
                                        <div class="h-7 w-7 flex-shrink-0 overflow-hidden rounded bg-slate-800">
                                            {entry.imageUrl ? (
                                                <img
                                                    src={entry.imageUrl}
                                                    alt=""
                                                    class="h-full w-full object-contain"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <ChipFallback label={entry.label} />
                                            )}
                                        </div>
                                        <div class="flex min-w-0 flex-col">
                                            <span
                                                class={`flex items-center gap-1.5 truncate text-sm ${
                                                    isHeader
                                                        ? 'font-mono text-[11px] font-semibold tracking-widest text-amber-400 uppercase'
                                                        : 'text-slate-100'
                                                }`}
                                            >
                                                {entry.label}
                                            </span>
                                            {entry.hint && !hideHint ? (
                                                <span class="truncate text-xs text-slate-500">
                                                    {entry.hint}
                                                </span>
                                            ) : null}
                                        </div>
                                    </button>
                                </li>
                            )
                        })
                    )}
                </ul>
            )}
        </div>
    )
}
