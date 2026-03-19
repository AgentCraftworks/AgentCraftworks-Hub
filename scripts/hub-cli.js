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
const { execSync, spawn } = require('child_process')

const PIPE_PATH =
  os.platform() === 'win32'
    ? '\\\\.\\pipe\\agentcraftworks-hub-config'
    : '/tmp/agentcraftworks-hub-config.sock'

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
  }
  return flags
}

async function handleMonitor() {
  // Launch the Ink terminal dashboard
  try {
    const dashboardPath = require.resolve('@agentcraftworks-hub/terminal-dashboard')
    const child = spawn(process.execPath, [dashboardPath], { stdio: 'inherit' })
    child.on('exit', (code) => process.exit(code || 0))
  } catch {
    // Fallback: quick rate-limit status via gh CLI
    console.error('hub-monitor package not found. Install it or run: npx hub-monitor')
    console.error('Falling back to gh api rate_limit...\n')
    try {
      const raw = execSync('gh api rate_limit', { encoding: 'utf-8' })
      const data = JSON.parse(raw)
      const core = data.resources.core
      const resetAt = new Date(core.reset * 1000)
      const etaMs = resetAt - Date.now()
      const etaMin = Math.max(0, Math.round(etaMs / 60000))
      console.log(`Rate Limit (core): ${core.used}/${core.limit} used — ${core.remaining} remaining — resets in ${etaMin}m`)
    } catch (err) {
      console.error('Could not fetch rate limit:', err.message)
      process.exit(1)
    }
  }
}

async function handleStatus() {
  try {
    const raw = execSync('gh api rate_limit', { encoding: 'utf-8' })
    const data = JSON.parse(raw)
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
  if (domain === 'monitor') return { _handler: 'monitor' }
  if (domain === 'status') return { _handler: 'status' }

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

  console.error(`Unknown command: ${domain} ${action}`)
  printUsage()
  process.exit(1)
}

function printUsage() {
  console.error(`AgentCraftworks Hub CLI

Usage: hub <command>

Monitoring:
  monitor                        Launch terminal dashboard (Ink TUI, for VS Code terminal)
  status                         Single-line rate limit summary

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
  if (message._handler === 'monitor') { await handleMonitor(); return }
  if (message._handler === 'status') { await handleStatus(); return }

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
