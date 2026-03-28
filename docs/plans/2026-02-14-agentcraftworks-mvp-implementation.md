# Tangent MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete Tangent MVP — an Electron terminal app with sessions panel, xterm.js terminal, agents sidebar, status engine, and status bar.

**Architecture:** Electron + electron-vite monolith with src/main (node-pty, session store, status engine), src/preload (contextBridge), src/renderer (React + xterm.js + Tailwind), and src/shared (types, pure functions). All status computation in main process; renderer is read-only.

**Tech Stack:** Electron, electron-vite, React 19, TypeScript 5, xterm.js, node-pty, Tailwind CSS v4, shadcn/ui, Vitest, Playwright

---

## Phase 0: Project Reset

### Task 1: Remove Next.js Scaffolding

**Files:**
- Delete: `app/`, `public/`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `nul`
- Delete: `tests/example.spec.ts`, `playwright.config.ts` (will recreate later)
- Keep: `.resources/`, `CLAUDE.md`, `.gitignore`, `docs/`, `.agents/`
- Modify: `package.json` (gut it), `tsconfig.json` (replace), `components.json` (update paths)

**Step 1: Delete Next.js files**

```bash
rm -rf app/ public/ next.config.ts next-env.d.ts postcss.config.mjs eslint.config.mjs nul tests/ playwright.config.ts lib/
```

**Step 2: Gut package.json to bare minimum**

Replace `package.json` with:
```json
{
  "name": "tangent",
  "version": "0.1.0",
  "private": true,
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "lint": "eslint src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "postinstall": "electron-rebuild"
  }
}
```

**Step 3: Update .gitignore for Electron**

Replace Next.js-specific entries with Electron ones:
```gitignore
# dependencies
/node_modules

# electron-vite output
/out
/dist

# testing
/coverage
/test-results
/playwright-report

# misc
.DS_Store
*.pem
npm-debug.log*

# env files
.env*

# typescript
*.tsbuildinfo
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove Next.js scaffolding for Electron migration"
```

---

### Task 2: Initialize Electron + electron-vite

**Files:**
- Create: `electron.vite.config.ts`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Modify: `package.json` (add all dependencies)
- Create: `tsconfig.json`, `tsconfig.main.json`, `tsconfig.preload.json`, `tsconfig.renderer.json`

**Step 1: Install all dependencies**

```bash
npm install electron electron-vite @vitejs/plugin-react --save-dev
npm install electron-rebuild --save-dev
npm install node-pty
npm install @xterm/xterm @xterm/addon-fit
npm install react react-dom
npm install @types/react @types/react-dom --save-dev
npm install typescript --save-dev
npm install tailwindcss @tailwindcss/vite --save-dev
npm install class-variance-authority clsx tailwind-merge lucide-react
npm install vitest --save-dev
npm install @playwright/test --save-dev
npm install eslint @electron-toolkit/eslint-config-ts --save-dev
npm install uuid
npm install @types/uuid --save-dev
```

**Step 2: Create electron.vite.config.ts**

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    }
  }
})
```

**Step 3: Create TypeScript configs**

`tsconfig.json` (base):
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.main.json" },
    { "path": "./tsconfig.preload.json" },
    { "path": "./tsconfig.renderer.json" }
  ]
}
```

`tsconfig.main.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./out/main",
    "paths": {
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/main/**/*", "src/shared/**/*"]
}
```

`tsconfig.preload.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "outDir": "./out/preload",
    "paths": {
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/preload/**/*", "src/shared/**/*"]
}
```

`tsconfig.renderer.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "outDir": "./out/renderer",
    "paths": {
      "@/*": ["./src/renderer/*"],
      "@shared/*": ["./src/shared/*"]
    },
    "lib": ["DOM", "DOM.Iterable", "ESNext"]
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

**Step 4: Create minimal main process entry**

`src/main/index.ts`:
```typescript
import { app, BrowserWindow } from 'electron'
import { join } from 'path'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})
```

**Step 5: Create minimal preload**

`src/preload/index.ts`:
```typescript
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('tangentAPI', {
  // Will be populated in Task 10
})
```

**Step 6: Create renderer entry files**

`src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tangent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`src/renderer/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

`src/renderer/App.tsx`:
```tsx
export function App(): JSX.Element {
  return (
    <div className="flex h-screen w-screen bg-[#0d1117] text-[#e6edf3]">
      <div className="flex items-center justify-center w-full">
        <h1 className="text-2xl font-mono">Tangent</h1>
      </div>
    </div>
  )
}
```

`src/renderer/styles/globals.css`:
```css
@import "tailwindcss";
```

`src/renderer/lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

**Step 7: Update components.json for new paths**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

**Step 8: Verify dev server launches**

```bash
npm run dev
```

Expected: Electron window opens showing "Tangent" text on dark background. If it fails, debug and fix before proceeding.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: initialize Electron + electron-vite project with React and Tailwind"
```

---

## Phase 1: Shared Types & Pure Functions (TDD)

### Task 3: Define All Shared Types

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/constants.ts`

**Step 1: Create shared types**

`src/shared/types.ts`:
```typescript
// === Session Status ===

export type SessionStatus =
  | 'shell_ready'
  | 'agent_launching'
  | 'agent_ready'
  | 'processing'
  | 'tool_executing'
  | 'needs_input'
  | 'failed'
  | 'exited'

export type AgentType = 'copilot-cli' | 'claude-code' | 'shell'

export type UIStatusLabel = 'shell' | 'running' | 'idle' | 'error'

// === Session ===

export interface Session {
  id: string
  agentType: AgentType
  name: string
  folderName: string
  folderPath: string
  isRenamed: boolean
  status: SessionStatus
  lastActivity: string
  startedAt: number
  updatedAt: number
  ptyId: string
  exitCode?: number
  isExternal: boolean
  sourceFile?: string
}

// === UI Status Indicator ===

export interface UIStatusIndicator {
  label: UIStatusLabel
  dotVisible: boolean
  dotColor: string | null
  dotAnimation: 'pulse-slow' | 'pulse-fast' | 'none'
  barColor: string | null
  bgTint: string
  bgTintSelected: string
  bgTintHover: string
  glowShadow: string
}

// === Agent Profiles ===

export interface AgentProfile {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  cwdMode: 'activeSession'
  launchTarget: 'currentTab' | 'newTab'
}

export interface AgentGroup {
  id: string
  name: string
  agents: AgentProfile[]
}

export interface AgentStore {
  version: 2
  groups: AgentGroup[]
}

// === Status File (System A) ===

export interface StatusFile {
  status: 'ready' | 'processing' | 'tool' | 'input' | 'error'
  detail?: string
  updatedAt: number
}

// === IPC Event Types ===

export type SessionEvent =
  | { type: 'created'; session: Session }
  | { type: 'updated'; session: Session }
  | { type: 'closed'; sessionId: string }

// === OSC Sequence Data ===

export interface OscTitleChange {
  sessionId: string
  title: string
}

export interface OscProgressChange {
  sessionId: string
  state: 'hidden' | 'indeterminate' | 'normal' | 'error' | 'warning'
  progress: number
}
```

**Step 2: Create shared constants**

