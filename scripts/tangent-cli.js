#!/usr/bin/env node

// tangent-cli.js — Simple CLI to talk to Tangent's named pipe server
// Usage:
//   node scripts/tangent-cli.js config get
//   node scripts/tangent-cli.js config set editor code-insiders
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

function parseArgs(argv) {
  const args = argv.slice(2)
  if (args.length < 2) {
    printUsage()
    process.exit(1)
  }

  const domain = args[0]
  const action = args[1]

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

  if (domain === 'agents' && action === 'list') {
    return { method: 'agents.list' }
  }

  if (domain === 'agents' && action === 'add') {
    if (args.length < 3) {
      console.error('Usage: tangent-cli agents add <folder> --name <name> --command <cmd> [--args "<args>"]')
      process.exit(1)
    }
    const folder = args[2]
    const flags = {}
    for (let i = 3; i < args.length; i++) {
      if (args[i] === '--name' && args[i + 1]) flags.name = args[++i]
      else if (args[i] === '--command' && args[i + 1]) flags.command = args[++i]
      else if (args[i] === '--args' && args[i + 1]) flags.args = args[++i].split(/\s+/)
    }
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

  console.error(`Unknown command: ${domain} ${action}`)
  printUsage()
  process.exit(1)
}

function printUsage() {
  console.error(`Usage:
  tangent-cli config get
  tangent-cli config set <key> <value>
  tangent-cli agents list
  tangent-cli agents add <folder> --name <name> --command <cmd> [--args "<args>"]`)
}

async function main() {
  const message = parseArgs(process.argv)
  try {
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
