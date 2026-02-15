import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { PtyManager } from './pty/PtyManager'
import { SessionStore } from './session/SessionStore'
import { SessionManager } from './session/SessionManager'
import { AgentStore } from './agents/AgentStore'
import { AgentLauncher } from './agents/AgentLauncher'
import { registerIpcHandlers } from './ipc/handlers'

let mainWindow: BrowserWindow | null = null

const ptyManager = new PtyManager()
const sessionStore = new SessionStore()
const sessionManager = new SessionManager(sessionStore, ptyManager)
const agentStore = new AgentStore()
const agentLauncher = new AgentLauncher(ptyManager, sessionStore, sessionManager)

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  registerIpcHandlers({
    sessionManager,
    sessionStore,
    ptyManager,
    agentStore,
    agentLauncher,
    getWindow: () => mainWindow
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await agentStore.load()
  createWindow()
})

app.on('window-all-closed', () => {
  ptyManager.dispose()
  app.quit()
})