`src/shared/constants.ts`:
```typescript
import type { StatusFile, SessionStatus } from './types'

// Status file value -> SessionStatus mapping
export const STATUS_FILE_MAP: Record<StatusFile['status'], SessionStatus> = {
  ready: 'agent_ready',
  processing: 'processing',
  tool: 'tool_executing',
  input: 'needs_input',
  error: 'failed'
}

// OSC 9;4 progress state codes
export const OSC_PROGRESS_STATES = {
  0: 'hidden',
  1: 'indeterminate',
  2: 'normal',
  3: 'error',
  4: 'warning'
} as const

// Timing constants for System B debounce
export const STATUS_TIMING = {
  MIN_HOLD_MS: 500,
  PROMPT_SILENCE_MS: 300,
  FAILED_PERSIST_MS: 2000,
  FAILED_WINDOW_MS: 3000,
  ACTIVITY_TIMEOUT_MS: 60_000,
  AGENT_LAUNCH_TIMEOUT_MS: 30_000,
  OUTPUT_BUFFER_LINES: 20
} as const

// Default zoom
export const ZOOM = {
  DEFAULT: 14,
  MIN: 8,
  MAX: 32,
  STEP: 2
} as const
```

**Step 3: Commit**

```bash
git add src/shared/
git commit -m "feat: define shared types and constants for session, status, and agents"
```

---

### Task 4: Implement and Test mapStatusToUI()

**Files:**
- Create: `src/shared/statusMapping.ts`
- Create: `src/shared/__tests__/statusMapping.test.ts`

**Step 1: Write the failing tests**

`src/shared/__tests__/statusMapping.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { mapStatusToUI } from '../statusMapping'
import type { SessionStatus } from '../types'

describe('mapStatusToUI', () => {
  describe('shell status (no dot)', () => {
    it.each(['shell_ready', 'exited'] as SessionStatus[])('%s → shell', (status) => {
      const ui = mapStatusToUI(status)
      expect(ui.label).toBe('shell')
      expect(ui.dotVisible).toBe(false)
      expect(ui.dotColor).toBeNull()
      expect(ui.dotAnimation).toBe('none')
      expect(ui.barColor).toBeNull()
      expect(ui.bgTint).toBe('transparent')
    })
  })

  describe('running status (green, pulsing)', () => {
    it.each(['processing', 'tool_executing'] as SessionStatus[])('%s → running', (status) => {
      const ui = mapStatusToUI(status)
      expect(ui.label).toBe('running')
      expect(ui.dotVisible).toBe(true)
      expect(ui.dotColor).toBe('--running')
      expect(ui.dotAnimation).toBe('pulse-slow')
      expect(ui.barColor).toBe('--running')
      expect(ui.bgTintSelected).toBe('rgba(0, 255, 68, 0.10)')
    })
  })

  describe('idle status (amber, static)', () => {
    it.each(['agent_launching', 'agent_ready', 'needs_input'] as SessionStatus[])('%s → idle', (status) => {
      const ui = mapStatusToUI(status)
      expect(ui.label).toBe('idle')
      expect(ui.dotVisible).toBe(true)
      expect(ui.dotColor).toBe('--idle')
      expect(ui.dotAnimation).toBe('none')
      expect(ui.barColor).toBe('--idle')
    })
  })

  describe('error status (red, fast pulse)', () => {
    it('failed → error', () => {
      const ui = mapStatusToUI('failed')
      expect(ui.label).toBe('error')
      expect(ui.dotVisible).toBe(true)
      expect(ui.dotColor).toBe('--error')
      expect(ui.dotAnimation).toBe('pulse-fast')
      expect(ui.barColor).toBe('--error')
    })
  })

  it('returns all required UI fields for every status', () => {
    const allStatuses: SessionStatus[] = [
      'shell_ready', 'agent_launching', 'agent_ready', 'processing',
      'tool_executing', 'needs_input', 'failed', 'exited'
    ]
    for (const status of allStatuses) {
      const ui = mapStatusToUI(status)
      expect(ui).toHaveProperty('label')
      expect(ui).toHaveProperty('dotVisible')
      expect(ui).toHaveProperty('dotColor')
      expect(ui).toHaveProperty('dotAnimation')
      expect(ui).toHaveProperty('barColor')
      expect(ui).toHaveProperty('bgTint')
      expect(ui).toHaveProperty('bgTintSelected')
      expect(ui).toHaveProperty('bgTintHover')
      expect(ui).toHaveProperty('glowShadow')
    }
  })
})
```

**Step 2: Verify tests fail**

```bash
npx vitest run src/shared/__tests__/statusMapping.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement mapStatusToUI()**

`src/shared/statusMapping.ts`:
```typescript
import type { SessionStatus, UIStatusIndicator } from './types'

export function mapStatusToUI(status: SessionStatus): UIStatusIndicator {
  switch (status) {
    case 'shell_ready':
    case 'exited':
      return {
        label: 'shell',
        dotVisible: false,
        dotColor: null,
        dotAnimation: 'none',
        barColor: null,
        bgTint: 'transparent',
        bgTintSelected: 'var(--bg-active)',
        bgTintHover: 'var(--bg-hover)',
        glowShadow: 'none'
      }

    case 'processing':
    case 'tool_executing':
      return {
        label: 'running',
        dotVisible: true,
        dotColor: '--running',
        dotAnimation: 'pulse-slow',
        barColor: '--running',
        bgTint: 'rgba(0, 255, 68, 0.04)',
        bgTintSelected: 'rgba(0, 255, 68, 0.10)',
        bgTintHover: 'rgba(0, 255, 68, 0.07)',
        glowShadow: 'inset 0 0 12px rgba(0, 255, 68, 0.06), 0 0 8px rgba(0, 255, 68, 0.03)'
      }

    case 'agent_launching':
    case 'agent_ready':
    case 'needs_input':
      return {
        label: 'idle',
        dotVisible: true,
        dotColor: '--idle',
        dotAnimation: 'none',
        barColor: '--idle',
        bgTint: 'rgba(255, 184, 0, 0.04)',
        bgTintSelected: 'rgba(255, 184, 0, 0.10)',
        bgTintHover: 'rgba(255, 184, 0, 0.07)',
        glowShadow: 'inset 0 0 12px rgba(255, 184, 0, 0.06), 0 0 8px rgba(255, 184, 0, 0.03)'
      }

    case 'failed':
      return {
        label: 'error',
        dotVisible: true,
        dotColor: '--error',
        dotAnimation: 'pulse-fast',
        barColor: '--error',
        bgTint: 'rgba(255, 68, 119, 0.04)',
        bgTintSelected: 'rgba(255, 68, 119, 0.10)',
        bgTintHover: 'rgba(255, 68, 119, 0.07)',
        glowShadow: 'inset 0 0 12px rgba(255, 68, 119, 0.06), 0 0 8px rgba(255, 68, 119, 0.03)'
      }
  }
}
```

**Step 4: Verify tests pass**

```bash
npx vitest run src/shared/__tests__/statusMapping.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/shared/statusMapping.ts src/shared/__tests__/
git commit -m "feat: implement mapStatusToUI() with full test coverage"
```

---

### Task 5: Implement and Test canTransition()

**Files:**
- Create: `src/shared/transitions.ts`
- Create: `src/shared/__tests__/transitions.test.ts`

**Step 1: Write the failing tests**

`src/shared/__tests__/transitions.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { canTransition } from '../transitions'

