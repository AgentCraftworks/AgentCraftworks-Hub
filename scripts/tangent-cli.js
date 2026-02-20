#!/usr/bin/env node

// tangent-cli.js — Simple CLI to talk to Tangent's named pipe server
// Usage:
//   node scripts/tangent-cli.js config get
//   node scripts/tangent-cli.js config set editor code-insiders
//   node scripts/tangent-cli.js config export ./tangent-config.json
//   node scripts/tangent-cli.js config import ./tangent-config.json
//   node scripts/tangent-cli.js agents list
//   node scripts/tangent-cli.js agents add "My Project" --name Copilot --command copilot --args "--yolo"

const net = require('net')
const os = require('os')

const PIPE_PATH =
  os.platform() === 'win32'
    ? '\\\\.\\pipe\\tangent-config'
    : '/tmp/tangent-config.sock'

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
      reject(new Error('Cannot connect to Tangent. Is it running? ' + err.message))
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

function parseArgs(argv) {
  const args = argv.slice(2)

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    printUsage()
    process.exit(0)
  }

  if (args.length < 2) {
    printUsage()
    process.exit(1)
  }

  const domain = args[0]
  const action = args[1]

  // --- config ---
  if (domain === 'config' && action === 'get') {
    return { method: 'config.get' }
  }

  if (domain === 'config' && action === 'set') {
    if (args.length < 4) {
      console.error('Usage: tangent-cli config set <key> <value>')
      process.exit(1)
    }
    return { method: 'config.set', params: { key: args[2], value: args[3] } }
  }

  if (domain === 'config' && action === 'export') {
    if (args.length < 3) {
      console.error('Usage: tangent-cli config export <path>')
      process.exit(1)
    }
    return { method: 'config.export', _exportPath: args[2] }
  }

  if (domain === 'config' && action === 'import') {
    if (args.length < 3) {
      console.error('Usage: tangent-cli config import <path>')
      process.exit(1)
    }
    return { method: 'config.import', _importPath: args[2] }
  }

  // --- agents ---
  if (domain === 'agents' && action === 'list') {
    return { method: 'agents.list' }
  }

  if (domain === 'agents' && action === 'add') {
    if (args.length < 3) {
      console.error('Usage: tangent-cli agents add <folder> --name <name> --command <cmd> [--args "<args>"]')
      process.exit(1)
    }
    const folder = args[2]
    const flags = parseFlags(args, 3)
    if (!flags.name || !flags.command) {
      console.error('--name and --command are required')
      process.exit(1)
    }
    return {
      method: 'agents.add',
      params: {
        folder,
        agent: { name: flags.name, command: flags.command, args: flags.args || [] }
      }
    }
  }

  if (domain === 'agents' && action === 'edit') {
    if (args.length < 3) {
      console.error('Usage: tangent-cli agents edit <agent-name> [--command <cmd>] [--args "<args>"] [--name <new-name>]')
      process.exit(1)
    }
    const agentName = args[2]
    const flags = parseFlags(args, 3)
    if (!flags.name && !flags.command && !flags.args) {
      console.error('At least one of --name, --command, or --args is required')
      process.exit(1)
    }
    const updates = {}
    if (flags.name) updates.name = flags.name
    if (flags.command) updates.command = flags.command
    if (flags.args) updates.args = flags.args
    return { method: 'agents.edit', params: { name: agentName, updates } }
  }

  if (domain === 'agents' && action === 'remove') {
    if (args.length < 3) {
      console.error('Usage: tangent-cli agents remove <agent-name>')
      process.exit(1)
    }
    return { method: 'agents.remove', params: { name: args[2] } }
  }

  // --- projects ---
  if (domain === 'projects' && action === 'list') {
    return { method: 'projects.list' }
  }

  if (domain === 'projects' && action === 'add') {
    if (args.length < 3) {
      console.error('Usage: tangent-cli projects add <name>')
      process.exit(1)
    }
    return { method: 'projects.add', params: { name: args[2] } }
  }

  if (domain === 'projects' && action === 'remove') {
    if (args.length < 3) {
      console.error('Usage: tangent-cli projects remove <name>')
      process.exit(1)
    }
    return { method: 'projects.remove', params: { name: args[2] } }
  }

  if (domain === 'projects' && action === 'rename') {
    if (args.length < 4) {
      console.error('Usage: tangent-cli projects rename <old-name> <new-name>')
      process.exit(1)
    }
    return { method: 'projects.rename', params: { oldName: args[2], newName: args[3] } }
  }

  console.error(`Unknown command: ${domain} ${action}`)
  printUsage()
  process.exit(1)
}

function printUsage() {
  console.error(`Tangent CLI — manage agents and projects via named pipe

Usage: tangent-cli <command>

Commands:
  help                           Show this help message

  config get                     Get all configuration values
  config set <key> <value>       Set a configuration value
  config export <path>           Export config + agents to a JSON file
  config import <path>           Import config + agents from a JSON file

  agents list                    List all agents (grouped by project)
  agents add <folder> --name <name> --command <cmd> [--args "<args>"]
                                 Add an agent to a project folder
  agents edit <agent-name> [--command <cmd>] [--args "<args>"] [--name <new-name>]
                                 Edit an existing agent (searches all folders)
  agents remove <agent-name>     Remove an agent by name

  projects list                  List all project folders
  projects add <name>            Create a new project folder
  projects remove <name>         Remove a project folder (and all its agents)
  projects rename <old> <new>    Rename a project folder`)
}

async function main() {
  const message = parseArgs(process.argv)
  try {
    // Handle config export: get bundle from server, write to file
    if (message._exportPath) {
      const fs = require('fs')
      const exportPath = message._exportPath
      delete message._exportPath
      const response = await send(message)
      if (response.error) {
        console.error('Error:', response.error)
        process.exit(1)
      }
      fs.writeFileSync(exportPath, JSON.stringify(response.result, null, 2), 'utf-8')
      console.log('Config exported to', exportPath)
      return
    }

    // Handle config import: read file, send to server
    if (message._importPath) {
      const fs = require('fs')
      const importPath = message._importPath
      delete message._importPath
      const raw = fs.readFileSync(importPath, 'utf-8')
      const bundle = JSON.parse(raw)
      message.params = { config: bundle.config, agents: bundle.agents }
      const response = await send(message)
      if (response.error) {
        console.error('Error:', response.error)
        process.exit(1)
      }
      console.log('Config imported from', importPath)
      return
    }

    const response = await send(message)
    if (response.error) {
      console.error('Error:', response.error)
      process.exit(1)
    }
    console.log(JSON.stringify(response.result, null, 2))
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}

main()
