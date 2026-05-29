import type { Migration } from './runner'

export const initial: Migration = {
  version: 1,
  name: 'initial',
  sql: [
    `CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      nick TEXT NOT NULL,
      mail TEXT,
      link TEXT,
      content TEXT NOT NULL,
      ua TEXT,
      ip TEXT,
      master INTEGER DEFAULT 0,
      top INTEGER DEFAULT 0,
      rid TEXT,
      pid TEXT,
      pinned_from_id TEXT,
      is_spam INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_comments_url ON comments(url)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_rid ON comments(rid)`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nick TEXT NOT NULL,
      mail TEXT UNIQUE,
      link TEXT,
      avatar TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS likes (
      comment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (comment_id, user_id)
    )`,
  ],
}
