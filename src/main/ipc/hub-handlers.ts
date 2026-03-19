// hub-handlers.ts — IPC handlers for GitHub monitoring (Hub dashboard)
// Registers the GitHubMonitorService and pushes snapshots to the renderer.

import { ipcMain, BrowserWindow } from 'electron'
import { execSync } from 'child_process'
import { GitHubMonitorService } from '../github/GitHubMonitorService.js'
import type { MonitorSnapshot } from '../github/GitHubMonitorService.js'

let monitorService: GitHubMonitorService | null = null

function getToken(): string {
  try {
    return execSync('gh auth token', { encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

export function registerHubHandlers(getWindow: () => BrowserWindow | null): void {
  // Get latest snapshot (one-shot request from renderer)
  ipcMain.handle('hub:getSnapshot', () => monitorService?.getSnapshot() ?? null)

  // Start monitoring — called when Hub dashboard is first opened
  ipcMain.handle('hub:start', (_, enterprise?: string) => {
    if (monitorService) return { ok: true }

    const token = getToken()
    if (!token) return { ok: false, error: 'No GitHub token found. Run: gh auth login' }

    monitorService = new GitHubMonitorService(token, enterprise ? { enterprise } : undefined)
    monitorService.on('update', (snapshot: MonitorSnapshot) => {
      getWindow()?.webContents.send('hub:snapshot', snapshot)
    })
    monitorService.on('error', (err: Error) => {
      getWindow()?.webContents.send('hub:error', err.message)
    })
    monitorService.start()
    return { ok: true }
  })

  // Stop monitoring — called when Hub dashboard is closed
  ipcMain.handle('hub:stop', () => {
    monitorService?.stop()
    monitorService = null
    return { ok: true }
  })

  // Manually refresh all pollers immediately
  ipcMain.handle('hub:refresh', () => {
    if (!monitorService) return { ok: false, error: 'Monitor not running' }
    // Restart to trigger immediate polls
    monitorService.stop()
    const token = getToken()
    if (!token) return { ok: false, error: 'No GitHub token' }
    monitorService = new GitHubMonitorService(token)
    monitorService.on('update', (snapshot: MonitorSnapshot) => {
      getWindow()?.webContents.send('hub:snapshot', snapshot)
    })
    monitorService.start()
    return { ok: true }
  })
}