describe('canTransition', () => {
  // Valid transitions from PRD table
  const validTransitions = [
    ['shell_ready', 'agent_launching'],
    ['agent_launching', 'agent_ready'],
    ['agent_launching', 'failed'],
    ['agent_ready', 'processing'],
    ['agent_ready', 'shell_ready'],
    ['processing', 'agent_ready'],
    ['processing', 'tool_executing'],
    ['processing', 'needs_input'],
    ['processing', 'failed'],
    ['tool_executing', 'processing'],
    ['tool_executing', 'agent_ready'],
    ['tool_executing', 'failed'],
    ['needs_input', 'processing'],
    ['needs_input', 'agent_ready'],
    ['failed', 'agent_ready'],
    ['failed', 'processing'],
  ] as const

  it.each(validTransitions)('%s → %s is valid', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  // Any → exited is always valid
  it.each([
    'shell_ready', 'agent_launching', 'agent_ready', 'processing',
    'tool_executing', 'needs_input', 'failed'
  ] as const)('%s → exited is valid', (from) => {
    expect(canTransition(from, 'exited')).toBe(true)
  })

  // Any → failed is always valid
  it.each([
    'shell_ready', 'agent_launching', 'agent_ready', 'processing',
    'tool_executing', 'needs_input'
  ] as const)('%s → failed is valid', (from) => {
    expect(canTransition(from, 'failed')).toBe(true)
  })

  // exited is terminal — no transitions out
  it.each([
    'shell_ready', 'agent_launching', 'agent_ready', 'processing',
    'tool_executing', 'needs_input', 'failed', 'exited'
  ] as const)('exited → %s is invalid', (to) => {
    expect(canTransition('exited', to)).toBe(false)
  })

  // Invalid transitions
  const invalidTransitions = [
    ['shell_ready', 'processing'],
    ['shell_ready', 'agent_ready'],
    ['agent_launching', 'processing'],
    ['agent_launching', 'tool_executing'],
    ['agent_ready', 'tool_executing'],
    ['agent_ready', 'needs_input'],
    ['processing', 'shell_ready'],
    ['processing', 'agent_launching'],
    ['needs_input', 'shell_ready'],
    ['needs_input', 'tool_executing'],
  ] as const

  it.each(invalidTransitions)('%s → %s is invalid', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
  })
})
```

**Step 2: Verify tests fail**

```bash
npx vitest run src/shared/__tests__/transitions.test.ts
```

**Step 3: Implement canTransition()**

`src/shared/transitions.ts`:
```typescript
import type { SessionStatus } from './types'

const VALID_TRANSITIONS = new Set<string>([
  'shell_ready->agent_launching',
  'agent_launching->agent_ready',
  'agent_launching->failed',
  'agent_ready->processing',
  'agent_ready->shell_ready',
  'processing->agent_ready',
  'processing->tool_executing',
  'processing->needs_input',
  'processing->failed',
  'tool_executing->processing',
  'tool_executing->agent_ready',
  'tool_executing->failed',
  'needs_input->processing',
  'needs_input->agent_ready',
  'failed->agent_ready',
  'failed->processing',
])

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  // exited is terminal — no transitions out
  if (from === 'exited') return false

  // Any → exited is always valid (PTY close)
  if (to === 'exited') return true

  // Any → failed is always valid (error detected)
  if (to === 'failed') return true

  return VALID_TRANSITIONS.has(`${from}->${to}`)
}
```

**Step 4: Verify tests pass**

```bash
npx vitest run src/shared/__tests__/transitions.test.ts
```

**Step 5: Commit**

```bash
git add src/shared/transitions.ts src/shared/__tests__/transitions.test.ts
git commit -m "feat: implement canTransition() state machine guard with tests"
```

---

## Phase 2: Main Process Foundation

### Task 6: PtyManager

**Files:**
- Create: `src/main/pty/PtyManager.ts`

**Step 1: Implement PtyManager**

`src/main/pty/PtyManager.ts`:
```typescript
import * as pty from 'node-pty'
import { EventEmitter } from 'events'

export interface PtyInstance {
  id: string
  process: pty.IPty
}

export class PtyManager extends EventEmitter {
  private instances = new Map<string, pty.IPty>()

  spawn(id: string, cwd: string): pty.IPty {
    const shell = 'powershell.exe'
    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd,
      env: process.env as Record<string, string>
    })

    this.instances.set(id, proc)

    proc.onExit(({ exitCode }) => {
      this.instances.delete(id)
      this.emit('exit', id, exitCode)
    })

    return proc
  }

  write(id: string, data: string): void {
    this.instances.get(id)?.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.instances.get(id)?.resize(cols, rows)
  }

  kill(id: string): void {
    const proc = this.instances.get(id)
    if (proc) {
      proc.kill()
      this.instances.delete(id)
    }
  }

  get(id: string): pty.IPty | undefined {
    return this.instances.get(id)
  }

  dispose(): void {
    for (const [id, proc] of this.instances) {
      proc.kill()
    }
    this.instances.clear()
  }
}
```

**Step 2: Commit**

```bash
git add src/main/pty/
git commit -m "feat: add PtyManager for spawning and managing node-pty instances"
```

---

### Task 7: SessionStore

**Files:**
- Create: `src/main/session/SessionStore.ts`

**Step 1: Implement SessionStore**

`src/main/session/SessionStore.ts`:
```typescript
import { EventEmitter } from 'events'
import { canTransition } from '@shared/transitions'
import type { Session, SessionStatus } from '@shared/types'

export class SessionStore extends EventEmitter {
  private sessions = new Map<string, Session>()

  getAll(): Session[] {
    return Array.from(this.sessions.values())
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  add(session: Session): void {
    this.sessions.set(session.id, session)
    this.emit('created', session)
  }

  remove(id: string): void {
    this.sessions.delete(id)
    this.emit('closed', id)
  }

  /**
   * Atomic update for CWD-related fields.
   * folderPath, folderName, and name update together per Naming Rule 6.
   */
  updateCwd(id: string, newPath: string, newFolderName: string): void {
    const session = this.sessions.get(id)
    if (!session) return

    session.folderPath = newPath
    session.folderName = newFolderName
    // Naming Rule 2: auto-update name unless manually renamed
    if (!session.isRenamed) {
      session.name = newFolderName
    }
    session.updatedAt = Date.now()
    this.emit('updated', session)
  }

  /**
   * Status update with transition validation.
   * Invalid transitions are logged and ignored (never thrown).
   */
  updateStatus(id: string, newStatus: SessionStatus): void {
    const session = this.sessions.get(id)
    if (!session) return

    if (!canTransition(session.status, newStatus)) {
      console.warn(
        `[SessionStore] Invalid transition: ${session.status} -> ${newStatus} (session ${id})`
      )
      return
    }

    session.status = newStatus
    session.updatedAt = Date.now()
    this.emit('updated', session)
  }

  /**
   * Promote shell session to agent type.
   * Naming Rule 3: name is NOT changed during agent detection.
   */
  promoteToAgent(id: string, agentType: 'copilot-cli' | 'claude-code'): void {
    const session = this.sessions.get(id)
    if (!session) return

    session.agentType = agentType
    // Status transitions shell_ready -> agent_launching
    this.updateStatus(id, 'agent_launching')
  }

  /**
   * Manual rename. Naming Rule 4: sticky.
   */
  rename(id: string, newName: string): void {
    const session = this.sessions.get(id)
    if (!session) return

    session.name = newName
    session.isRenamed = true
    session.updatedAt = Date.now()
    this.emit('updated', session)
  }

  updateActivity(id: string, activity: string): void {
    const session = this.sessions.get(id)
    if (!session) return

    session.lastActivity = activity
    session.updatedAt = Date.now()
    this.emit('updated', session)
  }
}
```

**Step 2: Commit**

```bash
git add src/main/session/
git commit -m "feat: add SessionStore with atomic updates and transition validation"
```

---

### Task 8: SessionManager

**Files:**
- Create: `src/main/session/SessionManager.ts`

**Step 1: Implement SessionManager**

`src/main/session/SessionManager.ts`:
```typescript
import { v4 as uuid } from 'uuid'
import path from 'path'
import { SessionStore } from './SessionStore'
import { PtyManager } from '../pty/PtyManager'
import type { Session } from '@shared/types'

export class SessionManager {
  private activeSessionId: string | null = null

