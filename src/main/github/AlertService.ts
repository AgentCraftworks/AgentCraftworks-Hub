// AlertService.ts — Sends Electron native notifications for GitHub monitoring thresholds
// Fires at most once per rate-limit reset window per alert type.

import { Notification } from 'electron'
import type { MonitorSnapshot } from '../github/GitHubMonitorService.js'

export interface AlertThresholds {
  coreRemainingCritical: number   // default 500
  coreRemainingWarning: number    // default 1000
  searchRemainingCritical: number // default 5
  actionsMinutesPctWarning: number // default 80  (0-100)
  actionsMinutesPctCritical: number // default 95
}

const DEFAULTS: AlertThresholds = {
  coreRemainingCritical: 500,
  coreRemainingWarning: 1000,
  searchRemainingCritical: 5,
  actionsMinutesPctWarning: 80,
  actionsMinutesPctCritical: 95,
}

export class AlertService {
  private thresholds: AlertThresholds
  // Track last-alerted reset window per alert key to avoid spam
  private lastAlerted = new Map<string, number>()

  constructor(thresholds: Partial<AlertThresholds> = {}) {
    this.thresholds = { ...DEFAULTS, ...thresholds }
  }

  evaluate(snapshot: MonitorSnapshot): void {
    const { rateLimit, billing } = snapshot

    if (rateLimit) {
      const { core, search } = rateLimit

      if (core.remaining <= this.thresholds.coreRemainingCritical) {
        this.fire('core-critical', {
          title: '🚨 GitHub API Rate Limit Critical',
          body: `Only ${core.remaining} core REST calls remaining. Resets in ${this.fmtEta(core.resetEtaMs)}.`,
          resetWindow: core.reset,
        })
      } else if (core.remaining <= this.thresholds.coreRemainingWarning) {
        this.fire('core-warning', {
          title: '⚠️ GitHub API Rate Limit Warning',
          body: `${core.remaining} core calls remaining (${Math.round((core.used / core.limit) * 100)}% used). Resets in ${this.fmtEta(core.resetEtaMs)}.`,
          resetWindow: core.reset,
        })
      }

      if (search.remaining <= this.thresholds.searchRemainingCritical) {
        this.fire('search-critical', {
          title: '⚠️ GitHub Search Rate Limit',
          body: `Only ${search.remaining} search calls remaining. Resets in ${this.fmtEta(search.resetEtaMs)}.`,
          resetWindow: search.reset,
        })
      }
    }

    if (billing?.actionsMinutes) {
      const m = billing.actionsMinutes
      if (m.includedMinutes > 0) {
        const pct = Math.round((m.totalMinutesUsed / m.includedMinutes) * 100)
        const billingWindow = new Date().getMonth() // alert once per calendar month

        if (pct >= this.thresholds.actionsMinutesPctCritical) {
          this.fire('actions-critical', {
            title: '🚨 Actions Minutes Critical',
            body: `${pct}% of included minutes used (${m.totalMinutesUsed.toLocaleString()}/${m.includedMinutes.toLocaleString()}). Overages billing at ~$0.008/min.`,
            resetWindow: billingWindow,
          })
        } else if (pct >= this.thresholds.actionsMinutesPctWarning) {
          this.fire('actions-warning', {
            title: '⚠️ Actions Minutes Warning',
            body: `${pct}% of included minutes used. ${(m.includedMinutes - m.totalMinutesUsed).toLocaleString()} minutes remaining this month.`,
            resetWindow: billingWindow,
          })
        }
      }
    }
  }

  private fire(key: string, opts: { title: string; body: string; resetWindow: number }): void {
    const lastWindow = this.lastAlerted.get(key)
    if (lastWindow === opts.resetWindow) return // already alerted this window

    this.lastAlerted.set(key, opts.resetWindow)

    if (!Notification.isSupported()) return

    new Notification({
      title: opts.title,
      body: opts.body,
    }).show()
  }

  private fmtEta(ms: number): string {
    if (ms <= 0) return 'imminently'
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }
}
