// GitHubMonitorService.ts — Orchestrates all GitHub monitoring pollers
// Runs in the Electron main process and exposes data via IPC.

import { EventEmitter } from 'events'
import { RateLimitPoller, type RateLimitData } from './RateLimitPoller.js'
import { BillingPoller, type BillingData } from './BillingPoller.js'
import { CopilotUsagePoller, type CopilotUsageData } from './CopilotUsagePoller.js'
import { AuditLogPoller, type AuditLogEntry } from './AuditLogPoller.js'
import { AlertService, type AlertThresholds } from './AlertService.js'
import { appendSample, loadHistory, closeDb } from './HistoryStore.js'

export interface MonitorConfig {
  enterprise: string
  token: string
  rateLimitIntervalMs: number
  billingIntervalMs: number
  copilotIntervalMs: number
  auditLogIntervalMs: number
  alertThresholds?: Partial<AlertThresholds>
}

export interface MonitorSnapshot {
  rateLimit: RateLimitData | null
  billing: BillingData | null
  copilot: CopilotUsageData | null
  topCallers: AuditLogEntry[]
  lastUpdated: Record<string, number>
}

const DEFAULT_CONFIG: Omit<MonitorConfig, 'token'> = {
  enterprise: 'AICraftworks',
  rateLimitIntervalMs: 30_000,
  billingIntervalMs: 5 * 60_000,
  copilotIntervalMs: 5 * 60_000,
  auditLogIntervalMs: 2 * 60_000,
}

export class GitHubMonitorService extends EventEmitter {
  private config: MonitorConfig
  private rateLimitPoller: RateLimitPoller
  private billingPoller: BillingPoller
  private copilotPoller: CopilotUsagePoller
  private auditLogPoller: AuditLogPoller
  private alertService: AlertService
  private snapshot: MonitorSnapshot = {
    rateLimit: null,
    billing: null,
    copilot: null,
    topCallers: [],
    lastUpdated: {},
  }

  constructor(token: string, overrides: Partial<MonitorConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, token, ...overrides }
    this.rateLimitPoller = new RateLimitPoller(token, this.config.rateLimitIntervalMs)
    this.billingPoller = new BillingPoller(token, this.config.enterprise, this.config.billingIntervalMs)
    this.copilotPoller = new CopilotUsagePoller(token, this.config.enterprise, this.config.copilotIntervalMs)
    this.auditLogPoller = new AuditLogPoller(token, this.config.enterprise, this.config.auditLogIntervalMs)
    this.alertService = new AlertService(this.config.alertThresholds)

    // Pre-fill rate limit history from SQLite
    const history = loadHistory()
    if (history.length > 0) {
      this.snapshot.rateLimit = {
        core: { limit: history[history.length - 1].coreLimit, used: history[history.length - 1].coreUsed, remaining: history[history.length - 1].coreLimit - history[history.length - 1].coreUsed, reset: 0, resetEtaMs: 0 },
        search: { limit: 30, used: 0, remaining: 30, reset: 0, resetEtaMs: 0 },
        graphql: { limit: 5000, used: 0, remaining: 5000, reset: 0, resetEtaMs: 0 },
        codeSearch: { limit: 10, used: 0, remaining: 10, reset: 0, resetEtaMs: 0 },
        history: history.map(h => h.coreUsed),
        fetchedAt: history[history.length - 1].ts,
      }
    }
  }

  start(): void {
    this.rateLimitPoller.on('data', (data: RateLimitData) => {
      this.snapshot.rateLimit = data
      this.snapshot.lastUpdated.rateLimit = Date.now()
      // Persist sample to SQLite for sparkline continuity across restarts
      appendSample({ ts: data.fetchedAt, coreUsed: data.core.used, coreLimit: data.core.limit })
      this.alertService.evaluate(this.snapshot)
      this.emit('update', this.snapshot)
    })

    this.billingPoller.on('data', (data: BillingData) => {
      this.snapshot.billing = data
      this.snapshot.lastUpdated.billing = Date.now()
      this.alertService.evaluate(this.snapshot)
      this.emit('update', this.snapshot)
    })

    this.copilotPoller.on('data', (data: CopilotUsageData) => {
      this.snapshot.copilot = data
      this.snapshot.lastUpdated.copilot = Date.now()
      this.emit('update', this.snapshot)
    })

    this.auditLogPoller.on('data', (entries: AuditLogEntry[]) => {
      this.snapshot.topCallers = entries
      this.snapshot.lastUpdated.auditLog = Date.now()
      this.emit('update', this.snapshot)
    })

    this.rateLimitPoller.start()
    this.billingPoller.start()
    this.copilotPoller.start()
    this.auditLogPoller.start()
  }

  stop(): void {
    this.rateLimitPoller.stop()
    this.billingPoller.stop()
    this.copilotPoller.stop()
    this.auditLogPoller.stop()
    closeDb()
  }

  getSnapshot(): MonitorSnapshot {
    return { ...this.snapshot }
  }
}
