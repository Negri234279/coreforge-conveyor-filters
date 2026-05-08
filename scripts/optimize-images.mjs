#!/usr/bin/env node
// Convert PNG images in a directory to WebP using sharp.
//
// Usage:
//   node scripts/optimize-images.mjs <dir> [--quality=80] [--keep] [--dry-run]
//
// Defaults:
//   - quality 80, effort 6 (sharp's slowest/best compression).
//   - originals are deleted after a successful write; pass --keep to preserve them.
//   - --dry-run reports the savings without writing or deleting anything.
//
// Examples:
//   npm run optimize:boxes
//   node scripts/optimize-images.mjs public/items --quality=85
//   node scripts/optimize-images.mjs public/boxes --keep --dry-run

import { readdir, stat, writeFile, unlink } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { argv, exit } from 'node:process'
import sharp from 'sharp'

function parseArgs(args) {
    const opts = {
        dir: null,
        quality: 80,
        keep: false,
        dryRun: false,
    }
    for (const a of args) {
        if (a.startsWith('--quality=')) {
            opts.quality = Number(a.slice('--quality='.length))
        } else if (a === '--keep') {
            opts.keep = true
        } else if (a === '--dry-run') {
            opts.dryRun = true
        } else if (!a.startsWith('--') && !opts.dir) {
            opts.dir = a
        } else {
            throw new Error(`Unknown argument: ${a}`)
        }
    }
    if (!opts.dir) {
        throw new Error('Usage: optimize-images.mjs <dir> [--quality=N] [--keep] [--dry-run]')
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

async function main() {
    const opts = parseArgs(argv.slice(2))

    let entries
    try {
        entries = await readdir(opts.dir)
    } catch (err) {
        throw new Error(`Could not read directory "${opts.dir}": ${err.message}`)
    }

    const pngs = entries.filter((f) => f.toLowerCase().endsWith('.png'))
    if (pngs.length === 0) {
        console.log(`No .png files found in ${opts.dir}`)
        return
    }

    console.log(
        `Converting ${pngs.length} PNG → WebP in ${opts.dir}` +
            ` (quality=${opts.quality}, keep=${opts.keep}, dryRun=${opts.dryRun})\n`,
    )

    let totalOld = 0
    let totalNew = 0
    let failed = 0

    for (const file of pngs) {
        const src = join(opts.dir, file)
        const dst = join(opts.dir, parse(file).name + '.webp')
        try {
            const srcStat = await stat(src)
            const buf = await sharp(src).webp({ quality: opts.quality, effort: 6 }).toBuffer()

            totalOld += srcStat.size
            totalNew += buf.length
            const saved = srcStat.size - buf.length
            const pct = ((saved / srcStat.size) * 100).toFixed(1)

            if (!opts.dryRun) {
                await writeFile(dst, buf)
                if (!opts.keep) await unlink(src)
            }

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
        `\nDone. ${pngs.length - failed}/${pngs.length} converted. ` +
            `${fmt(totalOld)} → ${fmt(totalNew)} (-${totalPct}%)` +
            (failed ? ` · ${failed} failed` : ''),
    )

    if (failed > 0) exit(1)
}

main().catch((err) => {
    console.error(err.message)
    exit(1)
})
