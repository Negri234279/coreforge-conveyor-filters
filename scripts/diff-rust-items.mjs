#!/usr/bin/env node
// Compare the Rust "items" bundle between the Staging and the live client and
// copy every item that is new or changed (its .json AND its .png) into an
// output folder that is NOT tracked by git.
//
// "Item" = the base name shared by a `<name>.json` + `<name>.png` pair. An item
// is reported when:
//   - new     : the .json exists in Staging but not in the live client
//   - changed : the .json exists in both but its (normalized) content differs
// Items present only in the live client are reported as "removed" but nothing is
// copied for them (there is no Staging source to copy).
//
// Nothing is ever deleted or modified in the source folders — the script only
// reads them and writes copies into the output dir.
//
// Usage:
//   node scripts/diff-rust-items.mjs [--staging=<dir>] [--live=<dir>] [--out=<dir>] [--dry-run]
//
// Defaults (Windows Steam paths):
//   --staging "C:\Program Files (x86)\Steam\steamapps\common\RustStaging\Bundles\items"
//   --live    "C:\Program Files (x86)\Steam\steamapps\common\Rust\Bundles\items"
//   --out     <repo>/tmp/rust-item-diff

import { readdir, readFile, writeFile, mkdir, copyFile, rm, access } from 'node:fs/promises'
import { join, resolve, parse } from 'node:path'
import { argv, exit, cwd } from 'node:process'

const DEFAULT_STAGING =
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\RustStaging\\Bundles\\items'
const DEFAULT_LIVE = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Rust\\Bundles\\items'
const DEFAULT_OUT = join(cwd(), 'tmp', 'rust-item-diff')

function parseArgs(args) {
    const opts = {
        staging: DEFAULT_STAGING,
        live: DEFAULT_LIVE,
        out: DEFAULT_OUT,
        dryRun: false,
    }

    const flags = {
        '--staging=': (v) => (opts.staging = v),
        '--live=': (v) => (opts.live = v),
        '--out=': (v) => (opts.out = v),
    }

    for (const a of args) {
        if (a === '--dry-run') {
            opts.dryRun = true
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

/** Map of base name → true for every `<base>.json` in a directory. */
async function readJsonIndex(dir) {
    const entries = await readdir(dir)
    const index = new Set()
    for (const entry of entries) {
        const { name, ext } = parse(entry)
        if (ext.toLowerCase() === '.json') index.add(name)
    }
    return index
}

/** Stable string form of a JSON file so key order / whitespace never counts as a diff. */
function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort()
        return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
    }
    return JSON.stringify(value)
}

async function normalizedJson(path) {
    const raw = await readFile(path, 'utf8')
    try {
        return stableStringify(JSON.parse(raw))
    } catch {
        // Not valid JSON — fall back to the raw text so we still detect a change.
        return raw
    }
}

/** Copy `<base>.json` and (if present) `<base>.png` from srcDir into destDir. */
async function copyItem(base, srcDir, destDir, dryRun) {
    const copied = []
    for (const ext of ['.json', '.png']) {
        const src = join(srcDir, `${base}${ext}`)
        if (!(await exists(src))) continue
        if (!dryRun) await copyFile(src, join(destDir, `${base}${ext}`))
        copied.push(`${base}${ext}`)
    }
    return copied
}

async function main() {
    const opts = parseArgs(argv.slice(2))

    for (const [label, dir] of [
        ['staging', opts.staging],
        ['live', opts.live],
    ]) {
        if (!(await exists(dir))) {
            console.error(`The ${label} folder does not exist:\n  ${dir}`)
            exit(1)
        }
    }

    console.log('Comparing Rust item bundles')
    console.log(`  staging : ${opts.staging}`)
    console.log(`  live    : ${opts.live}`)
    console.log(`  out     : ${opts.out}${opts.dryRun ? '  (dry-run)' : ''}\n`)

    const [stagingIndex, liveIndex] = await Promise.all([
        readJsonIndex(opts.staging),
        readJsonIndex(opts.live),
    ])

    const newItems = []
    const changedItems = []
    const removedItems = []

    for (const base of stagingIndex) {
        if (!liveIndex.has(base)) {
            newItems.push(base)
            continue
        }
        const [stagingJson, liveJson] = await Promise.all([
            normalizedJson(join(opts.staging, `${base}.json`)),
            normalizedJson(join(opts.live, `${base}.json`)),
        ])
        if (stagingJson !== liveJson) changedItems.push(base)
    }

    for (const base of liveIndex) {
        if (!stagingIndex.has(base)) removedItems.push(base)
    }

    newItems.sort()
    changedItems.sort()
    removedItems.sort()

    // Fresh output dirs so stale results never linger between runs.
    const newDir = join(opts.out, 'new')
    const changedDir = join(opts.out, 'changed')
    if (!opts.dryRun) {
        await rm(opts.out, { recursive: true, force: true })
        await Promise.all([
            mkdir(newDir, { recursive: true }),
            mkdir(changedDir, { recursive: true }),
        ])
    }

    for (const base of newItems) await copyItem(base, opts.staging, newDir, opts.dryRun)
    for (const base of changedItems) await copyItem(base, opts.staging, changedDir, opts.dryRun)

    const summary = {
        generatedAt: new Date().toISOString(),
        staging: opts.staging,
        live: opts.live,
        counts: {
            stagingItems: stagingIndex.size,
            liveItems: liveIndex.size,
            new: newItems.length,
            changed: changedItems.length,
            removed: removedItems.length,
        },
        new: newItems,
        changed: changedItems,
        removed: removedItems,
    }

    if (!opts.dryRun) {
        await writeFile(join(opts.out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
    }

    console.log(`staging items : ${stagingIndex.size}`)
    console.log(`live items    : ${liveIndex.size}`)
    console.log(`new           : ${newItems.length}  -> ${resolve(newDir)}`)
    console.log(`changed       : ${changedItems.length}  -> ${resolve(changedDir)}`)
    console.log(`removed       : ${removedItems.length}  (not copied — no staging source)`)
    if (!opts.dryRun) console.log(`\nsummary.json  : ${resolve(join(opts.out, 'summary.json'))}`)
}

try {
    await main()
} catch (err) {
    console.error('Failed to diff Rust items:', err instanceof Error ? err.message : err)
    exit(1)
}
