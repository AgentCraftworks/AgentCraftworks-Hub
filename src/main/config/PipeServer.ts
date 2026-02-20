import { createServer, type Server, type Socket } from 'net'
import { platform } from 'os'
import { unlinkSync } from 'fs'
import { v4 as uuid } from 'uuid'
import type { ConfigStore } from './ConfigStore'
import type { AgentStore } from '../agents/AgentStore'
import type { AgentProfile } from '@shared/types'

const PIPE_PATH =
  platform() === 'win32'
    ? '\\\\.\\pipe\\tangent-config'
    : '/tmp/tangent-config.sock'

interface RpcRequest {
  method: string
  params?: Record<string, unknown>
}

interface RpcResponse {
  result?: unknown
  error?: string
}

export class PipeServer {
  private server: Server | null = null
  private readonly configStore: ConfigStore
  private readonly agentStore: AgentStore

  constructor(configStore: ConfigStore, agentStore: AgentStore) {
    this.configStore = configStore
    this.agentStore = agentStore
  }

  start(): void {
    // Clean up stale socket on Unix
    if (platform() !== 'win32') {
      try {
        unlinkSync(PIPE_PATH)
      } catch {
        // ignore
      }
    }

    this.server = createServer((socket: Socket) => {
      let buffer = ''
      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8')
        let newlineIdx: number
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim()
          buffer = buffer.slice(newlineIdx + 1)
          if (line.length > 0) {
            this.handleMessage(line, socket)
          }
        }
      })
      socket.on('error', (err) => {
        console.warn('[PipeServer] Socket error:', err.message)
      })
    })

    this.server.on('error', (err) => {
      console.error('[PipeServer] Server error:', err.message)
    })

    this.server.listen(PIPE_PATH, () => {
      console.log(`[PipeServer] Listening on ${PIPE_PATH}`)
    })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }
    if (platform() !== 'win32') {
      try {
        unlinkSync(PIPE_PATH)
      } catch {
        // ignore
      }
    }
  }

  private handleMessage(line: string, socket: Socket): void {
    let request: RpcRequest
    try {
      request = JSON.parse(line)
    } catch {
      this.send(socket, { error: 'Invalid JSON' })
      return
    }

    const response = this.dispatch(request)
    this.send(socket, response)
  }

  private dispatch(request: RpcRequest): RpcResponse {
    switch (request.method) {
      case 'config.get':
        return { result: this.configStore.getAll() }

      case 'config.set': {
        const key = request.params?.key as string | undefined
        const value = request.params?.value
        if (!key) return { error: 'Missing "key" param' }
        this.configStore.set(key, value)
        return { result: 'ok' }
      }

      case 'agents.list':
        return { result: this.agentStore.getGroups() }

      case 'agents.add': {
        const folderName = request.params?.folder as string | undefined
        const agentData = request.params?.agent as Partial<AgentProfile> | undefined
        if (!folderName || !agentData?.name || !agentData?.command) {
          return { error: 'Missing "folder", "agent.name", or "agent.command" param' }
        }
        const folders = this.agentStore.getGroups()
        const folder = folders.find((f) => f.name === folderName)
        if (!folder) {
          return { error: `Folder "${folderName}" not found` }
        }
        const newAgent: AgentProfile = {
          id: uuid(),
          name: agentData.name,
          command: agentData.command,
          args: agentData.args ?? [],
          cwdMode: agentData.cwdMode ?? 'activeSession',
          launchTarget: agentData.launchTarget ?? 'currentTab'
        }
        folder.agents.push(newAgent)
        this.agentStore.save(folders).catch((err) => {
          console.warn('[PipeServer] Failed to save agents:', err)
        })
        return { result: 'ok' }
      }

      default:
        return { error: `Unknown method: ${request.method}` }
    }
  }

  private send(socket: Socket, response: RpcResponse): void {
    try {
      socket.write(JSON.stringify(response) + '\n')
    } catch {
      // socket may be closed
    }
  }
}
