// hub-types.ts — Shared types for Hub monitoring (used by main + renderer)
// Keep in sync with the individual poller exports.

export interface RateLimitEndpoint {
  limit: number
  used: number
  remaining: number
  reset: number
  resetEtaMs: number
}

export interface RateLimitData {
  core: RateLimitEndpoint
  search: RateLimitEndpoint
  graphql: RateLimitEndpoint
  codeSearch: RateLimitEndpoint
  history: number[]
  fetchedAt: number
}

export interface ActionsMinutes {
  totalMinutesUsed: number
  totalPaidMinutesUsed: number
  includedMinutes: number
  minutesUsedBreakdown: { ubuntu: number; macos: number; windows: number }
  estimatedOverageCostUsd: number
  billingCycleResetAt: string | null
}

export interface BillingData {
  actionsMinutes: ActionsMinutes | null
  fetchedAt: number
  error?: string
}

export interface CopilotModelBreakdown {
  model: string
  totalSuggestionsCount: number
  totalAcceptancesCount: number
  totalChatTurns?: number
}

export interface CopilotSeatBreakdown {
  total: number
  activeThisCycle: number
  inactiveThisCycle: number
  pendingInvitation: number
  pendingCancellation: number
  addedThisCycle: number
}

export interface CopilotUsageData {
  totalActiveUsers: number
  totalEngagedUsers: number
  modelBreakdown: CopilotModelBreakdown[]
  premiumRequestsUsed: number
  premiumRequestsLimit: number | null
  seatBreakdown: CopilotSeatBreakdown | null
  planType: string | null
  fetchedAt: number
  error?: string
}

export interface AuditLogEntry {
  actor: string
  action: string
  tokenType: string
  appSlug?: string
  count: number
  lastSeenAt: number
}

export interface MonitorSnapshot {
  rateLimit: RateLimitData | null
  billing: BillingData | null
  copilot: CopilotUsageData | null
  topCallers: AuditLogEntry[]
  auditLogError?: string
  lastUpdated: Record<string, number>
}

export interface RateLimitSample {
  ts: number
  coreUsed: number
  coreLimit: number
}

export interface HubWindowAPI {
  start(enterprise?: string): Promise<{ ok: boolean; error?: string }>
  stop(): Promise<{ ok: boolean }>
  getSnapshot(): Promise<MonitorSnapshot | null>
  getHistory(): Promise<RateLimitSample[]>
  getTokenConfig(): Promise<{
    hasToken: boolean
    enterprise: string
    isGhCli: boolean
    ghAuthenticated: boolean
    ghScopes: string[]
    missingScopes: string[]
  }>
  checkLoginStatus(): Promise<{ authenticated: boolean; scopes: string[]; missingScopes: string[] }>
  beginGitHubLogin(params: { enterprise: string }): Promise<{ ok: boolean; error?: string }>
  openDevicePage(): Promise<{ ok: boolean }>
  completeGitHubLogin(params: { enterprise: string }): Promise<{ ok: boolean; error?: string; scopes?: string[]; missingScopes?: string[] }>
  logoutGitHub(): Promise<{ ok: boolean; error?: string }>
  refresh(): Promise<{ ok: boolean; error?: string }>
  onSnapshot(cb: (snapshot: MonitorSnapshot) => void): () => void
  onError(cb: (message: string) => void): () => void
  onDeviceCode(cb: (code: string) => void): () => void
}