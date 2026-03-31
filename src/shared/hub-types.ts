// hub-types.ts — Shared types for Hub monitoring (used by main + renderer)
// Keep in sync with the individual poller exports.
import type { HubDeepLinkPayload } from './hub-contracts'

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

export type ActorKind = 'Copilot' | 'Human' | 'Bot'

export interface HourlyBucket {
  hourUtc: string
  copilot: number
  human: number
  bot: number
  total: number
}

export interface AuditLogEntry {
  actor: string
  action: string
  tokenType: string
  appSlug?: string
  count: number
  lastSeenAt: number
  actorKind: ActorKind
}

export interface GhawWorkflowDataRun {
  id: number
  workflowId?: number
  name: string
  headBranch: string
  status: string
  conclusion?: string | null
  runNumber: number
  event: string
  htmlUrl: string
  createdAt: string
  updatedAt: string
  runStartedAt?: string | null
}

export interface GhawWorkflowData {
  repository: string
  runs: GhawWorkflowDataRun[]
  summary: {
    total: number
    queued: number
    inProgress: number
    completed: number
    success: number
    failed: number
    cancelled: number
  }
  fetchedAt: number
  recovered?: boolean
  error?: string
}

export interface MonitorSnapshot {
  rateLimit: RateLimitData | null
  billing: BillingData | null
  copilot: CopilotUsageData | null
  topCallers: AuditLogEntry[]
  topCallers1h: AuditLogEntry[]
  hourlyBuckets: HourlyBucket[]
  auditScope: 'enterprise' | 'org' | null
  auditLogError?: string
  ghawWorkflows: GhawWorkflowData | null
  rateGovernor: HubRateGovernorData | null
  handoffs: HubHandoffData | null
  squadState: HubSquadData | null
  lastUpdated: Record<string, number>
}

// ============================================================================
// Rate Governor Panel Types
// ============================================================================

export type TrafficLightZone = 'GREEN' | 'AMBER' | 'RED'
export type CircuitBreakerState = 'CLOSED' | 'PRE_EMPTIVE_OPEN' | 'OPEN' | 'HALF_OPEN'
export type CascadeMode = 'parallel' | 'sequential'

export interface HubRateGovernorAgent {
  agentId: string
  priority: 'P0' | 'P1' | 'P2'
  reserved: number
  used: number
  quotaType: 'github' | 'copilot'
}

export interface HubRateGovernorData {
  state: {
    trafficLight: TrafficLightZone
    circuitState: CircuitBreakerState
    circuitStateByQuota: { github: CircuitBreakerState; copilot: CircuitBreakerState }
    cascadeMode: CascadeMode
  }
  github: { windowTotal: number; windowRemaining: number; donationPool: number }
  copilot: { windowTotal: number; windowRemaining: number; donationPool: number }
  agents: HubRateGovernorAgent[]
}

// ============================================================================
// Handoff Flow Panel Types
// ============================================================================

export type HandoffStatus = 'pending' | 'active' | 'completed' | 'failed'
export type HandoffPriority = 'low' | 'medium' | 'high' | 'critical'

export interface HubHandoffEntry {
  handoff_id: string
  from_agent: string
  to_agent: string
  status: HandoffStatus
  priority: HandoffPriority
  task: string
  sla_deadline?: string
  created_at: string
  completed_at?: string
  failed_at?: string
  failure_reason?: string
}

export interface HubHandoffStats {
  total: number
  active: number
  completed: number
  failed: number
  avgCompletionMs: number
  slaComplianceRate: number
}

export interface HubHandoffData {
  active: HubHandoffEntry[]
  recent: HubHandoffEntry[]
  stats: HubHandoffStats
}

// ============================================================================
// Squad Coordinator Panel Types
// ============================================================================

export interface HubSquadAgent {
  id: string
  name: string
  engagementLevel: number
  priority: 'P0' | 'P1' | 'P2'
  skills: string[]
}

export interface HubSquadInfo {
  squadId: string
  ceiling: number
  agents: HubSquadAgent[]
  defaultLane: string
}

export interface HubRoutingDecision {
  agentId: string
  toolName: string
  reason: string
  responseMode: 'DIRECT' | 'LIGHTWEIGHT' | 'STANDARD' | 'FULL'
  zone: TrafficLightZone
  allowed: boolean
  timestamp: number
}

export type SquadHandoffType = 'request-response' | 'scatter-gather' | 'event-broadcast'

export interface HubSquadHandoff {
  fromSquadId: string
  toSquadId: string
  type: SquadHandoffType
  priority: 'P0' | 'P1' | 'P2'
  status: HandoffStatus
}

export interface HubSquadData {
  squads: HubSquadInfo[]
  recentRouting: HubRoutingDecision[]
  squadHandoffs: HubSquadHandoff[]
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

export interface GhawInsightsRun {
  repo: string
  workflowName: string
  workflowPath?: string
  trigger: string
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending'
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | 'stale'
    | 'startup_failure'
    | null
  startedAt: number
  completedAt: number | null
  durationMs: number | null
  runId: number
  runUrl: string
}

export interface GhawWorkflowDefinition {
  repo: string
  workflowName: string
  workflowPath: string
  triggers: string[]
  scheduleCrons: string[]
}

export interface GhawAnomaly {
  severity: 'info' | 'warning' | 'critical'
  type:
    | 'high_skip_rate'
    | 'high_failure_rate'
    | 'run_spike'
    | 'duration_spike'
    | 'duplicate_advisory_pattern'
  repo: string
  workflowName: string
  metricValue: number
  baselineValue?: number
  note: string
}

export interface GhawMinutesSummary {
  window: '7d' | '30d'
  ghawRuntimeMinutes: number
  estimatedBillableMinutes: Record<string, number> & { total: number }
  estimatedCostUsd?: number
  methodology: 'run_duration_estimate' | 'billing_api_enriched'
}

export interface GhawInsightsSnapshot {
  definitions: GhawWorkflowDefinition[]
  runs7d: GhawInsightsRun[]
  runs30d: GhawInsightsRun[]
  anomalies: GhawAnomaly[]
  topHotspots: Array<{
    repo: string
    workflowName: string
    runs7d: number
    failRate7d: number
    skipRate7d: number
    p95DurationMinutes7d: number
  }>
  minutes7d: GhawMinutesSummary
  minutes30d: GhawMinutesSummary
  fetchedAt: number
  error?: string
}

/**
 * Renderer-facing preload contract for the GHAW workflow poller.
 * Methods are request/reply IPC calls and event handlers are push subscriptions.
 */
export interface GhawWorkflowPoller {
  /** Start GHAW workflow polling. */
  start(): Promise<HubActionResponse>
  /** Stop GHAW workflow polling. */
  stop(): Promise<HubActionResponse>
  /** Force an immediate GHAW workflow refresh. */
  refresh(): Promise<HubActionResponse>
  /** Fetch the latest cached GHAW insights snapshot. */
  getSnapshot(): Promise<GhawInsightsSnapshot | null>
  /** Subscribe to incremental snapshot updates from the main process. */
  onSnapshot(cb: (snapshot: GhawInsightsSnapshot) => void): () => void
  /** Subscribe to poller errors emitted by the main process. */
  onError(cb: (message: string) => void): () => void
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
  onDeepLinkOpen(cb: (payload: HubDeepLinkPayload) => void): () => void
}
