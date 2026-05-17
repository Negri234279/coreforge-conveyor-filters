import { useEffect, useRef, useState } from 'preact/hooks'
import type { OpenCore } from '../types'
import {
    categoriesForOpenCore,
    countFiltersForOpenCore,
    deleteOpenCore,
    deploymentTotalsForOpenCore,
    setOpenCoreShared,
} from '../store/filters'
import { shareOpenCoreWithClan } from '../store/org'
import DeploymentTotals from './DeploymentTotals'
import { itemImage } from '../store/items'
import { getCurrentUser } from '../store/auth'
import ConfirmDeleteModal from './ConfirmDeleteModal'

interface Props {
    openCore: OpenCore
    onRename: () => void
}

export default function OpenCoreCard({ openCore, onRename }: Props) {
    const inOrg = !!getCurrentUser()?.orgId
    const cats = categoriesForOpenCore(openCore.id)
    const filterCount = countFiltersForOpenCore(openCore.id)
    const totals = deploymentTotalsForOpenCore(openCore.id)

    // Up to 4 cover thumbnails from the filters inside, for a little collage.
    const covers: string[] = []
    for (const c of cats) {
        for (const f of [...c.filters, ...c.subcategories.flatMap((s) => s.filters)]) {
            if (covers.length >= 4) break
            covers.push(f.coverItemShortname)
        }
        if (covers.length >= 4) break
    }

    const [menuOpen, setMenuOpen] = useState(false)
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
    const [confirmShareOpen, setConfirmShareOpen] = useState(false)
    const [sharing, setSharing] = useState(false)
    const menuRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (!menuRef.current) return
            if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
        }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
    }, [])

    function onDelete() {
        setMenuOpen(false)
        setConfirmDeleteOpen(true)
    }

    function confirmDelete() {
        setConfirmDeleteOpen(false)
        deleteOpenCore(openCore.id)
    }

    function onToggleShare() {
        setMenuOpen(false)
        setConfirmShareOpen(true)
    }

    function confirmUnshare() {
        setConfirmShareOpen(false)
        setOpenCoreShared(openCore.id, false)
    }

    async function confirmShare() {
        setConfirmShareOpen(false)
        setSharing(true)
        try {
            await shareOpenCoreWithClan(openCore.id)
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Share failed')
        } finally {
            setSharing(false)
        }
    }

    function open() {
        window.location.href = `/opencore/${encodeURIComponent(openCore.id)}`
    }

    return (
        <div class="group relative flex flex-col rounded-lg border border-slate-700/80 bg-slate-900/40 transition hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]">
            <button
                type="button"
                onClick={open}
                class="flex flex-1 flex-col items-stretch rounded-lg p-4 text-left"
            >
                <div class="flex gap-1.5">
                    {covers.length > 0 ? (
                        covers.map((sn, i) => (
                            <img
                                key={`${sn}-${i}`}
                                src={itemImage(sn)}
                                alt=""
                                class="h-10 w-10 rounded bg-slate-800/80 object-contain"
                                loading="lazy"
                            />
                        ))
                    ) : (
                        <div class="flex h-10 w-10 items-center justify-center rounded bg-slate-800/80 text-slate-600">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                class="h-5 w-5"
                            >
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" />
                                <rect x="14" y="14" width="7" height="7" rx="1" />
                            </svg>
                        </div>
                    )}
                </div>
                <div class="mt-3 flex items-center gap-2">
                    <h3 class="truncate text-base font-bold tracking-wide text-slate-100 uppercase">
                        {openCore.name}
                    </h3>
                    {openCore.sharedWithOrg ? (
                        <span
                            class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wider text-amber-400 uppercase"
                            title="Shared with your clan"
                        >
                            Shared
                        </span>
                    ) : null}
                </div>
                <p class="mt-1 text-xs text-slate-500">
                    {cats.length} {cats.length === 1 ? 'category' : 'categories'} · {filterCount}{' '}
                    {filterCount === 1 ? 'filter' : 'filters'}
                </p>
                {filterCount > 0 ? <DeploymentTotals totals={totals} class="mt-2" /> : null}
            </button>

            <div class="absolute top-2 right-2" ref={menuRef}>
                <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    class="rounded p-1.5 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-800 hover:text-amber-400"
                    aria-label="Open Core actions"
                    aria-haspopup="menu"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        class="h-4 w-4"
                    >
                        <circle cx="12" cy="5" r="1.7" />
                        <circle cx="12" cy="12" r="1.7" />
                        <circle cx="12" cy="19" r="1.7" />
                    </svg>
                </button>
                {menuOpen ? (
                    <div
                        role="menu"
                        class="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl"
                    >
                        <button
                            type="button"
                            onClick={() => {
                                setMenuOpen(false)
                                open()
                            }}
                            class="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                        >
                            Open
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setMenuOpen(false)
                                onRename()
                            }}
                            class="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                        >
                            Rename
                        </button>
                        {inOrg ? (
                            <button
                                type="button"
                                onClick={onToggleShare}
                                disabled={sharing}
                                class="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {sharing
                                    ? 'Sharing…'
                                    : openCore.sharedWithOrg
                                      ? 'Unshare from clan'
                                      : 'Share with clan'}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={onDelete}
                            class="block w-full px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10"
                        >
                            Delete
                        </button>
                    </div>
                ) : null}
            </div>

            <ConfirmDeleteModal
                open={confirmDeleteOpen}
                title="Delete Open Core"
                message={`Delete Open Core "${openCore.name}"? Its categories become loose categories.`}
                confirmLabel="Delete Open Core"
                onCancel={() => setConfirmDeleteOpen(false)}
                onConfirm={confirmDelete}
            />

            <ConfirmDeleteModal
                open={confirmShareOpen}
                title={openCore.sharedWithOrg ? 'Unshare from clan' : 'Share with clan'}
                message={
                    openCore.sharedWithOrg
                        ? `Stop sharing "${openCore.name}" with your clan? Clan members will no longer see it.`
                        : `Create a clan copy of "${openCore.name}"? Your personal Open Core stays private and is not affected. Clan owners and admins will be able to edit the shared copy independently.`
                }
                confirmLabel={openCore.sharedWithOrg ? 'Unshare' : 'Share'}
                confirmTone="primary"
                onCancel={() => setConfirmShareOpen(false)}
                onConfirm={openCore.sharedWithOrg ? confirmUnshare : confirmShare}
            />
        </div>
    )
}
