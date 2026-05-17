import { useState } from 'preact/hooks'
import {
    addCategory,
    categoriesForOpenCore,
    categories as categoriesSignal,
    deploymentTotalsForOpenCore,
    findCategoryByName,
    findOpenCore,
    isHydrated,
    openCores,
    renameOpenCore,
    setOpenCoreShared,
} from '../store/filters'
import { shareOpenCoreWithClan } from '../store/org'
import { getCurrentUser } from '../store/auth'
import CategorySection from './CategorySection'
import DeploymentTotals from './DeploymentTotals'
import CategoryFormModal from './CategoryFormModal'
import OpenCoreFormModal from './OpenCoreFormModal'
import OpenCoreBoxesView from './OpenCoreBoxesView'
import ConfirmDeleteModal from './ConfirmDeleteModal'

interface Props {
    openCoreId: string
}

type View = 'conveyors' | 'boxes'

export default function OpenCoreDetail({ openCoreId }: Props) {
    const hydrated = isHydrated.value
    // Touch signals so we re-render on changes.
    openCores.value
    categoriesSignal.value

    const oc = findOpenCore(openCoreId)
    const cats = categoriesForOpenCore(openCoreId)
    const inOrg = !!getCurrentUser()?.orgId

    const [view, setView] = useState<View>('conveyors')
    const [catCreateOpen, setCatCreateOpen] = useState(false)
    const [renameOpen, setRenameOpen] = useState(false)
    const [confirmShareOpen, setConfirmShareOpen] = useState(false)
    const [sharing, setSharing] = useState(false)

    if (!hydrated) return <p class="text-sm text-slate-500">Loading…</p>
    if (!oc) {
        return (
            <div class="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                Open Core not found.{' '}
                <a
                    href="/"
                    class="text-amber-400 underline decoration-amber-400/40 transition-colors hover:text-amber-300 hover:decoration-amber-400"
                >
                    Go home
                </a>
                .
            </div>
        )
    }

    function handleCreateCategory(values: {
        name: string
        openCoreId: string | null
        sharedWithOrg: boolean
    }) {
        addCategory(values.name, values.openCoreId, values.sharedWithOrg)
        setCatCreateOpen(false)
    }
    function validateNewCategoryName(name: string): string | null {
        return findCategoryByName(name) ? `A category named "${name}" already exists.` : null
    }
    function handleRename(values: { name: string }) {
        renameOpenCore(openCoreId, values.name)
        setRenameOpen(false)
    }
    function validateRenameName(name: string): string | null {
        const dup = openCores.value.some(
            (o) => o.id !== openCoreId && o.name.trim().toLowerCase() === name.toLowerCase(),
        )
        return dup ? `An Open Core named "${name}" already exists.` : null
    }
    function confirmToggleShare() {
        setConfirmShareOpen(false)
        if (oc) setOpenCoreShared(openCoreId, !oc.sharedWithOrg)
    }

    async function confirmShareWithClan() {
        setConfirmShareOpen(false)
        setSharing(true)
        try {
            await shareOpenCoreWithClan(openCoreId)
        } catch (e) {
            // Re-open with no built-in toast component here — show via alert as fallback.
            alert(e instanceof Error ? e.message : 'Share failed')
        } finally {
            setSharing(false)
        }
    }

    return (
        <div>
            <div class="mb-6">
                <a
                    href="/"
                    class="text-xs font-semibold tracking-wider text-slate-500 uppercase transition-colors hover:text-amber-400"
                >
                    &larr; Back to My Conveyors
                </a>
                <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <h1
                            class="text-3xl text-slate-100"
                            style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                        >
                            {oc.name}
                        </h1>
                        {oc.sharedWithOrg ? (
                            <span class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wider text-amber-400 uppercase">
                                Shared
                            </span>
                        ) : null}
                    </div>
                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setRenameOpen(true)}
                            class="rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                        >
                            Rename
                        </button>
                        {inOrg ? (
                            oc.sharedWithOrg ? (
                                <button
                                    type="button"
                                    onClick={() => setConfirmShareOpen(true)}
                                    class="rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                                >
                                    Unshare from clan
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmShareOpen(true)}
                                    disabled={sharing}
                                    class="rounded border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-500/40 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {sharing ? 'Sharing…' : 'Share with clan'}
                                </button>
                            )
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setCatCreateOpen(true)}
                            class="rounded bg-amber-500 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-amber-400"
                        >
                            + Category
                        </button>
                    </div>
                </div>
            </div>

            {cats.length > 0 ? (
                <DeploymentTotals
                    totals={deploymentTotalsForOpenCore(openCoreId)}
                    variant="stat"
                    class="mb-6"
                />
            ) : null}

            {/* View toggle */}
            <div class="mb-6 inline-flex rounded border border-slate-800 bg-slate-900/40 p-0.5 text-sm">
                <button
                    type="button"
                    onClick={() => setView('conveyors')}
                    class={`rounded px-3 py-1.5 font-semibold transition-colors ${
                        view === 'conveyors'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'text-slate-400 hover:text-amber-400'
                    }`}
                >
                    Conveyors
                </button>
                <button
                    type="button"
                    onClick={() => setView('boxes')}
                    class={`rounded px-3 py-1.5 font-semibold transition-colors ${
                        view === 'boxes'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'text-slate-400 hover:text-amber-400'
                    }`}
                >
                    Boxes
                </button>
            </div>

            {cats.length === 0 ? (
                <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
                    <p class="text-sm text-slate-400">This Open Core has no categories yet.</p>
                    <button
                        type="button"
                        onClick={() => setCatCreateOpen(true)}
                        class="mt-4 rounded bg-amber-500 px-3 py-2 text-sm font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-amber-400"
                    >
                        + Add Category
                    </button>
                </div>
            ) : view === 'conveyors' ? (
                cats.map((c) => <CategorySection key={c.id} category={c} />)
            ) : (
                <OpenCoreBoxesView categories={cats} />
            )}

            <CategoryFormModal
                open={catCreateOpen}
                mode="create"
                lockedOpenCoreId={openCoreId}
                canShareWithOrg={inOrg}
                onCancel={() => setCatCreateOpen(false)}
                onSubmit={handleCreateCategory}
                validateName={validateNewCategoryName}
            />
            <OpenCoreFormModal
                open={renameOpen}
                mode="edit"
                initialName={oc.name}
                onCancel={() => setRenameOpen(false)}
                onSubmit={handleRename}
                validateName={validateRenameName}
            />
            <ConfirmDeleteModal
                open={confirmShareOpen}
                title={oc.sharedWithOrg ? 'Unshare from clan' : 'Share with clan'}
                message={
                    oc.sharedWithOrg
                        ? `Stop sharing "${oc.name}" with your clan? Clan members will no longer see it.`
                        : `Create a clan copy of "${oc.name}"? Your personal Open Core stays private and is not affected. Clan owners and admins will be able to edit the shared copy independently.`
                }
                confirmLabel={oc.sharedWithOrg ? 'Unshare' : 'Share'}
                confirmTone="primary"
                onCancel={() => setConfirmShareOpen(false)}
                onConfirm={oc.sharedWithOrg ? confirmToggleShare : confirmShareWithClan}
            />
        </div>
    )
}
