import { useEffect, useState } from 'preact/hooks'

interface Props {
    open: boolean
    /** Small eyebrow above the title, e.g. "New" / "Edit". */
    eyebrow: string
    /** The noun rendered as the Bebas Neue title, e.g. "Category". */
    title: string
    initialName?: string
    label?: string
    placeholder?: string
    submitLabel?: string
    busy?: boolean
    onCancel: () => void
    onSubmit: (values: { name: string }) => void
    validateName?: (name: string) => string | null
}

/**
 * Amber-styled single-field name modal — the canonical look shared by category
 * and subcategory create/rename flows across the personal and clan views.
 */
export default function NameFormModal({
    open,
    eyebrow,
    title,
    initialName = '',
    label = 'Name',
    placeholder,
    submitLabel = 'Save',
    busy = false,
    onCancel,
    onSubmit,
    validateName,
}: Props) {
    const [name, setName] = useState(initialName)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setName(initialName)
        setError(null)
    }, [open, initialName])

    if (!open) return null

    function submit(e: Event) {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) {
            setError('Name is required.')
            return
        }
        if (validateName) {
            const msg = validateName(trimmed)
            if (msg) {
                setError(msg)
                return
            }
        }
        onSubmit({ name: trimmed })
    }

    return (
        <div
            class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel()
            }}
        >
            <form
                onSubmit={submit}
                class="w-full max-w-md rounded-lg border border-l-2 border-slate-800 border-l-amber-500/30 bg-[#0d1117] p-5 shadow-[0_0_60px_rgba(0,0,0,0.8),0_0_30px_rgba(245,158,11,0.05)]"
            >
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <div class="mb-0.5 font-mono text-[11px] tracking-widest text-amber-500/50 uppercase">
                            {eyebrow}
                        </div>
                        <h3
                            class="text-2xl text-slate-100"
                            style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                        >
                            {title}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        class="rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-amber-400"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <div class="mt-5">
                    <label class="block font-mono text-[11px] tracking-widest text-amber-500/50 uppercase">
                        {label} <span class="text-rose-400">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        autoFocus
                        value={name}
                        onInput={(e) => setName((e.target as HTMLInputElement).value)}
                        class="mt-1.5 w-full rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 transition-colors outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
                        placeholder={placeholder}
                    />
                </div>

                {error ? (
                    <div class="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-[11px] text-rose-300">
                        {error}
                    </div>
                ) : null}

                <div class="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        class="rounded px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy}
                        class="rounded bg-amber-500 px-4 py-1.5 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitLabel}
                    </button>
                </div>
            </form>
        </div>
    )
}
