#!/usr/bin/env node

// hub-mcp-server.js — MCP server entry point shim
// Launches packages/mcp-server/dist/index.js (production build)
// Falls back to tsx + src/index.ts for development if dist is not built.
//
// Add to your MCP client config:
//   { "command": "node", "args": ["<repo-root>/scripts/hub-mcp-server.js"],
//     "env": { "GITHUB_TOKEN": "...", "GITHUB_ENTERPRISE": "AICraftworks" } }

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const repoRoot = path.join(__dirname, '..')
const distEntry = path.join(repoRoot, 'packages', 'mcp-server', 'dist', 'index.js')
const srcEntry  = path.join(repoRoot, 'packages', 'mcp-server', 'src', 'index.ts')

let child

if (fs.existsSync(distEntry)) {
  // Production: run compiled JS
  child = spawn(process.execPath, [distEntry], {
    stdio: 'inherit',
    env: process.env,
  })
} else if (fs.existsSync(srcEntry)) {
  // Development: use tsx for TypeScript execution
  const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx')
  const tsxCmd = fs.existsSync(tsx + '.cmd') ? tsx + '.cmd' : tsx
  if (fs.existsSync(tsxCmd) || fs.existsSync(tsx)) {
    child = spawn(tsxCmd, [srcEntry], {
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
    })
  } else {
    process.stderr.write('[hub-mcp-server] Error: dist/index.js not found and tsx not available.\n')
    process.stderr.write('Run: npm run build --workspace=packages/mcp-server\n')
    process.exit(1)
  }
} else {
  process.stderr.write('[hub-mcp-server] Error: MCP server source not found.\n')
  process.stderr.write(`Expected: ${distEntry}\n`)
  process.exit(1)
}

child.on('exit', (code) => process.exit(code ?? 0))
child.on('error', (err) => {
  process.stderr.write(`[hub-mcp-server] Spawn error: ${err.message}\n`)
  process.exit(1)
})

// Forward signals to child
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
