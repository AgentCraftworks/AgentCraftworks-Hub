// CopilotUsagePoller.ts — Polls org-level Copilot billing every 5 min
// Uses /orgs/{org}/copilot/billing (enterprise endpoint returns 404).
// Requires a token with manage_billing:copilot scope.
import { EventEmitter } from 'events'
import { Octokit } from '@octokit/rest'

export interface CopilotModelBreakdown {
  model: string
  totalSuggestionsCount: number
  totalAcceptancesCount: number
  totalChatTurns?: number
}

export interface CopilotUsageData {
  totalActiveUsers: number
  totalEngagedUsers: number
  modelBreakdown: CopilotModelBreakdown[]
  premiumRequestsUsed: number
  premiumRequestsLimit: number | null
  seatBreakdown: {
    total: number
    activeThisCycle: number
    inactiveThisCycle: number
    pendingInvitation: number
    pendingCancellation: number
    addedThisCycle: number
  } | null
  planType: string | null
  fetchedAt: number
  error?: string
}

export class CopilotUsagePoller extends EventEmitter {
  private octokit: Octokit
  private org: string
  private intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(token: string, org: string, intervalMs: number) {
    super()
    this.octokit = new Octokit({ auth: token })
    this.org = org
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
      // Org-level copilot billing endpoint
      const { data } = await this.octokit.request(
        'GET /orgs/{org}/copilot/billing',
        { org: this.org }
      ) as { data: Record<string, unknown> }

      const seatBreakdown = data.seat_breakdown as Record<string, number> | undefined

      this.emit('data', {
        totalActiveUsers: Number(seatBreakdown?.active_this_cycle ?? 0),
        totalEngagedUsers: Number(seatBreakdown?.active_this_cycle ?? 0),
        modelBreakdown: [],
        premiumRequestsUsed: 0,
        premiumRequestsLimit: null,
        seatBreakdown: seatBreakdown ? {
          total: Number(seatBreakdown.total ?? 0),
          activeThisCycle: Number(seatBreakdown.active_this_cycle ?? 0),
          inactiveThisCycle: Number(seatBreakdown.inactive_this_cycle ?? 0),
          pendingInvitation: Number(seatBreakdown.pending_invitation ?? 0),
          pendingCancellation: Number(seatBreakdown.pending_cancellation ?? 0),
          addedThisCycle: Number(seatBreakdown.added_this_cycle ?? 0),
        } : null,
        planType: data.plan_type ? String(data.plan_type) : null,
        fetchedAt: Date.now(),
      } satisfies CopilotUsageData)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.emit('data', {
        totalActiveUsers: 0,
        totalEngagedUsers: 0,
        modelBreakdown: [],
        premiumRequestsUsed: 0,
        premiumRequestsLimit: null,
        seatBreakdown: null,
        planType: null,
        fetchedAt: Date.now(),
        error: message,
      } satisfies CopilotUsageData)
    }
  }
}
