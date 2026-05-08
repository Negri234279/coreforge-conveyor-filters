import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { searchItems, getItem, itemImage } from '../store/items'

export interface ComboboxEntry {
    key: string
    label: string
    hint?: string
    imageUrl: string
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
            if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [])

    function pick(entry: ComboboxEntry) {
        onSelect(entry.key)
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
        }
    }

    return (
        <div class="relative" ref={wrapRef}>
            {selected && !resetOnSelect ? (
                <div class="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5">
                    <img
                        src={selected.imageUrl}
                        alt=""
                        class="h-8 w-8 rounded bg-slate-800 object-contain"
                        loading="lazy"
                    />
                    <div class="flex min-w-0 flex-1 flex-col">
                        <span class="truncate text-sm text-slate-100">{selected.label}</span>
                        {selected.hint && !hideHint ? (
                            <span class="truncate text-xs text-slate-500">{selected.hint}</span>
                        ) : null}
                    </div>
                    {onClear ? (
                        <button
                            type="button"
                            onClick={onClear}
                            class="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                            aria-label="Clear selection"
                        >
                            ✕
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(true)
                            setQuery('')
                            setTimeout(() => inputRef.current?.focus(), 0)
                        }}
                        class="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    >
                        Change
                    </button>
                </div>
            ) : (
                <input
                    ref={inputRef}
                    type="text"
                    class="w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/40"
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

            {open && (!selected || resetOnSelect) && (
                <ul class="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-700 bg-slate-900 shadow-xl">
                    {results.length === 0 ? (
                        <li class="px-3 py-2 text-sm text-slate-500">
                            {source.emptyText ?? 'No matches.'}
                        </li>
                    ) : (
                        results.map((entry, i) => (
                            <li key={entry.key}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setActive(i)}
                                    onClick={() => pick(entry)}
                                    class={`flex w-full items-center gap-2 px-2 py-1.5 text-left ${
                                        i === active ? 'bg-slate-800' : ''
                                    }`}
                                >
                                    <img
                                        src={entry.imageUrl}
                                        alt=""
                                        class="h-7 w-7 rounded bg-slate-800 object-contain"
                                        loading="lazy"
                                    />
                                    <div class="flex min-w-0 flex-col">
                                        <span class="truncate text-sm text-slate-100">
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
                        ))
                    )}
                </ul>
            )}
        </div>
    )
}
