-- Idempotent schema. Applied at app startup by src/db/client.ts.
-- Update src/db/schema.ts in lockstep when you change this file.

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    username_lower  TEXT NOT NULL,
    email           TEXT,
    password_hash   TEXT NOT NULL,
    org_id          TEXT,
    org_role        TEXT, -- 'owner' | 'member' | NULL
    created_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uq ON users(username_lower);

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
    created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS open_cores_user_idx ON open_cores(user_id);

CREATE TABLE IF NOT EXISTS categories (
    id                   TEXT PRIMARY KEY,
    user_id              TEXT NOT NULL,
    name                 TEXT NOT NULL,
    open_core_id         TEXT,
    is_open_core_filter  INTEGER NOT NULL DEFAULT 0,
    position             INTEGER NOT NULL DEFAULT 0,
    created_at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS categories_user_idx ON categories(user_id);
CREATE INDEX IF NOT EXISTS categories_open_core_idx ON categories(open_core_id);

CREATE TABLE IF NOT EXISTS subcategories (
    id          TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name        TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL
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
    created_at            INTEGER NOT NULL
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
