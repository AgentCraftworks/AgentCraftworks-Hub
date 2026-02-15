import { ipcMain, BrowserWindow } from 'electron'
import type { SessionManager } from '../session/SessionManager'
import type { SessionStore } from '../session/SessionStore'
import type { PtyManager } from '../pty/PtyManager'
import type { AgentStore } from '../agents/AgentStore'
import type { AgentLauncher } from '../agents/AgentLauncher'

export function registerIpcHandlers(deps: {
  sessionManager: SessionManager
  sessionStore: SessionStore
  ptyManager: PtyManager
  agentStore: AgentStore
  agentLauncher: AgentLauncher
  getWindow: () => BrowserWindow | null
}): void {
  const { sessionManager, sessionStore, ptyManager, agentStore, agentLauncher, getWindow } = deps

  // --- Sessions ---
  ipcMain.handle('session:getAll', () => sessionStore.getAll())
  ipcMain.handle('session:create', () => sessionManager.create())
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
  })
  ipcMain.handle('agents:launch', (_, agentId: string, sessionId: string) => {
    const agent = agentStore.findAgent(agentId)
    if (agent) agentLauncher.launch(agent, sessionId)
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
