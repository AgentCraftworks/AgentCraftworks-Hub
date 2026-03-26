// hub-handlers.ts — IPC handlers for GitHub monitoring (Hub dashboard)
// Registers the GitHubMonitorService and pushes snapshots to the renderer.

import { ipcMain, BrowserWindow, shell } from 'electron'
import { execSync, spawn } from 'child_process'
import { createRequire } from 'module'
import { GitHubMonitorService } from '../github/GitHubMonitorService.js'
import type { MonitorSnapshot } from '../github/GitHubMonitorService.js'
import { loadHistory } from '../github/HistoryStore.js'
import { appendOperationLog, listOperationLog } from '../github/OperationLogStore.js'
import {
  submitActionRequest,
  listActionRequests,
  approveActionRequest,
  rejectActionRequest,
  countPendingActionRequests,
} from '../github/ActionRequestStore.js'
import {
  authorizeActionTier,
  getActionAuthoritySnapshot,
  normalizeActionTier,
  toDeniedOperationLog,
} from '../hub/ActionAuthority.js'

// Keytar is an optional native module — gracefully degrade if not available
const requireForOptionalDeps =
  typeof require === 'function' ? require : createRequire(import.meta.url)

let keytar: {
  getPassword: (svc: string, acc: string) => Promise<string | null>
  setPassword: (svc: string, acc: string, pw: string) => Promise<void>
  deletePassword: (svc: string, acc: string) => Promise<boolean>
} | null = null
try {
  keytar = requireForOptionalDeps('keytar')
} catch {
  // keytar not available — enterprise slug stored in memory only
}

const KEYTAR_SERVICE = 'agentcraftworks-hub'
const KEYTAR_ACCOUNT_ENTERPRISE = 'github-enterprise'
const KEYTAR_ACCOUNT_ORG = 'github-org'
const REQUIRED_GH_SCOPES = ['read:audit_log', 'read:enterprise', 'manage_billing:copilot']

let monitorService: GitHubMonitorService | null = null
let cachedEnterprise = 'AICraftWorks'
let cachedOrg = 'AgentCraftworks'

async function getStoredEnterprise(): Promise<string> {
  if (keytar) {
    const stored = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ENTERPRISE)
    if (stored) return stored
  }
  return cachedEnterprise
}

async function getStoredOrg(): Promise<string> {
  if (keytar) {
    const stored = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ORG)
    if (stored) return stored
  }
  return cachedOrg
}

