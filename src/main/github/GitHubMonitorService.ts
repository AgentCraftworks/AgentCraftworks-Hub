// GitHubMonitorService.ts — Orchestrates all GitHub monitoring pollers
// Runs in the Electron main process and exposes data via IPC.

import { EventEmitter } from 'events'
import { RateLimitPoller, type RateLimitData } from './RateLimitPoller.js'
import { BillingPoller, type BillingData } from './BillingPoller.js'
import { CopilotUsagePoller, type CopilotUsageData } from './CopilotUsagePoller.js'
import { AuditLogPoller, type AuditLogEntry } from './AuditLogPoller.js'

export interface MonitorConfig {
  enterprise: string
  token: string
  rateLimitIntervalMs: number
  billingIntervalMs: number
  copilotIntervalMs: number
  auditLogIntervalMs: number
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
  }

  start(): void {
    this.rateLimitPoller.on('data', (data: RateLimitData) => {
      this.snapshot.rateLimit = data
      this.snapshot.lastUpdated.rateLimit = Date.now()
      this.emit('update', this.snapshot)
    })

    this.billingPoller.on('data', (data: BillingData) => {
      this.snapshot.billing = data
      this.snapshot.lastUpdated.billing = Date.now()
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
  }

  getSnapshot(): MonitorSnapshot {
    return { ...this.snapshot }
  }
}
