import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { spawn } from 'child_process'
import type { SessionManager } from '../session/SessionManager'
import type { SessionStore } from '../session/SessionStore'
import type { PtyManager } from '../pty/PtyManager'
import type { AgentStore } from '../agents/AgentStore'
import type { AgentLauncher } from '../agents/AgentLauncher'
import type { ConfigStore } from '../config/ConfigStore'

export function registerIpcHandlers(deps: {
  sessionManager: SessionManager
  sessionStore: SessionStore
  ptyManager: PtyManager
  agentStore: AgentStore
  agentLauncher: AgentLauncher
  configStore: ConfigStore
  getWindow: () => BrowserWindow | null
}): void {
  const { sessionManager, sessionStore, ptyManager, agentStore, agentLauncher, configStore, getWindow } = deps

  // --- Sessions ---
  ipcMain.handle('session:getAll', () => sessionStore.getAll())
  ipcMain.handle('session:create', () => sessionManager.create(configStore.getStartFolder()))
  ipcMain.handle('session:close', (_, id: string) => sessionManager.close(id))
  ipcMain.handle('session:select', (_, id: string) => sessionManager.select(id))
  ipcMain.handle('session:rename', (_, id: string, name: string) => sessionStore.rename(id, name))
  ipcMain.handle('session:scanExternal', () => sessionManager.scanExternal())

  // Forward store events to renderer
  sessionStore.on('created', (session) => {
    getWindow()?.webContents.send('session:created', session)
  })
  sessionStore.on('updated', (session) => {
    getWindow()?.webContents.send('session:updated', session)
  })
  sessionStore.on('closed', (sessionId) => {
    getWindow()?.webContents.send('session:closed', sessionId)
  })

  // --- Terminal ---
  ipcMain.on('terminal:write', (_, sessionId: string, data: string) => {
    const session = sessionStore.get(sessionId)
    if (session) ptyManager.write(session.ptyId, data)
  })

  ipcMain.on('terminal:resize', (_, sessionId: string, cols: number, rows: number) => {
    const session = sessionStore.get(sessionId)
    if (session) ptyManager.resize(session.ptyId, cols, rows)
  })

  // PTY data -> renderer (set up per session when created)
  ipcMain.handle('terminal:attach', (_, sessionId: string) => {
    const session = sessionStore.get(sessionId)
    if (!session) return
    const proc = ptyManager.get(session.ptyId)
    if (!proc) return
    proc.onData((data) => {
      getWindow()?.webContents.send(`terminal:data:${sessionId}`, data)
    })
  })

  // --- Agents ---
  ipcMain.handle('agents:getGroups', () => agentStore.getGroups())
  ipcMain.handle('agents:saveGroups', async (_, groups) => {
    await agentStore.save(groups)
    getWindow()?.webContents.send('agents:updated', groups)
  })
  ipcMain.handle('agents:launch', (_, agentId: string, sessionId: string) => {
    const agent = agentStore.findAgent(agentId)
    if (agent) agentLauncher.launch(agent, sessionId)
  })

  // --- Session Metrics ---
  ipcMain.handle('session:getMetrics', (_, sessionId: string) => {
    const session = sessionStore.get(sessionId)
    return session?.metrics ?? null
  })

  // --- Dialog ---
  ipcMain.handle('dialog:openFolder', async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('dialog:openFile', async (_, filters) => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: filters || [],
      title: 'Select file'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // --- Shell ---
  ipcMain.handle('shell:openInVSCode', (_, folderPath: string) => {
    spawn('code-insiders', [folderPath], { shell: true, detached: true, stdio: 'ignore' }).unref()
  })

  ipcMain.handle('shell:openInExplorer', (_, folderPath: string) => {
    shell.openPath(folderPath)
  })

  // --- App ---
  let zoomLevel = 14
  ipcMain.handle('app:getZoom', () => zoomLevel)
  ipcMain.handle('app:setZoom', (_, level: number) => {
    zoomLevel = Math.max(8, Math.min(32, level))
    getWindow()?.webContents.send('app:zoomChanged', zoomLevel)
    return zoomLevel
  })
}
