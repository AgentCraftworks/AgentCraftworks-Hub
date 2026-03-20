// AuditLogPoller.ts — Polls enterprise audit log to identify top API callers every 2 min
// Requires a token with read:audit_log scope (enterprise admin).
import { EventEmitter } from 'events'
import { Octokit } from '@octokit/rest'

export interface AuditLogEntry {
  actor: string
  action: string
  tokenType: string
  appSlug?: string
  count: number
  lastSeenAt: number
}

export interface AuditLogData {
  entries: AuditLogEntry[]
  error?: string
}

export class AuditLogPoller extends EventEmitter {
  private octokit: Octokit
  private enterprise: string
  private intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(token: string, enterprise: string, intervalMs: number) {
    super()
    this.octokit = new Octokit({ auth: token })
    this.enterprise = enterprise
    this.intervalMs = intervalMs
  }

  start(): void {
    this.poll()
    this.timer = setInterval(() => this.poll(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  private async poll(): Promise<void> {
    try {
      const { data } = await this.octokit.request(
        'GET /enterprises/{enterprise}/audit-log',
        {
          enterprise: this.enterprise,
          per_page: 100,
          order: 'desc',
        }
      )

      const entries = Array.isArray(data) ? data as Record<string, unknown>[] : []

      // Aggregate by actor
      const actorMap = new Map<string, AuditLogEntry>()
      for (const entry of entries) {
        const actor = String(entry.actor ?? entry.actor_login ?? 'unknown')
        const existing = actorMap.get(actor)
        const ts = Number(entry['@timestamp'] ?? entry.created_at ?? Date.now())
        if (existing) {
          existing.count++
          if (ts > existing.lastSeenAt) existing.lastSeenAt = ts
        } else {
          actorMap.set(actor, {
            actor,
            action: String(entry.action ?? ''),
            tokenType: String(
              entry.programmatic_access_type ??
              (entry.oauth_application_name ? 'OAuth App' : 'Unknown')
            ),
            appSlug: entry.oauth_application_name ? String(entry.oauth_application_name) : undefined,
            count: 1,
            lastSeenAt: ts,
          })
        }
      }

      const sorted = [...actorMap.values()].sort((a, b) => b.count - a.count)
      this.emit('data', { entries: sorted } satisfies AuditLogData)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.emit('data', { entries: [], error: message } satisfies AuditLogData)
    }
  }
}
