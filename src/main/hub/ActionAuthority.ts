// ActionAuthority.ts — Tier-based action authorization for the Hub desktop app.
// The local desktop always runs as a T3 (local admin) persona, which means
// T1–T3 operations are always authorized.  T4/T5 are reserved for future
// elevated-privilege flows.

import type {
  ActionTier,
  ActionAuthoritySnapshot,
  HubActionResponse,
  OperationLogAppendInput,
} from '../../shared/hub-types.js'

// ---------------------------------------------------------------------------
// Tier ordering (lower index = lower privilege)
// ---------------------------------------------------------------------------

const TIER_ORDER: ActionTier[] = ['T1', 'T2', 'T3', 'T4', 'T5']

function tierLevel(tier: ActionTier): number {
  return TIER_ORDER.indexOf(tier)
}

// ---------------------------------------------------------------------------
// Current authority — for the local desktop app the persona is always
// "local-admin" with enterprise license, granted up to T3.
// ---------------------------------------------------------------------------

const LOCAL_TIER: ActionTier = 'T3'
const MAX_TIER: ActionTier = 'T5'

/**
 * Tier → human-readable requirement description shown in denied responses.
 */
const TIER_REQUIREMENTS: Record<ActionTier, string> = {
  T1: 'Basic read operations (no elevated permission needed)',
  T2: 'Auth operations — start/stop monitoring, GitHub login/logout',
  T3: 'Approve or reject action requests',
  T4: 'Reserved for future elevated-privilege flows',
  T5: 'Reserved for future super-admin flows',
}

/**
 * Capabilities that a T3 local-admin persona holds.
 * Any code that calls `getActionAuthoritySnapshot()` and inspects
 * `capabilities.includes('approve_action')` will get the correct answer.
 */
const LOCAL_CAPABILITIES: string[] = [
  'read_snapshot',
  'start_monitor',
  'stop_monitor',
  'github_login',
  'github_logout',
  'approve_action',   // T3
  'reject_action',    // T3
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the current `ActionAuthoritySnapshot` that matches the declared
 * type in `hub-types.ts`.  All fields are populated so renderer code that
 * reads `capabilities`, `personaId`, etc. always gets real values.
 */
export function getActionAuthoritySnapshot(): ActionAuthoritySnapshot {
  return {
    personaId: 'local-admin',
    licenseLevel: 'enterprise',
    capabilities: LOCAL_CAPABILITIES,
    tierRequirements: TIER_REQUIREMENTS,
  }
}

/**
 * Checks whether the current local-admin persona is allowed to perform an
 * action at the requested tier.  Returns an `ok: true` response if allowed,
 * or `ok: false / denied: true` with the required tier if not.
 */
export function authorizeActionTier(required: ActionTier): HubActionResponse {
  if (tierLevel(required) <= tierLevel(LOCAL_TIER)) {
    return { ok: true }
  }
  return {
    ok: false,
    denied: true,
    requiredTier: required,
    personaId: 'local-admin',
    licenseLevel: 'enterprise',
    error: `This action requires tier ${required}; current persona is limited to ${LOCAL_TIER}.`,
  }
}

/**
 * Coerces an arbitrary string (e.g. from user input or IPC payload) to a
 * valid `ActionTier`, defaulting to `'T1'` for unknown values.
 */
export function normalizeActionTier(tier: string | undefined): ActionTier {
  if (tier && (TIER_ORDER as string[]).includes(tier)) {
    return tier as ActionTier
  }
  return 'T1'
}

/**
 * Builds an `OperationLogAppendInput` entry for a denied authorization
 * attempt, ready to pass to `appendOperationLog`.
 */
export function toDeniedOperationLog(
  action: string,
  scope: string,
  authResult: HubActionResponse,
): OperationLogAppendInput {
  return {
    action,
    scope,
    surface: 'desktop',
    actor: authResult.personaId ?? 'unknown',
    tier: authResult.requiredTier ?? 'T1',
    result: 'denied',
  }
}

export { MAX_TIER }
