#!/usr/bin/env node
// Gather the game JSON (+ PNG) for every ORPHAN item icon — an image that lives
// in public/items but is referenced by no entry in src/data/items.json — so they
// can be recovered into items.json.
//
// For each orphan image base name it looks up "<name>.json" in the Rust bundle
// (Staging first, then the live client) and copies the matching .json + .png into
// an output folder. It writes NOTHING to items.json itself — that second step is
// the already-proven importer:
//
//   node scripts/recover-orphan-items.mjs      # gather -> tmp/orphan-items
//   node scripts/optimize-diff-items.mjs tmp/orphan-items --dry-run   # preview
//   node scripts/optimize-diff-items.mjs tmp/orphan-items             # add for real
//
// Orphans whose shortname is in scripts/item-excluded.json are skipped (they are
// meant to have no item). Orphans with NO json in either bundle are reported as
// "unresolved" — those are stale images (candidates for deletion), not items.
//
// Usage:
//   node scripts/recover-orphan-items.mjs [--items=<path>] [--dir=<dir>] [--staging=<dir>] [--live=<dir>] [--excluded=<path>] [--out=<dir>]

import { readdir, readFile, access, mkdir, copyFile, rm } from 'node:fs/promises'
import { join, parse, resolve } from 'node:path'
import { argv, exit } from 'node:process'

const REQUIRED_SIZES = ['medium', 'tiny']
const DEFAULT_STAGING =
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\RustStaging\\Bundles\\items'
const DEFAULT_LIVE = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Rust\\Bundles\\items'

function parseArgs(args) {
    const opts = {
        itemsPath: 'src/data/items.json',
        dir: 'public/items',
        staging: DEFAULT_STAGING,
        live: DEFAULT_LIVE,
        excludedPath: 'scripts/item-excluded.json',
        out: 'tmp/orphan-items',
    }

    const flags = {
        '--items=': (v) => (opts.itemsPath = v),
        '--dir=': (v) => (opts.dir = v),
        '--staging=': (v) => (opts.staging = v),
        '--live=': (v) => (opts.live = v),
        '--excluded=': (v) => (opts.excludedPath = v),
        '--out=': (v) => (opts.out = v),
    }

    for (const a of args) {
        const key = Object.keys(flags).find((f) => a.startsWith(f))
        if (key) {
            flags[key](a.slice(key.length))
            continue
        }

        console.error(`Unknown argument: ${a}`)
        exit(1)
    }

    return opts
}

async function exists(path) {
    try {
        await access(path)

        return true
    } catch {
        return false
    }
}

async function loadExcluded(path) {
    if (!(await exists(path))) return new Set()
    const parsed = JSON.parse(await readFile(path, 'utf8'))
    return new Set(Array.isArray(parsed.notFilterable) ? parsed.notFilterable : [])
}

/** Set of image base names (no extension) present in <dir>/<size>. */
async function readSizeIndex(dir, size) {
    try {
        const entries = await readdir(join(dir, size))

        return new Set(
            entries
                .filter((e) => parse(e).ext.toLowerCase() === '.webp')
                .map((e) => parse(e).name),
        )
    } catch {
        return new Set()
    }
}

async function main() {
    const opts = parseArgs(argv.slice(2))

    const [itemsRaw, excluded] = await Promise.all([
        readFile(opts.itemsPath, 'utf8'),
        loadExcluded(opts.excludedPath),
    ])
    const items = JSON.parse(itemsRaw)
    if (!Array.isArray(items)) throw new Error(`${opts.itemsPath} is not a JSON array`)

    // Everything items.json currently points at (imagePath, else shortname).
    const referenced = new Set()
    for (const it of items) {
        const effectivePath = it.imagePath ?? it.shortname
        if (effectivePath) referenced.add(effectivePath)
    }

    const indexes = await Promise.all(REQUIRED_SIZES.map((s) => readSizeIndex(opts.dir, s)))
    const allImages = new Set()
    for (const idx of indexes) for (const name of idx) allImages.add(name)

    const orphans = [...allImages]
        .filter((name) => !referenced.has(name) && !excluded.has(name))
        .sort()

    console.log(`Found ${orphans.length} orphan image(s) in ${opts.dir}\n`)
    if (orphans.length === 0) return

    // Fresh output dir so the gather is repeatable.
    await rm(opts.out, { recursive: true, force: true })
    await mkdir(opts.out, { recursive: true })

    const resolved = []
    const unresolved = []

    for (const name of orphans) {
        const jsonName = `${name}.json`
        const pngName = `${name}.png`

        // Staging wins over live when both have it.
        let srcDir = null
        for (const dir of [opts.staging, opts.live]) {
            if (await exists(join(dir, jsonName))) {
                srcDir = dir
                break
            }
        }

        if (!srcDir) {
            unresolved.push(name)
            continue
        }

        await copyFile(join(srcDir, jsonName), join(opts.out, jsonName))
        if (await exists(join(srcDir, pngName))) {
            await copyFile(join(srcDir, pngName), join(opts.out, pngName))
        }
        resolved.push(name)
    }

    console.log(`✓ ${resolved.length} orphan(s) resolved from bundle -> ${resolve(opts.out)}`)
    for (const n of resolved) console.log(`    ${n}`)

    if (unresolved.length > 0) {
        console.log(
            `\n⚠ ${unresolved.length} orphan(s) with NO json in either bundle ` +
                `(stale images — consider deleting, not adding):`,
        )
        for (const n of unresolved) console.log(`    ${n}`)
    }

    console.log(
        `\nNext — review then add to items.json with the importer:\n` +
            `    node scripts/optimize-diff-items.mjs ${opts.out} --dry-run\n` +
            `    node scripts/optimize-diff-items.mjs ${opts.out}`,
    )
}

main().catch((err) => {
    console.error(err.message)
    exit(1)
})
