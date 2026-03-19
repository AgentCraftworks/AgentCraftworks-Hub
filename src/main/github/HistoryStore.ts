// HistoryStore.ts — Persists rate limit history samples to SQLite
// Loaded on startup to pre-fill sparklines; written on each poll.
// DB: ~/.agentcraftworks-hub/history.db

import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync } from 'fs'

const DB_DIR = join(homedir(), '.agentcraftworks-hub')
const DB_PATH = join(DB_DIR, 'history.db')
const MAX_ROWS = 720 // 6 hours at 30s interval

export interface RateLimitSample {
  ts: number
  coreUsed: number
  coreLimit: number
}

type BetterSqlite3DB = {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => void
    all: (...args: unknown[]) => unknown[]
  }
  exec: (sql: string) => void
  close: () => void
}

let db: BetterSqlite3DB | null = null

function getDb(): BetterSqlite3DB | null {
  if (db) return db
  try {
    mkdirSync(DB_DIR, { recursive: true })
    // Dynamic import to avoid hard crash if better-sqlite3 native bindings aren't built
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as (path: string) => BetterSqlite3DB
    db = Database(DB_PATH)
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit_history (
        ts        INTEGER PRIMARY KEY,
        core_used INTEGER NOT NULL,
        core_limit INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ts ON rate_limit_history(ts);
    `)
    return db
  } catch (err) {
    // Silently degrade — history just won't persist across restarts
    process.stderr.write(`[HistoryStore] SQLite unavailable: ${err}\n`)
    return null
  }
}

export function appendSample(sample: RateLimitSample): void {
  const d = getDb()
  if (!d) return
  try {
    d.prepare('INSERT OR REPLACE INTO rate_limit_history (ts, core_used, core_limit) VALUES (?, ?, ?)').run(sample.ts, sample.coreUsed, sample.coreLimit)
    // Prune old rows
    d.prepare('DELETE FROM rate_limit_history WHERE ts NOT IN (SELECT ts FROM rate_limit_history ORDER BY ts DESC LIMIT ?)').run(MAX_ROWS)
  } catch {
    // Non-fatal
  }
}

export function loadHistory(): RateLimitSample[] {
  const d = getDb()
  if (!d) return []
  try {
    const rows = d.prepare('SELECT ts, core_used, core_limit FROM rate_limit_history ORDER BY ts ASC').all() as {ts: number; core_used: number; core_limit: number}[]
    return rows.map(r => ({ ts: r.ts, coreUsed: r.core_used, coreLimit: r.core_limit }))
  } catch {
    return []
  }
}

export function closeDb(): void {
  db?.close()
  db = null
}