  constructor(
    private store: SessionStore,
    private ptyManager: PtyManager
  ) {
    // Wire PTY exit events to session store
    this.ptyManager.on('exit', (ptyId: string, exitCode: number) => {
      const session = this.findByPtyId(ptyId)
      if (session) {
        session.exitCode = exitCode
        this.store.updateStatus(session.id, 'exited')
      }
    })
  }

  create(cwd?: string): Session {
    const workingDir = cwd || process.env.USERPROFILE || 'C:\\'
    const folderName = path.basename(workingDir)
    const sessionId = uuid()
    const ptyId = uuid()

    // Spawn PTY
    const proc = this.ptyManager.spawn(ptyId, workingDir)

    const session: Session = {
      id: sessionId,
      agentType: 'shell',
      name: folderName,        // Naming Rule 1: initial name = folder name
      folderName,
      folderPath: workingDir,
      isRenamed: false,
      status: 'shell_ready',
      lastActivity: '',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      ptyId,
      isExternal: false
    }

    this.store.add(session)
    this.activeSessionId = sessionId
    return session
  }

  close(sessionId: string): void {
    const session = this.store.get(sessionId)
    if (!session) return

    this.ptyManager.kill(session.ptyId)
    this.store.remove(sessionId)

    if (this.activeSessionId === sessionId) {
      const remaining = this.store.getAll()
      this.activeSessionId = remaining.length > 0 ? remaining[0].id : null
    }
  }

  select(sessionId: string): void {
    this.activeSessionId = sessionId
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId
  }

  getActiveSession(): Session | undefined {
    return this.activeSessionId
      ? this.store.get(this.activeSessionId)
      : undefined
  }

