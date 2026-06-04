export interface Item {
    id: number
    itemId: number
    shortname: string
    name: string
    category: string
    imagePath: string
}

export interface Box {
    id: number
    name: string
    imagePath: string
}

export interface CategorySeed {
    id: number
    name: string
}

export interface ConveyorItem {
    /** null for item slots; the ItemCategory id for category slots. */
    TargetCategory: number | null
    MaxAmountInOutput: number
    BufferAmount: number
    MinAmountInInput: number
    IsBlueprint: boolean
    BufferTransferRemaining: number
    TargetItemName: string
}

export interface FilterItem {
    shortname: string
    max: number
    buffer: number
    min: number
}

/** Deployment counts for a filter. How many boxes it feeds, how many conveyors
 *  run it, and how many storage adaptors are wired up. Default 1 each. */
export interface FilterCounts {
    boxCount: number
    conveyorCount: number
    storageAdaptorCount: number
}

export const DEFAULT_FILTER_COUNTS: FilterCounts = {
    boxCount: 1,
    conveyorCount: 1,
    storageAdaptorCount: 1,
}

export interface Filter extends FilterCounts {
    id: string
    name: string
    description?: string
    coverItemShortname: string
    boxImagePath?: string
    categoryId: string
    subcategoryId?: string
    items: FilterItem[]
    sharedWithOrg?: boolean
    createdAt: string
}

export interface OrgFilterView extends FilterCounts {
    id: string
    name: string
    description?: string
    coverItemShortname: string
    boxImagePath?: string
    items: FilterItem[]
    owner: { id: string; username: string }
    categoryName: string
    subcategoryName?: string
    createdAt: string
}

export type OrgRole = 'owner' | 'admin' | 'member'

export interface OrgSummary {
    id: string
    name: string
    inviteCode: string | null // null for non-owners
    role: OrgRole
    members: { id: string; username: string; role: OrgRole }[]
}

export interface Subcategory {
    id: string
    name: string
    filters: Filter[]
}

export interface Category {
    id: string
    name: string
    /** When set, this category belongs to that Open Core; otherwise it's a "loose" category. */
    openCoreId?: string | null
    /** @deprecated Replaced by the Open Core entity. Kept for backward-compat; unused. */
    isOpenCoreFilter?: boolean
    sharedWithOrg?: boolean
    subcategories: Subcategory[]
    filters: Filter[]
}

/** An Open Core: a named grouping of categories (a base's industrial setup). */
export interface OpenCore {
    id: string
    name: string
    sharedWithOrg?: boolean
}

export interface MeState {
    openCores: OpenCore[]
    categories: Category[]
    source?: string
}

// ─── Open Core 3D Viewer ────────────────────────────────────────────────────

export interface RawVec3 {
    x: string
    y: string
    z: string
}

export interface RawEntity {
    grade: number
    pos: RawVec3
    prefabname: string
    rot: RawVec3 // Euler radians, Unity/left-handed, each component in [0, 2π]
    skinid: number // Steam workshop skin id; 0 = default skin
}

export interface RawOpenCoreFile {
    default?: {
        position?: RawVec3
        rotationdiff?: number
        rotationy?: number
    }
    entities: RawEntity[]
}

export interface Vec3 {
    x: number
    y: number
    z: number
}

export type PrefabKind =
    | 'foundation'
    | 'foundation-triangle'
    | 'floor'
    | 'floor-triangle'
    | 'wall'
    | 'wall-half'
    | 'wall-window'
    | 'wall-frame'
    | 'ramp'
    | 'box-large'
    | 'box-small'
    | 'fridge'
    | 'shelf'
    | 'unknown'

export type GeometryShape = 'box' | 'triangle-prism' | 'wedge'

/** Where the Rust entity `pos.y` sits relative to the mesh's vertical extent. */
export type Anchor = 'center' | 'bottom' | 'top'

export interface PrefabDef {
    /** Short prefab name = basename of prefabname without the ".prefab" suffix. */
    prefabName: string
    displayName: string
    kind: PrefabKind
    shape: GeometryShape
    /** Mesh size in metres: x = width, y = height, z = depth. */
    size: Vec3
    anchor: Anchor
    /** True = a storage container the user can click & assign a filter to. */
    interactive: boolean
}

