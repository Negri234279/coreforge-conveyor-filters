import type { Anchor, GeometryShape, PrefabDef, PrefabKind, Vec3 } from '../../types'

function def(
    prefabName: string,
    displayName: string,
    kind: PrefabKind,
    shape: GeometryShape,
    x: number,
    y: number,
    z: number,
    anchor: Anchor,
    interactive: boolean,
): PrefabDef {
    return { prefabName, displayName, kind, shape, size: { x, y, z }, anchor, interactive }
}

export const PREFAB_REGISTRY: Record<string, PrefabDef> = {
    foundation: def('foundation', 'Foundation', 'foundation', 'box', 3, 1, 3, 'center', false),
    'foundation.triangle': def(
        'foundation.triangle',
        'Triangle Foundation',
        'foundation-triangle',
        'triangle-prism',
        3,
        1,
        3,
        'center',
        false,
    ),
    floor: def('floor', 'Floor / Ceiling', 'floor', 'box', 3, 0.1, 3, 'center', false),
    'floor.frame': def('floor.frame', 'Floor Frame', 'floor', 'box', 3, 0.1, 3, 'center', false),
    'floor.triangle': def(
        'floor.triangle',
        'Triangle Floor',
        'floor-triangle',
        'triangle-prism',
        3,
        0.1,
        3,
        'center',
        false,
    ),
    'floor.triangle.frame': def(
        'floor.triangle.frame',
        'Triangle Floor Frame',
        'floor-triangle',
        'triangle-prism',
        3,
        0.1,
        3,
        'center',
        false,
    ),
    wall: def('wall', 'Wall', 'wall', 'box', 3, 3, 0.1, 'bottom', false),
    'wall.half': def('wall.half', 'Half Wall', 'wall-half', 'box', 3, 1.5, 0.1, 'bottom', false),
    'wall.window': def(
        'wall.window',
        'Window Wall',
        'wall-window',
        'box',
        3,
        3,
        0.1,
        'bottom',
        false,
    ),
    'wall.frame': def('wall.frame', 'Wall Frame', 'wall-frame', 'box', 3, 3, 0.1, 'bottom', false),
    ramp: def('ramp', 'Ramp', 'ramp', 'wedge', 3, 3, 3, 'bottom', false),
    'box.wooden.large': def(
        'box.wooden.large',
        'Large Wood Box',
        'box-large',
        'box',
        // Real Rust large wood box is a chunky crate: ~1.1 W × 0.9 H × 1.0 D.
        // (The export's box spacing under-reports size — boxes clip into each
        // other in the radial packing — so we use the true model footprint.)
        1.7,
        0.8,
        1.0,
        'bottom',
        true,
    ),
    woodbox_deployed: def(
        'woodbox_deployed',
        'Wood Storage Box',
        'box-small',
        'box',
        // Real Rust small wood box: ~0.84 W × 0.72 H × 0.46 D.
        0.84,
        0.72,
        0.46,
        'bottom',
        true,
    ),
    'fridge.deployed': def(
        'fridge.deployed',
        'Fridge',
        'fridge',
        'box',
        // Real Rust fridge: ~0.68 W × 1.36 H × 0.67 D.
        0.68,
        1.36,
        0.67,
        'bottom',
        true,
    ),
    wall_single_shallow_shelf: def(
        'wall_single_shallow_shelf',
        'Shelf',
        'shelf',
        'box',
        1.0,
        1.0,
        0.3,
        'bottom',
        false,
    ),
} as const

/** "assets/prefabs/.../box.wooden.large.prefab" → "box.wooden.large" */
export function prefabBasename(prefabname: string): string {
    const last = prefabname.lastIndexOf('/')
    const tail = last >= 0 ? prefabname.slice(last + 1) : prefabname
    return tail.endsWith('.prefab') ? tail.slice(0, -7) : tail
}

const UNKNOWN_SIZE: Vec3 = { x: 1, y: 1, z: 1 }

/** Registry lookup with fallback for unrecognised prefabs. */
export function resolvePrefab(prefabname: string): PrefabDef {
    const basename = prefabBasename(prefabname)
    const found = PREFAB_REGISTRY[basename]
    if (found) return found
    return {
        prefabName: basename,
        displayName: basename,
        kind: 'unknown',
        shape: 'box',
        size: UNKNOWN_SIZE,
        anchor: 'bottom',
        interactive: false,
    }
}
