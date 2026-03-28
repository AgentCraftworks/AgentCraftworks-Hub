# Tangent MVP Design

**Date**: 2026-02-14
**Status**: Approved

## Overview

Tangent is a standalone Electron terminal application with a built-in Agents sidebar. Users navigate to a folder in the terminal, click an Agent (Copilot CLI, Claude Code), and the AI tool launches in that terminal session. The full product spec is in `.resources/tangent-prd.md`.

This design covers the complete MVP: Electron + Vite + React + xterm.js + node-pty, targeting PowerShell on Windows.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Electron + electron-vite | PRD specifies Electron; electron-vite handles main/preload/renderer builds with HMR |
| Architecture | Monolith (single package) | Simpler than monorepo, shared types via `src/shared/`, sufficient for MVP scope |
| Previous scaffolding | Replace Next.js entirely | Next.js is server-rendered, incompatible with Electron desktop app architecture |
| Build scope | Full MVP in one pass | All PRD features: sessions, terminal, agents sidebar, status engine, status bar |

## Project Structure

```
tangent/
  electron.vite.config.ts       # electron-vite config (main, preload, renderer)
  package.json                   # Single package, electron-vite scripts
  tsconfig.json                  # Base config
  tsconfig.main.json             # Main process TS config (Node target)
  tsconfig.preload.json          # Preload TS config
  tsconfig.renderer.json         # Renderer TS config (DOM target)

  src/
    main/
      index.ts                   # Electron app entry, window creation
      pty/
        PtyManager.ts            # Spawns/manages node-pty instances
      session/
        SessionStore.ts          # Single source of truth for all sessions
        SessionManager.ts        # Session lifecycle (create, close, rename, CWD tracking)
      status/
        StatusEngine.ts          # One instance per session, runs detection
        SystemA.ts               # File watcher detection
        SystemB.ts               # Output-parsing detection with debounce
        transitions.ts           # canTransition() guard
      agents/
        AgentStore.ts            # Loads/saves ~/.tangent/agents.json
        AgentLauncher.ts         # Command injection into PTY
      ipc/
        handlers.ts              # All ipcMain.handle() registrations

    preload/
      index.ts                   # contextBridge exposing tangentAPI

    renderer/
      index.html                 # HTML entry
      main.tsx                   # React root mount
      App.tsx                    # Top-level layout (3-column + status bar)
      hooks/
        useSession.ts            # IPC listeners for session state
        useAgents.ts             # IPC listeners for agent store
      components/
        SessionsPanel/
          SessionsPanel.tsx
          SessionItem.tsx         # Status-colored card with edge bar
          SessionFilter.tsx
        Terminal/
          TerminalViewport.tsx    # xterm.js mount, fit addon, multi-instance
        AgentsSidebar/
          AgentsSidebar.tsx       # Right 220px panel
          AgentGroup.tsx
          AgentItem.tsx
          AgentForm.tsx
        StatusBar/
          StatusBar.tsx           # Bottom 24px bar
        ui/                      # shadcn/ui primitives
      lib/
        utils.ts                 # cn() and other utilities
      styles/
        globals.css              # Tailwind v4, GitHub Dark theme tokens

    shared/
      types.ts                   # Session, SessionStatus, AgentProfile, etc.
      statusMapping.ts           # mapStatusToUI() pure function
      constants.ts               # Status colors, timing constants
```

## IPC Contract

The preload script exposes `tangentAPI` via `contextBridge`. This is the complete API surface:

```typescript
interface TangentAPI {
  // Sessions
  session: {
    getAll(): Promise<Session[]>;
    create(): Promise<Session>;
    close(sessionId: string): Promise<void>;
    select(sessionId: string): Promise<void>;
    rename(sessionId: string, name: string): Promise<void>;

    onCreated(cb: (session: Session) => void): () => void;
    onUpdated(cb: (session: Session) => void): () => void;
    onClosed(cb: (sessionId: string) => void): () => void;
  };

  // Terminal
  terminal: {
    write(sessionId: string, data: string): void;
    onData(sessionId: string, cb: (data: string) => void): () => void;
    resize(sessionId: string, cols: number, rows: number): void;
  };

  // Agents
  agents: {
    getGroups(): Promise<AgentGroup[]>;
    saveGroups(groups: AgentGroup[]): Promise<void>;
    launch(agentId: string, sessionId: string): Promise<void>;

    onUpdated(cb: (groups: AgentGroup[]) => void): () => void;
  };

  // App
  app: {
    getZoom(): Promise<number>;
    setZoom(level: number): Promise<void>;
  };
}
```

