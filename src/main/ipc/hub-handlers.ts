// hub-handlers.ts — IPC handlers for GitHub monitoring (Hub dashboard)
// Registers the GitHubMonitorService and pushes snapshots to the renderer.

import { ipcMain, BrowserWindow } from 'electron'
import { execSync } from 'child_process'
import { GitHubMonitorService } from '../github/GitHubMonitorService.js'
import type { MonitorSnapshot } from '../github/GitHubMonitorService.js'
import { loadHistory } from '../github/HistoryStore.js'

// Keytar is an optional native module — gracefully degrade if not available
let keytar: {
  getPassword: (svc: string, acc: string) => Promise<string | null>
  setPassword: (svc: string, acc: string, pw: string) => Promise<void>
  deletePassword: (svc: string, acc: string) => Promise<boolean>
} | null = null
try {
  keytar = require('keytar')
} catch {
  // keytar not available — tokens stored in memory only
}

const KEYTAR_SERVICE = 'agentcraftworks-hub'
const KEYTAR_ACCOUNT_TOKEN = 'github-pat'
const KEYTAR_ACCOUNT_ENTERPRISE = 'github-enterprise'

let monitorService: GitHubMonitorService | null = null
let cachedToken = ''
let cachedEnterprise = 'AICraftworks'

async function getStoredToken(): Promise<string> {
  if (keytar) {
    const stored = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_TOKEN)
    if (stored) return stored
  }
  return cachedToken
}

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

  // Returns whether a PAT is configured and the enterprise name
  ipcMain.handle('hub:getTokenConfig', async () => {
    const token = await getStoredToken()
    const enterprise = await getStoredEnterprise()
    return { hasToken: !!token, enterprise, isGhCli: !token }
  })

  // Save a PAT + enterprise name — restarts monitor with new credentials
  ipcMain.handle('hub:setToken', async (_, { token, enterprise }: { token: string; enterprise: string }) => {
    if (!token) return { ok: false, error: 'Token is required' }
    const ent = enterprise.trim() || 'AICraftworks'
    cachedToken = token
    cachedEnterprise = ent
    if (keytar) {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_TOKEN, token)
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_ENTERPRISE, ent)
    }
    startMonitor(token, ent, getWindow)
    return { ok: true }
  })

  // Clear stored token — fall back to gh CLI token
  ipcMain.handle('hub:clearToken', async () => {
    cachedToken = ''
    if (keytar) {
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_TOKEN)
    }
    const token = getGhCliToken()
    const enterprise = await getStoredEnterprise()
    if (token) startMonitor(token, enterprise, getWindow)
    return { ok: true }
  })

  // Start monitoring — called when Hub dashboard is first opened
  ipcMain.handle('hub:start', async (_, enterprise?: string) => {
    if (monitorService) return { ok: true }

    const stored = await getStoredToken()
    const token = stored || getGhCliToken()
    if (!token) return { ok: false, error: 'No GitHub token found. Run: gh auth login OR set a PAT in Settings.' }

    const ent = enterprise ?? (await getStoredEnterprise())
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
    const stored = await getStoredToken()
    const token = stored || getGhCliToken()
    if (!token) return { ok: false, error: 'No GitHub token' }
    const enterprise = await getStoredEnterprise()
    startMonitor(token, enterprise, getWindow)
    return { ok: true }
  })
}