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
  estimatedCostUsd: number
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

export interface OperationLogEntry {
  id: string
  ts: string
  actor: string
  action: string
  scope: string
  surface: string
  tier: string
  result: string
}

export interface OperationLogQuery {
  limit?: number
  scope?: string
  surface?: string
  result?: string
}

export interface OperationLogAppendInput {
  actor?: string
  action: string
  scope?: string
  surface?: string
  tier?: string
  result?: string
}

export type ActionTier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5'

export interface HubActionResponse {
  ok: boolean
  error?: string
  denied?: boolean
  requiredTier?: ActionTier
  requiredCapability?: string
  personaId?: string
  licenseLevel?: string
}

export interface ActionAuthoritySnapshot {
  personaId: string
  licenseLevel: string
  capabilities: string[]
  tierRequirements: Record<ActionTier, string>
}

// ============================================================================
// Action Request Queue (request/approve workflow)
// ============================================================================

export type ActionRequestState = 'pending' | 'approved' | 'rejected'

export interface ActionRequest {
  id: string
  ts: string
  actor: string
  action: string
  scope: string
  surface: string
  tier: string
  rationale?: string
  state: ActionRequestState
  resolvedAt?: string
  resolvedBy?: string
  resolvedNote?: string
}

export interface ActionRequestSubmitInput {
  actor?: string
  action: string
  scope?: string
  surface?: string
  tier?: string
  rationale?: string
}

export interface ActionRequestQuery {
  limit?: number
  state?: ActionRequestState
  scope?: string
}

export interface HubWindowAPI {
  start(enterprise?: string): Promise<HubActionResponse>
  stop(): Promise<HubActionResponse>
  getSnapshot(): Promise<MonitorSnapshot | null>
  getHistory(): Promise<RateLimitSample[]>
  getOperationLog(query?: OperationLogQuery): Promise<OperationLogEntry[]>
  appendOperationLogEntry(input: OperationLogAppendInput): Promise<HubActionResponse & { entry?: OperationLogEntry }>
  getActionAuthority(): Promise<ActionAuthoritySnapshot>
  getTokenConfig(): Promise<{
    hasToken: boolean
    enterprise: string
    org: string
    isGhCli: boolean
    ghAuthenticated: boolean
    ghScopes: string[]
    missingScopes: string[]
  }>
  checkLoginStatus(): Promise<{ authenticated: boolean; scopes: string[]; missingScopes: string[] }>
  beginGitHubLogin(params: { enterprise: string; org?: string }): Promise<HubActionResponse>
  openDevicePage(): Promise<HubActionResponse>
  completeGitHubLogin(params: { enterprise: string; org?: string }): Promise<HubActionResponse & { scopes?: string[]; missingScopes?: string[] }>
  logoutGitHub(): Promise<HubActionResponse>
  refresh(): Promise<HubActionResponse>
  onSnapshot(cb: (snapshot: MonitorSnapshot) => void): () => void
  onError(cb: (message: string) => void): () => void
  onDeviceCode(cb: (code: string) => void): () => void
  onOperationLogUpdated(cb: (entry: OperationLogEntry) => void): () => void
  // Action request queue
  submitActionRequest(input: ActionRequestSubmitInput): Promise<HubActionResponse & { request?: ActionRequest }>
  listActionRequests(query?: ActionRequestQuery): Promise<ActionRequest[]>
  approveActionRequest(id: string, note?: string): Promise<HubActionResponse & { request?: ActionRequest }>
  rejectActionRequest(id: string, note?: string): Promise<HubActionResponse & { request?: ActionRequest }>
  countPendingRequests(): Promise<number>
  onActionRequestUpdated(cb: (request: ActionRequest) => void): () => void
  onDeepLinkOpen(cb: (payload: {
    rawUrl: string
    panel: string
    scopeRaw: string
    persona?: string
    scope?: unknown
  }) => void): () => void
}