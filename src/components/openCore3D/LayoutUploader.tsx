import { useRef, useState } from 'preact/hooks'

import { parseOpenCoreFile } from '../../lib/openCore/parseLayout'
import { createLayout, replaceLayoutSource } from '../../store/openCoreLayouts'
import type { OpenCoreLayout } from '../../types'

type Props = {
    openCoreId: string
    /** When set, replace this layout's base in place (keeps assignments) instead
     *  of creating a new one. */
    existing?: OpenCoreLayout
    sharedWithOrg?: boolean
    onCreated: (layout: OpenCoreLayout) => void
}

export default function LayoutUploader({ openCoreId, existing, sharedWithOrg = false, onCreated }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [pasteText, setPasteText] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [summary, setSummary] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)

    async function handleText(text: string, name: string) {
        setError(null)
        setSummary(null)

        let model
        try {
            model = parseOpenCoreFile(text)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Invalid file')
            return
        }

        setSummary(
            `${model.counts.boxes} boxes · ${model.counts.structures} structures · ${model.counts.unknown} unknown`,
        )

        setUploading(true)
        try {
            const layout = existing
                ? await replaceLayoutSource(existing.id, { name, sourceJson: text })
                : await createLayout({ openCoreId, name, sourceJson: text, sharedWithOrg })
            onCreated(layout)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed')
        } finally {
            setUploading(false)
        }
    }

    async function handleFileChange(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        const text = await file.text()
        const name = file.name.replace(/\.json$/i, '') || 'Open Core layout'
        await handleText(text, name)
    }

    async function handlePaste() {
        if (!pasteText.trim()) return
        await handleText(pasteText.trim(), 'Open Core layout')
    }

    return (
        <div class="mx-auto max-w-xl py-8">
            <h2
                class="mb-6 text-3xl text-slate-100"
                style="font-family:'Bebas Neue',sans-serif;letter-spacing:0.05em"
            >
                Upload Open Core
            </h2>

            {/* Dropzone */}
            <div
                class="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                    e.preventDefault()
                    const file = e.dataTransfer?.files?.[0]
                    if (!file) return
                    const text = await file.text()
                    const name = file.name.replace(/\.json$/i, '') || 'Open Core layout'
                    await handleText(text, name)
                }}
            >
                <p class="text-sm text-slate-400">Drag & drop your CopyPaste JSON export here</p>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    class="rounded bg-amber-500 px-4 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {uploading ? 'Uploading…' : 'Choose file'}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    class="hidden"
                    onChange={handleFileChange}
                />
            </div>

            {/* Paste fallback */}
            <div class="mt-6 flex flex-col gap-2">
                <label class="font-mono text-[11px] tracking-widest text-slate-500 uppercase">
                    Or paste JSON
                </label>
                <textarea
                    value={pasteText}
                    onInput={(e) => setPasteText((e.target as HTMLTextAreaElement).value)}
                    placeholder='{"entities":[...]}'
                    rows={5}
                    class="w-full rounded border border-slate-800 bg-slate-900/40 px-3 py-2 font-mono text-xs text-slate-300 placeholder-slate-700 focus:border-amber-500/40 focus:outline-none"
                />
                <button
                    type="button"
                    onClick={handlePaste}
                    disabled={uploading || !pasteText.trim()}
                    class="self-start rounded bg-amber-500 px-4 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {uploading ? 'Uploading…' : 'Upload'}
                </button>
            </div>

            {/* Summary */}
            {summary && (
                <p class="mt-4 font-mono text-[11px] tracking-widest text-amber-400 uppercase">
                    {summary}
                </p>
            )}

            {/* Error */}
            {error && (
                <div class="mt-4 rounded border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                    {error}
                </div>
            )}
        </div>
    )
}
