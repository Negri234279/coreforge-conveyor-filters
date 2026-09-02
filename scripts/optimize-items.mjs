#!/usr/bin/env node
// Generate the four item icon sizes (WebP) that the app serves from
// public/items/{full,medium,small,tiny}/<name>.webp.
//
// Reads each source PNG/JPG/WebP from public/items-raw (expected 512x512) and
// writes the four sizes into public/items/<size>/<name>.webp. NON-DESTRUCTIVE:
// if a name is already taken it writes a copy ("<name> - copia.webp", then
// " - copia (2)", …) instead of overwriting, using the same chosen name across
// all four size dirs. The source files are left untouched.
//
// Sizes (square): full 512, medium 80, small 48, tiny 24. Resolve them in the
// app via itemImage() (uses /items/medium/...) — never hardcode a size path.
//
// Usage:
//   node scripts/optimize-items.mjs [srcDir] [--out=<dir>] [--quality=85] [--dry-run]
//   npm run optimize:items
//
// Examples:
//   npm run optimize:items                                  # public/items-raw → public/items
//   node scripts/optimize-items.mjs --dry-run               # preview, write nothing
//   node scripts/optimize-items.mjs public/items-raw --quality=90

import { readdir, stat, writeFile, mkdir, readFile } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { argv, exit } from 'node:process'
import sharp from 'sharp'

const SOURCE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

// Square edge (px) per served size directory. `full` is the source resolution.
const SIZES = {
    full: 512,
    medium: 80,
    small: 48,
    tiny: 24,
}

function parseArgs(args) {
    const opts = {
        srcDir: 'public/items-raw',
        outDir: 'public/items',
        quality: 85,
        dryRun: false,
    }

    let srcSeen = false
    
    for (const a of args) {
        if (a.startsWith('--quality=')) {
            opts.quality = Number(a.slice('--quality='.length))
        } else if (a.startsWith('--out=')) {
            opts.outDir = a.slice('--out='.length)
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

function fmt(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`

    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// Decide the base name to write under, using the `full` slot as the identity
// key (WebP encoding is deterministic, so the same source produces the same
// bytes). A name is reusable when its `full` slot is EITHER empty OR already
// holds byte-identical output — that keeps re-runs idempotent (they overwrite
// in place instead of piling up copies). Only a name owned by a DIFFERENT image
// is diverted to a Windows-style " - copia" (then " - copia (2)", …).
async function resolveName(outDir, name, fullBuf) {
    const reusable = async (candidate) => {
        try {
            const existing = await readFile(join(outDir, 'full', `${candidate}.webp`))
            return existing.equals(fullBuf)
        } catch {
            return true // missing = free to use
        }
    }

    if (await reusable(name)) return name

    let candidate = `${name} - copia`
    let n = 2
    while (!(await reusable(candidate))) {
        candidate = `${name} - copia (${n})`
        n++
    }

    return candidate
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

async function main() {
    const opts = parseArgs(argv.slice(2))
    const sizeNames = Object.keys(SIZES)

    let entries
    try {
        entries = await readdir(opts.srcDir)
    } catch (err) {
        throw new Error(`Could not read source directory "${opts.srcDir}": ${err.message}`)
    }

    const sources = entries.filter((f) => SOURCE_EXTS.has(parse(f).ext.toLowerCase()))
    if (sources.length === 0) {
        console.log(`No source images (${[...SOURCE_EXTS].join(', ')}) found in ${opts.srcDir}`)
        return
    }

    const sizeList = sizeNames.map((n) => `${n} ${SIZES[n]}px`).join(', ')
    console.log(
        `Generating ${sources.length} item(s) × ${sizeNames.length} sizes ` +
            `(${sizeList}): ${opts.srcDir} → ${opts.outDir}` +
            ` (quality=${opts.quality}${opts.dryRun ? ', dryRun' : ''})\n`,
    )

    if (!opts.dryRun) {
        await Promise.all(
            sizeNames.map((n) => mkdir(join(opts.outDir, n), { recursive: true })),
        )
    }

    let totalNew = 0
    let written = 0
    let failed = 0

    for (const file of sources) {
        const src = join(opts.srcDir, file)
        const name = parse(file).name

        try {
            const srcStat = await stat(src)
            const buffers = await Promise.all(
                sizeNames.map((n) => toWebp(src, SIZES[n], opts.quality)),
            )

            const outName = await resolveName(
                opts.outDir,
                name,
                buffers[sizeNames.indexOf('full')],
            )

            if (!opts.dryRun) {
                await Promise.all(
                    sizeNames.map((n, i) =>
                        writeFile(join(opts.outDir, n, `${outName}.webp`), buffers[i]),
                    ),
                )
            }

            const outSize = buffers.reduce((sum, b) => sum + b.length, 0)
            totalNew += outSize
            written++

            const renamed = outName !== name ? `  → "${outName}"` : ''
            const perSize = sizeNames
                .map((n, i) => `${n} ${fmt(buffers[i].length)}`)
                .join('  ')
            console.log(
                `${opts.dryRun ? '[dry] ' : ''}${file.padEnd(32)} ` +
                    `src ${fmt(srcStat.size).padStart(9)}  →  ${perSize}${renamed}`,
            )
        } catch (err) {
            console.error(`✗ ${file}: ${err.message}`)
            failed++
        }
    }

    console.log(
        `\nDone. ${written}/${sources.length} item(s) written across ${sizeNames.length} sizes ` +
            `(${fmt(totalNew)} total)` +
            (failed ? ` · ${failed} failed` : '') +
            `\nSources left untouched in ${opts.srcDir}.`,
    )

    if (failed > 0) exit(1)
}

main().catch((err) => {
    console.error(err.message)
    exit(1)
})
