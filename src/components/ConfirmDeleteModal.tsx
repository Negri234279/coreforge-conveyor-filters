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
            ? 'rounded-md bg-teal-500/90 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-teal-400'
            : 'rounded-md bg-rose-500/90 px-3 py-1.5 text-sm font-semibold text-slate-50 hover:bg-rose-500'

    return (
        <div
            class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel()
            }}
        >
            <div class="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
                <div class="flex items-start justify-between gap-4">
                    <h3 class="text-base font-semibold text-slate-100">{title}</h3>
                    <button
                        type="button"
                        onClick={onCancel}
                        class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <p class="mt-3 text-sm text-slate-300">{message}</p>

                <div class="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        class="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
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
