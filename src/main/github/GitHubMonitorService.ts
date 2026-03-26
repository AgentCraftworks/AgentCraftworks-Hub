// GitHubMonitorService.ts — Orchestrates all GitHub monitoring pollers
// Runs in the Electron main process and exposes data via IPC.
import { EventEmitter } from 'events'
import { RateLimitPoller, type RateLimitData } from './RateLimitPoller.js'
import { BillingPoller, type BillingData } from './BillingPoller.js'
import { CopilotUsagePoller, type CopilotUsageData } from './CopilotUsagePoller.js'
import { AuditLogPoller, type AuditLogEntry, type AuditLogData } from './AuditLogPoller.js'
import { GhawWorkflowPoller, type GhawWorkflowData } from './GhawWorkflowPoller.js'
import { AlertService, type AlertThresholds } from './AlertService.js'
import { appendSample, loadHistory, closeDb } from './HistoryStore.js'

export interface MonitorConfig {
  enterprise: string  // Enterprise slug for audit log (case-sensitive: AICraftWorks)
  org: string         // Org slug for billing/copilot APIs (AgentCraftworks)
  token: string
  rateLimitIntervalMs: number
  billingIntervalMs: number
  copilotIntervalMs: number
  auditLogIntervalMs: number
  ghawWorkflowIntervalMs: number
  ghawWorkflowOwner: string
  ghawWorkflowRepo: string
  alertThresholds?: Partial<AlertThresholds>
}

export interface MonitorSnapshot {
  rateLimit: RateLimitData | null
  billing: BillingData | null
  copilot: CopilotUsageData | null
  topCallers: AuditLogEntry[]
  auditLogError?: string
  ghawWorkflows: GhawWorkflowData | null
  lastUpdated: Record<string, number>
}

const DEFAULT_CONFIG: Omit<MonitorConfig, 'token'> = {
  enterprise: 'AICraftWorks',   // Case-sensitive! Capital W required for enterprise endpoints
  org: 'AgentCraftworks',       // Org slug for billing v2 and copilot endpoints
  rateLimitIntervalMs: 30_000,
  billingIntervalMs: 5 * 60_000,
  copilotIntervalMs: 5 * 60_000,
  auditLogIntervalMs: 2 * 60_000,
  ghawWorkflowIntervalMs: 30_000,
  ghawWorkflowOwner: 'AgentCraftworks',
  ghawWorkflowRepo: 'AgentCraftworks-Hub',
}

export class GitHubMonitorService extends EventEmitter {
  private config: MonitorConfig
  private rateLimitPoller: RateLimitPoller
  private billingPoller: BillingPoller
  private copilotPoller: CopilotUsagePoller
  private auditLogPoller: AuditLogPoller
  private ghawWorkflowPoller: GhawWorkflowPoller
  private alertService: AlertService
  private snapshot: MonitorSnapshot = {
    rateLimit: null,
    billing: null,
    copilot: null,
    topCallers: [],
    ghawWorkflows: null,
    lastUpdated: {},
  }

  constructor(token: string, overrides: Partial<MonitorConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, token, ...overrides }

    this.rateLimitPoller = new RateLimitPoller(token, this.config.rateLimitIntervalMs)
    // Billing and Copilot use org-level endpoints
    this.billingPoller = new BillingPoller(token, this.config.org, this.config.billingIntervalMs)
    this.copilotPoller = new CopilotUsagePoller(token, this.config.org, this.config.copilotIntervalMs)
    // Audit log uses enterprise-level endpoint
    this.auditLogPoller = new AuditLogPoller(token, this.config.enterprise, this.config.auditLogIntervalMs)
    this.ghawWorkflowPoller = new GhawWorkflowPoller(
      token,
      this.config.ghawWorkflowOwner,
      this.config.ghawWorkflowRepo,
      this.config.ghawWorkflowIntervalMs,
    )
    this.alertService = new AlertService(this.config.alertThresholds)

    // Pre-fill rate limit history from disk
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

    this.auditLogPoller.on('data', (result: AuditLogData) => {
      this.snapshot.topCallers = result.entries
      this.snapshot.auditLogError = result.error
      this.snapshot.lastUpdated.auditLog = Date.now()
      this.emit('update', this.snapshot)
    })

    this.ghawWorkflowPoller.on('data', (data: GhawWorkflowData) => {
      this.snapshot.ghawWorkflows = data
      this.snapshot.lastUpdated.ghawWorkflows = Date.now()
      this.emit('update', this.snapshot)
    })

    this.rateLimitPoller.start()
    this.billingPoller.start()
    this.copilotPoller.start()
    this.auditLogPoller.start()
    this.ghawWorkflowPoller.start()
  }

  stop(): void {
    this.rateLimitPoller.stop()
    this.billingPoller.stop()
    this.copilotPoller.stop()
    this.auditLogPoller.stop()
    this.ghawWorkflowPoller.stop()
    closeDb()
  }

  getSnapshot(): MonitorSnapshot {
    return { ...this.snapshot }
  }
}
