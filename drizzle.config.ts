// Used by `drizzle-kit` for SQL migration generation if/when we move away from
// the idempotent schema.sql bootstrap. Runtime schema application lives in
// src/db/client.ts — drizzle-kit is not required to run the app.

import { defineConfig } from 'drizzle-kit'
import { resolve } from 'node:path'

const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), 'src/data')
const DB_FILE = process.env.NODE_ENV === 'production' ? 'coreforge.prod.db' : 'coreforge.dev.db'

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dialect: 'sqlite',
    dbCredentials: {
        url: resolve(DATA_DIR, DB_FILE),
    },
})
