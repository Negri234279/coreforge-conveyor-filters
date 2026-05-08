import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'

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
    useEffect(() => {
        return () => {
            if (hideTimer) window.clearTimeout(hideTimer)
        }
    }, [])

    if (!message.value) return null

    return (
        <div class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
            <div class="pointer-events-auto rounded-md border border-teal-500/40 bg-teal-500/10 px-4 py-2 text-sm font-medium text-teal-200 shadow-lg backdrop-blur">
                {message.value}
            </div>
        </div>
    )
}
