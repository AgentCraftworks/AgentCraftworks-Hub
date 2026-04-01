// SquadStatePoller.ts — Polls .squad/team-config.json + history/ every 10s
// Emits 'data' with HubSquadData snapshot.

import { EventEmitter } from 'events'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { HubSquadData, HubSquadInfo, HubRoutingDecision, HubSquadHandoff } from '@shared/hub-types'

function findSquadDir(): string | null {
  const candidates = [
    join(process.cwd(), '.squad'),
    join(homedir(), '.agentcraftworks', '.squad'),
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  return null
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

export class SquadStatePoller extends EventEmitter {
  private intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(intervalMs: number = 10000) {
    super()
    this.intervalMs = intervalMs
  }

  start(): void {
    this.poll()
    this.timer = setInterval(() => this.poll(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  private poll(): void {
    const squadDir = findSquadDir()
    if (!squadDir) {
      this.emit('data', this.getDemoData())
      return
    }

    try {
      const config = readJsonSafe<{
        squadId?: string
        squadCeiling?: number
        agents?: Array<{
          id: string
          name?: string
          engagementLevel?: number
          ratePriority?: string
          skills?: string[]
        }>
        defaultLane?: string
      }>(join(squadDir, 'team-config.json'), {})

      // Build squad info from config
      const squads: HubSquadInfo[] = []
      if (config.squadId || config.agents) {
        squads.push({
          squadId: config.squadId || 'default',
          ceiling: config.squadCeiling || 3,
          agents: (config.agents || []).map(a => ({
            id: a.id,
            name: a.name || a.id,
            engagementLevel: a.engagementLevel || 1,
            priority: (a.ratePriority as any) || 'P1',
            skills: a.skills || [],
          })),
          defaultLane: config.defaultLane || 'lane-implementation',
        })
      }

      // Read recent routing decisions from history/
      const recentRouting: HubRoutingDecision[] = []
      const historyDir = join(squadDir, 'history')
      if (existsSync(historyDir)) {
        const files = readdirSync(historyDir).filter(f => f.endsWith('.json')).slice(-5)
        for (const file of files) {
          const history = readJsonSafe<Array<{
            timestamp?: number
            toolName?: string
            path?: string
            durationMs?: number
            success?: boolean
          }>>(join(historyDir, file), [])

          const agentId = file.replace('.json', '')
          for (const entry of history.slice(-3)) {
            recentRouting.push({
              agentId,
              toolName: entry.toolName || 'unknown',
              reason: `Routed via ${entry.path || 'MCP'}`,
              responseMode: 'STANDARD',
              zone: 'GREEN',
              allowed: entry.success !== false,
              timestamp: entry.timestamp || Date.now(),
            })
          }
        }
      }

      // Sort by timestamp descending
      recentRouting.sort((a, b) => b.timestamp - a.timestamp)

      const data: HubSquadData = {
        squads: squads.length > 0 ? squads : this.getDemoData().squads,
        recentRouting: recentRouting.length > 0 ? recentRouting.slice(0, 10) : this.getDemoData().recentRouting,
        squadHandoffs: this.getDemoData().squadHandoffs, // TODO: read from squad-handoff bus
      }

      this.emit('data', data)
    } catch (err) {
      this.emit('error', `SquadStatePoller: ${err}`)
      this.emit('data', this.getDemoData())
    }
  }

  private getDemoData(): HubSquadData {
    const now = Date.now()
    return {
      squads: [
        {
          squadId: 'squad-alpha',
          ceiling: 3,
          agents: [
            { id: 'pr-scanner-01', name: 'PR Scanner', engagementLevel: 3, priority: 'P0', skills: ['triage', 'labeling'] },
            { id: 'code-reviewer-02', name: 'Code Reviewer', engagementLevel: 3, priority: 'P1', skills: ['review', 'security'] },
            { id: 'test-writer-04', name: 'Test Writer', engagementLevel: 2, priority: 'P2', skills: ['testing', 'coverage'] },
          ],
          defaultLane: 'lane-interactive',
        },
        {
          squadId: 'squad-beta',
          ceiling: 4,
          agents: [
            { id: 'deploy-bot-05', name: 'Deploy Bot', engagementLevel: 4, priority: 'P0', skills: ['deploy', 'rollback'] },
            { id: 'doc-generator-03', name: 'Doc Generator', engagementLevel: 2, priority: 'P1', skills: ['documentation', 'api-docs'] },
          ],
          defaultLane: 'lane-implementation',
        },
      ],
      recentRouting: [
        { agentId: 'pr-scanner-01', toolName: 'github_list_pulls', reason: 'MCP prefix match', responseMode: 'DIRECT', zone: 'GREEN', allowed: true, timestamp: now - 60000 },
        { agentId: 'code-reviewer-02', toolName: 'review_diff', reason: 'Skill match: review', responseMode: 'STANDARD', zone: 'GREEN', allowed: true, timestamp: now - 120000 },
        { agentId: 'deploy-bot-05', toolName: 'deploy_staging', reason: 'Priority routing P0', responseMode: 'FULL', zone: 'AMBER', allowed: true, timestamp: now - 180000 },
        { agentId: 'test-writer-04', toolName: 'run_tests', reason: 'Default lane assignment', responseMode: 'LIGHTWEIGHT', zone: 'AMBER', allowed: false, timestamp: now - 240000 },
      ],
      squadHandoffs: [
        { fromSquadId: 'squad-alpha', toSquadId: 'squad-beta', type: 'request-response', priority: 'P0', status: 'active' },
        { fromSquadId: 'squad-beta', toSquadId: 'squad-alpha', type: 'event-broadcast', priority: 'P1', status: 'completed' },
      ],
    }
  }
}
