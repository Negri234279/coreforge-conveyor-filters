import type { ViewerMode } from '../../types'

type Props = {
    openCoreId: string
    layoutName: string
    sharedWithOrg: boolean
    canEdit: boolean
    isOwner: boolean
    mode: ViewerMode
    onModeChange: (mode: ViewerMode) => void
    saving: boolean
    dirty: boolean
    onReupload: () => void
}

export default function ViewerToolbar({
    openCoreId,
    layoutName,
    sharedWithOrg,
    canEdit,
    isOwner,
    mode,
    onModeChange,
    saving,
    dirty,
    onReupload,
}: Props) {
    const saveLabel = saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'
    const saveLabelClass = saving ? 'text-amber-400' : dirty ? 'text-rose-400' : 'text-slate-500'

    return (
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <a
                    href={`/opencore/${openCoreId}`}
                    class="font-mono text-xs font-semibold tracking-wider text-slate-500 uppercase transition-colors hover:text-amber-400"
                >
                    ← Back to Open Core
                </a>
                <h1
                    class="text-2xl leading-none text-slate-100"
                    style="font-family:'Bebas Neue',sans-serif;letter-spacing:0.05em"
                >
                    {layoutName}
                </h1>
                {sharedWithOrg && (
                    <span class="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-widest text-amber-400 uppercase">
                        Shared
                    </span>
                )}
            </div>

            <div class="flex items-center gap-3">
                {/* Save status chip */}
                <span class={`font-mono text-[11px] tracking-widest uppercase ${saveLabelClass}`}>
                    {saveLabel}
                </span>

                {/* View ⇄ Edit toggle */}
                {canEdit && (
                    <div class="inline-flex rounded border border-slate-800 bg-slate-900/40 p-0.5 text-sm">
                        <button
                            type="button"
                            onClick={() => onModeChange('view')}
                            class={`rounded px-3 py-1.5 font-semibold transition-colors ${
                                mode === 'view'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'text-slate-400 hover:text-amber-400'
                            }`}
                        >
                            View
                        </button>
                        <button
                            type="button"
                            onClick={() => onModeChange('edit')}
                            class={`rounded px-3 py-1.5 font-semibold transition-colors ${
                                mode === 'edit'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'text-slate-400 hover:text-amber-400'
                            }`}
                        >
                            Edit
                        </button>
                    </div>
                )}

                {/* Replace base file (owner only) */}
                {isOwner && (
                    <button
                        type="button"
                        onClick={onReupload}
                        class="rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-slate-400 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                    >
                        Replace base file
                    </button>
                )}
            </div>
        </div>
    )
}
