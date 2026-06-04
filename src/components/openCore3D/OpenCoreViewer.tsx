import { useEffect, useRef, useState } from 'preact/hooks'

import { categoriesForOpenCore, ensureLoaded } from '../../store/filters'
import {
    fetchLayoutsForOpenCore,
    layoutSaveError,
    saveLayoutDebounced,
} from '../../store/openCoreLayouts'
import { boxImage } from '../../store/boxes'
import { itemImage } from '../../store/items'
import { parseOpenCoreFile } from '../../lib/openCore/parseLayout'
import type {
    BoxAssignment,
    Filter,
    OpenCoreLayout,
    OpenCoreLayoutModel,
    SceneEntity,
    ViewerMode,
} from '../../types'
import type { SceneController } from '../../lib/openCore/scene'
import InfoPanel from './InfoPanel'
import ViewerToolbar from './ViewerToolbar'
import LayoutUploader from './LayoutUploader'

type Props = {
    openCoreId: string
    initialFilters?: Filter[]
    canCreate?: boolean
    sharedWithOrg?: boolean
}

function flattenFilters(openCoreId: string): Filter[] {
    const cats = categoriesForOpenCore(openCoreId)
    const out: Filter[] = []

    for (const cat of cats) {
        for (const f of cat.filters) {
            out.push(f)
        }

        for (const sub of cat.subcategories) {
            for (const f of sub.filters) {
                out.push(f)
            }
        }
    }

    return out
}

function assignmentsToMap(assignments: BoxAssignment[]): Map<string, string> {
    const m = new Map<string, string>()

    for (const a of assignments) {
        m.set(a.boxKey, a.filterId)
    }

    return m
}

function mapToAssignments(m: Map<string, string>): BoxAssignment[] {
    return Array.from(m.entries()).map(([boxKey, filterId]) => ({ boxKey, filterId }))
}

function coverImageFor(filter: Filter): string {
    return filter.boxImagePath
        ? boxImage(filter.boxImagePath)
        : itemImage(filter.coverItemShortname)
}

/** filterId → how many boxes in the layout are currently assigned that filter. */
function computeUsedCounts(assignments: Map<string, string>): Map<string, number> {
    const counts = new Map<string, number>()

    for (const filterId of assignments.values()) {
        counts.set(filterId, (counts.get(filterId) ?? 0) + 1)
    }

    return counts
}

/** boxKey → assigned filter's cover-image URL (skips unknown filter ids). */
function buildLabelMap(
    assignments: Map<string, string>,
    filtersById: Map<string, Filter>,
): Map<string, string> {
    const out = new Map<string, string>()

    for (const [boxKey, filterId] of assignments) {
        const f = filtersById.get(filterId)
        if (f) out.set(boxKey, coverImageFor(f))
    }

    return out
}

