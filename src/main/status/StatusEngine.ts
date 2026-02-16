import { OscParser } from './OscParser'
import { SystemB } from './SystemB'
import { SystemA } from './SystemA'
import { CwdTracker } from './CwdTracker'
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
  private cwdTracker: CwdTracker
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
    this.cwdTracker = new CwdTracker(sessionId, store)

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
    this.cwdTracker.handleOutput(data)
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
    // OSC title changes -> update lastActivity only for agent sessions
    // Shell sessions use command extraction instead (more useful than process title)
    this.oscParser.on('title', (title: string) => {
      const session = this.store.get(this.sessionId)
      if (!session || session.agentType === 'shell') return
      let clean = title.trim()
      // Strip Copilot CLI's emoji prefix (🤖) from the title to get just the intent
      clean = clean.replace(/^🤖\s*/, '').replace(/^Copilot:\s*/i, '')
      if (clean && clean.length < 100 && !clean.includes('\x1b') && !clean.includes('\x07')) {
        // Don't overwrite activity with just the app name
        if (clean === 'GitHub Copilot' || clean === 'Copilot') return
        this.store.updateActivity(this.sessionId, clean)
      }
    })

    // OSC 9;4 progress signals — high-priority status hints.
    // Windows Terminal spec: 0=hidden, 1=normal, 2=error, 3=indeterminate, 4=warning
    // Copilot CLI emits: state 3 (indeterminate) when thinking, state 0 (hidden) between turns.
    //
    // IMPORTANT: State 0 (hidden) does NOT reliably mean "idle" for agent sessions.
    // The CLI clears progress between individual tool calls within the same turn,
    // causing flicker. Only state 3 → processing is reliable from OSC.
    // For idle detection, we rely on SystemB prompt detection (❯ + silence).
    this.oscParser.on('progress', (state: number) => {
      let status: SessionStatus | null = null
      switch (state) {
        case 3: // indeterminate -> processing (CLI sends this when thinking)
        case 1: // normal -> processing
          status = 'processing'
          break
        case 0: {
          // hidden — only trust for shell sessions. For agent sessions,
          // the CLI clears progress between tool calls mid-turn, which
          // would falsely set agent_ready while the agent is still working.
          const session = this.store.get(this.sessionId)
          if (session && session.agentType === 'shell') {
            status = 'agent_ready'
          }
          break
        }
        case 2: {
          // error — only trust for shell sessions (spurious during agent sessions)
          const session = this.store.get(this.sessionId)
          if (session && session.agentType === 'shell') {
            status = 'failed'
          }
          break
        }
      }

      if (status) {
        this.store.updateStatus(this.sessionId, status)
      }
    })

    // OSC CWD changes -> route through CwdTracker for dedup
    this.oscParser.on('cwd', (cwdPath: string) => {
      this.cwdTracker.handleOscCwd(cwdPath)
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

    // Shell command extraction -> update lastActivity with last typed command
    this.systemB.on('command', (command: string) => {
      this.store.updateActivity(this.sessionId, command)
    })

    // Agent detected from output — promote the session
    this.systemB.on('agent-detected', (agentType: 'copilot-cli' | 'claude-code') => {
      const session = this.store.get(this.sessionId)
      // Only promote if session is in agent_launching state — prevents false
      // positives when agent names appear in normal shell output (e.g. `dir`)
      if (session && session.agentType === 'shell' && session.status === 'agent_launching') {
        this.store.promoteToAgent(this.sessionId, agentType)
      }
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
