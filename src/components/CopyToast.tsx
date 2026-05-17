import { signal } from '@preact/signals'
import { useEffect, useState } from 'preact/hooks'

const message = signal<string | null>(null)
let hideTimer: number | undefined

export function showToast(text: string) {
    message.value = text
    if (typeof window !== 'undefined') {
        if (hideTimer) window.clearTimeout(hideTimer)
        hideTimer = window.setTimeout(() => {
            message.value = null
        }, 1800)
    }
}

export default function CopyToast() {
    const [text, setText] = useState<string | null>(null)

    useEffect(() => {
        const unsub = message.subscribe((val) => setText(val))
        return () => {
            unsub()
            if (hideTimer) window.clearTimeout(hideTimer)
        }
    }, [])

    if (!text) return null

    return (
        <div class="pointer-events-none fixed inset-x-0 bottom-6 z-[9999] flex justify-center">
            <div class="pointer-events-auto rounded border border-amber-500/40 bg-[#0d1117] px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)] backdrop-blur">
                {text}
            </div>
        </div>
    )
}
