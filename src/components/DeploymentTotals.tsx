import type { DeploymentTotals as Totals } from '../store/filters'

interface Props {
    totals: Totals
    /** 'chip' = compact pills (cards); 'stat' = bigger labelled blocks (detail header). */
    variant?: 'chip' | 'stat'
    class?: string
}

const LARGE_BOX = (
    <>
        <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
    </>
)

const SMALL_BOX = (
    <>
        <rect x="5" y="7" width="14" height="12" rx="1.5" />
        <line x1="5" y1="11" x2="19" y2="11" />
        <line x1="11" y1="14.5" x2="13" y2="14.5" />
    </>
)

const LOCKER = (
    <>
        <rect x="6" y="3" width="12" height="18" rx="1" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="9" y1="12" x2="10" y2="12" />
        <line x1="14" y1="12" x2="15" y2="12" />
    </>
)

const FRIDGE = (
    <>
        <rect x="6" y="3" width="12" height="18" rx="1.5" />
        <line x1="6" y1="10" x2="18" y2="10" />
        <line x1="9" y1="6" x2="9" y2="8" />
        <line x1="9" y1="13" x2="9" y2="17" />
    </>
)

const ITEMS = [
    {
        key: 'boxLargeTotal' as const,
        label: 'Large',
        path: LARGE_BOX,
    },
    {
        key: 'boxSmallTotal' as const,
        label: 'Small',
        path: SMALL_BOX,
    },
    {
        key: 'boxLockerTotal' as const,
        label: 'Lockers',
        path: LOCKER,
    },
    {
        key: 'boxFridgeTotal' as const,
        label: 'Fridges',
        path: FRIDGE,
    },
    {
        key: 'conveyorTotal' as const,
        label: 'Conveyors',
        // arrows in a row
        path: (
            <>
                <line x1="2" y1="12" x2="22" y2="12" />
                <polyline points="9 6 3 12 9 18" />
                <polyline points="15 6 21 12 15 18" />
            </>
        ),
    },
    {
        key: 'storageAdaptorTotal' as const,
        label: 'Storage adaptors',
        // plug
        path: (
            <>
                <path d="M9 2v6M15 2v6" />
                <path d="M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8z" />
                <line x1="12" y1="17" x2="12" y2="22" />
            </>
        ),
    },
]

export default function DeploymentTotals({ totals, variant = 'chip', class: cls = '' }: Props) {
    if (variant === 'stat') {
        return (
            <div class={`flex flex-wrap gap-2 ${cls}`}>
                {ITEMS.map((it) => (
                    <div
                        key={it.key}
                        class="flex items-center gap-2 rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5"
                        title={it.label}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="h-4 w-4 text-amber-500"
                        >
                            {it.path}
                        </svg>
                        <span class="text-sm font-semibold text-amber-400">{totals[it.key]}</span>
                        <span class="font-mono text-[11px] uppercase tracking-widest text-slate-500">{it.label}</span>
                    </div>
                ))}
            </div>
        )
    }
    return (
        <div class={`flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-slate-500 ${cls}`}>
            {ITEMS.map((it) => (
                <span key={it.key} class="inline-flex items-center gap-1" title={it.label}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="h-3.5 w-3.5 text-amber-500/40"
                    >
                        {it.path}
                    </svg>
                    <span class="text-amber-400/70">{totals[it.key]}</span>
                    {it.label}
                </span>
            ))}
        </div>
    )
}
