#!/usr/bin/env node

// tangent-mcp-server.js — MCP (Model Context Protocol) server for Tangent
// Implements MCP over stdio, proxies commands to Tangent's named pipe server.
//
// Usage (in MCP client config):
//   { "command": "node", "args": ["scripts/tangent-mcp-server.js"] }

const net = require('net')
const os = require('os')
const readline = require('readline')

const PIPE_PATH =
  os.platform() === 'win32'
    ? '\\\\.\\pipe\\tangent-config'
    : '/tmp/tangent-config.sock'

const SERVER_INFO = {
  name: 'tangent',
  version: '0.1.0'
}

const PROTOCOL_VERSION = '2024-11-05'

// ── Tool definitions ──

const TOOLS = [
  {
    name: 'tangent_config_get',
    description: 'Get Tangent configuration (editor, fontSize, startFolder)',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'tangent_config_set',
    description: 'Set a Tangent configuration value',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Config key (editor, fontSize, startFolder)' },
        value: { type: 'string', description: 'Value to set' }
      },
      required: ['key', 'value']
    }
  },
  {
    name: 'tangent_projects_list',
    description: 'List project folders configured in Tangent',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'tangent_projects_add',
    description: 'Add a new project folder to Tangent',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project folder name' }
      },
      required: ['name']
    }
  },
  {
    name: 'tangent_projects_remove',
    description: 'Remove a project folder from Tangent',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project folder name to remove' }
      },
      required: ['name']
    }
  },
  {
    name: 'tangent_agents_list',
    description: 'List all agents across all project folders',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'tangent_agents_add',
    description: 'Add an agent to a project folder',
    inputSchema: {
      type: 'object',
      properties: {
        folder: { type: 'string', description: 'Project folder name' },
        name: { type: 'string', description: 'Agent display name' },
        command: { type: 'string', description: 'Command to run (e.g. copilot, claude)' },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional command arguments'
        }
      },
      required: ['folder', 'name', 'command']
    }
  },
  {
    name: 'tangent_agents_remove',
    description: 'Remove an agent by name',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Agent name to remove' }
      },
      required: ['name']
    }
  }
]

// ── Named pipe client ──

function sendToPipe(message) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(PIPE_PATH, () => {
      client.write(JSON.stringify(message) + '\n')
    })
    let buffer = ''
    client.on('data', (chunk) => {
      buffer += chunk.toString('utf-8')
      const idx = buffer.indexOf('\n')
      if (idx !== -1) {
        const line = buffer.slice(0, idx).trim()
        client.end()
        try {
          resolve(JSON.parse(line))
        } catch {
          reject(new Error('Invalid JSON from Tangent: ' + line))
        }
      }
    })
    client.on('error', (err) => {
      reject(new Error('Cannot connect to Tangent. Is it running? ' + err.message))
    })
  })
}

// ── Tool → pipe mapping ──

const TOOL_MAP = {
  tangent_config_get: (args) => ({ method: 'config.get' }),
  tangent_config_set: (args) => ({ method: 'config.set', params: { key: args.key, value: args.value } }),
  tangent_projects_list: (args) => ({ method: 'projects.list' }),
  tangent_projects_add: (args) => ({ method: 'projects.add', params: { name: args.name } }),
  tangent_projects_remove: (args) => ({ method: 'projects.remove', params: { name: args.name } }),
  tangent_agents_list: (args) => ({ method: 'agents.list' }),
  tangent_agents_add: (args) => ({
    method: 'agents.add',
    params: { folder: args.folder, agent: { name: args.name, command: args.command, args: args.args || [] } }
  }),
  tangent_agents_remove: (args) => ({ method: 'agents.remove', params: { name: args.name } })
}

// ── MCP request handlers ──

function handleInitialize(id, params) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO
    }
  }
}

function handleToolsList(id) {
  return {
    jsonrpc: '2.0',
    id,
    result: { tools: TOOLS }
  }
}

async function handleToolsCall(id, params) {
  const toolName = params?.name
  const args = params?.arguments || {}

  const mapper = TOOL_MAP[toolName]
  if (!mapper) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }],
        isError: true
      }
    }
  }

  try {
    const pipeMsg = mapper(args)
    const response = await sendToPipe(pipeMsg)
    if (response.error) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify({ error: response.error }) }],
          isError: true
        }
      }
    }
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: JSON.stringify(response.result, null, 2) }]
      }
    }
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
        isError: true
      }
    }
  }
}

// ── stdio transport ──

function writeLine(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

async function processMessage(line) {
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    writeLine({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
    return
  }

  const { id, method, params } = msg

  // Notifications (no id) — just acknowledge silently
  if (id === undefined || id === null) {
    if (method === 'notifications/initialized') {
      // Client acknowledged initialization — no response needed
    }
    return
  }

  let response
  switch (method) {
    case 'initialize':
      response = handleInitialize(id, params)
      break
    case 'tools/list':
      response = handleToolsList(id)
      break
    case 'tools/call':
      response = await handleToolsCall(id, params)
      break
    default:
      response = {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      }
  }

  writeLine(response)
}

// ── Main ──

let pending = 0
let inputClosed = false

function checkExit() {
  if (inputClosed && pending === 0) process.exit(0)
}

const rl = readline.createInterface({ input: process.stdin, terminal: false })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (trimmed.length > 0) {
    pending++
    processMessage(trimmed).finally(() => { pending--; checkExit() })
  }
})
rl.on('close', () => { inputClosed = true; checkExit() })

// Suppress unhandled rejection crashes
process.on('unhandledRejection', (err) => {
  process.stderr.write(`[tangent-mcp-server] Error: ${err}\n`)
})
