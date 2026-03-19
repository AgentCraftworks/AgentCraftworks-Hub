// CopilotUsagePoller.ts — Polls enterprise Copilot usage every 5 min
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
  // Per-model breakdown for the current billing period
  modelBreakdown: CopilotModelBreakdown[]
  premiumRequestsUsed: number
  premiumRequestsLimit: number | null
  fetchedAt: number
  error?: string
}

export class CopilotUsagePoller extends EventEmitter {
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
        'GET /enterprises/{enterprise}/copilot/usage',
        { enterprise: this.enterprise }
      )

      // data is an array of daily usage records — aggregate the most recent day
      const records = Array.isArray(data) ? data : []
      const latest = records[records.length - 1] as Record<string, unknown> | undefined

      const breakdown: CopilotModelBreakdown[] = []
      let premiumRequestsUsed = 0

      if (latest?.breakdown && Array.isArray(latest.breakdown)) {
        for (const entry of latest.breakdown as Record<string, unknown>[]) {
          const model = String(entry.model ?? 'unknown')
          breakdown.push({
            model,
            totalSuggestionsCount: Number(entry.total_suggestions_count ?? 0),
            totalAcceptancesCount: Number(entry.total_acceptances_count ?? 0),
            totalChatTurns: Number(entry.total_chat_turns ?? 0),
          })
          // Premium models (non-base) count toward premium requests
          if (model !== 'default' && model !== 'gpt-3.5-turbo') {
            premiumRequestsUsed += Number(entry.total_suggestions_count ?? 0)
          }
        }
      }

      this.emit('data', {
        totalActiveUsers: Number(latest?.total_active_users ?? 0),
        totalEngagedUsers: Number(latest?.total_engaged_users ?? 0),
        modelBreakdown: breakdown,
        premiumRequestsUsed,
        premiumRequestsLimit: null, // Not available in public API
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
        fetchedAt: Date.now(),
        error: message,
      } satisfies CopilotUsageData)
    }
  }
}