  private findByPtyId(ptyId: string): Session | undefined {
    return this.store.getAll().find(s => s.ptyId === ptyId)
  }
}
```

**Step 2: Commit**

```bash
git add src/main/session/SessionManager.ts
git commit -m "feat: add SessionManager for session lifecycle and PTY coordination"
```

---

### Task 9: AgentStore and AgentLauncher

**Files:**
- Create: `src/main/agents/AgentStore.ts`
- Create: `src/main/agents/AgentLauncher.ts`

**Step 1: Implement AgentStore**

`src/main/agents/AgentStore.ts`:
```typescript
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { v4 as uuid } from 'uuid'
import type { AgentGroup, AgentStore as AgentStoreData } from '@shared/types'

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
```

**Step 2: Implement AgentLauncher**

`src/main/agents/AgentLauncher.ts`:
```typescript
import type { AgentProfile } from '@shared/types'
import type { PtyManager } from '../pty/PtyManager'
import type { SessionStore } from '../session/SessionStore'
import type { SessionManager } from '../session/SessionManager'

/**
 * Escape a value for PowerShell single-quoted string.
 * In PS single quotes, the only escape is '' for a literal '.
 */
function psEscape(value: string): string {
  return value.replace(/'/g, "''")
}

export class AgentLauncher {
  constructor(
    private ptyManager: PtyManager,
    private sessionStore: SessionStore,
    private sessionManager: SessionManager
  ) {}

  launch(agent: AgentProfile, sessionId: string): void {
    let targetSessionId = sessionId

    if (agent.launchTarget === 'newTab') {
      const currentSession = this.sessionStore.get(sessionId)
      if (!currentSession) return
      const newSession = this.sessionManager.create(currentSession.folderPath)
      targetSessionId = newSession.id
    }

    const targetSession = this.sessionStore.get(targetSessionId)
    if (!targetSession) return

    // Build command lines
    const lines: string[] = []

    // Set environment variables
    if (agent.env) {
      for (const [key, value] of Object.entries(agent.env)) {
        lines.push(`$env:${key} = '${psEscape(value)}'`)
      }
    }

    // Build the command with args
    const args = agent.args.map(a => `'${psEscape(a)}'`).join(' ')
    const cmd = args ? `${agent.command} ${args}` : agent.command
    lines.push(cmd)

    // Join with \r and terminate with \r
    const payload = lines.join('\r') + '\r'
    this.ptyManager.write(targetSession.ptyId, payload)

    // Promote session: Naming Rule 3 — name is NOT changed
    const agentType = agent.command.includes('copilot') ? 'copilot-cli' as const
                    : agent.command.includes('claude') ? 'claude-code' as const
                    : 'shell' as const

    if (agentType !== 'shell') {
      this.sessionStore.promoteToAgent(targetSessionId, agentType)
    }
  }
}
```

**Step 3: Commit**

```bash
git add src/main/agents/
git commit -m "feat: add AgentStore persistence and AgentLauncher command injection"
```

---

### Task 10: IPC Handlers and Preload

**Files:**
- Create: `src/main/ipc/handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

**Step 1: Implement IPC handlers**

`src/main/ipc/handlers.ts`:
```typescript
import { ipcMain, BrowserWindow } from 'electron'
import type { SessionManager } from '../session/SessionManager'
import type { SessionStore } from '../session/SessionStore'
import type { PtyManager } from '../pty/PtyManager'
import type { AgentStore } from '../agents/AgentStore'
import type { AgentLauncher } from '../agents/AgentLauncher'

export function registerIpcHandlers(deps: {
  sessionManager: SessionManager
  sessionStore: SessionStore
  ptyManager: PtyManager
  agentStore: AgentStore
  agentLauncher: AgentLauncher
  getWindow: () => BrowserWindow | null
}): void {
  const { sessionManager, sessionStore, ptyManager, agentStore, agentLauncher, getWindow } = deps

  // --- Sessions ---
  ipcMain.handle('session:getAll', () => sessionStore.getAll())
  ipcMain.handle('session:create', () => sessionManager.create())
  ipcMain.handle('session:close', (_, id: string) => sessionManager.close(id))
  ipcMain.handle('session:select', (_, id: string) => sessionManager.select(id))
  ipcMain.handle('session:rename', (_, id: string, name: string) => sessionStore.rename(id, name))

  // Forward store events to renderer
  sessionStore.on('created', (session) => {
    getWindow()?.webContents.send('session:created', session)
  })
  sessionStore.on('updated', (session) => {
    getWindow()?.webContents.send('session:updated', session)
  })
  sessionStore.on('closed', (sessionId) => {
    getWindow()?.webContents.send('session:closed', sessionId)
  })

  // --- Terminal ---
  ipcMain.on('terminal:write', (_, sessionId: string, data: string) => {
    const session = sessionStore.get(sessionId)
    if (session) ptyManager.write(session.ptyId, data)
  })

  ipcMain.on('terminal:resize', (_, sessionId: string, cols: number, rows: number) => {
    const session = sessionStore.get(sessionId)
    if (session) ptyManager.resize(session.ptyId, cols, rows)
  })

  // PTY data → renderer (set up per session when created)
  ipcMain.handle('terminal:attach', (_, sessionId: string) => {
    const session = sessionStore.get(sessionId)
    if (!session) return
    const proc = ptyManager.get(session.ptyId)
    if (!proc) return
    proc.onData((data) => {
      getWindow()?.webContents.send(`terminal:data:${sessionId}`, data)
    })
  })

  // --- Agents ---
  ipcMain.handle('agents:getGroups', () => agentStore.getGroups())
  ipcMain.handle('agents:saveGroups', async (_, groups) => {
    await agentStore.save(groups)
  })
  ipcMain.handle('agents:launch', (_, agentId: string, sessionId: string) => {
    const agent = agentStore.findAgent(agentId)
    if (agent) agentLauncher.launch(agent, sessionId)
  })

  // --- App ---
  let zoomLevel = 14
  ipcMain.handle('app:getZoom', () => zoomLevel)
  ipcMain.handle('app:setZoom', (_, level: number) => {
    zoomLevel = Math.max(8, Math.min(32, level))
    getWindow()?.webContents.send('app:zoomChanged', zoomLevel)
    return zoomLevel
  })
}
```

**Step 2: Update main process entry to wire everything**

`src/main/index.ts` — replace the minimal version from Task 2 with full wiring:
```typescript
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { PtyManager } from './pty/PtyManager'
import { SessionStore } from './session/SessionStore'
import { SessionManager } from './session/SessionManager'
import { AgentStore } from './agents/AgentStore'
import { AgentLauncher } from './agents/AgentLauncher'
import { registerIpcHandlers } from './ipc/handlers'

let mainWindow: BrowserWindow | null = null

// Core services
const ptyManager = new PtyManager()
const sessionStore = new SessionStore()
const sessionManager = new SessionManager(sessionStore, ptyManager)
const agentStore = new AgentStore()
const agentLauncher = new AgentLauncher(ptyManager, sessionStore, sessionManager)

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#0d1117',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Register all IPC handlers
  registerIpcHandlers({
    sessionManager,
    sessionStore,
    ptyManager,
    agentStore,
    agentLauncher,
    getWindow: () => mainWindow
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await agentStore.load()
  createWindow()
})

app.on('window-all-closed', () => {
  ptyManager.dispose()
  app.quit()
})
```

**Step 3: Implement full preload script**

`src/preload/index.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron'

const tangentAPI = {
  session: {
    getAll: () => ipcRenderer.invoke('session:getAll'),
    create: () => ipcRenderer.invoke('session:create'),
    close: (id: string) => ipcRenderer.invoke('session:close', id),
    select: (id: string) => ipcRenderer.invoke('session:select', id),
    rename: (id: string, name: string) => ipcRenderer.invoke('session:rename', id, name),

    onCreated: (cb: (session: any) => void) => {
      const handler = (_: any, session: any) => cb(session)
      ipcRenderer.on('session:created', handler)
      return () => ipcRenderer.removeListener('session:created', handler)
    },
    onUpdated: (cb: (session: any) => void) => {
      const handler = (_: any, session: any) => cb(session)
      ipcRenderer.on('session:updated', handler)
      return () => ipcRenderer.removeListener('session:updated', handler)
    },
    onClosed: (cb: (sessionId: string) => void) => {
      const handler = (_: any, sessionId: string) => cb(sessionId)
      ipcRenderer.on('session:closed', handler)
      return () => ipcRenderer.removeListener('session:closed', handler)
    }
  },

  terminal: {
    write: (sessionId: string, data: string) => {
      ipcRenderer.send('terminal:write', sessionId, data)
    },
    attach: (sessionId: string) => ipcRenderer.invoke('terminal:attach', sessionId),
    onData: (sessionId: string, cb: (data: string) => void) => {
      const channel = `terminal:data:${sessionId}`
      const handler = (_: any, data: string) => cb(data)
      ipcRenderer.on(channel, handler)
      return () => ipcRenderer.removeListener(channel, handler)
    },
    resize: (sessionId: string, cols: number, rows: number) => {
      ipcRenderer.send('terminal:resize', sessionId, cols, rows)
    }
  },

  agents: {
    getGroups: () => ipcRenderer.invoke('agents:getGroups'),
    saveGroups: (groups: any) => ipcRenderer.invoke('agents:saveGroups', groups),
    launch: (agentId: string, sessionId: string) =>
      ipcRenderer.invoke('agents:launch', agentId, sessionId),

    onUpdated: (cb: (groups: any) => void) => {
      const handler = (_: any, groups: any) => cb(groups)
      ipcRenderer.on('agents:updated', handler)
      return () => ipcRenderer.removeListener('agents:updated', handler)
    }
  },

  app: {
    getZoom: () => ipcRenderer.invoke('app:getZoom'),
    setZoom: (level: number) => ipcRenderer.invoke('app:setZoom', level),
    onZoomChanged: (cb: (level: number) => void) => {
      const handler = (_: any, level: number) => cb(level)
      ipcRenderer.on('app:zoomChanged', handler)
      return () => ipcRenderer.removeListener('app:zoomChanged', handler)
    }
  }
}

contextBridge.exposeInMainWorld('tangentAPI', tangentAPI)
```

**Step 4: Verify app still launches**

```bash
npm run dev
```

**Step 5: Commit**

```bash
git add src/main/ src/preload/
git commit -m "feat: wire IPC handlers and preload contextBridge for full API surface"
```

---

## Phase 3: Renderer — Layout, Theme, Terminal

### Task 11: GitHub Dark Theme CSS

**Files:**
- Modify: `src/renderer/styles/globals.css`

**Step 1: Write the full GitHub Dark theme**

`src/renderer/styles/globals.css`:
```css
@import "tailwindcss";

/* === GitHub Dark Color Theme === */
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #1c2128;
  --bg-hover: #21262d;
  --bg-active: #1a2233;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #484f58;
  --accent: #58a6ff;
  --running: #00ff44;
  --error: #ff4477;
  --idle: #ffb800;

  --font-mono: 'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace;
  --font-ui: system-ui, -apple-system, sans-serif;
}

/* === Pulse Animations === */
@keyframes pulse-slow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes pulse-fast {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.animate-pulse-slow {
  animation: pulse-slow 2s ease-in-out infinite;
}

.animate-pulse-fast {
  animation: pulse-fast 1.5s ease-in-out infinite;
}

/* === Base Styles === */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-ui);
  overflow: hidden;
  user-select: none;
}

/* === Scrollbar Styling === */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--bg-hover);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* === xterm.js overrides === */
.xterm {
  padding: 4px;
}
```

**Step 2: Commit**

```bash
git add src/renderer/styles/
git commit -m "feat: add GitHub Dark theme with CSS custom properties and pulse animations"
```

---

### Task 12: App Layout Shell

**Files:**
- Modify: `src/renderer/App.tsx`
- Create: `src/renderer/components/SessionsPanel/SessionsPanel.tsx`
- Create: `src/renderer/components/Terminal/TerminalViewport.tsx`
- Create: `src/renderer/components/AgentsSidebar/AgentsSidebar.tsx`
- Create: `src/renderer/components/StatusBar/StatusBar.tsx`

**Step 1: Create placeholder components**

Each placeholder returns a styled div with its name. Example for `SessionsPanel.tsx`:
```tsx
export function SessionsPanel() {
  return (
    <div className="w-[240px] min-w-[240px] h-full border-r border-[var(--bg-hover)]"
         style={{ background: 'var(--bg-secondary)' }}>
      <div className="p-3 text-xs uppercase tracking-wider text-[var(--text-muted)]">
        Sessions
      </div>
    </div>
  )
}
```

Similar placeholders for `TerminalViewport`, `AgentsSidebar`, `StatusBar`.

**Step 2: Implement App.tsx layout**

```tsx
import { SessionsPanel } from '@/components/SessionsPanel/SessionsPanel'
import { TerminalViewport } from '@/components/Terminal/TerminalViewport'
import { AgentsSidebar } from '@/components/AgentsSidebar/AgentsSidebar'
import { StatusBar } from '@/components/StatusBar/StatusBar'

export function App() {
  return (
    <div className="flex flex-col h-screen w-screen">
      {/* Main content: 3 columns */}
      <div className="flex flex-1 min-h-0">
        <SessionsPanel />
        <TerminalViewport />
        <AgentsSidebar />
      </div>
      {/* Status bar: 24px */}
      <StatusBar />
    </div>
  )
}
```

**Step 3: Verify layout renders**

```bash
npm run dev
```

Expected: Three-column layout visible with status bar at bottom.

**Step 4: Commit**

```bash
git add src/renderer/
git commit -m "feat: add 3-column App layout with placeholder panels"
```

---

### Task 13: Terminal Viewport with xterm.js

**Files:**
- Modify: `src/renderer/components/Terminal/TerminalViewport.tsx`
- Create: `src/renderer/hooks/useSession.ts`

**Step 1: Create useSession hook**

`src/renderer/hooks/useSession.ts`:
```tsx
import { useState, useEffect, useCallback } from 'react'
import type { Session } from '@shared/types'

declare global {
  interface Window {
    tangentAPI: any
  }
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    // Load initial sessions
    window.tangentAPI.session.getAll().then((all: Session[]) => {
      setSessions(all)
      if (all.length > 0 && !activeId) {
        setActiveId(all[0].id)
      }
    })

    const unsubCreated = window.tangentAPI.session.onCreated((session: Session) => {
      setSessions(prev => [...prev, session])
      setActiveId(session.id)
    })

    const unsubUpdated = window.tangentAPI.session.onUpdated((session: Session) => {
      setSessions(prev => prev.map(s => s.id === session.id ? session : s))
    })

    const unsubClosed = window.tangentAPI.session.onClosed((sessionId: string) => {
      setSessions(prev => {
        const next = prev.filter(s => s.id !== sessionId)
        if (activeId === sessionId) {
          setActiveId(next.length > 0 ? next[0].id : null)
        }
        return next
      })
    })

    return () => {
      unsubCreated()
      unsubUpdated()
      unsubClosed()
    }
  }, [])

  const createSession = useCallback(async () => {
    const session = await window.tangentAPI.session.create()
    return session
  }, [])

  const selectSession = useCallback((id: string) => {
    setActiveId(id)
    window.tangentAPI.session.select(id)
  }, [])

  const closeSession = useCallback((id: string) => {
    window.tangentAPI.session.close(id)
  }, [])

  const renameSession = useCallback((id: string, name: string) => {
    window.tangentAPI.session.rename(id, name)
  }, [])

  return {
    sessions,
    activeId,
    activeSession: sessions.find(s => s.id === activeId),
    createSession,
    selectSession,
    closeSession,
    renameSession
  }
}
```

**Step 2: Implement TerminalViewport**

`src/renderer/components/Terminal/TerminalViewport.tsx`:
```tsx
import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewportProps {
  sessions: { id: string }[]
  activeId: string | null
  fontSize: number
}

interface TerminalInstance {
  terminal: Terminal
  fitAddon: FitAddon
  cleanup: () => void
}

export function TerminalViewport({ sessions, activeId, fontSize }: TerminalViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instancesRef = useRef<Map<string, TerminalInstance>>(new Map())

  // Create/destroy terminal instances as sessions change
  useEffect(() => {
    const currentIds = new Set(sessions.map(s => s.id))
    const instances = instancesRef.current

    // Remove terminals for closed sessions
    for (const [id, inst] of instances) {
      if (!currentIds.has(id)) {
        inst.cleanup()
        inst.terminal.dispose()
        instances.delete(id)
      }
    }

    // Create terminals for new sessions
    for (const session of sessions) {
      if (!instances.has(session.id) && containerRef.current) {
        const terminal = new Terminal({
          fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace",
          fontSize,
          theme: {
            background: '#0d1117',
            foreground: '#e6edf3',
            cursor: '#58a6ff',
            selectionBackground: '#264f78'
          },
          cursorBlink: true,
          allowProposedApi: true
        })
        const fitAddon = new FitAddon()
        terminal.loadAddon(fitAddon)

        const div = document.createElement('div')
        div.style.height = '100%'
        div.style.display = 'none'
        div.dataset.sessionId = session.id
        containerRef.current.appendChild(div)

        terminal.open(div)
        fitAddon.fit()

        // Attach to PTY data stream
        window.tangentAPI.terminal.attach(session.id)
        const unsubData = window.tangentAPI.terminal.onData(session.id, (data: string) => {
          terminal.write(data)
        })

        // Forward user input to PTY
        const onDataDisposable = terminal.onData((data) => {
          window.tangentAPI.terminal.write(session.id, data)
        })

        // Report resize
        const onResizeDisposable = terminal.onResize(({ cols, rows }) => {
          window.tangentAPI.terminal.resize(session.id, cols, rows)
        })

        instances.set(session.id, {
          terminal,
          fitAddon,
          cleanup: () => {
            unsubData()
            onDataDisposable.dispose()
            onResizeDisposable.dispose()
            div.remove()
          }
        })
      }
    }
  }, [sessions, fontSize])

  // Show/hide terminals based on active session
  useEffect(() => {
    const instances = instancesRef.current
    for (const [id, inst] of instances) {
      const div = inst.terminal.element?.parentElement
      if (div) {
        div.style.display = id === activeId ? 'block' : 'none'
      }
      if (id === activeId) {
        inst.fitAddon.fit()
        inst.terminal.focus()
      }
    }
  }, [activeId])

  // Handle resize
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const inst = activeId ? instancesRef.current.get(activeId) : null
      if (inst) inst.fitAddon.fit()
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [activeId])

  // Update font size
  useEffect(() => {
    for (const [, inst] of instancesRef.current) {
      inst.terminal.options.fontSize = fontSize
      inst.fitAddon.fit()
    }
  }, [fontSize])

  return (
    <div ref={containerRef} className="flex-1 min-w-0 h-full" />
  )
}
```

**Step 3: Wire into App.tsx**

Update `App.tsx` to use `useSessions()` hook and pass props to `TerminalViewport`.

**Step 4: Verify terminal renders and accepts input**

```bash
npm run dev
```

Expected: PowerShell prompt appears in the terminal area. Typing works.

**Step 5: Commit**

```bash
git add src/renderer/
git commit -m "feat: integrate xterm.js terminal with PTY via IPC"
```

---

## Phase 4: Sessions Panel

### Task 14: SessionItem Component

**Files:**
- Create: `src/renderer/components/SessionsPanel/SessionItem.tsx`

**Step 1: Implement SessionItem with status-colored styling**

The component takes a `Session` and renders the full status-styled card per the PRD: left edge color bar (3px), tinted background, status dot, agent badge, close button on hover, last activity text. All visual properties derived from `mapStatusToUI(session.status)`.

CSS transitions: `transition: background 400ms ease, border-color 400ms ease`.

Left bar uses `animate-pulse-slow` for running, `animate-pulse-fast` for error, static otherwise.

**Step 2: Commit**

```bash
git add src/renderer/components/SessionsPanel/SessionItem.tsx
git commit -m "feat: add SessionItem with status-colored cards per PRD spec"
```

---

### Task 15: SessionsPanel with Sections and Interactions

**Files:**
- Modify: `src/renderer/components/SessionsPanel/SessionsPanel.tsx`
- Create: `src/renderer/components/SessionsPanel/SessionFilter.tsx`

**Step 1: Implement SessionsPanel**

Two collapsible sections: Active (live PTY) and Recent (last 48h). "Show N older sessions" button for sessions > 48h.

Keyboard interactions:
- `j`/`k` navigation
- `Enter` to select
- `x`/`Delete` to close
- `F2` to rename (inline editing)
- `/` to open filter
- `Escape` to clear filter/unfocus

"+ New Session" button at bottom.

**Step 2: Implement SessionFilter**

Simple text input that filters sessions by name/folderName.

**Step 3: Wire into App.tsx with Ctrl+B toggle**

**Step 4: Commit**

```bash
git add src/renderer/components/SessionsPanel/
git commit -m "feat: add SessionsPanel with sections, filter, and keyboard navigation"
```

---

## Phase 5: Status Engine

### Task 16: System B — Output Parsing

**Files:**
- Create: `src/main/status/SystemB.ts`
- Create: `src/main/status/__tests__/SystemB.test.ts`

**Step 1: Write tests for pattern matching and debounce**

Test each detection rule from the PRD:
1. `PS {path}>` → `shell_ready`
2. `❯` at line start → `agent_ready` (after 300ms silence)
3. `›` at line start → `agent_ready` (after 300ms silence)
4. Spinner characters → `processing` (eager)
5. `thinking`/`Thinking` → `processing` (eager)
6. Tool patterns → `tool_executing`
7. y/n patterns → `needs_input`
8. Error patterns → `failed` (requires 2 matches)

Test debounce: 500ms minimum hold, 300ms prompt silence, 2-match failed requirement.

**Step 2: Implement SystemB**

Maintains a rolling 20-line buffer. Runs pattern matching on each PTY output chunk. Manages debounce timers. Emits status change recommendations.

**Step 3: Verify tests pass**

**Step 4: Commit**

```bash
git add src/main/status/
git commit -m "feat: implement System B output parser with debounce and hysteresis"
```

---

### Task 17: OSC Sequence Detection

> **New signal source:** Intercept OSC 2 (title), OSC 9;4 (progress), and BEL from PTY output. These provide higher-confidence status signals than text pattern matching.

**Files:**
- Create: `src/main/status/OscParser.ts`
- Create: `src/main/status/__tests__/OscParser.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest'
import { OscParser } from '../OscParser'

describe('OscParser', () => {
  it('detects OSC 2 title changes', () => {
    const parser = new OscParser()
    const events: any[] = []
    parser.on('title', (title: string) => events.push({ type: 'title', title }))

    parser.feed('\x1b]2;Build App From Spec\x07')
    expect(events).toEqual([{ type: 'title', title: 'Build App From Spec' }])
  })

  it('detects OSC 9;4 progress state changes', () => {
    const parser = new OscParser()
    const events: any[] = []
    parser.on('progress', (state: number) => events.push({ type: 'progress', state }))

    parser.feed('\x1b]9;4;1;0\x07')  // indeterminate (spinner)
    parser.feed('\x1b]9;4;0;0\x07')  // hidden (done)
    expect(events).toEqual([
      { type: 'progress', state: 1 },
      { type: 'progress', state: 0 }
    ])
  })

  it('detects standalone BEL', () => {
    const parser = new OscParser()
    const events: any[] = []
    parser.on('bell', () => events.push({ type: 'bell' }))

    parser.feed('\x07')
    expect(events).toEqual([{ type: 'bell' }])
  })

  it('does not emit BEL for BEL inside OSC sequences', () => {
    const parser = new OscParser()
    const events: any[] = []
    parser.on('bell', () => events.push('bell'))
    parser.on('title', () => events.push('title'))

    parser.feed('\x1b]2;Hello\x07')
    expect(events).toEqual(['title'])  // No standalone bell
  })

  it('passes through non-OSC data unchanged', () => {
    const parser = new OscParser()
    const chunks: string[] = []
    parser.on('data', (d: string) => chunks.push(d))

    parser.feed('hello world')
    expect(chunks.join('')).toContain('hello world')
  })
})
```

**Step 2: Implement OscParser**

`src/main/status/OscParser.ts`:
```typescript
import { EventEmitter } from 'events'

/**
 * Parses OSC escape sequences from raw PTY output.
 * Emits: 'title' (OSC 2), 'progress' (OSC 9;4), 'bell' (standalone BEL)
 * Also emits 'data' with the raw data for forwarding to renderer.
 */
export class OscParser extends EventEmitter {
  private buffer = ''

  feed(data: string): void {
    this.buffer += data
    this.parse()
    // Always forward raw data to renderer
    this.emit('data', data)
  }

  private parse(): void {
    let i = 0
    while (i < this.buffer.length) {
      // Check for ESC ] (OSC start)
      if (this.buffer[i] === '\x1b' && this.buffer[i + 1] === ']') {
        // Find the terminator: BEL (\x07) or ST (\x1b\\)
        const belIdx = this.buffer.indexOf('\x07', i + 2)
        const stIdx = this.buffer.indexOf('\x1b\\', i + 2)

        let endIdx = -1
        let terminatorLen = 0
        if (belIdx !== -1 && (stIdx === -1 || belIdx < stIdx)) {
          endIdx = belIdx
          terminatorLen = 1
        } else if (stIdx !== -1) {
          endIdx = stIdx
          terminatorLen = 2
        }

        if (endIdx === -1) {
          // Incomplete OSC sequence, wait for more data
          break
        }

        const content = this.buffer.slice(i + 2, endIdx)
        this.handleOsc(content)
        i = endIdx + terminatorLen
        continue
      }

      // Check for standalone BEL
      if (this.buffer[i] === '\x07') {
        this.emit('bell')
        i++
        continue
      }

      i++
    }

    // Keep unprocessed data in buffer (only if we broke out of incomplete OSC)
    if (i < this.buffer.length) {
      this.buffer = this.buffer.slice(i)
    } else {
      this.buffer = ''
    }
  }

  private handleOsc(content: string): void {
    const semiIdx = content.indexOf(';')
    if (semiIdx === -1) return

    const id = content.slice(0, semiIdx)
    const payload = content.slice(semiIdx + 1)

    switch (id) {
      case '2': // Window title
        this.emit('title', payload)
        break
      case '9': {
        // ConEmu-style: 9;4;state;progress
        const parts = payload.split(';')
        if (parts[0] === '4' && parts.length >= 2) {
          this.emit('progress', parseInt(parts[1], 10))
        }
        break
      }
    }
  }
}
```

**Step 3: Verify tests pass**

```bash
npx vitest run src/main/status/__tests__/OscParser.test.ts
```

**Step 4: Commit**

```bash
git add src/main/status/OscParser.ts src/main/status/__tests__/
git commit -m "feat: add OSC sequence parser for title, progress, and bell detection"
```

---

### Task 18: System A — File Watcher

**Files:**
- Create: `src/main/status/SystemA.ts`

**Step 1: Implement SystemA**

Watches `~/.tangent/status/<ptyId>.json`. Uses `fs.watch()`. Reads file on change, parses JSON, maps to `SessionStatus` using `STATUS_FILE_MAP`. On file deletion, emits a "deactivate" event so StatusEngine falls back to System B. JSON parse failures are logged and ignored.

**Step 2: Commit**

```bash
git add src/main/status/SystemA.ts
git commit -m "feat: add System A file watcher for structured status detection"
```

---

### Task 19: StatusEngine Orchestrator

**Files:**
- Create: `src/main/status/StatusEngine.ts`
- Modify: `src/main/session/SessionManager.ts` (wire StatusEngine per session)

**Step 1: Implement StatusEngine**

One instance per session. Receives:
1. PTY output stream (runs through OscParser first)
2. PTY exit event
3. Agent launch events

Orchestration logic:
- Always feed PTY data through OscParser
- If System A is active (status file exists), use System A for status; System B still runs for `lastActivity` extraction only
- If System A is not active, use System B for both status and lastActivity
- OSC signals (progress state 1 = processing, state 0 = agent_ready, state 3 = failed) serve as high-priority hints within System B (override text patterns)
- OSC title changes → update `lastActivity`
- BEL events are informational (no status change)
- PTY exit → immediately set `exited`

**Step 2: Wire into SessionManager**

When a session is created, create a StatusEngine for it. Connect PTY `onData` to the engine. Connect engine status outputs to `sessionStore.updateStatus()`.

**Step 3: Verify end-to-end: launch app, create session, type commands, see status changes**

```bash
npm run dev
```

**Step 4: Commit**

```bash
git add src/main/status/ src/main/session/
git commit -m "feat: add StatusEngine orchestrating System A, System B, and OSC parsing"
```

---

## Phase 6: Agents Sidebar

### Task 20: useAgents Hook

**Files:**
- Create: `src/renderer/hooks/useAgents.ts`

**Step 1: Implement useAgents**

Similar pattern to `useSessions`. Loads groups from IPC, listens for updates, exposes `saveGroups` and `launchAgent` callbacks.

**Step 2: Commit**

---

### Task 21: Agents Sidebar UI

**Files:**
- Modify: `src/renderer/components/AgentsSidebar/AgentsSidebar.tsx`
- Create: `src/renderer/components/AgentsSidebar/AgentGroup.tsx`
- Create: `src/renderer/components/AgentsSidebar/AgentItem.tsx`
- Create: `src/renderer/components/AgentsSidebar/AgentForm.tsx`

**Step 1: Implement AgentsSidebar**

220px panel. Expanded state: group tabs across top (+ button for new group), group header with rename/delete, agent list with numbered items.

Collapsed state: vertical tab labels along right edge.

**Step 2: Implement AgentItem**

Numbered items with hover action buttons (move up, move down, edit, delete). `tab` badge for newTab agents. Number highlights blue when Ctrl+Shift held.

**Step 3: Implement AgentForm**

Inline form at bottom: Name, Command, Arguments, Launch Target dropdown. Save/Cancel buttons.

**Step 4: Wire sidebar toggle with Ctrl+Shift+1-9**

**Step 5: Commit**

```bash
git add src/renderer/components/AgentsSidebar/ src/renderer/hooks/
git commit -m "feat: add Agents sidebar with groups, agent items, and inline form"
```

---

## Phase 7: Status Bar & Polish

### Task 22: Status Bar

**Files:**
- Modify: `src/renderer/components/StatusBar/StatusBar.tsx`

**Step 1: Implement 3-section status bar**

24px height. Left: status dot + non-running count + total sessions. Center: agent type label + last activity. Right: CWD path (right-truncated) + keyboard hint + external toggle.

**Step 2: Commit**

---

### Task 23: Keyboard Shortcuts

**Files:**
- Create: `src/renderer/hooks/useKeyboard.ts`
- Modify: `src/renderer/App.tsx`

**Step 1: Implement global keyboard handler**

All shortcuts from the PRD table:
- `Ctrl+B` toggle sessions panel
- `Ctrl+N` new session
- `Ctrl+W` close active session
- `Ctrl+Tab`/`Ctrl+Shift+Tab` next/prev session
- `Ctrl+Shift+1-9` open sidebar group
- `Ctrl+=/-/0` zoom
- Panel-focused: j/k, Enter, x/Delete, F2, /, Escape

**Step 2: Implement right-click handler for terminal**

Selected text → copy, no selection → paste.

**Step 3: Commit**

```bash
git add src/renderer/
git commit -m "feat: add keyboard shortcuts and right-click copy/paste"
```

---

### Task 24: CWD Tracking

**Files:**
- Create: `src/main/status/CwdTracker.ts`

**Step 1: Implement CWD detection**

Two mechanisms:
1. **OSC 7**: Parse `ESC ] 7 ; file://host/path ST` from PTY output (via OscParser — add handler for OSC 7)
2. **Prompt parsing**: Regex for `PS D:\path>` from PowerShell output

When detected, call `sessionStore.updateCwd()` (atomic update per Naming Rules).

**Step 2: Wire into StatusEngine**

**Step 3: Commit**

```bash
git add src/main/status/CwdTracker.ts
git commit -m "feat: add CWD tracking via OSC 7 and PowerShell prompt parsing"
```

---

### Task 25: External Session Discovery

**Files:**
- Create: `src/main/session/ExternalScanner.ts`

**Step 1: Implement scanner**

Scans Copilot CLI and Claude Code session storage on disk. Creates external sessions with `isExternal: true`, initial status `agent_ready`. Deduplicates against Tangent-launched sessions. Toggle controlled by status bar button.

**Step 2: Commit**

```bash
git add src/main/session/ExternalScanner.ts
git commit -m "feat: add external session discovery for Copilot CLI and Claude Code"
```

---

## Phase 8: Testing & Final

### Task 26: Vitest Configuration

**Files:**
- Create: `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts']
  }
})
```

**Step 1: Verify all existing tests pass**

```bash
npm test
```

**Step 2: Commit**

---

### Task 27: Playwright E2E Setup

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/app.spec.ts`

**Step 1: Configure Playwright for Electron**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    trace: 'on-first-retry'
  }
})
```

**Step 2: Write basic smoke tests**

- App window opens
- Terminal renders
- Session creation works
- Agent sidebar toggles

**Step 3: Commit**

```bash
git add playwright.config.ts tests/
git commit -m "feat: add Playwright e2e test setup and smoke tests"
```

---

### Task 28: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md to reflect new Electron architecture**

Replace Next.js references with electron-vite commands, new project structure, new import aliases.

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Electron + electron-vite architecture"
```
