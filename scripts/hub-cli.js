#!/usr/bin/env node

// hub-cli.js — CLI to talk to AgentCraftworks Hub's named pipe server
// Extends tangent-cli with hub monitoring commands.
//
// Usage:
//   hub help
//   hub config get
//   hub config set <key> <value>
//   hub agents list
//   hub agents add <folder> --name <name> --command <cmd>
//   hub projects list
//   hub monitor          (launches terminal dashboard — requires hub-monitor package)
//   hub status           (single-line rate limit summary)

const net = require('net')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { execSync, execFileSync, spawn } = require('child_process')

const PIPE_PATH =
  os.platform() === 'win32'
    ? '\\\\.\\pipe\\agentcraftworks-hub-config'
    : '/tmp/agentcraftworks-hub-config.sock'

const HUB_DATA_DIR = path.join(os.homedir(), '.agentcraftworks-hub')
const OPLOG_PATH = path.join(HUB_DATA_DIR, 'operation-log.json')
const ACTION_REQUEST_PATH = path.join(HUB_DATA_DIR, 'action-requests.json')

function send(message) {
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
          reject(new Error('Invalid JSON response: ' + line))
        }
      }
    })

    client.on('error', (err) => {
      reject(new Error('Cannot connect to AgentCraftworks Hub. Is it running? ' + err.message))
    })
  })
}

function parseFlags(args, startIdx) {
  const flags = {}
  for (let i = startIdx; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) flags.name = args[++i]
    else if (args[i] === '--command' && args[i + 1]) flags.command = args[++i]
    else if (args[i] === '--args' && args[i + 1]) flags.args = args[++i].split(/\s+/)
    else if (args[i] === '--scope' && args[i + 1]) flags.scope = args[++i]
    else if (args[i] === '--persona' && args[i + 1]) flags.persona = args[++i]
    else if (args[i] === '--limit' && args[i + 1]) flags.limit = Number(args[++i])
    else if (args[i] === '--surface' && args[i + 1]) flags.surface = args[++i]
    else if (args[i] === '--action' && args[i + 1]) flags.action = args[++i]
    else if (args[i] === '--result' && args[i + 1]) flags.result = args[++i]
    else if (args[i] === '--actor' && args[i + 1]) flags.actor = args[++i]
    else if (args[i] === '--tier' && args[i + 1]) flags.tier = args[++i]
    else if (args[i] === '--rationale' && args[i + 1]) flags.rationale = args[++i]
    else if (args[i] === '--note' && args[i + 1]) flags.note = args[++i]
    else if (args[i] === '--state' && args[i + 1]) flags.state = args[++i]
    else if (args[i] === '--id' && args[i + 1]) flags.id = args[++i]
  }
  return flags
}

function ghApiRateLimit(scope) {
  const repoMatch = /^repo:([^/]+\/.+)$/i.exec(scope || '')
  const ghArgs = ['api']

  if (repoMatch) {
    ghArgs.push('-R', repoMatch[1])
  }

  ghArgs.push('rate_limit')
  const out = execFileSync('gh', ghArgs, { encoding: 'utf-8' })
  return JSON.parse(out)
}

function ensureDataDir() {
  fs.mkdirSync(HUB_DATA_DIR, { recursive: true })
}

