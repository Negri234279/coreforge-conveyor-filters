// argon2id (the OWASP-recommended hash for new code). @node-rs/argon2 ships
// prebuilt binaries for all platforms we care about, so the Docker build
// doesn't need python/g++.

import { hash, verify } from '@node-rs/argon2'

// Reasonable defaults — leaves headroom on a small VPS, well above OWASP minima.
// (Argon2id is @node-rs/argon2's default algorithm, so we don't need to pass it.)
const OPTS = {
    memoryCost: 19 * 1024, // 19 MiB
    timeCost: 2,
    parallelism: 1,
}

export function hashPassword(password: string): Promise<string> {
    return hash(password, OPTS)
}

export async function verifyPassword(stored: string, candidate: string): Promise<boolean> {
    try {
        return await verify(stored, candidate)
    } catch {
        return false
    }
}