export default function OpenCoreViewer({ openCoreId, initialFilters, canCreate = true, sharedWithOrg = false }: Props) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [layout, setLayout] = useState<OpenCoreLayout | null>(null)
    const [model, setModel] = useState<OpenCoreLayoutModel | null>(null)
    const [availableFilters, setAvailableFilters] = useState<Filter[]>([])
    const [filtersById, setFiltersById] = useState<Map<string, Filter>>(new Map())
    const [showUploader, setShowUploader] = useState(false)

    const [mode, setMode] = useState<ViewerMode>('view')
    const [selectedBoxKey, setSelectedBoxKey] = useState<string | null>(null)
    const [panelOpen, setPanelOpen] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [assignments, setAssignments] = useState<Map<string, string>>(new Map())

    const saveErrorVal = layoutSaveError.value

    const containerRef = useRef<HTMLDivElement>(null)
    const controllerRef = useRef<SceneController | null>(null)

    // Load layout + filters on mount
    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                const layouts = initialFilters
                    ? await fetchLayoutsForOpenCore(openCoreId)
                    : (await Promise.all([fetchLayoutsForOpenCore(openCoreId), ensureLoaded()]))[0]

                if (cancelled) return

                const filters = initialFilters ?? flattenFilters(openCoreId)
                const fbm = new Map<string, Filter>()

                for (const f of filters) {
                    fbm.set(f.id, f)
                }

                setAvailableFilters(filters)
                setFiltersById(fbm)

                if (layouts.length === 0) {
                    if (canCreate) setShowUploader(true)
                    setLoading(false)
                    return
                }

                // An Open Core can have several layouts (e.g. from re-uploads).
                // Show the most recently touched one — that's the layout the user
                // is actively working on (upload or assign both bump updatedAt).
                const active = [...layouts].sort(
                    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
                )[0]
                setLayout(active)
                setAssignments(assignmentsToMap(active.assignments))

                const parsed = parseOpenCoreFile(active.sourceJson)
                setModel(parsed)
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void load()

        return () => {
            cancelled = true
        }
    }, [openCoreId])

    // Mount Three.js scene when model is ready
    useEffect(() => {
        if (!model || !containerRef.current) return

        let controller: SceneController | null = null

        async function mountScene() {
            if (!model || !containerRef.current) return

            const { createSceneController } = await import('../../lib/openCore/scene')
            controller = createSceneController()
            controllerRef.current = controller

            controller.mount(containerRef.current, model, {
                onSelect(key) {
                    setSelectedBoxKey(key)
                    setPanelOpen(key !== null)
                    controller?.setSelected(key)
                },
                onHover(key) {
                    // visual handled by scene; no extra panel state needed
                    void key
                },
            })

            // Sync initial assignments → emissive tint + front-face cover images
            controller.setAssigned(
                buildLabelMap(assignmentsToMap(layout?.assignments ?? []), filtersById),
            )
        }

        void mountScene()

        function handleResize() {
            controllerRef.current?.resize()
        }

        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            controller?.dispose()
            controllerRef.current = null
        }
    }, [model])

    function handleAssign(boxKey: string, filterId: string | null) {
        setAssignments((prev) => {
            const next = new Map(prev)
            if (filterId === null) {
                next.delete(boxKey)
            } else {
                next.set(boxKey, filterId)
            }

            controllerRef.current?.setAssigned(buildLabelMap(next, filtersById))
            setDirty(true)

            if (layout) {
                setSaving(true)
                saveLayoutDebounced(layout.id, { assignments: mapToAssignments(next) }, (err) => {
                    setSaving(false)
                    if (!err) setDirty(false)
                })
            }
            
            return next
        })
    }

    function handleModeChange(m: ViewerMode) {
        setMode(m)
        controllerRef.current?.setMode(m)
    }

    function handleClose() {
        setSelectedBoxKey(null)
        setPanelOpen(false)
        controllerRef.current?.setSelected(null)
    }

    // After the panel opens/closes the canvas changes width on md+ screens.
    // Defer resize by one rAF so the browser has reflowed before we read the new size.
    useEffect(() => {
        const id = requestAnimationFrame(() => controllerRef.current?.resize())
        return () => cancelAnimationFrame(id)
    }, [panelOpen])

    function handleCreated(newLayout: OpenCoreLayout) {
        setShowUploader(false)
        setLayout(newLayout)
        setAssignments(assignmentsToMap(newLayout.assignments))
        try {
            const parsed = parseOpenCoreFile(newLayout.sourceJson)
            setModel(parsed)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to parse layout')
        }
    }

    // Derive selected entity + assigned filter
    const selectedEntity: SceneEntity | null = selectedBoxKey
        ? (model?.interactiveBoxes.find((b) => b.boxKey === selectedBoxKey) ?? null)
        : null

    const assignedFilterId = selectedBoxKey ? assignments.get(selectedBoxKey) : undefined
    const assignedFilter = assignedFilterId ? (filtersById.get(assignedFilterId) ?? null) : null

    const canEdit = layout?.canEdit ?? false
    const isOwner = layout?.owner
        ? layout.canEdit &&
          (() => {
              // canEdit alone isn't enough to detect owner; we check via the store user
              // We rely on the toolbar receiving canEdit — sharing toggle is separate
              return true // simplified: use canEdit as a proxy; sharing toggle shown to canEdit users
          })()
        : false

    if (loading) {
        return <p class="text-sm text-slate-500">Loading…</p>
    }

    if (error) {
        return (
            <div class="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                {error}{' '}
                <a
                    href="/"
                    class="text-amber-400 underline decoration-amber-400/40 hover:text-amber-300"
                >
                    Go home
                </a>
            </div>
        )
    }

    if (showUploader || (!layout && canCreate)) {
        return (
            <LayoutUploader
                openCoreId={openCoreId}
                existing={layout ?? undefined}
                sharedWithOrg={sharedWithOrg}
                onCreated={handleCreated}
            />
        )
    }

    if (!layout) {
        return (
            <p class="py-8 text-center font-mono text-[11px] tracking-widest text-slate-500 uppercase">
                No layout uploaded yet. An owner or admin must upload the Open Core layout.
            </p>
        )
    }

    return (
        <div class="flex flex-col gap-4">
            <ViewerToolbar
                openCoreId={openCoreId}
                layoutName={layout.name}
                sharedWithOrg={layout.sharedWithOrg}
                canEdit={canEdit}
                isOwner={isOwner}
                mode={mode}
                onModeChange={handleModeChange}
                saving={saving}
                dirty={dirty}
                onReupload={() => setShowUploader(true)}
            />

            {saveErrorVal && (
                <div class="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    Save error: {saveErrorVal}
                </div>
            )}

            {/* Canvas + panel */}
            <div class="flex flex-col gap-4 md:flex-row">
                {/* Three.js canvas container */}
                <div
                    ref={containerRef}
                    class="relative min-h-[70vh] flex-1 overflow-hidden rounded-lg border border-slate-800"
                    style="background:#0a0e14"
                />

                {/* Info panel */}
                {panelOpen && (
                    <div class="w-full shrink-0 rounded-lg border border-slate-800 bg-slate-900/40 md:w-80">
                        <InfoPanel
                            entity={selectedEntity}
                            assignedFilter={assignedFilter}
                            mode={mode}
                            canEdit={canEdit}
                            availableFilters={availableFilters}
                            filterUsedCounts={computeUsedCounts(assignments)}
                            onAssign={handleAssign}
                            onClose={handleClose}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
