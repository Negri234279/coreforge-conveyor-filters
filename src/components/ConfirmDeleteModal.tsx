interface Props {
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    confirmTone?: 'danger' | 'primary'
    onCancel: () => void
    onConfirm: () => void
}

export default function ConfirmDeleteModal({
    open,
    title,
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    confirmTone = 'danger',
    onCancel,
    onConfirm,
}: Props) {
    if (!open) return null

    const confirmClass =
        confirmTone === 'primary'
            ? 'rounded bg-amber-500 px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-amber-400'
            : 'rounded bg-rose-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-50 transition-colors hover:bg-rose-500'

    return (
        <div
            class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel()
            }}
        >
            <div
                class="w-full max-w-md rounded-lg border border-slate-800 p-5 shadow-xl"
                style="background:rgba(15,23,42,0.97); border-left:2px solid rgba(245,158,11,0.32)"
            >
                <div class="flex items-start justify-between gap-4">
                    <h3
                        class="text-xl text-slate-100"
                        style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                    >
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onCancel}
                        class="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <p class="mt-3 text-sm text-slate-400">{message}</p>

                <div class="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        class="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                    >
                        {cancelLabel}
                    </button>
                    <button type="button" onClick={onConfirm} class={confirmClass}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
