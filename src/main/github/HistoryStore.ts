// HistoryStore.ts — Persists rate limit history samples to a JSON file
// Loaded on startup to pre-fill sparklines; written on each poll.
// Store: ~/.agentcraftworks-hub/history.json
// No native dependencies — pure Node.js fs.

import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'

const DATA_DIR = join(homedir(), '.agentcraftworks-hub')
const HISTORY_PATH = join(DATA_DIR, 'history.json')
const MAX_SAMPLES = 720 // 6 hours at 30s interval

export interface RateLimitSample {
  ts: number
  coreUsed: number
  coreLimit: number
}

let cache: RateLimitSample[] = []
let dirty = false
let flushTimer: ReturnType<typeof setInterval> | null = null

function ensureDir(): void {
  mkdirSync(DATA_DIR, { recursive: true })
}

export function loadHistory(): RateLimitSample[] {
  try {
    ensureDir()
    const raw = readFileSync(HISTORY_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as RateLimitSample[]
    cache = Array.isArray(parsed) ? parsed.slice(-MAX_SAMPLES) : []
    // Start periodic flush every 60s to avoid writing on every 30s poll
    if (!flushTimer) {
      flushTimer = setInterval(flushIfDirty, 60_000)
    }
    return cache
  } catch {
    cache = []
    return cache
  }
}

export function appendSample(sample: RateLimitSample): void {
  ensureDir()
  cache.push(sample)
  if (cache.length > MAX_SAMPLES) cache = cache.slice(-MAX_SAMPLES)
  dirty = true
  // Start flush timer if not already running
  if (!flushTimer) {
    flushTimer = setInterval(flushIfDirty, 60_000)
  }
}

function flushIfDirty(): void {
  if (!dirty) return
  try {
    writeFileSync(HISTORY_PATH, JSON.stringify(cache), 'utf-8')
    dirty = false
  } catch {
    // Non-fatal
  }
}

export function closeDb(): void {
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null }
  flushIfDirty() // final flush on shutdown
}

