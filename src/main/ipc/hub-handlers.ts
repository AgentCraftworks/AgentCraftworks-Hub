// hub-handlers.ts — IPC handlers for GitHub monitoring (Hub dashboard)
// Registers the GitHubMonitorService and pushes snapshots to the renderer.
import { ipcMain, BrowserWindow, shell } from 'electron'
import { execSync, spawn } from 'child_process'
import { createRequire } from 'module'
import { GitHubMonitorService } from '../github/GitHubMonitorService.js'
import type { MonitorSnapshot } from '../github/GitHubMonitorService.js'
import { loadHistory } from '../github/HistoryStore.js'

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
const REQUIRED_GH_SCOPES = ['read:audit_log', 'read:enterprise', 'manage_billing:copilot']

let monitorService: GitHubMonitorService | null = null
let cachedEnterprise = 'AICraftworks'

async function getStoredEnterprise(): Promise<string> {
  if (keytar) {
    const stored = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ENTERPRISE)
    if (stored) return stored
  }
  return cachedEnterprise
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

function startMonitor(token: string, enterprise: string, getWindow: () => BrowserWindow | null): void {
  if (monitorService) {
    monitorService.stop()
    monitorService = null
  }
  monitorService = new GitHubMonitorService(token, { enterprise })
  monitorService.on('update', (snapshot: MonitorSnapshot) => {
    getWindow()?.webContents.send('hub:snapshot', snapshot)
  })
  monitorService.on('error', (err: Error) => {
    getWindow()?.webContents.send('hub:error', err.message)
  })
  monitorService.start()
}

export function registerHubHandlers(getWindow: () => BrowserWindow | null): void {
  // Get latest snapshot (one-shot request from renderer)
  ipcMain.handle('hub:getSnapshot', () => monitorService?.getSnapshot() ?? null)

  // Return persisted rate limit history for the full chart
  ipcMain.handle('hub:getHistory', () => loadHistory())

  // Returns auth status and enterprise name — no PAT fields
  ipcMain.handle('hub:getTokenConfig', async () => {
    const enterprise = await getStoredEnterprise()
    const ghToken = getGhCliToken()
    const ghScopes = ghToken ? getGhCliScopes() : []
    return {
      hasToken: false,
      enterprise,
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
  ipcMain.handle('hub:beginGitHubLogin', async (_, { enterprise }: { enterprise: string }) => {
    const ent = enterprise.trim() || 'AICraftworks'
    cachedEnterprise = ent
    if (keytar) {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ENTERPRISE, ent)
    }

    try {
      launchGitHubLoginIntegrated(REQUIRED_GH_SCOPES, getWindow)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Unable to launch GitHub login. Ensure GitHub CLI (gh) is installed and in PATH.' }
    }
  })

  // Open github.com/login/device in the default browser (for device flow fallback)
  ipcMain.handle('hub:openDevicePage', () => {
    shell.openExternal('https://github.com/login/device')
    return { ok: true }
  })

  // Verify gh auth status/scopes and start monitoring with gh token
  ipcMain.handle('hub:completeGitHubLogin', async (_, { enterprise }: { enterprise: string }) => {
    const token = getGhCliToken()
    if (!token) {
      return { ok: false, error: 'GitHub login not detected yet. Complete the sign-in flow in your browser first.' }
    }

    const scopes = getGhCliScopes()
    const missing = missingScopes(scopes)
    const ent = enterprise.trim() || (await getStoredEnterprise())
    cachedEnterprise = ent
    if (keytar) {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ENTERPRISE, ent)
    }

    startMonitor(token, ent, getWindow)
    return { ok: true, scopes, missingScopes: missing }
  })

  // Log out of GitHub CLI and stop monitor
  ipcMain.handle('hub:logoutGitHub', async () => {
    try {
      execSync('gh auth logout --hostname github.com --yes', { stdio: 'ignore' })
    } catch {
      // No-op: logout may fail if already logged out
    }

    monitorService?.stop()
    monitorService = null

    return { ok: true }
  })

  // Start monitoring — called when Hub dashboard is first opened
  ipcMain.handle('hub:start', async (_, enterprise?: string) => {
    if (monitorService) return { ok: true }

    const token = getGhCliToken()
    if (!token) return { ok: false, error: 'No GitHub token found. Click "Sign in with GitHub" to authenticate.' }

    const ent = enterprise?.trim() || (await getStoredEnterprise())
    startMonitor(token, ent, getWindow)
    return { ok: true }
  })

  // Stop monitoring
  ipcMain.handle('hub:stop', () => {
    monitorService?.stop()
    monitorService = null
    return { ok: true }
  })

  // Manually refresh all pollers immediately
  ipcMain.handle('hub:refresh', async () => {
    const token = getGhCliToken()
    if (!token) return { ok: false, error: 'No GitHub token' }
    const enterprise = await getStoredEnterprise()
    startMonitor(token, enterprise, getWindow)
    return { ok: true }
  })
}
