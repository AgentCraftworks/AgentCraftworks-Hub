import { v4 as uuid } from 'uuid'
import path from 'path'
import { SessionStore } from './SessionStore'
import { PtyManager } from '../pty/PtyManager'
import type { Session } from '@shared/types'

export class SessionManager {
  private activeSessionId: string | null = null

  constructor(
    private store: SessionStore,
    private ptyManager: PtyManager
  ) {
    this.ptyManager.on('exit', (ptyId: string, exitCode: number) => {
      const session = this.findByPtyId(ptyId)
      if (session) {
        session.exitCode = exitCode
        this.store.updateStatus(session.id, 'exited')
      }
    })
  }

  create(cwd?: string): Session {
    const workingDir = cwd || process.env.USERPROFILE || 'C:\\'
    const folderName = path.basename(workingDir)
    const sessionId = uuid()
    const ptyId = uuid()

    const proc = this.ptyManager.spawn(ptyId, workingDir)

    const session: Session = {
      id: sessionId,
      agentType: 'shell',
      name: folderName,
      folderName,
      folderPath: workingDir,
      isRenamed: false,
      status: 'shell_ready',
      lastActivity: '',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      ptyId,
      isExternal: false
    }

    this.store.add(session)
    this.activeSessionId = sessionId
    return session
  }

  close(sessionId: string): void {
    const session = this.store.get(sessionId)
    if (!session) return

    this.ptyManager.kill(session.ptyId)
    this.store.remove(sessionId)

    if (this.activeSessionId === sessionId) {
      const remaining = this.store.getAll()
      this.activeSessionId = remaining.length > 0 ? remaining[0].id : null
    }
  }

  select(sessionId: string): void {
    this.activeSessionId = sessionId
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId
  }

  getActiveSession(): Session | undefined {
    return this.activeSessionId
      ? this.store.get(this.activeSessionId)
      : undefined
  }

  private findByPtyId(ptyId: string): Session | undefined {
    return this.store.getAll().find(s => s.ptyId === ptyId)
  }
}