function getGhCliToken(): string {
  try {
    return execSync('gh auth token', { encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

function getGhCliScopes(): string[] {
  try {
    const output = execSync('gh auth status --hostname github.com 2>&1', { encoding: 'utf-8' })
    const match = output.match(/Token scopes:\s*([^\n\r]+)/i)
    if (!match) return []
    return match[1]
      .replace(/'/g, '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function missingScopes(scopes: string[]): string[] {
  return REQUIRED_GH_SCOPES.filter((scope) => !scopes.includes(scope))
}

/**
 * Launch GitHub browser-based OAuth flow entirely within the Electron process.
 * Captures the device code from gh CLI output and pushes it to the renderer
 * so the user sees the code in the app UI (no hidden terminal).
 * Auto-opens github.com/login/device in the default browser.
 */
function launchGitHubLoginIntegrated(
  scopes: string[],
  getWindow: () => BrowserWindow | null,
): void {
  const scopeCsv = scopes.join(',')
  const proc = spawn(
    'gh',
    ['auth', 'login', '-h', 'github.com', '--web', '-p', 'HTTPS', '--scopes', scopeCsv],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
  )

  let codeSent = false
  const codeRegex = /one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i

  function parseForCode(chunk: Buffer | string) {
    if (codeSent) return
    const text = chunk.toString()
    const match = text.match(codeRegex)
    if (match) {
      codeSent = true
      const deviceCode = match[1]
      // Push the code to the renderer so it can display it in the UI
      getWindow()?.webContents.send('hub:deviceCode', deviceCode)
      // Open the device page in the default browser
      shell.openExternal('https://github.com/login/device')
    }
  }

  proc.stdout?.on('data', parseForCode)
  proc.stderr?.on('data', parseForCode)

  // Close stdin immediately — skips any "Press Enter" / protocol selection prompts
  proc.stdin?.end()
  proc.unref()
}

function startMonitor(token: string, enterprise: string, org: string, getWindow: () => BrowserWindow | null): void {
  if (monitorService) {
    monitorService.stop()
    monitorService = null
  }
  monitorService = new GitHubMonitorService(token, { enterprise, org })
  monitorService.on('update', (snapshot: MonitorSnapshot) => {
    getWindow()?.webContents.send('hub:snapshot', snapshot)
  })
  monitorService.on('error', (err: Error) => {
    getWindow()?.webContents.send('hub:error', err.message)
  })
  monitorService.start()
}

function pushOperationLogUpdate(getWindow: () => BrowserWindow | null, entry: ReturnType<typeof appendOperationLog>): void {
  getWindow()?.webContents.send('hub:operationLogUpdated', entry)
}

function appendDesktopOperationLog(
  getWindow: () => BrowserWindow | null,
  action: string,
  scope: string,
  result: string,
  tier = 'T1',
): void {
  const entry = appendOperationLog({
    action,
    scope,
    surface: 'desktop',
    result,
    actor: 'hub-desktop',
    tier,
  })
  pushOperationLogUpdate(getWindow, entry)
}

export function registerHubHandlers(getWindow: () => BrowserWindow | null): void {
  // Get latest snapshot (one-shot request from renderer)
  ipcMain.handle('hub:getSnapshot', () => monitorService?.getSnapshot() ?? null)

  // Return persisted rate limit history for the full chart
  ipcMain.handle('hub:getHistory', () => loadHistory())

  ipcMain.handle('hub:getOperationLog', (_, query) => listOperationLog(query ?? {}))

  ipcMain.handle('hub:getActionAuthority', () => getActionAuthoritySnapshot())

  ipcMain.handle('hub:appendOperationLogEntry', (_, input: {
    actor?: string
    action?: string
    scope?: string
    surface?: string
    tier?: string
    result?: string
  }) => {
    if (!input?.action || !input.action.trim()) {
      return { ok: false, entry: null, error: 'action is required' }
    }

    const requiredTier = normalizeActionTier(input?.tier)
    const authResult = authorizeActionTier(requiredTier)
    if (!authResult.ok) {
      const scope = input?.scope?.trim() || '(global)'
      const deniedEntry = appendOperationLog(toDeniedOperationLog('hub.appendOperationLogEntry', scope, authResult))
      pushOperationLogUpdate(getWindow, deniedEntry)
      return authResult
    }

    const entry = appendOperationLog({
      actor: input?.actor,
      action: input.action,
      scope: input?.scope,
      surface: input?.surface,
      tier: input?.tier,
      result: input?.result,
    })
    pushOperationLogUpdate(getWindow, entry)
    return { ok: true, entry }
  })

  // Returns auth status and enterprise/org names — no PAT fields
  ipcMain.handle('hub:getTokenConfig', async () => {
    const enterprise = await getStoredEnterprise()
    const org = await getStoredOrg()
    const ghToken = getGhCliToken()
    const ghScopes = ghToken ? getGhCliScopes() : []
    return {
      hasToken: !!ghToken,
      enterprise,
      org,
      isGhCli: true,
      ghAuthenticated: !!ghToken,
      ghScopes,
      missingScopes: missingScopes(ghScopes),
    }
  })

  // Check auth status — used by renderer to poll for login completion
  ipcMain.handle('hub:checkLoginStatus', () => {
    const token = getGhCliToken()
    if (!token) return { authenticated: false, scopes: [], missingScopes: REQUIRED_GH_SCOPES }
    const scopes = getGhCliScopes()
    return { authenticated: true, scopes, missingScopes: missingScopes(scopes) }
  })

  // Launch GitHub web OAuth flow — opens system browser silently, no terminal window
  ipcMain.handle('hub:beginGitHubLogin', async (_, { enterprise, org }: { enterprise: string; org?: string }) => {
    const authResult = authorizeActionTier('T2')
    if (!authResult.ok) {
      const scope = `org:${(org ?? '').trim() || cachedOrg}`
      const deniedEntry = appendOperationLog(toDeniedOperationLog('hub.beginGitHubLogin', scope, authResult))
      pushOperationLogUpdate(getWindow, deniedEntry)
      return authResult
    }

    const ent = enterprise.trim() || 'AICraftWorks'
    const orgSlug = (org ?? '').trim() || 'AgentCraftworks'
    cachedEnterprise = ent
    cachedOrg = orgSlug
    if (keytar) {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ENTERPRISE, ent)
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ORG, orgSlug)
    }

    try {
      launchGitHubLoginIntegrated(REQUIRED_GH_SCOPES, getWindow)
      appendDesktopOperationLog(getWindow, 'hub.beginGitHubLogin', `org:${orgSlug}`, 'ok')
      return { ok: true }
    } catch {
      appendDesktopOperationLog(getWindow, 'hub.beginGitHubLogin', `org:${orgSlug}`, 'failed')
      return { ok: false, error: 'Unable to launch GitHub login. Ensure GitHub CLI (gh) is installed and in PATH.' }
    }
  })

  // Open github.com/login/device in the default browser (for device flow fallback)
  ipcMain.handle('hub:openDevicePage', () => {
    shell.openExternal('https://github.com/login/device')
    return { ok: true }
  })

  // Verify gh auth status/scopes and start monitoring with gh token
  ipcMain.handle('hub:completeGitHubLogin', async (_, { enterprise, org }: { enterprise: string; org?: string }) => {
    const authResult = authorizeActionTier('T2')
    if (!authResult.ok) {
      const scope = `org:${(org ?? '').trim() || cachedOrg}`
      const deniedEntry = appendOperationLog(toDeniedOperationLog('hub.completeGitHubLogin', scope, authResult))
      pushOperationLogUpdate(getWindow, deniedEntry)
      return authResult
    }

    const token = getGhCliToken()
    if (!token) {
      const failedScope = `org:${(org ?? '').trim() || cachedOrg}`
      appendDesktopOperationLog(getWindow, 'hub.completeGitHubLogin', failedScope, 'failed')
      return { ok: false, error: 'GitHub login not detected yet. Complete the sign-in flow in your browser first.' }
    }

    const scopes = getGhCliScopes()
    const missing = missingScopes(scopes)
    const ent = enterprise.trim() || (await getStoredEnterprise())
    const orgSlug = (org ?? '').trim() || (await getStoredOrg())
    cachedEnterprise = ent
    cachedOrg = orgSlug
    if (keytar) {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ENTERPRISE, ent)
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ORG, orgSlug)
    }

    startMonitor(token, ent, orgSlug, getWindow)
    appendDesktopOperationLog(getWindow, 'hub.completeGitHubLogin', `org:${orgSlug}`, 'ok')
    return { ok: true, scopes, missingScopes: missing }
  })

  // Log out of GitHub CLI and stop monitor
  ipcMain.handle('hub:logoutGitHub', async () => {
    const authResult = authorizeActionTier('T2')
    if (!authResult.ok) {
      const deniedEntry = appendOperationLog(toDeniedOperationLog('hub.logoutGitHub', `org:${cachedOrg}`, authResult))
      pushOperationLogUpdate(getWindow, deniedEntry)
      return authResult
    }

    const org = await getStoredOrg()
    try {
      execSync('gh auth logout --hostname github.com --yes', { stdio: 'ignore' })
    } catch {
      // No-op: logout may fail if already logged out
    }

    monitorService?.stop()
    monitorService = null

    appendDesktopOperationLog(getWindow, 'hub.logoutGitHub', `org:${org}`, 'ok')

    return { ok: true }
  })

  // Start monitoring — called when Hub dashboard is first opened
  ipcMain.handle('hub:start', async (_, enterprise?: string) => {
    if (monitorService) return { ok: true }

    const token = getGhCliToken()
    const org = await getStoredOrg()
    if (!token) {
      appendDesktopOperationLog(getWindow, 'hub.start', `org:${org}`, 'failed')
      return { ok: false, error: 'No GitHub token found. Click "Sign in with GitHub" to authenticate.' }
    }

    const ent = enterprise?.trim() || (await getStoredEnterprise())
    startMonitor(token, ent, org, getWindow)
    appendDesktopOperationLog(getWindow, 'hub.start', `org:${org}`, 'ok')
    return { ok: true }
  })

  // Stop monitoring
  ipcMain.handle('hub:stop', () => {
    const authResult = authorizeActionTier('T2')
    if (!authResult.ok) {
      const deniedEntry = appendOperationLog(toDeniedOperationLog('hub.stop', `org:${cachedOrg}`, authResult))
      pushOperationLogUpdate(getWindow, deniedEntry)
      return authResult
    }

    const scope = `org:${cachedOrg}`
    monitorService?.stop()
    monitorService = null
    appendDesktopOperationLog(getWindow, 'hub.stop', scope, 'ok')
    return { ok: true }
  })

  // Manually refresh all pollers immediately
  ipcMain.handle('hub:refresh', async () => {
    const token = getGhCliToken()
    const org = await getStoredOrg()
    if (!token) {
      appendDesktopOperationLog(getWindow, 'hub.refresh', `org:${org}`, 'failed')
      return { ok: false, error: 'No GitHub token' }
    }
    const enterprise = await getStoredEnterprise()
    startMonitor(token, enterprise, org, getWindow)
    appendDesktopOperationLog(getWindow, 'hub.refresh', `org:${org}`, 'ok')
    return { ok: true }
  })

  // ============================================================================
  // Action Request Queue — submit / list / approve / reject
  // ============================================================================

  function pushActionRequestUpdate(request: ReturnType<typeof submitActionRequest>): void {
    getWindow()?.webContents.send('hub:actionRequestUpdated', request)
  }

  ipcMain.handle('hub:submitActionRequest', (_, input: {
    actor?: string
    action?: string
    scope?: string
    surface?: string
    tier?: string
    rationale?: string
  }) => {
    if (!input?.action || !input.action.trim()) {
      return { ok: false, error: 'action is required' }
    }
    const request = submitActionRequest({
      actor: input.actor,
      action: input.action,
      scope: input.scope,
      surface: input.surface,
      tier: input.tier,
      rationale: input.rationale,
    })
    pushActionRequestUpdate(request)
    appendDesktopOperationLog(getWindow, 'hub.submitActionRequest', input.scope || '', 'ok')
    return { ok: true, request }
  })

  ipcMain.handle('hub:listActionRequests', (_, query) => listActionRequests(query ?? {}))

  ipcMain.handle('hub:countPendingRequests', () => countPendingActionRequests())

  ipcMain.handle('hub:approveActionRequest', (_, id: string, note?: string) => {
    const authResult = authorizeActionTier('T3')
    if (!authResult.ok) {
      const deniedEntry = appendOperationLog(toDeniedOperationLog('hub.approveActionRequest', id, authResult))
      pushOperationLogUpdate(getWindow, deniedEntry)
      return authResult
    }
    const updated = approveActionRequest(id, { resolvedBy: 'hub-desktop', note })
    if (!updated) return { ok: false, error: `Request ${id} not found` }
    pushActionRequestUpdate(updated)
    appendDesktopOperationLog(getWindow, 'hub.approveActionRequest', id, 'ok', 'T3')
    return { ok: true, request: updated }
  })

  ipcMain.handle('hub:rejectActionRequest', (_, id: string, note?: string) => {
    const authResult = authorizeActionTier('T3')
    if (!authResult.ok) {
      const deniedEntry = appendOperationLog(toDeniedOperationLog('hub.rejectActionRequest', id, authResult))
      pushOperationLogUpdate(getWindow, deniedEntry)
      return authResult
    }
    const updated = rejectActionRequest(id, { resolvedBy: 'hub-desktop', note })
    if (!updated) return { ok: false, error: `Request ${id} not found` }
    pushActionRequestUpdate(updated)
    appendDesktopOperationLog(getWindow, 'hub.rejectActionRequest', id, 'ok', 'T3')
    return { ok: true, request: updated }
  })
}