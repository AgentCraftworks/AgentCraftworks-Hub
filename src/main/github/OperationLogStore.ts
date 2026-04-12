// OperationLogStore.ts — File-backed operation log for Hub desktop.
// Store: ~/.agentcraftworks-hub/operation-log.json
// Mirrors the CLI implementation in scripts/hub-cli.js.

import { randomUUID } from 'crypto'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import type { OperationLogEntry, OperationLogQuery, OperationLogAppendInput } from '../../shared/hub-types.js'

const DATA_DIR = join(homedir(), '.agentcraftworks-hub')
const OPLOG_PATH = join(DATA_DIR, 'operation-log.json')
const MAX_ENTRIES = 2000
const DEFAULT_QUERY_LIMIT = 100

function ensureDir(): void {
  mkdirSync(DATA_DIR, { recursive: true })
}

function loadEntries(): OperationLogEntry[] {
  try {
    ensureDir()
    if (!existsSync(OPLOG_PATH)) return []
    const raw = readFileSync(OPLOG_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as OperationLogEntry[]) : []
  } catch {
    return []
  }
}

function saveEntries(entries: OperationLogEntry[]): void {
  ensureDir()
  writeFileSync(OPLOG_PATH, JSON.stringify(entries, null, 2), 'utf-8')
}

/**
 * Appends a new operation log entry, trimming the log to `MAX_ENTRIES`.
 * Returns the newly created entry.
 */
export function appendOperationLog(input: OperationLogAppendInput): OperationLogEntry {
  const entry: OperationLogEntry = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    actor: input.actor ?? 'hub-desktop',
    action: input.action,
    scope: input.scope ?? '',
    surface: input.surface ?? 'desktop',
    tier: input.tier ?? 'T1',
    result: input.result ?? 'ok',
  }

  const entries = loadEntries()
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES)
  }
  saveEntries(entries)
  return entry
}

/**
 * Lists operation log entries, most recent first, with optional filtering.
 */
export function listOperationLog(query: OperationLogQuery): OperationLogEntry[] {
  const limit = query.limit != null && query.limit > 0 ? Math.min(query.limit, MAX_ENTRIES) : DEFAULT_QUERY_LIMIT
  const entries = loadEntries()

  const filtered = entries.filter((entry) => {
    if (query.scope && entry.scope !== query.scope) return false
    if (query.surface && entry.surface !== query.surface) return false
    if (query.result && entry.result !== query.result) return false
    return true
  })

  // Return most-recent first
  return filtered.slice(-limit).reverse()
}
