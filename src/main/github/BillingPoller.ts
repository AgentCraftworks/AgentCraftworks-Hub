// BillingPoller.ts — Polls enterprise Actions minutes and storage billing every 5 min
// Requires a token with read:enterprise scope.

import { EventEmitter } from 'events'
import { Octokit } from '@octokit/rest'

export interface ActionsMinutes {
  totalMinutesUsed: number
  totalPaidMinutesUsed: number
  includedMinutes: number
  minutesUsedBreakdown: {
    ubuntu: number
    macos: number
    windows: number
  }
  // Estimated overage cost in USD (linux=$0.008/min, windows=2x, macos=10x)
  estimatedOverageCostUsd: number
  billingCycleResetAt: string | null
}

export interface BillingData {
  actionsMinutes: ActionsMinutes | null
  fetchedAt: number
  error?: string
}

const MINUTE_RATES_USD: Record<string, number> = {
  ubuntu: 0.008,
  windows: 0.016,
  macos: 0.08,
}

function calcOverageCost(breakdown: ActionsMinutes['minutesUsedBreakdown'], included: number, total: number): number {
  if (total <= included) return 0
  // Simple estimate: apply overage proportionally by OS
  const overage = total - included
  const ratio = overage / total
  return (
    breakdown.ubuntu * MINUTE_RATES_USD.ubuntu * ratio +
    breakdown.windows * MINUTE_RATES_USD.windows * ratio +
    breakdown.macos * MINUTE_RATES_USD.macos * ratio
  )
}

export class BillingPoller extends EventEmitter {
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
      // GitHub Enterprise billing endpoint
      const { data } = await this.octokit.request(
        'GET /enterprises/{enterprise}/settings/billing/actions',
        { enterprise: this.enterprise }
      )

      const breakdown = {
        ubuntu: (data as unknown as Record<string, number>).minutes_used_breakdown?.UBUNTU ?? 0,
        windows: (data as unknown as Record<string, number>).minutes_used_breakdown?.WINDOWS ?? 0,
        macos: (data as unknown as Record<string, number>).minutes_used_breakdown?.MACOS ?? 0,
      }

      const actionsMinutes: ActionsMinutes = {
        totalMinutesUsed: data.total_minutes_used,
        totalPaidMinutesUsed: data.total_paid_minutes_used,
        includedMinutes: data.included_minutes,
        minutesUsedBreakdown: breakdown,
        estimatedOverageCostUsd: calcOverageCost(breakdown, data.included_minutes, data.total_minutes_used),
        billingCycleResetAt: null,
      }

      this.emit('data', { actionsMinutes, fetchedAt: Date.now() } satisfies BillingData)
    } catch (err: unknown) {
      // Graceful degradation — emit with error flag so UI can show "admin access required"
      const message = err instanceof Error ? err.message : String(err)
      this.emit('data', { actionsMinutes: null, fetchedAt: Date.now(), error: message } satisfies BillingData)
    }
  }
}
