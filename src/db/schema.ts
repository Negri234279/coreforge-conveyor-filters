// Drizzle schema. Mirrors src/db/schema.sql, which is what actually applies
// at runtime (idempotent CREATE TABLE IF NOT EXISTS). When you add new columns
// or tables, update both files.

import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
    'users',
    {
        id: text('id').primaryKey(),
        username: text('username').notNull(),
        usernameLower: text('username_lower').notNull(),
        email: text('email'),
        passwordHash: text('password_hash'),
        googleId: text('google_id'),
        avatarUrl: text('avatar_url'),
        orgId: text('org_id'),
        orgRole: text('org_role'), // 'owner' | 'admin' | 'member' | null
        // App-wide super-admin (dashboard access). Independent from org_role.
        isAdmin: integer('is_admin').notNull().default(0),
        // Updated by middleware (throttled to ~60s) on authenticated requests.
        lastSeenAt: integer('last_seen_at'),
        createdAt: integer('created_at').notNull(),
    },
    (t) => [
        uniqueIndex('users_username_lower_uq').on(t.usernameLower),
        uniqueIndex('users_google_id_uq').on(t.googleId),
    ],
)

export const sessions = sqliteTable('sessions', {
    // sha256(token) — the raw token only lives in the user's cookie.
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
})

export const organizations = sqliteTable(
    'organizations',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        inviteCode: text('invite_code').notNull(),
        ownerId: text('owner_id').notNull(),
        createdAt: integer('created_at').notNull(),
    },
    (t) => [
        uniqueIndex('organizations_invite_code_uq').on(t.inviteCode),
        // Case-insensitive unique clan name. Defined as an expression index in
        // schema.sql (lower(name)); drizzle-kit can't express that here, so this
        // is a plain placeholder for documentation/typing only.
        uniqueIndex('organizations_name_lower_uq').on(t.name),
    ],
)

export const openCores = sqliteTable('open_cores', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    sharedWithOrg: integer('shared_with_org').notNull().default(0),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull().default(0),
})

export const categories = sqliteTable('categories', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    openCoreId: text('open_core_id'),
    isOpenCoreFilter: integer('is_open_core_filter').notNull().default(0),
    sharedWithOrg: integer('shared_with_org').notNull().default(0),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull().default(0),
})

export const subcategories = sqliteTable('subcategories', {
    id: text('id').primaryKey(),
    categoryId: text('category_id').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull().default(0),
})

export const filters = sqliteTable('filters', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: text('category_id').notNull(),
    subcategoryId: text('subcategory_id'),
    name: text('name').notNull(),
    description: text('description'),
    coverItemShortname: text('cover_item_shortname').notNull(),
    boxImagePath: text('box_image_path'),
    sharedWithOrg: integer('shared_with_org').notNull().default(0),
    boxCount: integer('box_count').notNull().default(1),
    conveyorCount: integer('conveyor_count').notNull().default(1),
    storageAdaptorCount: integer('storage_adaptor_count').notNull().default(1),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull().default(0),
})

export const filterItems = sqliteTable(
    'filter_items',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        filterId: text('filter_id').notNull(),
        shortname: text('shortname').notNull(),
        max: integer('max').notNull().default(0),
        buffer: integer('buffer').notNull().default(0),
        min: integer('min').notNull().default(0),
        position: integer('position').notNull().default(0),
    },
    (t) => [uniqueIndex('filter_items_filter_shortname_uq').on(t.filterId, t.shortname)],
)

export const events = sqliteTable('events', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id'),
    type: text('type').notNull(),
    targetId: text('target_id'),
    metadata: text('metadata'),
    createdAt: integer('created_at').notNull(),
})

export const schemaMigrations = sqliteTable('schema_migrations', {
    name: text('name').primaryKey(),
    appliedAt: integer('applied_at').notNull(),
    appVersion: text('app_version'),
})

export type DbUser = typeof users.$inferSelect
export type DbSession = typeof sessions.$inferSelect
export type DbOrganization = typeof organizations.$inferSelect
export type DbOpenCore = typeof openCores.$inferSelect
export type DbCategory = typeof categories.$inferSelect
export type DbSubcategory = typeof subcategories.$inferSelect
export type DbFilter = typeof filters.$inferSelect
export type DbFilterItem = typeof filterItems.$inferSelect
export type DbEvent = typeof events.$inferSelect
export type DbSchemaMigration = typeof schemaMigrations.$inferSelect

// Marker used so TS doesn't drop `sql` import in case we add raw statements.
export const _markerSql = sql`SELECT 1`
