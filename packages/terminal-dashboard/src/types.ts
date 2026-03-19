// types.ts — shared types for terminal dashboard (mirrors src/shared/hub-types.ts)
export interface RateLimitEndpoint {
  limit: number; used: number; remaining: number; reset: number; resetEtaMs: number
}
export interface RateLimitData {
  core: RateLimitEndpoint; search: RateLimitEndpoint; graphql: RateLimitEndpoint; codeSearch: RateLimitEndpoint
  history: number[]; fetchedAt: number
}
export interface ActionsMinutes {
  totalMinutesUsed: number; totalPaidMinutesUsed: number; includedMinutes: number
  minutesUsedBreakdown: { ubuntu: number; macos: number; windows: number }
  estimatedOverageCostUsd: number; billingCycleResetAt: string | null
}
export interface BillingData { actionsMinutes: ActionsMinutes | null; fetchedAt: number; error?: string }
export interface CopilotUsageData {
  totalActiveUsers: number; totalEngagedUsers: number; premiumRequestsUsed: number
  premiumRequestsLimit: number | null; fetchedAt: number; error?: string
}
export interface AuditLogEntry { actor: string; action: string; tokenType: string; appSlug?: string; count: number; lastSeenAt: number }
export interface MonitorSnapshot {
  rateLimit: RateLimitData | null; billing: BillingData | null; copilot: CopilotUsageData | null
  topCallers: AuditLogEntry[]; lastUpdated: Record<string, number>
}
