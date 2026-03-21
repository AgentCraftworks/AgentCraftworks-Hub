// BillingPoller.ts — Polls org-level Actions billing usage (v2 API) every 5 min
// Uses /orgs/{org}/settings/billing/usage (the legacy enterprise endpoint is 410 Gone).
// Requires a token with read:enterprise or admin:org scope.
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
  estimatedCostUsd: number
  billingCycleResetAt: string | null
}

export interface BillingData {
  actionsMinutes: ActionsMinutes | null
  fetchedAt: number
  error?: string
}

export class BillingPoller extends EventEmitter {
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
      // New v2 billing usage endpoint (org-level)
      const { data } = await this.octokit.request(
        'GET /orgs/{org}/settings/billing/usage',
        { org: this.org }
      ) as { data: { usageItems: Array<Record<string, unknown>> } }

      const items = Array.isArray(data.usageItems) ? data.usageItems : []

      // Aggregate minutes from "actions" product items
      let totalMinutes = 0
      const breakdown = { ubuntu: 0, macos: 0, windows: 0 }

      for (const item of items) {
        if (item.product !== 'actions') continue
        const sku = String(item.sku ?? '').toLowerCase()
        const qty = Number(item.quantity ?? 0)
        if (sku.includes('storage')) continue // storage is GigabyteHours, not minutes

        totalMinutes += qty
        if (sku.includes('linux') || sku.includes('ubuntu')) breakdown.ubuntu += qty
        else if (sku.includes('macos')) breakdown.macos += qty
        else if (sku.includes('windows')) breakdown.windows += qty
        else breakdown.ubuntu += qty // default to linux
      }

      // Compute total cost from items
      let totalCost = 0
      for (const item of items) {
        totalCost += Number(item.netAmount ?? 0)
      }

      const actionsMinutes: ActionsMinutes = {
        totalMinutesUsed: Math.round(totalMinutes),
        totalPaidMinutesUsed: 0,
        includedMinutes: 0,
        minutesUsedBreakdown: {
          ubuntu: Math.round(breakdown.ubuntu),
          macos: Math.round(breakdown.macos),
          windows: Math.round(breakdown.windows),
        },
        estimatedCostUsd: totalCost,
        billingCycleResetAt: null,
      }

      this.emit('data', { actionsMinutes, fetchedAt: Date.now() } satisfies BillingData)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.emit('data', { actionsMinutes: null, fetchedAt: Date.now(), error: message } satisfies BillingData)
    }
  }
}
