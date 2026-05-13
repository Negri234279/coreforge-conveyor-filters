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

    if (!hydrated) return <p class="text-sm text-slate-500">Loading…</p>
    if (!oc) {
        return (
            <div class="rounded-md border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                Open Core not found.{' '}
                <a href="/" class="underline">
                    Go home
                </a>
                .
            </div>
        )
    }

    function handleCreateCategory(values: { name: string; openCoreId: string | null }) {
        addCategory(values.name, values.openCoreId)
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

    return (
        <div>
            <div class="mb-6">
                <a
                    href="/"
                    class="text-xs font-semibold tracking-wider text-slate-500 uppercase hover:text-slate-200"
                >
                    &larr; Back to My Conveyors
                </a>
                <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <h1 class="text-2xl font-bold tracking-tight text-slate-100">{oc.name}</h1>
                        {oc.sharedWithOrg ? (
                            <span class="rounded bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-teal-300 uppercase">
                                Shared
                            </span>
                        ) : null}
                    </div>
                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setRenameOpen(true)}
                            class="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:border-teal-500/60 hover:text-teal-200"
                        >
                            Rename
                        </button>
                        {inOrg ? (
                            <button
                                type="button"
                                onClick={() => setConfirmShareOpen(true)}
                                class="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:border-teal-500/60 hover:text-teal-200"
                            >
                                {oc.sharedWithOrg ? 'Unshare from clan' : 'Share with clan'}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setCatCreateOpen(true)}
                            class="rounded-md bg-teal-500/90 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-teal-400"
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
            <div class="mb-6 inline-flex rounded-md border border-slate-700 bg-slate-900/60 p-0.5 text-sm">
                <button
                    type="button"
                    onClick={() => setView('conveyors')}
                    class={`rounded px-3 py-1.5 font-semibold ${
                        view === 'conveyors'
                            ? 'bg-slate-700 text-slate-100'
                            : 'text-slate-400 hover:text-slate-100'
                    }`}
                >
                    Conveyors
                </button>
                <button
                    type="button"
                    onClick={() => setView('boxes')}
                    class={`rounded px-3 py-1.5 font-semibold ${
                        view === 'boxes'
                            ? 'bg-slate-700 text-slate-100'
                            : 'text-slate-400 hover:text-slate-100'
                    }`}
                >
                    Boxes
                </button>
            </div>

            {cats.length === 0 ? (
                <div class="rounded-lg border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
                    <p class="text-sm text-slate-300">This Open Core has no categories yet.</p>
                    <button
                        type="button"
                        onClick={() => setCatCreateOpen(true)}
                        class="mt-4 rounded-md bg-teal-500/90 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
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
                        : `Share "${oc.name}" with your clan? All clan members will be able to see it.`
                }
                confirmLabel={oc.sharedWithOrg ? 'Unshare' : 'Share'}
                confirmTone="primary"
                onCancel={() => setConfirmShareOpen(false)}
                onConfirm={confirmToggleShare}
            />
        </div>
    )
}
