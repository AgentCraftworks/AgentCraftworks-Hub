import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { v4 as uuid } from 'uuid'
import type { AgentGroup, AgentStoreData } from '@shared/types'

const STORE_DIR = join(homedir(), '.tangent')
const STORE_PATH = join(STORE_DIR, 'agents.json')

function defaultGroups(): AgentGroup[] {
  return [
    {
      id: uuid(),
      name: 'Agents',
      agents: [
        {
          id: uuid(),
          name: 'Copilot CLI',
          command: 'copilot',
          args: [],
          cwdMode: 'activeSession',
          launchTarget: 'currentTab'
        },
        {
          id: uuid(),
          name: 'Claude Code',
          command: 'claude',
          args: [],
          cwdMode: 'activeSession',
          launchTarget: 'currentTab'
        }
      ]
    }
  ]
}

export class AgentStore {
  private groups: AgentGroup[] = []

  async load(): Promise<AgentGroup[]> {
    try {
      const data = await readFile(STORE_PATH, 'utf-8')
      const parsed: AgentStoreData = JSON.parse(data)
      if (parsed.version === 2) {
        this.groups = parsed.groups
      } else {
        this.groups = defaultGroups()
      }
    } catch {
      this.groups = defaultGroups()
    }
    return this.groups
  }

  async save(groups: AgentGroup[]): Promise<void> {
    this.groups = groups
    const data: AgentStoreData = { version: 2, groups }
    await mkdir(STORE_DIR, { recursive: true })
    await writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8')
  }

  getGroups(): AgentGroup[] {
    return this.groups
  }

  findAgent(agentId: string) {
    for (const group of this.groups) {
      const agent = group.agents.find(a => a.id === agentId)
      if (agent) return agent
    }
    return undefined
  }
}