**Design rules**:
- All `on*` methods return an unsubscribe function for React cleanup
- Session state flows one way: main process → IPC event → renderer re-renders
- Renderer never writes to session status directly
- `terminal.write()` is fire-and-forget for low latency
- `terminal.onData()` streams raw PTY output to xterm.js

## Session Lifecycle

### Session Schema

Follows the PRD `Session` interface exactly (see PRD "What a Session Is" table).

### Naming Rules

Implemented exactly as PRD specifies:
1. Initial name = folder name
2. CWD changes auto-update name unless `isRenamed === true`
3. Agent detection does NOT change the name
4. Manual renames set `isRenamed = true` (sticky)
5. `folderName` is ground truth for location
6. `folderPath`, `folderName`, `name` update atomically in a single operation

### SessionStore

- Main process, single source of truth
- Holds `Map<string, Session>` in memory
- `updateStatus()` validates transitions via `canTransition()`, logs and ignores invalid ones
- Atomic updates: all naming fields update together before emitting IPC
- Emits `session:updated`, `session:created`, `session:closed` IPC events

## Status Engine

Follows the PRD exactly. One `StatusEngine` instance per session.

### Internal Status Values

```typescript
type SessionStatus =
  | 'shell_ready' | 'agent_launching' | 'agent_ready' | 'processing'
  | 'tool_executing' | 'needs_input' | 'failed' | 'exited';
```

### UI Mapping

`mapStatusToUI()` is a pure function in `src/shared/statusMapping.ts`. Maps 8 internal statuses to 4 UI states (`shell`, `running`, `idle`, `error`), returning dot visibility, color, animation, bar color, background tints, and glow shadow values exactly as defined in the PRD.

### Valid Transitions

Implemented as a `Set<string>` lookup (e.g., `"shell_ready->agent_launching"`). The `canTransition(from, to)` function returns `boolean`. Invalid transitions are logged as warnings and ignored (never thrown).

### Detection Systems

**System A (File Watcher)**: Watches `~/.tangent/status/<ptyId>.json`. When active, completely overrides System B for status. Maps file status values to `SessionStatus`.

**System B (Output Parsing)**: Fallback when no status file exists. Parses PTY output with the exact regex patterns from the PRD, in priority order. Includes:
- 500ms minimum hold time (prevents flicker)
- 300ms silence confirmation for `agent_ready` detection
- Eager `processing` transitions (immediate)
- 2-match requirement for `failed` (within 3 seconds, or persist 2 seconds)
- Rolling 20-line output buffer

**`lastActivity` extraction** runs in both systems, scanning for activity patterns.

## Terminal & xterm.js

- Each session gets its own `Terminal` instance
- Only active session's terminal is visible (`display: block` vs `none`)
- `@xterm/addon-fit` handles resize (window, sidebar toggle, panel toggle)
- CWD tracking: OSC 7 parsing (primary) + PowerShell prompt fallback
- Right-click: selected text → copy, no selection → paste
- Zoom: `Ctrl+=/-/0`, range 8–32px, default 14px, applies to all terminals

## Agents Sidebar

- Persists to `~/.tangent/agents.json` (grouped format v2)
- Default group "Agents" with Copilot CLI and Claude Code pre-configured
- Inline form for create/edit
- Launch injects escaped PowerShell commands into active PTY
- `currentTab` vs `newTab` launch targets
- Sidebar collapse/expand with `Ctrl+Shift+1-9` shortcuts

## Styling

- GitHub Dark color theme with exact PRD tokens
- Tailwind v4 with CSS custom properties
- Status-colored session items: tinted backgrounds, left edge bars, glow shadows
- `pulse-slow` (2s) and `pulse-fast` (1.5s) CSS animations for status dots/bars
- `transition: background 400ms ease, border-color 400ms ease` for smooth status changes
- Fonts: Cascadia Code / JetBrains Mono / Fira Code (terminal), system sans (UI labels)

## Testing

- **Vitest**: `mapStatusToUI()`, `canTransition()`, session naming rules, debounce logic, agent store serialization
- **Playwright**: App launch, session create/switch, agent launch, terminal interaction

## Pre-Implementation: Scaffolding Cleanup

Before building, the existing Next.js scaffolding must be removed:
- Delete: `app/`, `public/`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`
- Replace: `package.json` (new deps), `tsconfig.json` (electron-vite configs), `globals.css` (GitHub Dark theme)
- Keep: `.resources/`, `CLAUDE.md`, `.gitignore`, `components.json` (reconfigure for new paths)
- New deps: `electron`, `electron-vite`, `node-pty`, `xterm`, `@xterm/addon-fit`