export interface SceneEntity {
    /** Index into the parsed entity list — stable id for the whole entity set. */
    index: number
    /** Stable assignment key (interactive boxes only; '' for context geometry). */
    boxKey: string
    prefab: PrefabDef
    /** Position in Three.js space (Z already negated, anchor applied → mesh CENTER). */
    position: Vec3
    /** Euler radians in Three.js space, applied with rotation order 'YXZ'. */
    rotation: Vec3
    skinId: number
    grade: number
    interactive: boolean
}

export interface SceneBounds {
    min: Vec3
    max: Vec3
    center: Vec3
    size: Vec3
}

export interface OpenCoreLayoutModel {
    entities: SceneEntity[]
    /** Subset of `entities` where interactive === true. */
    interactiveBoxes: SceneEntity[]
    bounds: SceneBounds
    counts: {
        total: number
        structures: number
        boxes: number
        unknown: number
    }
}

/** One box → one filter. boxKey matches SceneEntity.boxKey. */
export interface BoxAssignment {
    boxKey: string
    filterId: string
}

/** Layout as returned by the API (client-facing). */
export interface OpenCoreLayout {
    id: string
    /** The Open Core this layout belongs to (null = standalone). */
    openCoreId: string | null
    name: string
    sharedWithOrg: boolean
    /** The raw uploaded CopyPaste JSON, verbatim. Parsed client-side at render. */
    sourceJson: string
    assignments: BoxAssignment[]
    owner: { id: string; username: string }
    /** Computed server-side for the requesting user (owner || clan owner/admin). */
    canEdit: boolean
    createdAt: string
    updatedAt: string
}

/** POST body to create a layout from an upload. */
export interface CreateLayoutBody {
    openCoreId: string | null
    name: string
    sourceJson: string
    sharedWithOrg?: boolean
}

/** PUT body to save edits. sourceJson set = owner "replace base file" in place. */
export interface UpdateLayoutBody {
    name?: string
    sharedWithOrg?: boolean
    assignments?: BoxAssignment[]
    sourceJson?: string
}

export type ViewerMode = 'view' | 'edit'

export interface ViewerUiState {
    mode: ViewerMode
    selectedBoxKey: string | null
    hoveredBoxKey: string | null
    panelOpen: boolean // mirrors selectedBoxKey !== null
    dirty: boolean // assignments changed since last successful save
    saving: boolean // a PUT is in flight
    lastError: string | null
}

// ─── /Open Core 3D Viewer ───────────────────────────────────────────────────

/** A clan member's shared Open Core, as listed on the Clan page. */
export interface OrgOpenCoreView {
    id: string
    name: string
    owner: { id: string; username: string }
    categoryCount: number
    filterCount: number
    /** Sums of the per-filter deployment counts across the whole Open Core. */
    boxTotal: number
    boxLargeTotal: number
    boxSmallTotal: number
    boxLockerTotal: number
    boxFridgeTotal: number
    conveyorTotal: number
    storageAdaptorTotal: number
}

/** Full read-only contents of a clan member's shared Open Core. */
export interface OrgOpenCoreDetail {
    id: string
    name: string
    owner: { id: string; username: string }
    categories: Category[]
}

/** A clan member's shared standalone category, as listed on the Clan page. */
export interface OrgCategoryView {
    id: string
    name: string
    owner: { id: string; username: string }
    /** Name of the Open Core the category belongs to, if any. Purely informative. */
    openCoreName?: string
    subcategoryCount: number
    filterCount: number
    boxTotal: number
    boxLargeTotal: number
    boxSmallTotal: number
    boxLockerTotal: number
    boxFridgeTotal: number
    conveyorTotal: number
    storageAdaptorTotal: number
}

/** Full read-only contents of a clan member's shared category. */
export interface OrgCategoryDetail {
    id: string
    name: string
    owner: { id: string; username: string }
    openCoreName?: string
    subcategories: Subcategory[]
    filters: Filter[]
}