function loadOpLog() {
  try {
    ensureDataDir()
    if (!fs.existsSync(OPLOG_PATH)) return []
    const raw = fs.readFileSync(OPLOG_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveOpLog(entries) {
  ensureDataDir()
  fs.writeFileSync(OPLOG_PATH, JSON.stringify(entries, null, 2), 'utf-8')
}

async function handleLogList(flags = {}) {
  const limit = Number.isFinite(flags.limit) ? Math.max(1, Math.min(500, flags.limit)) : 50
  const scope = (flags.scope || '').trim()
  const entries = loadOpLog()
  const filtered = scope ? entries.filter((e) => e.scope === scope) : entries
  const recent = filtered.slice(-limit).reverse()
  console.log(JSON.stringify(recent, null, 2))
}

async function handleLogAppend(flags = {}) {
  if (!flags.action || !flags.surface) {
    console.error('Usage: hub log append --action <name> --surface <desktop|vscode|terminal> [--scope <scope>] [--result <ok|failed>] [--actor <name>] [--tier <T1|T2|T3|T4|T5>]')
    process.exit(1)
  }

  const entries = loadOpLog()
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    ts: new Date().toISOString(),
    action: String(flags.action),
    surface: String(flags.surface),
    scope: String(flags.scope || ''),
    result: String(flags.result || 'ok'),
    actor: String(flags.actor || 'unknown'),
    tier: String(flags.tier || 'T1'),
  }

  entries.push(entry)
  if (entries.length > 2000) {
    entries.splice(0, entries.length - 2000)
  }
  saveOpLog(entries)
  console.log(JSON.stringify({ ok: true, entry }, null, 2))
}

// ── Action Request helpers ──────────────────────────────────────────────────

function loadActionRequests() {
  try {
    ensureDataDir()
    if (!fs.existsSync(ACTION_REQUEST_PATH)) return []
    const raw = fs.readFileSync(ACTION_REQUEST_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveActionRequests(entries) {
  ensureDataDir()
  fs.writeFileSync(ACTION_REQUEST_PATH, JSON.stringify(entries, null, 2), 'utf-8')
}

async function handleRequestSubmit(flags = {}) {
  if (!flags.action) {
    console.error('Usage: hub request submit --action <name> [--scope <scope>] [--surface <vscode|cli>] [--tier <T3|T4|T5>] [--actor <name>] [--rationale "<text>"]')
    process.exit(1)
  }
  const entries = loadActionRequests()
  const request = {
    id: `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    ts: new Date().toISOString(),
    actor: String(flags.actor || 'unknown'),
    action: String(flags.action),
    scope: String(flags.scope || ''),
    surface: String(flags.surface || 'cli'),
    tier: String(flags.tier || 'T3'),
    rationale: flags.rationale ? String(flags.rationale) : undefined,
    state: 'pending',
  }
  entries.push(request)
  if (entries.length > 1000) entries.splice(0, entries.length - 1000)
  saveActionRequests(entries)
  console.log(JSON.stringify({ ok: true, request }, null, 2))
}

async function handleRequestList(flags = {}) {
  const limit = Number.isFinite(flags.limit) ? Math.max(1, Math.min(500, flags.limit)) : 50
  const stateFilter = (flags.state || '').trim().toLowerCase()
  const scopeFilter = (flags.scope || '').trim()
  const entries = loadActionRequests()
  const filtered = entries.filter((e) => {
    if (stateFilter && e.state !== stateFilter) return false
    if (scopeFilter && e.scope !== scopeFilter) return false
    return true
  })
  const recent = filtered.slice(-limit).reverse()
  console.log(JSON.stringify(recent, null, 2))
}

async function handleRequestApprove(flags = {}) {
  if (!flags.id) {
    console.error('Usage: hub request approve --id <request-id> [--note "<text>"]')
    process.exit(1)
  }
  const entries = loadActionRequests()
  const idx = entries.findIndex((e) => e.id === flags.id)
  if (idx === -1) { console.error(`Request ${flags.id} not found`); process.exit(1) }
  if (entries[idx].state !== 'pending') {
    console.log(JSON.stringify({ ok: true, request: entries[idx] }, null, 2))
    return
  }
  entries[idx] = {
    ...entries[idx],
    state: 'approved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: 'hub-cli',
    resolvedNote: flags.note ? String(flags.note) : undefined,
  }
  saveActionRequests(entries)
  console.log(JSON.stringify({ ok: true, request: entries[idx] }, null, 2))
}

async function handleRequestReject(flags = {}) {
  if (!flags.id) {
    console.error('Usage: hub request reject --id <request-id> [--note "<text>"]')
    process.exit(1)
  }
  const entries = loadActionRequests()
  const idx = entries.findIndex((e) => e.id === flags.id)
  if (idx === -1) { console.error(`Request ${flags.id} not found`); process.exit(1) }
  if (entries[idx].state !== 'pending') {
    console.log(JSON.stringify({ ok: true, request: entries[idx] }, null, 2))
    return
  }
  entries[idx] = {
    ...entries[idx],
    state: 'rejected',
    resolvedAt: new Date().toISOString(),
    resolvedBy: 'hub-cli',
    resolvedNote: flags.note ? String(flags.note) : undefined,
  }
  saveActionRequests(entries)
  console.log(JSON.stringify({ ok: true, request: entries[idx] }, null, 2))
}

async function handleMonitor(flags = {}) {
  // Launch the Ink terminal dashboard
  try {
    const dashboardPath = require.resolve('@agentcraftworks-hub/terminal-dashboard')
    const env = {
      ...process.env,
      HUB_SCOPE: flags.scope || '',
      HUB_PERSONA: flags.persona || '',
    }
    const child = spawn(process.execPath, [dashboardPath], { stdio: 'inherit', env })
    child.on('exit', (code) => process.exit(code || 0))
  } catch {
    // Fallback: quick rate-limit status via gh CLI
    console.error('hub-monitor package not found. Install it or run: npx hub-monitor')
    console.error('Falling back to gh api rate_limit...\n')
    try {
      const data = ghApiRateLimit(flags.scope)
      const core = data.resources.core
      const resetAt = new Date(core.reset * 1000)
      const etaMs = resetAt - Date.now()
      const etaMin = Math.max(0, Math.round(etaMs / 60000))
      console.log(`Rate Limit (core): ${core.used}/${core.limit} used — ${core.remaining} remaining — resets in ${etaMin}m`)
      if (flags.scope) {
        console.log(`Scope: ${flags.scope}`)
      }
    } catch (err) {
      console.error('Could not fetch rate limit:', err.message)
      process.exit(1)
    }
  }
}

async function handleStatus(flags = {}) {
  try {
    const data = ghApiRateLimit(flags.scope)
    const core = data.resources.core
    const search = data.resources.search
    const graphql = data.resources.graphql
    const resetAt = new Date(core.reset * 1000)
    const etaMs = resetAt - Date.now()
    const etaMin = Math.max(0, Math.round(etaMs / 60000))
    const pct = Math.round((core.used / core.limit) * 100)
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5))
    console.log(`[Hub] Rate Limit  ${bar} ${pct}%  ${core.remaining}/${core.limit} remaining  reset in ${etaMin}m`)
    console.log(`      Search: ${search.remaining}/${search.limit}  GraphQL: ${graphql.remaining}/${graphql.limit}`)
    if (flags.scope) {
      console.log(`      Scope: ${flags.scope}`)
    }
  } catch (err) {
    console.error('Could not fetch rate limit:', err.message)
    process.exit(1)
  }
}

function parseArgs(argv) {
  const args = argv.slice(2)

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printUsage()
    process.exit(0)
  }

  const domain = args[0]
  const action = args[1]

  // ── hub monitor / status (no pipe needed) ──
  if (domain === 'monitor') return { _handler: 'monitor', _flags: parseFlags(args, 1) }
  if (domain === 'status') return { _handler: 'status', _flags: parseFlags(args, 1) }
  if (domain === 'log' && action === 'list') return { _handler: 'log:list', _flags: parseFlags(args, 2) }
  if (domain === 'log' && action === 'append') return { _handler: 'log:append', _flags: parseFlags(args, 2) }
  if (domain === 'request' && action === 'submit') return { _handler: 'request:submit', _flags: parseFlags(args, 2) }
  if (domain === 'request' && action === 'list') return { _handler: 'request:list', _flags: parseFlags(args, 2) }
  if (domain === 'request' && action === 'approve') return { _handler: 'request:approve', _flags: parseFlags(args, 2) }
  if (domain === 'request' && action === 'reject') return { _handler: 'request:reject', _flags: parseFlags(args, 2) }

  if (args.length < 2) {
    printUsage()
    process.exit(1)
  }

  // ── config ──
  if (domain === 'config' && action === 'get') return { method: 'config.get' }
  if (domain === 'config' && action === 'set') {
    if (args.length < 4) { console.error('Usage: hub config set <key> <value>'); process.exit(1) }
    return { method: 'config.set', params: { key: args[2], value: args[3] } }
  }
  if (domain === 'config' && action === 'export') {
    if (args.length < 3) { console.error('Usage: hub config export <path>'); process.exit(1) }
    return { method: 'config.export', _exportPath: args[2] }
  }
  if (domain === 'config' && action === 'import') {
    if (args.length < 3) { console.error('Usage: hub config import <path>'); process.exit(1) }
    return { method: 'config.import', _importPath: args[2] }
  }

  // ── agents ──
  if (domain === 'agents' && action === 'list') return { method: 'agents.list' }
  if (domain === 'agents' && action === 'add') {
    if (args.length < 3) { console.error('Usage: hub agents add <folder> --name <name> --command <cmd>'); process.exit(1) }
    const folder = args[2]
    const flags = parseFlags(args, 3)
    if (!flags.name || !flags.command) { console.error('--name and --command are required'); process.exit(1) }
    return { method: 'agents.add', params: { folder, agent: { name: flags.name, command: flags.command, args: flags.args || [] } } }
  }
  if (domain === 'agents' && action === 'remove') {
    if (args.length < 3) { console.error('Usage: hub agents remove <agent-name>'); process.exit(1) }
    return { method: 'agents.remove', params: { name: args[2] } }
  }

  // ── projects ──
  if (domain === 'projects' && action === 'list') return { method: 'projects.list' }
  if (domain === 'projects' && action === 'add') {
    if (args.length < 3) { console.error('Usage: hub projects add <name>'); process.exit(1) }
    return { method: 'projects.add', params: { name: args[2] } }
  }
  if (domain === 'projects' && action === 'remove') {
    if (args.length < 3) { console.error('Usage: hub projects remove <name>'); process.exit(1) }
    return { method: 'projects.remove', params: { name: args[2] } }
  }

  if (domain === 'request') {
    console.error(`Unknown request action: ${action}. Use: submit | list | approve | reject`)
    process.exit(1)
  }

  console.error(`Unknown command: ${domain} ${action}`)
  printUsage()
  process.exit(1)
}

function printUsage() {
  console.error(`AgentCraftworks Hub CLI

Usage: hub <command>

Monitoring:
  monitor [--scope <scope>]      Launch terminal dashboard (Ink TUI, for VS Code terminal)
  status [--scope <scope>]       Single-line rate limit summary
  Scope examples: org:AgentCraftworks | repo:AgentCraftworks/AgentCraftworks-Hub

Operation Log:
  log list [--limit <n>] [--scope <scope>]
                                  Show recent operation log entries
  log append --action <name> --surface <desktop|vscode|terminal>
             [--scope <scope>] [--result <ok|failed>] [--actor <name>] [--tier <T1|T2|T3|T4|T5>]
                                  Append an operation log entry

Action Requests:
  request submit --action <name> [--scope <scope>] [--surface <vscode|cli>]
                 [--tier <T3|T4|T5>] [--actor <name>] [--rationale "<text>"]
                                  Submit an action for approval by a Hub admin
  request list [--state <pending|approved|rejected>] [--scope <scope>] [--limit <n>]
                                  List action requests
  request approve --id <request-id> [--note "<text>"]
                                  Approve a pending action request
  request reject --id <request-id> [--note "<text>"]
                                  Reject a pending action request

Configuration:
  config get                     Get all configuration values
  config set <key> <value>       Set a configuration value
  config export <path>           Export config to JSON
  config import <path>           Import config from JSON

Agents:
  agents list                    List all agents
  agents add <folder> --name <name> --command <cmd> [--args "<args>"]
  agents remove <agent-name>     Remove an agent

Projects:
  projects list                  List all project folders
  projects add <name>            Add a project folder
  projects remove <name>         Remove a project folder

Note: monitor and status work standalone (no Hub app required).
      All other commands require the Hub Electron app to be running.`)
}

async function main() {
  const message = parseArgs(process.argv)

  // Handle built-in commands that don't need the pipe
  if (message._handler === 'monitor') { await handleMonitor(message._flags); return }
  if (message._handler === 'status') { await handleStatus(message._flags); return }
  if (message._handler === 'log:list') { await handleLogList(message._flags); return }
  if (message._handler === 'log:append') { await handleLogAppend(message._flags); return }
  if (message._handler === 'request:submit') { await handleRequestSubmit(message._flags); return }
  if (message._handler === 'request:list') { await handleRequestList(message._flags); return }
  if (message._handler === 'request:approve') { await handleRequestApprove(message._flags); return }
  if (message._handler === 'request:reject') { await handleRequestReject(message._flags); return }

  try {
    if (message._exportPath) {
      const fs = require('fs')
      const exportPath = message._exportPath
      delete message._exportPath
      const response = await send(message)
      if (response.error) { console.error('Error:', response.error); process.exit(1) }
      fs.writeFileSync(exportPath, JSON.stringify(response.result, null, 2), 'utf-8')
      console.log('Config exported to', exportPath)
      return
    }

    if (message._importPath) {
      const fs = require('fs')
      const importPath = message._importPath
      delete message._importPath
      const raw = fs.readFileSync(importPath, 'utf-8')
      const bundle = JSON.parse(raw)
      message.params = { config: bundle.config, agents: bundle.agents }
      const response = await send(message)
      if (response.error) { console.error('Error:', response.error); process.exit(1) }
      console.log('Config imported from', importPath)
      return
    }

    const response = await send(message)
    if (response.error) { console.error('Error:', response.error); process.exit(1) }
    console.log(JSON.stringify(response.result, null, 2))
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}

main()
