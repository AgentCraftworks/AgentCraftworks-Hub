// RateGovernorPoller.ts — Polls .squad/rate-state.json + .squad/rate-pool.json every 5s
// Emits 'data' with HubRateGovernorData snapshot.

import { EventEmitter } from 'events'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { HubRateGovernorData, HubRateGovernorAgent } from '@shared/hub-types'

function findSquadDir(): string | null {
  // Look for .squad/ in cwd or home
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

export class RateGovernorPoller extends EventEmitter {
  private intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(intervalMs: number = 5000) {
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
      // No .squad/ directory — emit demo data
      this.emit('data', this.getDemoData())
      return
    }

    try {
      const state = readJsonSafe<{
        trafficLight?: string
        circuitState?: string
        cascadeMode?: string
      }>(join(squadDir, 'rate-state.json'), {})

      const pool = readJsonSafe<{
        github?: { windowTotal?: number; windowRemaining?: number; donationPool?: number; agentAllocations?: Record<string, any> }
        copilot?: { windowTotal?: number; windowRemaining?: number; donationPool?: number; agentAllocations?: Record<string, any> }
      }>(join(squadDir, 'rate-pool.json'), {})

      const githubPool = pool.github || {}
      const copilotPool = pool.copilot || {}

      // Extract agents from allocations
      const agents: HubRateGovernorAgent[] = []
      for (const [agentId, alloc] of Object.entries(githubPool.agentAllocations || {})) {
        agents.push({
          agentId,
          priority: alloc.priority || 'P1',
          reserved: alloc.reserved || 0,
          used: alloc.used || 0,
          quotaType: 'github',
        })
      }
      for (const [agentId, alloc] of Object.entries(copilotPool.agentAllocations || {})) {
        if (!agents.find(a => a.agentId === agentId)) {
          agents.push({
            agentId,
            priority: alloc.priority || 'P1',
            reserved: alloc.reserved || 0,
            used: alloc.used || 0,
            quotaType: 'copilot',
          })
        }
      }

      const data: HubRateGovernorData = {
        state: {
          trafficLight: (state.trafficLight as any) || 'GREEN',
          circuitState: (state.circuitState as any) || 'CLOSED',
          circuitStateByQuota: {
            github: 'CLOSED',
            copilot: 'CLOSED',
          },
          cascadeMode: (state.cascadeMode as any) || 'parallel',
        },
        github: {
          windowTotal: githubPool.windowTotal || 5000,
          windowRemaining: githubPool.windowRemaining || 5000,
          donationPool: githubPool.donationPool || 0,
        },
        copilot: {
          windowTotal: copilotPool.windowTotal || 5000,
          windowRemaining: copilotPool.windowRemaining || 5000,
          donationPool: copilotPool.donationPool || 0,
        },
        agents,
      }

      this.emit('data', data)
    } catch (err) {
      this.emit('error', `RateGovernorPoller: ${err}`)
      this.emit('data', this.getDemoData())
    }
  }

  private getDemoData(): HubRateGovernorData {
    return {
      state: {
        trafficLight: 'GREEN',
        circuitState: 'CLOSED',
        circuitStateByQuota: { github: 'CLOSED', copilot: 'CLOSED' },
        cascadeMode: 'parallel',
      },
      github: { windowTotal: 5000, windowRemaining: 4200, donationPool: 200 },
      copilot: { windowTotal: 5000, windowRemaining: 4800, donationPool: 0 },
      agents: [
        { agentId: 'pr-scanner-01', priority: 'P0', reserved: 12, used: 8, quotaType: 'github' },
        { agentId: 'code-reviewer-02', priority: 'P1', reserved: 8, used: 5, quotaType: 'github' },
        { agentId: 'doc-generator-03', priority: 'P1', reserved: 8, used: 3, quotaType: 'copilot' },
        { agentId: 'test-writer-04', priority: 'P2', reserved: 4, used: 2, quotaType: 'copilot' },
        { agentId: 'deploy-bot-05', priority: 'P0', reserved: 15, used: 12, quotaType: 'github' },
      ],
    }
  }
}
