import type { AgentProfile } from '@shared/types'
import type { PtyManager } from '../pty/PtyManager'
import type { SessionStore } from '../session/SessionStore'
import type { SessionManager } from '../session/SessionManager'

function psEscape(value: string): string {
  return value.replace(/'/g, "''")
}

export class AgentLauncher {
  constructor(
    private ptyManager: PtyManager,
    private sessionStore: SessionStore,
    private sessionManager: SessionManager
  ) {}

  launch(agent: AgentProfile, sessionId: string): void {
    let targetSessionId = sessionId

    if (agent.launchTarget === 'newTab') {
      const currentSession = this.sessionStore.get(sessionId)
      if (!currentSession) return
      const newSession = this.sessionManager.create(currentSession.folderPath)
      targetSessionId = newSession.id
    }

    const targetSession = this.sessionStore.get(targetSessionId)
    if (!targetSession) return

    const lines: string[] = []

    if (agent.env) {
      for (const [key, value] of Object.entries(agent.env)) {
        lines.push(`$env:${key} = '${psEscape(value)}'`)
      }
    }

    const args = agent.args.map(a => `'${psEscape(a)}'`).join(' ')
    const cmd = args ? `${agent.command} ${args}` : agent.command
    lines.push(cmd)

    const payload = lines.join('\r') + '\r'
    this.ptyManager.write(targetSession.ptyId, payload)

    const agentType = agent.command.includes('copilot') ? 'copilot-cli' as const
                    : agent.command.includes('claude') ? 'claude-code' as const
                    : 'shell' as const

    if (agentType !== 'shell') {
      this.sessionStore.promoteToAgent(targetSessionId, agentType)
    }
  }
}
