import path from 'path'
import { OscParser } from './OscParser'
import { SystemB } from './SystemB'
import { SystemA } from './SystemA'
import type { SessionStore } from '../session/SessionStore'
import type { SessionStatus } from '@shared/types'

/**
 * StatusEngine — One instance per session.
 *
 * Receives PTY output and coordinates all detection systems:
 *   - OscParser: extracts OSC escape sequences (title, progress, cwd, shell-integration)
 *   - System B: output-pattern-based status detection
 *   - System A: file-watcher-based status detection (higher priority)
 *
 * Priority: System A (when active) overrides System B for status.
 * System B always runs for lastActivity extraction.
 * OSC progress signals are high-priority hints within System B detection.
 */
export class StatusEngine {
  private oscParser: OscParser
  private systemB: SystemB
  private systemA: SystemA
  private systemAActive = false
  private disposed = false

  constructor(
    private sessionId: string,
    private ptyId: string,
    private store: SessionStore
  ) {
    this.oscParser = new OscParser()
    this.systemB = new SystemB()
    this.systemA = new SystemA(ptyId)

    this.wireOscParser()
    this.wireSystemB()
    this.wireSystemA()
  }

  /**
   * Main entry point for PTY output.
   * Feeds data through OscParser first, then SystemB.
   */
  feed(data: string): void {
    if (this.disposed) return
    this.oscParser.feed(data)
    this.systemB.feed(data)
  }

  /**
   * Handle PTY process exit. Immediately set status to 'exited'.
   */
  handlePtyExit(exitCode: number): void {
    if (this.disposed) return
    const session = this.store.get(this.sessionId)
    if (session) {
      session.exitCode = exitCode
      this.store.updateStatus(this.sessionId, 'exited')
    }
  }

  /**
   * Clean up all sub-systems.
   */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.oscParser.removeAllListeners()
    this.systemB.dispose()
    this.systemA.dispose()
  }

  private wireOscParser(): void {
    // OSC title changes -> update lastActivity
    this.oscParser.on('title', (title: string) => {
      this.store.updateActivity(this.sessionId, title)
    })

    // OSC progress signals: high-priority status hints
    this.oscParser.on('progress', (state: number) => {
      let status: SessionStatus | null = null
      switch (state) {
        case 1: // indeterminate -> processing
        case 2: // normal -> processing
          status = 'processing'
          break
        case 0: // hidden -> agent_ready
          status = 'agent_ready'
          break
        case 3: // error -> failed
          status = 'failed'
          break
      }

      if (status) {
        this.store.updateStatus(this.sessionId, status)
      }
    })

    // OSC CWD changes -> update session CWD
    this.oscParser.on('cwd', (cwdPath: string) => {
      const folderName = path.basename(cwdPath)
      this.store.updateCwd(this.sessionId, cwdPath, folderName)
    })

    // BEL events are informational — no status change
    // Shell integration marks — no status change needed here
  }

  private wireSystemB(): void {
    // System B status: only use if System A is not active
    this.systemB.on('status', (status: SessionStatus) => {
      if (!this.systemAActive) {
        this.store.updateStatus(this.sessionId, status)
      }
    })

    // System B activity: always forward regardless of System A state
    this.systemB.on('activity', (activity: string) => {
      this.store.updateActivity(this.sessionId, activity)
    })
  }

  private wireSystemA(): void {
    // System A activated: take over status from System B
    this.systemA.on('activate', () => {
      this.systemAActive = true
    })

    // System A status: always applied when active (higher priority)
    this.systemA.on('status', (status: SessionStatus) => {
      if (this.systemAActive) {
        this.store.updateStatus(this.sessionId, status)
      }
    })

    // System A activity: forward detail strings
    this.systemA.on('activity', (activity: string) => {
      this.store.updateActivity(this.sessionId, activity)
    })

    // System A deactivated: fall back to System B
    this.systemA.on('deactivate', () => {
      this.systemAActive = false
    })
  }
}
