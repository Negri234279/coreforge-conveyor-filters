import type { RawVec3, Vec3 } from '../../types'

const TWO_PI = Math.PI * 2

/** Collapse any [0, 2π] noise value into the canonical [-π, π] range. */
export function normalizeAngle(a: number): number {
    let n = a % TWO_PI
    if (n > Math.PI) n -= TWO_PI
    if (n < -Math.PI) n += TWO_PI
    return n
}

/**
 * Convert a Rust/Unity left-handed position to Three.js right-handed space.
 * The only change is Z negation.
 */
export function rustPosToThree(p: RawVec3): Vec3 {
    const x = Number(p.x)
    const y = Number(p.y)
    const z = Number(p.z)
    return {
        x: Number.isNaN(x) ? 0 : x,
        y: Number.isNaN(y) ? 0 : y,
        z: Number.isNaN(z) ? 0 : -z,
    }
}

/**
 * Convert a Rust/Unity Euler rotation to Three.js space.
 *
 * Mirroring Z for position (z → -z) means the rotation quaternion is mirrored
 * too: (qx,qy,qz,qw) → (-qx,-qy,qz,qw). For the pure-yaw data this collapses to
 * a Three.js Ry(-θ). Verified against the real export: with the wall slab built
 * thin along its local X, Ry(-rot.y) makes every clean-edge wall's face normal
 * line up with the foundation edge it sits on (20/20).
 *
 * The returned {x,y,z} values are intended to be applied with order 'YXZ'.
 */
export function rustRotToThreeEuler(r: RawVec3): Vec3 {
    const rx = Number(r.x)
    const ry = Number(r.y)
    const rz = Number(r.z)
    const rxN = normalizeAngle(Number.isNaN(rx) ? 0 : rx)
    const ryN = normalizeAngle(Number.isNaN(ry) ? 0 : ry)
    const rzN = normalizeAngle(Number.isNaN(rz) ? 0 : rz)
    return { x: -rxN, y: -ryN, z: rzN }
}
