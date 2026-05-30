import { useEffect, useRef, useState } from 'preact/hooks'
import type { Category } from '../types'
import {
    addSubcategory,
    categories,
    deleteCategory,
    openCores,
    removeSubcategory,
    renameSubcategory,
    setCategoryShared,
    updateCategory,
} from '../store/filters'
import { getCurrentUser } from '../store/auth'
import FilterCard from './FilterCard'
import CategoryFormModal from './CategoryFormModal'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import SubcategoryFormModal from './SubcategoryFormModal'

interface Props {
    category: Category
}

function HeaderMenu({
    items,
}: {
    items: { label: string; tone?: 'danger'; onClick: () => void }[]
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (!ref.current) return
            if (!ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
    }, [])

    return (
        <div class="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                class="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-amber-400"
                aria-label="Section actions"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="h-5 w-5"
                >
                    <circle cx="5" cy="12" r="1.7" />
                    <circle cx="12" cy="12" r="1.7" />
                    <circle cx="19" cy="12" r="1.7" />
                </svg>
            </button>
            {open ? (
                <div
                    role="menu"
                    class="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded border border-slate-800 bg-[#0d1117] shadow-[0_0_20px_rgba(0,0,0,0.5),0_0_10px_rgba(245,158,11,0.04)]"
                >
                    {items.map((it) => (
                        <button
                            key={it.label}
                            type="button"
                            onClick={() => {
                                setOpen(false)
                                it.onClick()
                            }}
                            class={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-800 ${
                                it.tone === 'danger'
                                    ? 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300'
                                    : 'text-slate-300 hover:text-amber-400'
                            }`}
                        >
                            {it.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

export default function CategorySection({ category }: Props) {
    const totalFilters =
        category.filters.length +
        category.subcategories.reduce((acc, s) => acc + s.filters.length, 0)

    const ssKey = `cf:cat:${category.id}:collapsed`
    const [collapsed, setCollapsed] = useState(() => sessionStorage.getItem(ssKey) === '1')

    function toggleCollapsed() {
        setCollapsed((v) => {
            const next = !v
            if (next) sessionStorage.setItem(ssKey, '1')
            else sessionStorage.removeItem(ssKey)
            return next
        })
    }
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [confirmShareOpen, setConfirmShareOpen] = useState(false)
    const [subDeleteId, setSubDeleteId] = useState<string | null>(null)
    const [subRenameId, setSubRenameId] = useState<string | null>(null)
    const [subCreateOpen, setSubCreateOpen] = useState(false)

    const inOrg = !!getCurrentUser()?.orgId
    const isShared = category.sharedWithOrg === true

    function onAddSubcategory() {
        setSubCreateOpen(true)
    }

    function handleCreateSubcategorySubmit(values: { name: string }) {
        addSubcategory(category.id, values.name)
        setSubCreateOpen(false)
    }

    function validateCreateSubcategoryName(name: string): string | null {
        const dup = category.subcategories.find(
            (s) => s.name.trim().toLowerCase() === name.toLowerCase(),
        )
        return dup ? `A subcategory named "${name}" already exists.` : null
    }

    function onEditCategory() {
        setEditOpen(true)
    }

    function handleEditSubmit(values: {
        name: string
        openCoreId: string | null
        sharedWithOrg: boolean
    }) {
        updateCategory(category.id, values)
        setEditOpen(false)
    }

    function confirmToggleShare() {
        setConfirmShareOpen(false)
        setCategoryShared(category.id, !isShared)
    }

    function validateEditName(name: string): string | null {
        if (name.toLowerCase() === category.name.trim().toLowerCase()) return null
        const dup = categories.value.find(
            (c) => c.id !== category.id && c.name.trim().toLowerCase() === name.toLowerCase(),
        )
        return dup ? `A category named "${name}" already exists.` : null
    }

    function onDeleteCategory() {
        setDeleteOpen(true)
    }

    function confirmDeleteCategory() {
        deleteCategory(category.id)
        setDeleteOpen(false)
    }

    const subToDelete =
        subDeleteId != null ? category.subcategories.find((s) => s.id === subDeleteId) : undefined

    function confirmDeleteSubcategory() {
        if (!subDeleteId) return
        removeSubcategory(category.id, subDeleteId)
        setSubDeleteId(null)
    }

    const subToRename =
        subRenameId != null ? category.subcategories.find((s) => s.id === subRenameId) : undefined

    function handleRenameSubcategorySubmit(values: { name: string }) {
        if (!subRenameId) return
        renameSubcategory(category.id, subRenameId, values.name)
        setSubRenameId(null)
    }

    function validateRenameSubcategoryName(name: string): string | null {
        if (!subToRename) return null
        if (name.toLowerCase() === subToRename.name.trim().toLowerCase()) {
            return null
        }
        const dup = category.subcategories.find(
            (s) => s.id !== subRenameId && s.name.trim().toLowerCase() === name.toLowerCase(),
        )
        return dup ? `A subcategory named "${name}" already exists.` : null
    }

    return (
        <section class="mb-12">
            <header class="flex items-center justify-between border-b border-slate-800 pb-3">
                <div class="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => toggleCollapsed()}
                        class="flex items-center gap-2 rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-amber-400"
                        aria-label={collapsed ? 'Expand category' : 'Collapse category'}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    <div>
                        <div class="mb-0.5 font-mono text-[11px] tracking-widest text-amber-500/40 uppercase">
                            Category
                        </div>
                        <div class="flex items-center gap-2">
                            <h2
                                class="text-xl text-slate-100"
                                style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                            >
                                {category.name}
                            </h2>
                            {isShared ? (
                                <span
                                    class="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-amber-400 uppercase"
                                    title="Shared with your clan"
                                >
                                    Shared
                                </span>
                            ) : null}
                            {collapsed && totalFilters > 0 ? (
                                <span class="font-mono text-[11px] text-slate-600">
                                    {totalFilters} filter{totalFilters !== 1 ? 's' : ''}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onAddSubcategory}
                        class="flex items-center gap-1 rounded px-2 py-1 font-mono text-[11px] tracking-widest text-slate-500 uppercase transition-colors hover:bg-slate-800 hover:text-amber-400"
                    >
                        <span aria-hidden="true">+</span> Subcategory
                    </button>
                    <HeaderMenu
                        items={[
                            {
                                label: 'New filter',
                                onClick: () => {
                                    window.location.href = `/filters/new?categoryId=${encodeURIComponent(
                                        category.id,
                                    )}`
                                },
                            },
                            { label: 'Edit', onClick: onEditCategory },
                            ...(inOrg
                                ? [
                                      {
                                          label: isShared ? 'Unshare from clan' : 'Share with clan',
                                          onClick: () => setConfirmShareOpen(true),
                                      },
                                  ]
                                : []),
                            { label: 'Delete', tone: 'danger' as const, onClick: onDeleteCategory },
                        ]}
                    />
                </div>
            </header>

            <CategoryFormModal
                open={editOpen}
                mode="edit"
                initialName={category.name}
                initialOpenCoreId={category.openCoreId ?? null}
                initialSharedWithOrg={isShared}
                canShareWithOrg={inOrg}
                openCores={openCores.value}
                onCancel={() => setEditOpen(false)}
                onSubmit={handleEditSubmit}
                validateName={validateEditName}
            />

            <ConfirmDeleteModal
                open={deleteOpen}
                title="Delete category"
                message={`Delete category "${category.name}" and all ${totalFilters} filters? This cannot be undone.`}
                confirmLabel="Delete category"
                onCancel={() => setDeleteOpen(false)}
                onConfirm={confirmDeleteCategory}
            />

            <ConfirmDeleteModal
                open={confirmShareOpen}
                title={isShared ? 'Unshare from clan' : 'Share with clan'}
                message={
                    isShared
                        ? `Stop sharing "${category.name}" with your clan? Clan members will no longer see it.`
                        : `Share "${category.name}" with your clan? All clan members will be able to see it.`
                }
                confirmLabel={isShared ? 'Unshare' : 'Share'}
                confirmTone="primary"
                onCancel={() => setConfirmShareOpen(false)}
                onConfirm={confirmToggleShare}
            />

            <ConfirmDeleteModal
                open={!!subToDelete}
                title="Delete subcategory"
                message={
                    subToDelete
                        ? `Delete subcategory "${subToDelete.name}"? Its filters will move into the parent category.`
                        : ''
                }
                confirmLabel="Delete subcategory"
                onCancel={() => setSubDeleteId(null)}
                onConfirm={confirmDeleteSubcategory}
            />

            <SubcategoryFormModal
                open={!!subToRename}
                mode="edit"
                initialName={subToRename?.name ?? ''}
                onCancel={() => setSubRenameId(null)}
                onSubmit={handleRenameSubcategorySubmit}
                validateName={validateRenameSubcategoryName}
            />

            <SubcategoryFormModal
                open={subCreateOpen}
                mode="create"
                onCancel={() => setSubCreateOpen(false)}
                onSubmit={handleCreateSubcategorySubmit}
                validateName={validateCreateSubcategoryName}
            />

            <div class={`mt-4 space-y-8 ${collapsed ? 'hidden' : ''}`}>
                {/* Filters directly in category */}
                {category.filters.length === 0 && category.subcategories.length === 0 ? (
                    <p class="font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                        No filters in this category.
                    </p>
                ) : null}

                {category.filters.length > 0 ? (
                    <div>
                        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {category.filters.map((f) => (
                                <FilterCard key={f.id} filter={f} />
                            ))}
                        </div>
                    </div>
                ) : category.subcategories.length > 0 ? (
                    <p class="font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                        No filters in this category.
                    </p>
                ) : null}

                {/* Subcategories */}
                {category.subcategories.map((sub) => (
                    <div key={sub.id}>
                        <header class="flex items-center justify-between border-b border-slate-800 pb-2">
                            <h3 class="font-mono text-[11px] tracking-widest text-slate-500 uppercase">
                                {sub.name}
                            </h3>
                            <HeaderMenu
                                items={[
                                    {
                                        label: 'New filter',
                                        onClick: () => {
                                            window.location.href = `/filters/new?categoryId=${encodeURIComponent(
                                                category.id,
                                            )}&subcategoryId=${encodeURIComponent(sub.id)}`
                                        },
                                    },
                                    {
                                        label: 'Rename',
                                        onClick: () => setSubRenameId(sub.id),
                                    },
                                    {
                                        label: 'Delete',
                                        tone: 'danger',
                                        onClick: () => setSubDeleteId(sub.id),
                                    },
                                ]}
                            />
                        </header>
                        <div class="mt-4">
                            {sub.filters.length === 0 ? (
                                <p class="font-mono text-[11px] tracking-widest text-slate-600 uppercase">
                                    No filters yet.
                                </p>
                            ) : (
                                <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {sub.filters.map((f) => (
                                        <FilterCard key={f.id} filter={f} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
