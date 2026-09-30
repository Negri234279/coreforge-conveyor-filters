#!/usr/bin/env node
// Verify that every item in src/data/items.json has its icon on disk for each
// served size, and (optionally) flag images on disk that no item references.
//
// The app serves two sizes — medium (itemImage()) and tiny (admin table) — so
// each item needs BOTH public/items/medium/<imagePath>.webp and
// public/items/tiny/<imagePath>.webp. A missing file = a broken icon in the UI.
//
// Shortnames in scripts/item-excluded.json (DLC redirect-skins, world-only
// entities) are skipped — they are not filter items, so a missing icon for them
// is expected, not an error. If one is still present in items.json a warning is
// shown (run `npm run items:import` to prune it).
//
// Exit code is 1 when any required image is missing (CI-friendly). Orphan images
// are reported but do NOT fail the run unless --strict is passed.
//
// Usage:
//   node scripts/verify-item-images.mjs [--items=<path>] [--dir=<dir>] [--excluded=<path>] [--strict]
//
// Defaults:
//   --items     src/data/items.json
//   --dir       public/items
//   --excluded  scripts/item-excluded.json
//
// Examples:
//   node scripts/verify-item-images.mjs
//   npm run items:verify
//   node scripts/verify-item-images.mjs --strict        # also fail on orphans

import { readdir, readFile, access } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { argv, exit } from 'node:process'

// The sizes the web actually serves — an item must have all of these.
const REQUIRED_SIZES = ['medium', 'tiny']

function parseArgs(args) {
    const opts = {
        itemsPath: 'src/data/items.json',
        dir: 'public/items',
        excludedPath: 'scripts/item-excluded.json',
        strict: false,
    }

    const flags = {
        '--items=': (v) => (opts.itemsPath = v),
        '--dir=': (v) => (opts.dir = v),
        '--excluded=': (v) => (opts.excludedPath = v),
    }

    for (const a of args) {
        if (a === '--strict') {
            opts.strict = true
            continue
        }

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

// Read the { notFilterable: [...] } exclusion list. Missing file = no exclusions.
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

    const indexes = Object.fromEntries(
        await Promise.all(
            REQUIRED_SIZES.map(async (size) => [size, await readSizeIndex(opts.dir, size)]),
        ),
    )

    console.log(
        `Verifying ${items.length} item(s) against ${opts.dir}/{${REQUIRED_SIZES.join(',')}}\n`,
    )

    const missing = [] // { shortname, imagePath, sizes: [...] }
    const noKey = [] // items with neither imagePath nor shortname — unresolvable
    const fellBack = [] // items with no imagePath that resolve via shortname (info only)
    const excludedPresent = [] // excluded shortnames still in items.json (should be pruned)
    const referenced = new Set() // effective paths that at least one item uses

    for (const item of items) {
        // Excluded shortnames are not filter items — a missing icon is expected.
        if (excluded.has(item.shortname)) {
            excludedPresent.push(item.shortname)
            continue
        }

        // Mirror itemImage(): imagePath first, else fall back to shortname.
        const effectivePath = item.imagePath ?? item.shortname
        if (!effectivePath) {
            noKey.push(`id:${item.id}`)
            continue
        }
        if (!item.imagePath) fellBack.push(item.shortname)

        referenced.add(effectivePath)

        const missingSizes = REQUIRED_SIZES.filter((size) => !indexes[size].has(effectivePath))
        if (missingSizes.length > 0) {
            missing.push({
                shortname: item.shortname ?? `id:${item.id}`,
                imagePath: effectivePath,
                sizes: missingSizes,
            })
        }
    }

    // Orphans: an image file present in EVERY size but referenced by no item.
    const allImages = new Set()
    for (const size of REQUIRED_SIZES) {
        for (const name of indexes[size]) allImages.add(name)
    }
    const orphans = [...allImages]
        .filter((name) => !referenced.has(name) && !excluded.has(name))
        .sort()

    // --- report ---
    if (excludedPresent.length > 0) {
        console.log(
            `⚠ ${excludedPresent.length} excluded item(s) still in items.json ` +
                `(run \`npm run items:import\` to prune): ${excludedPresent.join(', ')}\n`,
        )
    }

    if (noKey.length > 0) {
        console.log(`✗ ${noKey.length} item(s) with neither imagePath nor shortname:`)
        for (const s of noKey) console.log(`    ${s}`)
        console.log('')
    }

    if (missing.length > 0) {
        console.log(`✗ ${missing.length} item(s) missing image files:`)
        for (const m of missing.sort((a, b) => a.shortname.localeCompare(b.shortname))) {
            console.log(
                `    ${m.shortname.padEnd(40)} img="${m.imagePath}"  falta: ${m.sizes.join(', ')}`,
            )
        }
        console.log('')
    }

    if (fellBack.length > 0) {
        console.log(
            `ℹ ${fellBack.length} item(s) without imagePath resolve via shortname (OK, app falls back)\n`,
        )
    }

    if (orphans.length > 0) {
        console.log(`⚠ ${orphans.length} image(s) on disk not referenced by any item:`)
        for (const o of orphans.slice(0, 30)) console.log(`    ${o}`)
        if (orphans.length > 30) console.log(`    … and ${orphans.length - 30} more`)
        console.log('')
    }

    const ok = missing.length === 0 && noKey.length === 0
    const summary =
        `${items.length} items · ${missing.length} missing images · ` +
        `${orphans.length} orphan images · ${fellBack.length} shortname-fallback`

    if (ok && orphans.length === 0) {
        console.log(`✓ All good — ${summary}`)
        return
    }

    console.log(ok ? `✓ Images OK — ${summary}` : `✗ Problems found — ${summary}`)

    if (!ok || (opts.strict && orphans.length > 0)) exit(1)
}

main().catch((err) => {
    console.error(err.message)
    exit(1)
})
