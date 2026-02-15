import { EventEmitter } from 'events'
import { canTransition } from '@shared/transitions'
import type { Session, SessionStatus } from '@shared/types'

export class SessionStore extends EventEmitter {
  private sessions = new Map<string, Session>()

  getAll(): Session[] {
    return Array.from(this.sessions.values())
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  add(session: Session): void {
    this.sessions.set(session.id, session)
    this.emit('created', session)
  }

  remove(id: string): void {
    this.sessions.delete(id)
    this.emit('closed', id)
  }

  /**
   * Atomic update for CWD-related fields.
   * folderPath, folderName, and name update together per Naming Rule 6.
   */
  updateCwd(id: string, newPath: string, newFolderName: string): void {
    const session = this.sessions.get(id)
    if (!session) return

    session.folderPath = newPath
    session.folderName = newFolderName
    if (!session.isRenamed) {
      session.name = newFolderName
    }
    session.updatedAt = Date.now()
    this.emit('updated', session)
  }

  /**
   * Status update with transition validation.
   * Invalid transitions are logged and ignored (never thrown).
   */
  updateStatus(id: string, newStatus: SessionStatus): void {
    const session = this.sessions.get(id)
    if (!session) return

    if (!canTransition(session.status, newStatus)) {
      console.warn(
        `[SessionStore] Invalid transition: ${session.status} -> ${newStatus} (session ${id})`
      )
      return
    }

    session.status = newStatus
    session.updatedAt = Date.now()
    this.emit('updated', session)
  }

  /**
   * Promote shell session to agent type.
   * Naming Rule 3: name is NOT changed during agent detection.
   */
  promoteToAgent(id: string, agentType: 'copilot-cli' | 'claude-code'): void {
    const session = this.sessions.get(id)
    if (!session) return

    session.agentType = agentType
    this.updateStatus(id, 'agent_launching')
  }

  /**
   * Manual rename. Naming Rule 4: sticky.
   */
  rename(id: string, newName: string): void {
    const session = this.sessions.get(id)
    if (!session) return

    session.name = newName
    session.isRenamed = true
    session.updatedAt = Date.now()
    this.emit('updated', session)
  }

  updateActivity(id: string, activity: string): void {
    const session = this.sessions.get(id)
    if (!session) return

    session.lastActivity = activity
    session.updatedAt = Date.now()
    this.emit('updated', session)
  }
}
