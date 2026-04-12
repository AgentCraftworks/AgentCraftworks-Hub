// ActionRequestStore.ts — File-backed action request queue for Hub desktop.
// Store: ~/.agentcraftworks-hub/action-requests.json
// Mirrors the CLI implementation in scripts/hub-cli.js.

import { randomUUID } from 'crypto'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import type { ActionRequest, ActionRequestSubmitInput, ActionRequestQuery } from '../../shared/hub-types.js'

const DATA_DIR = join(homedir(), '.agentcraftworks-hub')
const ACTION_REQUEST_PATH = join(DATA_DIR, 'action-requests.json')
const MAX_REQUESTS = 1000
const DEFAULT_QUERY_LIMIT = 100

function ensureDir(): void {
  mkdirSync(DATA_DIR, { recursive: true })
}

function loadRequests(): ActionRequest[] {
  try {
    ensureDir()
    if (!existsSync(ACTION_REQUEST_PATH)) return []
    const raw = readFileSync(ACTION_REQUEST_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as ActionRequest[]) : []
  } catch {
    return []
  }
}

function saveRequests(requests: ActionRequest[]): void {
  ensureDir()
  writeFileSync(ACTION_REQUEST_PATH, JSON.stringify(requests, null, 2), 'utf-8')
}

/**
 * Submits a new action request in `pending` state.
 * Returns the newly created `ActionRequest`.
 */
export function submitActionRequest(input: ActionRequestSubmitInput): ActionRequest {
  const request: ActionRequest = {
    id: `req-${randomUUID()}`,
    ts: new Date().toISOString(),
    actor: input.actor ?? 'unknown',
    action: input.action,
    scope: input.scope ?? '',
    surface: input.surface ?? 'desktop',
    tier: input.tier ?? 'T3',
    rationale: input.rationale,
    state: 'pending',
  }

  const requests = loadRequests()
  requests.push(request)
  if (requests.length > MAX_REQUESTS) {
    requests.splice(0, requests.length - MAX_REQUESTS)
  }
  saveRequests(requests)
  return request
}

/**
 * Lists action requests with optional state/scope filtering, most recent first.
 */
export function listActionRequests(query: ActionRequestQuery): ActionRequest[] {
  const limit = query.limit != null && query.limit > 0 ? Math.min(query.limit, MAX_REQUESTS) : DEFAULT_QUERY_LIMIT
  const requests = loadRequests()

  const filtered = requests.filter((req) => {
    if (query.state && req.state !== query.state) return false
    if (query.scope && req.scope !== query.scope) return false
    return true
  })

  return filtered.slice(-limit).reverse()
}

/**
 * Approves a pending action request.
 * Returns the updated request, or `null` if not found.
 * Idempotent: already-resolved requests are returned as-is.
 */
export function approveActionRequest(
  id: string,
  options: { resolvedBy: string; note?: string },
): ActionRequest | null {
  const requests = loadRequests()
  const idx = requests.findIndex((r) => r.id === id)
  if (idx === -1) return null

  if (requests[idx].state !== 'pending') return requests[idx]

  requests[idx] = {
    ...requests[idx],
    state: 'approved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: options.resolvedBy,
    resolvedNote: options.note,
  }
  saveRequests(requests)
  return requests[idx]
}

/**
 * Rejects a pending action request.
 * Returns the updated request, or `null` if not found.
 * Idempotent: already-resolved requests are returned as-is.
 */
export function rejectActionRequest(
  id: string,
  options: { resolvedBy: string; note?: string },
): ActionRequest | null {
  const requests = loadRequests()
  const idx = requests.findIndex((r) => r.id === id)
  if (idx === -1) return null

  if (requests[idx].state !== 'pending') return requests[idx]

  requests[idx] = {
    ...requests[idx],
    state: 'rejected',
    resolvedAt: new Date().toISOString(),
    resolvedBy: options.resolvedBy,
    resolvedNote: options.note,
  }
  saveRequests(requests)
  return requests[idx]
}

/**
 * Returns the count of action requests currently in `pending` state.
 */
export function countPendingActionRequests(): number {
  return loadRequests().filter((r) => r.state === 'pending').length
}
