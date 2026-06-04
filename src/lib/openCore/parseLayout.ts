import type { OpenCoreLayoutModel, SceneEntity, SceneBounds, Vec3 } from '../../types'

import { resolvePrefab } from './prefabs'
import { rustPosToThree, rustRotToThreeEuler } from './coords'

// boxKey = String(entityIndex) ties each interactive box to its position in
// the entities array. A different uploaded file produces a new layout row (POST),
// so boxKeys never drift for a given saved layout.

function expandBounds(minV: Vec3, maxV: Vec3, pos: Vec3, sx: number, sy: number, sz: number): void {
    const hx = sx / 2
    const hy = sy / 2
    const hz = sz / 2
    if (pos.x - hx < minV.x) minV.x = pos.x - hx
    if (pos.x + hx > maxV.x) maxV.x = pos.x + hx
    if (pos.y - hy < minV.y) minV.y = pos.y - hy
    if (pos.y + hy > maxV.y) maxV.y = pos.y + hy
    if (pos.z - hz < minV.z) minV.z = pos.z - hz
    if (pos.z + hz > maxV.z) maxV.z = pos.z + hz
}

export function parseOpenCoreFile(raw: string): OpenCoreLayoutModel {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new Error('Invalid open core JSON. Paste the full CopyPaste export.')
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Not a CopyPaste export: root must be an object.')
    }

    const root = parsed as Record<string, unknown>
    if (!Array.isArray(root.entities)) {
        throw new Error('Not a CopyPaste export: missing "entities" array.')
    }

    // TODO: apply default.position offset in a later phase.

    const entities: SceneEntity[] = []
    const interactiveBoxes: SceneEntity[] = []
    let structures = 0
    let boxes = 0
    let unknown = 0

    const minV: Vec3 = { x: Infinity, y: Infinity, z: Infinity }
    const maxV: Vec3 = { x: -Infinity, y: -Infinity, z: -Infinity }

    for (let i = 0; i < root.entities.length; i++) {
        const raw = root.entities[i]
        if (!raw || typeof raw !== 'object') continue
        const e = raw as Record<string, unknown>
        if (typeof e.prefabname !== 'string') continue

        // Industrial player-IO entities (conveyor, splitter, combiner, storage
        // adaptor, …) all live under playerioents/ — out of scope for this phase,
        // so skip them entirely.
        if (e.prefabname.includes('/playerioents/')) continue

        const prefab = resolvePrefab(e.prefabname)
        // Ramps render poorly (slope orientation/pivot can't be verified from the
        // export) — skip them entirely rather than show a broken wedge.
        if (prefab.kind === 'ramp') continue

        const pos = rustPosToThree(e.pos as { x: string; y: string; z: string })
        const rot = rustRotToThreeEuler(e.rot as { x: string; y: string; z: string })

        // Anchor offset: shift mesh center so Rust pos lands at center/bottom/top.
        if (prefab.anchor === 'bottom') {
            pos.y += prefab.size.y / 2
        } else if (prefab.anchor === 'top') {
            pos.y -= prefab.size.y / 2
        }
        // 'center' = no shift

        const boxKey = prefab.interactive ? String(i) : ''

        const skinId = Number(e.skinid)
        const grade = Number(e.grade)

        const se: SceneEntity = {
            index: i,
            boxKey,
            prefab,
            position: pos,
            rotation: rot,
            skinId: Number.isNaN(skinId) ? 0 : skinId,
            grade: Number.isNaN(grade) ? 0 : grade,
            interactive: prefab.interactive,
        }

        entities.push(se)

        if (prefab.interactive) {
            interactiveBoxes.push(se)
            boxes++
        } else if (prefab.kind === 'unknown') {
            unknown++
        } else {
            structures++
        }

        expandBounds(minV, maxV, pos, prefab.size.x, prefab.size.y, prefab.size.z)
    }

    if (entities.length === 0) {
        throw new Error('No recognised entities in this file.')
    }

    const bounds: SceneBounds = {
        min: minV,
        max: maxV,
        center: {
            x: (minV.x + maxV.x) / 2,
            y: (minV.y + maxV.y) / 2,
            z: (minV.z + maxV.z) / 2,
        },
        size: {
            x: maxV.x - minV.x,
            y: maxV.y - minV.y,
            z: maxV.z - minV.z,
        },
    }

    return {
        entities,
        interactiveBoxes,
        bounds,
        counts: { total: entities.length, structures, boxes, unknown },
    }
}
