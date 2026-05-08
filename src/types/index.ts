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
    TargetCategory: null
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

export interface Filter {
    id: string
    name: string
    description?: string
    coverItemShortname: string
    boxImagePath?: string
    categoryId: string
    subcategoryId?: string
    items: FilterItem[]
    createdAt: string
}

export interface Subcategory {
    id: string
    name: string
    filters: Filter[]
}

export interface Category {
    id: string
    name: string
    isOpenCoreFilter?: boolean
    subcategories: Subcategory[]
    filters: Filter[]
}
