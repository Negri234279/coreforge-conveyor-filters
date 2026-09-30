#!/usr/bin/env node
// Import the Rust item diff (produced by scripts/diff-rust-items.mjs) into the app:
//   1. Optimize each item PNG into the served sizes at
//      public/items/{medium,tiny}/<imagePath>.webp (same as
//      optimize-items.mjs), OVERWRITING in place — imagePath is deterministic
//      (== shortname), so re-runs refresh icons instead of piling up copies.
//   2. Merge each item's game JSON into src/data/items.json with only the fields
//      the app needs ({ id, itemId, shortname, name, category, imagePath }):
//        - existing shortname -> updated in place (id kept)
//        - new shortname      -> appended with the next sequential id
//
// Shortnames listed in scripts/item-excluded.json (DLC redirect-skins, world-only
// entities, etc.) are NOT real conveyor items: they are never added, and if they
// are already present in items.json they get removed (along with their icons), so
// re-running items:update never re-introduces them.
//
// The source PNG/JSON files (the diff output and the Steam bundles) are never
// modified; only public/items and src/data/items.json are written.
//
// Usage:
//   node scripts/optimize-diff-items.mjs [srcDir] [--items=<path>] [--out=<dir>] [--excluded=<path>] [--quality=85] [--dry-run]
//
// Defaults:
//   srcDir      tmp/rust-item-diff   (its new/ and changed/ subfolders are processed)
//   --items     src/data/items.json
//   --out       public/items
//   --excluded  scripts/item-excluded.json
//
// Examples:
//   node scripts/diff-rust-items.mjs && node scripts/optimize-diff-items.mjs
//   node scripts/optimize-diff-items.mjs --dry-run           # preview, write nothing
//   node scripts/optimize-diff-items.mjs tmp/rust-item-diff/new --quality=90

import { readdir, writeFile, mkdir, readFile, access, rm } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { argv, exit } from 'node:process'
import sharp from 'sharp'

// Square edge (px) per served size directory.
const SIZES = {
    medium: 80,
    tiny: 24,
}

