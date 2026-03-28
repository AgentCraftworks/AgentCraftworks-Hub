// AuditLogPoller.ts — Polls audit log to identify top API callers every 2 min.
// Tries enterprise endpoint first; falls back to org endpoint automatically on 403.
// Paginates up to 1 000 events, classifies actors as Copilot / Human / Bot,
// and produces hourly Copilot-vs-Human buckets for the last 24 h.
import { EventEmitter } from 'events'
import { Octokit } from '@octokit/rest'
import type { ActorKind, HourlyBucket } from '../../shared/hub-types.js'

export interface AuditLogEntry {
  actor: string
  action: string
  tokenType: string
  appSlug?: string
  count: number
  lastSeenAt: number
  actorKind: ActorKind
}

export interface AuditLogData {
  entries: AuditLogEntry[]
  topCallers1h: AuditLogEntry[]
  hourlyBuckets: HourlyBucket[]
  auditScope: 'enterprise' | 'org'
  error?: string
}

const MAX_PAGES = 10
const PER_PAGE = 100

function classifyActor(actor: string): ActorKind {
  const lower = actor.toLowerCase()
  if (lower === 'copilot' || lower.includes('copilot')) return 'Copilot'
  if (lower.endsWith('[bot]')) return 'Bot'
  return 'Human'
}

function toHourKey(tsMs: number): string {
  const d = new Date(tsMs)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const hr = String(d.getUTCHours()).padStart(2, '0')
  return `${y}-${mo}-${day} ${hr}:00Z`
}

function buildResult(
  rawEntries: Record<string, unknown>[],
  auditScope: 'enterprise' | 'org',
): AuditLogData {
  const now = Date.now()
  const cut24h = now - 24 * 60 * 60_000
  const cut1h = now - 60 * 60_000

  // Filter to API-related events (same heuristic as the monitor script)
  const apiEvents = rawEntries.filter(
    (e) => e['request_id'] != null || e['programmatic_access_type'] != null,
  )

  // --- 24 h actor aggregation ---
  const actorMap24 = new Map<string, AuditLogEntry>()
  for (const e of apiEvents) {
    const ts = Number(e['@timestamp'] ?? e['created_at'] ?? 0)
    if (ts < cut24h) continue
    const actor = String(e['actor'] ?? e['actor_login'] ?? 'unknown')
    const existing = actorMap24.get(actor)
    if (existing) {
      existing.count++
      if (ts > existing.lastSeenAt) existing.lastSeenAt = ts
    } else {
      actorMap24.set(actor, {
        actor,
        action: String(e['action'] ?? ''),
        tokenType: String(
          e['programmatic_access_type'] ??
          (e['oauth_application_name'] ? 'OAuth App' : 'Unknown'),
        ),
        appSlug: e['oauth_application_name'] ? String(e['oauth_application_name']) : undefined,
        count: 1,
        lastSeenAt: ts,
        actorKind: classifyActor(actor),
      })
    }
  }
  const entries = [...actorMap24.values()].sort((a, b) => b.count - a.count)

  // --- 1 h actor aggregation ---
  const actorMap1h = new Map<string, AuditLogEntry>()
  for (const e of apiEvents) {
    const ts = Number(e['@timestamp'] ?? e['created_at'] ?? 0)
    if (ts < cut1h) continue
    const actor = String(e['actor'] ?? e['actor_login'] ?? 'unknown')
    const existing = actorMap1h.get(actor)
    if (existing) {
      existing.count++
      if (ts > existing.lastSeenAt) existing.lastSeenAt = ts
    } else {
      actorMap1h.set(actor, {
        actor,
        action: String(e['action'] ?? ''),
        tokenType: String(
          e['programmatic_access_type'] ??
          (e['oauth_application_name'] ? 'OAuth App' : 'Unknown'),
        ),
        appSlug: e['oauth_application_name'] ? String(e['oauth_application_name']) : undefined,
        count: 1,
        lastSeenAt: ts,
        actorKind: classifyActor(actor),
      })
    }
  }
  const topCallers1h = [...actorMap1h.values()].sort((a, b) => b.count - a.count)

  // --- Hourly Copilot vs Human buckets (last 24 h) ---
  const bucketMap = new Map<string, HourlyBucket>()
  for (const e of apiEvents) {
    const ts = Number(e['@timestamp'] ?? e['created_at'] ?? 0)
    if (ts < cut24h) continue
    const actor = String(e['actor'] ?? e['actor_login'] ?? 'unknown')
    const kind = classifyActor(actor)
    const key = toHourKey(ts)
    const bucket = bucketMap.get(key) ?? { hourUtc: key, copilot: 0, human: 0, bot: 0, total: 0 }
    if (kind === 'Copilot') bucket.copilot++
    else if (kind === 'Bot') bucket.bot++
    else bucket.human++
    bucket.total++
    bucketMap.set(key, bucket)
  }
  const hourlyBuckets = [...bucketMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)

  return { entries, topCallers1h, hourlyBuckets, auditScope }
}

export class AuditLogPoller extends EventEmitter {
  private octokit: Octokit
  private enterprise: string
  private org: string
  private intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(token: string, enterprise: string, org: string, intervalMs: number) {
    super()
    this.octokit = new Octokit({ auth: token })
    this.enterprise = enterprise
    this.org = org
    this.intervalMs = intervalMs
  }

  start(): void {
    void this.poll()
    this.timer = setInterval(() => void this.poll(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  private async fetchPages(endpoint: string, params: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, headers } = await this.octokit.request(endpoint, {
        ...params,
        per_page: PER_PAGE,
        page,
      }) as { data: unknown; headers: Record<string, string> }
      const items = Array.isArray(data) ? data as Record<string, unknown>[] : []
      all.push(...items)
      // Stop early if this page wasn't full or there's no next page link
      const hasNext = typeof headers['link'] === 'string' && headers['link'].includes('rel="next"')
      if (!hasNext || items.length < PER_PAGE) break
    }
    return all
  }

  private async poll(): Promise<void> {
    let auditScope: 'enterprise' | 'org' = 'enterprise'
    let rawEntries: Record<string, unknown>[] = []

    try {
      rawEntries = await this.fetchPages('GET /enterprises/{enterprise}/audit-log', {
        enterprise: this.enterprise,
        order: 'desc',
      })
    } catch (err: unknown) {
      const status = (err as { status?: number }).status
      if (status === 403 || status === 404) {
        // Fall back to org-level endpoint (no admin:enterprise scope required)
        auditScope = 'org'
        try {
          rawEntries = await this.fetchPages('GET /orgs/{org}/audit-log', {
            org: this.org,
            order: 'desc',
          })
        } catch (orgErr: unknown) {
          const message = orgErr instanceof Error ? orgErr.message : String(orgErr)
          this.emit('data', {
            entries: [],
            topCallers1h: [],
            hourlyBuckets: [],
            auditScope: 'org',
            error: message,
          } satisfies AuditLogData)
          return
        }
      } else {
        const message = err instanceof Error ? err.message : String(err)
        this.emit('data', {
          entries: [],
          topCallers1h: [],
          hourlyBuckets: [],
          auditScope: 'enterprise',
          error: message,
        } satisfies AuditLogData)
        return
      }
    }

    this.emit('data', buildResult(rawEntries, auditScope))
  }
}
