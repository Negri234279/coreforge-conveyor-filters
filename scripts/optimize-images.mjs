#!/usr/bin/env node
// Convert source images (PNG/JPG/WebP) to optimized WebP using sharp.
//
// Reads from a source directory and writes the optimized .webp into an output
// directory (defaults to <src>/../<name without "-raw">, e.g. boxes-raw → boxes).
// NOTHING is ever deleted — originals in the source dir are left untouched.
//
// Usage:
//   node scripts/optimize-images.mjs <srcDir> [--out=<dir>] [--quality=80] [--dry-run]
//
// Examples:
//   npm run optimize:boxes                                  # public/boxes-raw → public/boxes
//   node scripts/optimize-images.mjs public/boxes-raw --out=public/boxes
//   node scripts/optimize-images.mjs public/items-raw --out=public/items --quality=85
//   node scripts/optimize-images.mjs public/boxes-raw --dry-run

import { readdir, stat, writeFile, mkdir } from 'node:fs/promises'
import { join, parse, dirname, basename } from 'node:path'
import { argv, exit } from 'node:process'
import sharp from 'sharp'

const SOURCE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

/** boxes-raw → boxes ; items_raw → items ; foo → foo */
function defaultOutDir(srcDir) {
    const name = basename(srcDir).replace(/[-_]?raw$/i, '')
    return join(dirname(srcDir), name || basename(srcDir))
}

function parseArgs(args) {
    const opts = { srcDir: null, outDir: null, quality: 80, dryRun: false }
    for (const a of args) {
        if (a.startsWith('--quality=')) {
            opts.quality = Number(a.slice('--quality='.length))
        } else if (a.startsWith('--out=')) {
            opts.outDir = a.slice('--out='.length)
        } else if (a === '--dry-run') {
            opts.dryRun = true
        } else if (!a.startsWith('--') && !opts.srcDir) {
            opts.srcDir = a
        } else {
            throw new Error(`Unknown argument: ${a}`)
        }
    }
    if (!opts.srcDir) {
        throw new Error(
            'Usage: optimize-images.mjs <srcDir> [--out=<dir>] [--quality=N] [--dry-run]',
        )
    }
    if (!opts.outDir) opts.outDir = defaultOutDir(opts.srcDir)
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

async function main() {
    const opts = parseArgs(argv.slice(2))

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

    console.log(
        `Optimizing ${sources.length} image(s): ${opts.srcDir} → ${opts.outDir}` +
            ` (quality=${opts.quality}${opts.dryRun ? ', dryRun' : ''})\n`,
    )

    if (!opts.dryRun) await mkdir(opts.outDir, { recursive: true })

    let totalOld = 0
    let totalNew = 0
    let failed = 0

    for (const file of sources) {
        const src = join(opts.srcDir, file)
        const dst = join(opts.outDir, parse(file).name + '.webp')
        try {
            const srcStat = await stat(src)
            const buf = await sharp(src).webp({ quality: opts.quality, effort: 6 }).toBuffer()

            totalOld += srcStat.size
            totalNew += buf.length
            const saved = srcStat.size - buf.length
            const pct = ((saved / srcStat.size) * 100).toFixed(1)

            if (!opts.dryRun) await writeFile(dst, buf)

            console.log(
                `${opts.dryRun ? '[dry] ' : ''}${file.padEnd(40)} ` +
                    `${fmt(srcStat.size).padStart(9)} → ${fmt(buf.length).padStart(9)}  ` +
                    `(-${pct}%)`,
            )
        } catch (err) {
            console.error(`✗ ${file}: ${err.message}`)
            failed++
        }
    }

    const totalPct = totalOld ? (((totalOld - totalNew) / totalOld) * 100).toFixed(1) : '0.0'

    console.log(
        `\nDone. ${sources.length - failed}/${sources.length} optimized. ` +
            `${fmt(totalOld)} → ${fmt(totalNew)} (-${totalPct}%)` +
            (failed ? ` · ${failed} failed` : '') +
            `\nSources left untouched in ${opts.srcDir}.`,
    )

    if (failed > 0) exit(1)
}

main().catch((err) => {
    console.error(err.message)
    exit(1)
})