function parseArgs(args) {
    const opts = {
        srcDir: 'tmp/rust-item-diff',
        itemsPath: 'src/data/items.json',
        outDir: 'public/items',
        excludedPath: 'scripts/item-excluded.json',
        quality: 85,
        dryRun: false,
    }

    let srcSeen = false

    for (const a of args) {
        if (a.startsWith('--quality=')) {
            opts.quality = Number(a.slice('--quality='.length))
        } else if (a.startsWith('--items=')) {
            opts.itemsPath = a.slice('--items='.length)
        } else if (a.startsWith('--out=')) {
            opts.outDir = a.slice('--out='.length)
        } else if (a.startsWith('--excluded=')) {
            opts.excludedPath = a.slice('--excluded='.length)
        } else if (a === '--dry-run') {
            opts.dryRun = true
        } else if (!a.startsWith('--') && !srcSeen) {
            opts.srcDir = a
            srcSeen = true
        } else {
            throw new Error(`Unknown argument: ${a}`)
        }
    }

    if (!Number.isFinite(opts.quality) || opts.quality < 1 || opts.quality > 100) {
        throw new Error('--quality must be between 1 and 100')
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

// Resize to a square of `edge`px on a transparent canvas (icons keep their
// aspect ratio; non-square sources are letterboxed rather than stretched).
async function toWebp(src, edge, quality) {
    return sharp(src)
        .resize(edge, edge, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality, effort: 6 })
        .toBuffer()
}

// Collect every `<base>.json` under srcDir. If it has new/ or changed/ subfolders
// (the diff layout) those are scanned; otherwise srcDir itself is treated as flat.
async function collectSources(srcDir) {
    const dirs = []

    for (const sub of ['new', 'changed']) {
        if (await exists(join(srcDir, sub))) {
            dirs.push(join(srcDir, sub))
        }
    }

    if (dirs.length === 0) dirs.push(srcDir)

    const items = []
    for (const dir of dirs) {
        const entries = await readdir(dir)

        for (const entry of entries) {
            const { name, ext } = parse(entry)

            if (ext.toLowerCase() !== '.json') continue
            if (name === 'summary') continue

            const pngPath = join(dir, `${name}.png`)

            items.push({
                base: name,
                jsonPath: join(dir, entry),
                pngPath: (await exists(pngPath)) ? pngPath : null,
            })
        }
    }
    return items
}

// Read the { notFilterable: [...] } exclusion list. Missing file = no exclusions.
async function loadExcluded(path) {
    if (!(await exists(path))) return new Set()
    const parsed = JSON.parse(await readFile(path, 'utf8'))
    return new Set(Array.isArray(parsed.notFilterable) ? parsed.notFilterable : [])
}

// Map a Rust game item JSON to the trimmed shape stored in items.json.
function toAppItem(gameItem, base) {
    return {
        itemId: gameItem.itemid,
        shortname: gameItem.shortname,
        name: gameItem.Name,
        category: gameItem.Category,
        imagePath: base,
    }
}

async function main() {
    const opts = parseArgs(argv.slice(2))
    const sizeNames = Object.keys(SIZES)

    if (!(await exists(opts.srcDir))) {
        throw new Error(
            `Source directory "${opts.srcDir}" not found. Run scripts/diff-rust-items.mjs first.`,
        )
    }

    const sources = await collectSources(opts.srcDir)
    if (sources.length === 0) {
        console.log(`No item .json files found under ${opts.srcDir}`)
        return
    }

    const excluded = await loadExcluded(opts.excludedPath)

    const parsed = JSON.parse(await readFile(opts.itemsPath, 'utf8'))
    if (!Array.isArray(parsed)) throw new Error(`${opts.itemsPath} is not a JSON array`)

    // Cleanup pass: drop any excluded shortname already in items.json (and its
    // icons), so the list stays authoritative regardless of what the source holds.
    const removedExcluded = []
    const existing = parsed.filter((it) => {
        if (excluded.has(it.shortname)) {
            removedExcluded.push(it)
            return false
        }
        return true
    })

    const byShortname = new Map(existing.map((it) => [it.shortname, it]))
    let maxId = existing.reduce((m, it) => Math.max(m, it.id ?? 0), 0)

    console.log(
        `Importing ${sources.length} item(s) from ${opts.srcDir}\n` +
            `  images   -> ${opts.outDir} (quality=${opts.quality})\n` +
            `  json     -> ${opts.itemsPath}${opts.dryRun ? '   (dry-run)' : ''}\n` +
            `  excluded -> ${excluded.size} shortname(s) from ${opts.excludedPath}\n`,
    )

    if (!opts.dryRun) {
        await Promise.all(sizeNames.map((n) => mkdir(join(opts.outDir, n), { recursive: true })))
    }

    // Purge every excluded shortname's icon from disk — driven by the exclusion
    // list against the filesystem, NOT by what happens to be in items.json — so a
    // lingering icon (e.g. left by an earlier import) is always removed too. Each
    // item's imagePath is also checked in case it differs from the shortname.
    let iconsRemoved = 0
    for (const shortname of excluded) {
        const removed = removedExcluded.find((it) => it.shortname === shortname)
        const bases = new Set([shortname])
        if (removed?.imagePath) bases.add(removed.imagePath)

        let iconFiles = 0
        for (const base of bases) {
            for (const n of sizeNames) {
                const p = join(opts.outDir, n, `${base}.webp`)
                if (!(await exists(p))) continue
                iconFiles++
                if (!opts.dryRun) await rm(p, { force: true })
            }
        }
        if (iconFiles > 0) iconsRemoved++

        if (removed || iconFiles > 0) {
            const parts = []
            if (removed) parts.push('json')
            if (iconFiles > 0) parts.push(`${iconFiles} icon`)
            console.log(
                `${opts.dryRun ? '[dry] ' : ''}remove  ${shortname.padEnd(36)} (excluded: ${parts.join(' + ')})`,
            )
        }
    }

    let added = 0
    let updated = 0
    let skipped = 0
    let imagesWritten = 0
    let missingPng = 0
    let failed = 0

    for (const { base, jsonPath, pngPath } of sources) {
        try {
            const gameItem = JSON.parse(await readFile(jsonPath, 'utf8'))
            const appItem = toAppItem(gameItem, base)

            if (excluded.has(appItem.shortname)) {
                skipped++
                console.log(
                    `${opts.dryRun ? '[dry] ' : ''}skip    ${appItem.shortname.padEnd(36)} (excluded)`,
                )
                continue
            }

            // --- images ---
            if (pngPath) {
                const buffers = await Promise.all(
                    sizeNames.map((n) => toWebp(pngPath, SIZES[n], opts.quality)),
                )
                if (!opts.dryRun) {
                    await Promise.all(
                        sizeNames.map((n, i) =>
                            writeFile(join(opts.outDir, n, `${appItem.imagePath}.webp`), buffers[i]),
                        ),
                    )
                }
                imagesWritten++
            } else {
                missingPng++
            }

            // --- json merge ---
            const prev = byShortname.get(appItem.shortname)
            let action

            if (prev) {
                prev.itemId = appItem.itemId
                prev.name = appItem.name
                prev.category = appItem.category
                prev.imagePath = appItem.imagePath
                updated++
                action = 'update'
            } else {
                const entry = { id: ++maxId, ...appItem }
                existing.push(entry)
                byShortname.set(entry.shortname, entry)
                added++
                action = 'add   '
            }

            const noImg = pngPath ? '' : '  (no png)'

            console.log(
                `${opts.dryRun ? '[dry] ' : ''}${action}  ${appItem.shortname.padEnd(36)} ` +
                    `${appItem.category}${noImg}`,
            )
        } catch (err) {
            console.error(`✗ ${base}: ${err.message}`)
            failed++
        }
    }

    if (!opts.dryRun) {
        await writeFile(opts.itemsPath, JSON.stringify(existing, null, 4) + '\n')
    }

    console.log(
        `\nDone. ${added} added, ${updated} updated ` +
            `(items.json now ${existing.length} items) · ` +
            `${imagesWritten} icon set(s) × ${sizeNames.length} sizes` +
            (skipped ? ` · ${skipped} excluded (skipped)` : '') +
            (removedExcluded.length ? ` · ${removedExcluded.length} excluded (json removed)` : '') +
            (iconsRemoved ? ` · ${iconsRemoved} excluded (icons purged)` : '') +
            (missingPng ? ` · ${missingPng} without png` : '') +
            (failed ? ` · ${failed} failed` : ''),
    )
    
    if (opts.dryRun) console.log('Dry-run: nothing was written.')

    if (failed > 0) exit(1)
}

main().catch((err) => {
    console.error(err.message)
    exit(1)
})
