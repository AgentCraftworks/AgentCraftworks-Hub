# CLAUDE.md

## Project Overview

Tangent -- standalone Electron terminal app with built-in Agents sidebar. Users launch AI agents (Copilot CLI, Claude Code) from the sidebar into terminal sessions. The full product spec is in `.resources/tangent-prd.md`.

## Commands

```bash
npm run dev        # Start electron-vite dev server with HMR
npm run build      # Production build
npm run preview    # Preview production build
npm run test       # Run Vitest unit tests
npm run test:watch # Run Vitest in watch mode
npm run test:e2e   # Run Playwright e2e tests
npm run lint       # Run ESLint
```

## Tech Stack

- **Electron** + **electron-vite** (main/preload/renderer)
- **React 19**, **TypeScript 5**
- **xterm.js** (terminal), **node-pty** (PTY)
- **Tailwind CSS v4**, **shadcn/ui** (new-york style)
- **Vitest** (unit), **Playwright** (e2e)

## Project Structure

```
src/
  main/           # Electron main process
    index.ts      # App entry, window creation
    pty/          # PtyManager (node-pty wrapper)
    session/      # SessionStore, SessionManager, ExternalScanner
    status/       # StatusEngine, SystemA, SystemB, OscParser, CwdTracker
    agents/       # AgentStore, AgentLauncher
    ipc/          # IPC handler registrations
  preload/        # contextBridge (tangentAPI)
  renderer/       # React UI
    App.tsx       # Root layout
    hooks/        # useSessions, useAgents, useKeyboard
    components/   # SessionsPanel, Terminal, AgentsSidebar, StatusBar
    styles/       # globals.css (GitHub Dark theme)
  shared/         # Types, constants, pure functions
    types.ts
    constants.ts
    statusMapping.ts
    transitions.ts
```

## Import Aliases

- `@/*` maps to `src/renderer/`
- `@shared/*` maps to `src/shared/`

## Architecture

- Main process is single source of truth for sessions/status
- Renderer is read-only consumer via IPC events
- StatusEngine: System A (file watcher) > System B (output parsing) > OSC sequences
- 8 internal statuses mapped to 4 UI states via `mapStatusToUI()`
- All state transitions validated by `canTransition()`
- ExternalScanner discovers Copilot CLI and Claude Code sessions on disk

## Session Naming Rules

All three fields (`folderPath`, `folderName`, `name`) must update atomically. Agent detection must NOT change the session name. Manual renames are sticky (`isRenamed: true`).

## Status Engine

- System A (file watcher) always overrides System B (output parsing)
- System B includes debounce/hysteresis rules to prevent flicker
- Valid state transitions are explicitly listed; invalid transitions are logged and ignored, never thrown
