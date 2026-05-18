-- Idempotent schema. Applied at app startup by src/db/client.ts.
-- Update src/db/schema.ts in lockstep when you change this file.

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    username_lower  TEXT NOT NULL,
    email           TEXT,
    password_hash   TEXT,
    google_id       TEXT,
    avatar_url      TEXT,
    org_id          TEXT,
    org_role        TEXT, -- 'owner' | 'admin' | 'member' | NULL
    is_admin        INTEGER NOT NULL DEFAULT 0, -- app-wide super-admin (dashboard access)
    last_seen_at    INTEGER, -- updated by middleware (throttled), used for DAU/MAU
    created_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uq ON users(username_lower);
-- users_google_id_uq and users_last_seen_idx are created in migrate() (after any
-- ALTER/recreate on legacy DBs, so the columns are guaranteed to exist).

CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY, -- sha256(token)
    user_id     TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS organizations (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    invite_code  TEXT NOT NULL,
    owner_id     TEXT NOT NULL,
    created_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_invite_code_uq ON organizations(invite_code);
-- Clan names are unique, case-insensitive (expression index — no extra column needed).
CREATE UNIQUE INDEX IF NOT EXISTS organizations_name_lower_uq ON organizations(lower(name));

CREATE TABLE IF NOT EXISTS open_cores (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    name             TEXT NOT NULL,
    shared_with_org  INTEGER NOT NULL DEFAULT 0,
    position         INTEGER NOT NULL DEFAULT 0,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS open_cores_user_idx ON open_cores(user_id);

CREATE TABLE IF NOT EXISTS categories (
    id                   TEXT PRIMARY KEY,
    user_id              TEXT NOT NULL,
    name                 TEXT NOT NULL,
    open_core_id         TEXT,
    is_open_core_filter  INTEGER NOT NULL DEFAULT 0,
    shared_with_org      INTEGER NOT NULL DEFAULT 0,
    position             INTEGER NOT NULL DEFAULT 0,
    created_at           INTEGER NOT NULL,
    updated_at           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS categories_user_idx ON categories(user_id);
CREATE INDEX IF NOT EXISTS categories_open_core_idx ON categories(open_core_id);

CREATE TABLE IF NOT EXISTS subcategories (
    id          TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name        TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS subcategories_category_idx ON subcategories(category_id);

CREATE TABLE IF NOT EXISTS filters (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    category_id           TEXT NOT NULL,
    subcategory_id        TEXT,
    name                  TEXT NOT NULL,
    description           TEXT,
    cover_item_shortname  TEXT NOT NULL,
    box_image_path        TEXT,
    shared_with_org       INTEGER NOT NULL DEFAULT 0,
    box_count             INTEGER NOT NULL DEFAULT 1,
    conveyor_count        INTEGER NOT NULL DEFAULT 1,
    storage_adaptor_count INTEGER NOT NULL DEFAULT 1,
    position              INTEGER NOT NULL DEFAULT 0,
    created_at            INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS filters_user_idx ON filters(user_id);
CREATE INDEX IF NOT EXISTS filters_category_idx ON filters(category_id);
CREATE INDEX IF NOT EXISTS filters_subcategory_idx ON filters(subcategory_id);

CREATE TABLE IF NOT EXISTS filter_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    filter_id   TEXT NOT NULL,
    shortname   TEXT NOT NULL,
    max         INTEGER NOT NULL DEFAULT 0,
    buffer      INTEGER NOT NULL DEFAULT 0,
    min         INTEGER NOT NULL DEFAULT 0,
    position    INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS filter_items_filter_shortname_uq ON filter_items(filter_id, shortname);
CREATE INDEX IF NOT EXISTS filter_items_filter_idx ON filter_items(filter_id);

-- Generic event log. Used for usage metrics (logins, clones, JSON exports,
-- shared-filter views, content create/delete, …). One row per event; queried
-- aggregated by `type` + `created_at` from the admin dashboard.
--   user_id   NULL = anonymous / system event
--   target_id optional FK-ish reference to the entity the event is about
--   metadata  optional JSON blob (small) for event-specific extras
CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT,
    type        TEXT NOT NULL,
    target_id   TEXT,
    metadata    TEXT,
    created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_type_idx ON events(type);
CREATE INDEX IF NOT EXISTS events_user_id_idx ON events(user_id);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON events(created_at);
CREATE INDEX IF NOT EXISTS events_type_created_at_idx ON events(type, created_at);
