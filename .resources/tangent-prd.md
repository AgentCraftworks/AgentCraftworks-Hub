# Tangent — Product Reference Document

## What Is Tangent?

Tangent is a standalone Electron terminal application with a built-in **Agents sidebar**. The core idea: you navigate to a folder in the terminal, click an Agent in the sidebar, and the AI coding tool (Copilot CLI, Claude Code, etc.) launches right there in your terminal session using that folder as its working directory. No more `cd`, setting env vars, remembering CLI flags — just click and go.

The app is built with Electron + React + xterm.js on the renderer side and node-pty on the main process side. It targets **PowerShell on Windows** for the MVP.

---

## Layout & Visual Design

The window is a single-pane layout with four regions:

```
┌──────────────────────────────────────────────────────────┐
│  Sessions Panel    │  Terminal Viewport  │ [Agents ▸]    │
│  (left, 240px)     │  (fills center)     │ (right, 220px)│
│                    │                     │               │
│  SESSIONS (3)      │  ┌───────────────┐  │  Group tabs   │
│                    │  │               │  │  ┌──────────┐ │
│  ▸ Active          │  │   xterm.js     │  │  │ Agents   │ │
│  ┌──────────────┐  │  │   terminal    │  │  │ 1 Copilot│ │
│  │🟢 myapp  cop │◄─│  │               │  │  │ 2 Claude │ │
│  ├──────────────┤  │  │               │  │  │          │ │
│  │🟡 zap1   cla │  │  │               │  │  │ [+ Add]  │ │
│  └──────────────┘  │  │               │  │  └──────────┘ │
│  ▸ Recent          │  │               │  │               │
│  ┌──────────────┐  │  │               │  │               │
│  │   old1   cop │  │  │               │  │               │
│  └──────────────┘  │  │               │  │               │
│  [+ New Session]   │  └───────────────┘  │               │
│                    │                     │               │
├──────────────────────────────────────────────────────────┤
│  ● 0 non-running │ Copilot │ idle      D:\git\myapp  ext│
│  Status Bar (24px height)                                │
└──────────────────────────────────────────────────────────┘

  ◄── selected session has a left-edge color bar + tinted background
      matching its status color (green/amber/red)
```

### Color Theme (GitHub Dark)

| Token               | Value     | Usage                        |
|----------------------|-----------|------------------------------|
| `--bg-primary`       | `#0d1117` | Terminal & main background   |
| `--bg-secondary`     | `#161b22` | Panels, sidebar, status bar  |
| `--bg-tertiary`      | `#1c2128` | Group tabs, badges           |
| `--bg-hover`         | `#21262d` | Hover states                 |
| `--bg-active`        | `#1a2233` | Selected session             |
| `--text-primary`     | `#e6edf3` | Normal text                  |
| `--text-secondary`   | `#8b949e` | Muted text                   |
| `--text-muted`       | `#484f58` | Very subtle text/labels      |
| `--accent`           | `#58a6ff` | Blue highlight, active items |
| `--running`          | `#00ff44` | Running status dot (bright green) |
| `--error`            | `#ff4477` | Error dot, close hover (red/pink) |
| `--idle`             | `#ffb800` | Idle status dot (yellow/amber)    |

Fonts: `Cascadia Code` / `JetBrains Mono` / `Fira Code` for the monospace UI; system sans-serif stack for UI labels.

---

## Sessions Panel (Left Side)

A 240px-wide panel on the left showing all running and recent sessions. It is the primary way to switch between terminal sessions.

### What a Session Is

A session represents one PTY (terminal process). Each session has:

| Field            | Description                                                      |
|------------------|------------------------------------------------------------------|
| `id`             | Unique identifier                                                |
| `agentType`      | `'copilot-cli'`, `'claude-code'`, or `'shell'`                   |
| `name`           | Display name shown in the panel (see Naming Rules below)         |
| `folderName`     | Leaf folder of the current CWD, e.g. `myapp` — always tracks the real CWD regardless of display name |
| `folderPath`     | Full CWD path, e.g. `D:\projects\myapp`                          |
| `isRenamed`      | `true` if the user has manually renamed this session via F2      |
| `status`         | Current lifecycle status (see Status Engine below)               |
| `lastActivity`   | Human-readable summary, e.g. `editing src/auth.ts`              |
| `startedAt`      | Timestamp (ms)                                                   |
| `updatedAt`      | Timestamp (ms)                                                   |
| `ptyId`          | The PTY process identifier (only for Tangent-launched sessions)  |
| `exitCode`       | Only populated when status is `exited`                           |
| `isExternal`     | `true` if discovered from disk (not launched by Tangent)         |
| `sourceFile`     | Path to session file on disk (external sessions only)            |

### Session Naming Rules

> ⚠️ **This was a major bug source in previous iterations.** Follow these rules exactly. All three fields (`folderPath`, `folderName`, `name`) must update together in a single atomic operation in the main process. Never update only one of them — partial updates cause the next `session:updated` IPC event to push stale values to the renderer, undoing corrections.

**Rule 1 — Initial name = folder name.**
When a session is created, `name` is set to the leaf folder derived from the starting CWD.
```
CWD: D:\git\tangent\copilot-sdk → folderName: 'copilot-sdk', name: 'copilot-sdk'
```

**Rule 2 — CWD changes auto-update name, unless manually renamed.**
When the CWD changes (user `cd`s), `folderPath` and `folderName` always update to track the real directory. `name` auto-updates to the new `folderName` **only if** `isRenamed === false`. If `isRenamed === true`, `name` is left untouched.
```typescript
// In the main process CWD update handler:
session.folderPath = newPath;
session.folderName = path.basename(newPath);
if (!session.isRenamed) {
  session.name = session.folderName;
}
// Send ONE session:updated event with all fields
```

**Rule 3 — Agent detection does NOT change the name.**
When the user types `copilot` or `claude` and the session promotes from `shell` to an agent type, only `agentType` and `status` change. The `name` stays as-is (the folder name, or a manual name). Previous iterations had a bug where agent promotion overwrote the folder-based name with the agent name — **do not do this**.
```
Before: { name: 'copilot-sdk', agentType: 'shell',       status: 'shell_ready' }
After:  { name: 'copilot-sdk', agentType: 'copilot-cli', status: 'agent_launching' }
         ^^^^^^^^^^^^^^^^^^^^  name is UNCHANGED
```

**Rule 4 — Manual renames are sticky.**
When the user renames a session (F2), set `session.isRenamed = true`. From that point on, neither CWD changes nor agent detection should overwrite `name`. The only way to "un-stick" is if the user renames it again.

**Rule 5 — `folderName` is ground truth for location.**
`folderName` always reflects the real CWD, even when `name` differs (because the user renamed it). UI components that need to know "what folder is this session in" must read `folderName`, not `name`.

**Rule 6 — Atomic updates only.**
All writes to `folderPath`, `folderName`, and `name` must happen in the same code path, in the main process, before emitting the `session:updated` IPC event. Never update `folderPath` in one handler and `folderName`/`name` in another — that causes a race where the renderer receives a half-updated session.

### Session Display

Sessions are rendered as **vertical stacked items** in the left panel — not as top tabs. Each session item is a full-width card (filling the 240px panel) with a **status-colored left edge bar** and a **tinted background**. The active (selected) session also gets an elevated glow. Think of it as a vertical tab strip where color = state at a glance.

Each session item shows:
- **Left edge bar** (3px wide, left side) — colored to match the session's status. Hidden for `shell` sessions.
- **Session name** (bold, `--text-primary`) — the `name` field (folder name by default, or manual rename)
- **Agent badge** — small pill label: `copilot`, `claude`, or `shell`
- **External badge** — `ext` pill (uses `--error` color) for sessions discovered from disk
- **Close button** (×) — appears on hover, only for Tangent-launched sessions
- **Last activity** — italic subtext (`--text-secondary`), e.g. `editing src/auth.ts` or `3m ago`

#### Status-Colored Session Styling

The session item's **background** and **left edge bar** both reflect the session's current status. This uses low-opacity tints of the status color over the panel's `--bg-secondary` base, creating a subtle glow effect.

| UI Status | Left Bar Color | Background (idle state)                      | Background (selected)                          | Background (hover)                              |
|-----------|----------------|----------------------------------------------|------------------------------------------------|-------------------------------------------------|
| `running` | `--running`    | `rgba(0, 255, 68, 0.04)`                    | `rgba(0, 255, 68, 0.10)`                      | `rgba(0, 255, 68, 0.07)`                       |
| `idle`    | `--idle`       | `rgba(255, 184, 0, 0.04)`                   | `rgba(255, 184, 0, 0.10)`                     | `rgba(255, 184, 0, 0.07)`                      |
| `error`   | `--error`      | `rgba(255, 68, 119, 0.04)`                  | `rgba(255, 68, 119, 0.10)`                    | `rgba(255, 68, 119, 0.07)`                     |
| `shell`   | none (hidden)  | `transparent`                                | `var(--bg-active)`                             | `var(--bg-hover)`                               |

**Selected session** also gets a subtle `box-shadow` glow using the status color:
```css
/* Example for a selected 'running' session */
.session-item.selected.status-running {
  background: rgba(0, 255, 68, 0.10);
  box-shadow: inset 0 0 12px rgba(0, 255, 68, 0.06),
              0 0 8px rgba(0, 255, 68, 0.03);
}
```

**Left edge bar animation**: For `running` sessions, the left bar pulses opacity (1.0 → 0.5) on the same `pulse-slow` 2s cycle as the status dot. For `error`, it uses `pulse-fast` (1.5s). `idle` and `shell` bars are static.

**Transition**: Background color and bar color animate with `transition: background 400ms ease, border-color 400ms ease` so status changes feel smooth rather than jarring.

#### Section Layout

Sessions are split into two collapsible sections:
- **Active** — sessions with an active status or a live PTY
- **Recent** — inactive sessions from the last 48 hours

Sessions older than 48h are hidden by default with a "Show N older sessions" button.

### Session Panel Interactions

| Action                         | Trigger                               |
|--------------------------------|---------------------------------------|
| Select session                 | Click, or j/k + Enter when focused    |
| Close session                  | Hover → × button, or `x`/`Delete` key|
| Rename session                 | `F2` key when highlighted             |
| Filter sessions                | `/` key opens filter input            |
| Clear filter                   | `Escape` in filter input              |
| New session                    | `+ New Session` button at bottom      |
| Toggle panel visibility        | `Ctrl+B`                              |
| Focus panel                    | `Ctrl+B` (also toggles)               |
| Unfocus panel                  | `Escape`                              |

The panel auto-collapses when the window width drops below 700px.

### External Sessions

Tangent discovers sessions started **outside** Tangent by scanning disk:
- **Copilot CLI** sessions from Copilot's session storage
- **Claude Code** sessions from Claude's project files

These appear in the Sessions panel with an `ext` badge. Clicking an external session **resumes** it — Tangent spawns a new PTY and runs the agent's `--resume --session-id <uuid>` command.

A toggle button in the status bar (`○ ext` / `⊙ ext`) controls whether external sessions are shown. They're hidden by default. Duplicates between Tangent-launched and external sessions are automatically filtered out.

---

## Terminal Viewport (Center)

The center region is a full xterm.js terminal instance. Key behaviors:

- Each session gets its own `Terminal` instance mounted in a `div`
- Only the active session's terminal is visible; others are hidden with CSS
- Terminal re-fits automatically on resize (window, sidebar toggle, panel toggle)

### CWD Tracking

Tangent tracks the current working directory of each session through two mechanisms:
1. **OSC 7** — shell integration sequences (`ESC ] 7 ; file://host/path ST`)
2. **Prompt parsing** — fallback: parses `PS D:\path>` from PowerShell prompt output

When a new CWD is detected, the main process updates `folderPath`, `folderName`, and (if `isRenamed === false`) `name` **atomically in a single operation** before emitting `session:updated`. See **Session Naming Rules** above for the full logic.

### Agent Detection

When the user types `copilot` or `claude` at a shell prompt and presses Enter, Tangent detects it by reading the terminal buffer line. The session promotes from `shell` to the detected agent type:
- `agentType` updates to `'copilot-cli'` or `'claude-code'`
- `status` transitions from `shell_ready` → `agent_launching`
- **`name` is NOT changed** — it stays as the folder name (or manual name). See Naming Rule 3.

### Zoom

| Action         | Shortcut              |
|----------------|-----------------------|
| Zoom in        | `Ctrl+=` or `Ctrl++`  |
| Zoom out       | `Ctrl+-`              |
| Reset zoom     | `Ctrl+0`              |
| Scroll zoom    | `Ctrl + Mouse Wheel`  |

Font size range: 8–32px, default 14px. Zoom applies to all terminal instances simultaneously.

### Right-click

- If text is selected → copies to clipboard, clears selection
- If no selection → pastes from clipboard

---

## Agents Sidebar (Right Side)

A 220px-wide panel on the right for managing and launching AI agents. The sidebar can be **collapsed** or **expanded**.

### Collapsed State

When collapsed, vertical tab labels appear along the right edge — one per agent group. Clicking a label opens the sidebar to that group. Hovering reveals the labels.

### Expanded State

Shows:
1. **Group tabs** — horizontal tabs across the top, one per group, plus a `+` button to create new groups
2. **Group header** — displays the active group name (click to rename inline), with delete (🗑) and add (+) buttons
3. **Agent list** — numbered items (1, 2, 3...) showing each agent in the group

### Agent Items

Each agent in the list shows:
- **Number** (dimmed by default, highlights blue when Ctrl+Shift is held)
- **Name** — e.g. `Copilot CLI`
- **Tab badge** — shows `tab` if `launchTarget` is `newTab`
- **Action buttons** (on hover): ↑ move up, ↓ move down, ✎ edit, × delete

### Agent Profile Schema

```typescript
interface AgentProfile {
  id: string;              // auto-generated UUID
  name: string;            // required, non-empty
  command: string;         // required, non-empty (e.g. "copilot", "claude")
  args: string[];          // optional arguments (e.g. ["--resume"])
  env?: Record<string, string>;  // optional env vars
  cwdMode: 'activeSession';     // always uses active session's cwd
  launchTarget: 'currentTab' | 'newTab';  // default: currentTab
}
```

### Agent Groups

Agents are organized into **groups**. Each group has a name and an ordered list of agents. The store persists to `~/.tangent/agents.json`. Default installation creates one group called "Agents" with Copilot CLI and Claude Code pre-configured.

Groups support: create, rename (inline edit), delete (if more than one exists), and reorder.

### Agent Form

An inline form at the bottom of the sidebar for creating/editing agents. Fields:
- **Name** — text input
- **Command** — text input (e.g. `copilot`)
- **Arguments** — space-separated text input
- **Launch Target** — dropdown: `Current Tab` or `New Tab`

### How Agent Launch Works

1. User clicks an agent (or presses its number key)
2. Tangent gets the active session's current working directory
3. If `launchTarget` is `currentTab`: the agent command is injected into the active PTY
4. If `launchTarget` is `newTab`: a new session is created with the same cwd, then the command is injected there
5. The session's `agentType` and `status` update to reflect the launched agent. **`name` is not changed** (see Naming Rule 3).

The command injection generates properly escaped PowerShell lines:
- Environment variables are set via `$env:KEY = 'value'` lines
- Arguments are escaped with PowerShell single-quote rules
- All lines are joined with `\r` and terminated with `\r`

### Sidebar Shortcuts

| Action                          | Shortcut                |
|---------------------------------|-------------------------|
| Open sidebar to group N         | `Ctrl+Shift+1` through `Ctrl+Shift+9` |
| Toggle sidebar (same group)     | Press same `Ctrl+Shift+N` again       |
| Launch agent N (sidebar open)   | Press `1` through `9`                 |
| Close sidebar                   | Click terminal area                   |

When `Ctrl+Shift` is held, agent numbers highlight in blue and agent names brighten — a visual cue that number keys are active.

---

## Status Bar (Bottom)

A 24px-tall bar at the very bottom of the window with three sections:

### Left Section
- **Status dot** (green/amber/red per active session status) + count of non-running agent sessions
- Separator (`│`)
- Total session count

### Center Section (active session info)
- **Agent type label** — `Copilot`, `Claude`, or `Shell`
- Separator (`│`)
- **Last activity** — e.g. `editing src/auth.ts` or `idle`

### Right Section
- **Current working directory** — right-to-left truncated path of the active session
- **Keyboard hint** — `Ctrl+B panels`
- **External toggle** — button (`○ ext` / `⊙ ext`) to show/hide external sessions; highlights blue when active

---

## Session Status Engine

Tangent tracks each session's lifecycle via a single `status` field that holds one of **8 internal status values**. UI components convert this internal status to a visual indicator using a pure mapping function. This section is the **single source of truth** for all status behavior.

> ⚠️ **Implementation rule**: The `session.status` field always holds an **internal status** value (the 8 values below). UI components never store their own status — they derive everything from `session.status` via the `mapStatusToUI()` function defined below.

---

### 1. Internal Status Values (the `SessionStatus` type)

```typescript
type SessionStatus =
  | 'shell_ready'       // Plain shell prompt, no agent running
  | 'agent_launching'   // Agent command sent to PTY, waiting for agent to start
  | 'agent_ready'       // Agent is idle, showing its prompt, waiting for user input
  | 'processing'        // Agent is actively working (thinking, generating, etc.)
  | 'tool_executing'    // Agent is running a tool (file edit, shell command, etc.)
  | 'needs_input'       // Agent is asking a yes/no or confirmation question
  | 'failed'            // Agent encountered an error (but PTY is still alive)
  | 'exited';           // PTY process has terminated (exitCode is set)
```

Every `Session` object has exactly one `status: SessionStatus` field. No other status types exist. There is no separate "UI status" stored anywhere.

---

### 2. UI Status Mapping (pure function, renderer-side only)

The renderer maps `session.status` to visual properties using this **pure function**. Nothing else determines dot visibility, color, or animation. There are exactly **4 UI states**.

```typescript
interface UIStatusIndicator {
  label: 'shell' | 'running' | 'idle' | 'error';
  dotVisible: boolean;
  dotColor: string | null;         // CSS variable name, or null if hidden
  dotAnimation: 'pulse-slow' | 'pulse-fast' | 'none';
  // Session item styling (used by the Sessions Panel)
  barColor: string | null;         // Left edge bar CSS variable, or null
  bgTint: string;                  // rgba() for idle background
  bgTintSelected: string;          // rgba() for selected background
  bgTintHover: string;             // rgba() for hover background
  glowShadow: string;              // box-shadow value for selected state
}

function mapStatusToUI(status: SessionStatus): UIStatusIndicator {
  switch (status) {
    // ⚫ No dot, no color bar — plain terminal, no agent involved
    case 'shell_ready':
    case 'exited':
      return {
        label: 'shell', dotVisible: false, dotColor: null, dotAnimation: 'none',
        barColor: null,
        bgTint: 'transparent',
        bgTintSelected: 'var(--bg-active)',
        bgTintHover: 'var(--bg-hover)',
        glowShadow: 'none',
      };

    // 🟢 Bright green — agent is actively working
    case 'processing':
    case 'tool_executing':
      return {
        label: 'running', dotVisible: true, dotColor: '--running', dotAnimation: 'pulse-slow',
        barColor: '--running',
        bgTint: 'rgba(0, 255, 68, 0.04)',
        bgTintSelected: 'rgba(0, 255, 68, 0.10)',
        bgTintHover: 'rgba(0, 255, 68, 0.07)',
        glowShadow: 'inset 0 0 12px rgba(0, 255, 68, 0.06), 0 0 8px rgba(0, 255, 68, 0.03)',
      };

    // 🟡 Yellow/amber — agent is waiting for something
    case 'agent_launching':
    case 'agent_ready':
    case 'needs_input':
      return {
        label: 'idle', dotVisible: true, dotColor: '--idle', dotAnimation: 'none',
        barColor: '--idle',
        bgTint: 'rgba(255, 184, 0, 0.04)',
        bgTintSelected: 'rgba(255, 184, 0, 0.10)',
        bgTintHover: 'rgba(255, 184, 0, 0.07)',
        glowShadow: 'inset 0 0 12px rgba(255, 184, 0, 0.06), 0 0 8px rgba(255, 184, 0, 0.03)',
      };

    // 🔴 Red/pink — agent hit an error
    case 'failed':
      return {
        label: 'error', dotVisible: true, dotColor: '--error', dotAnimation: 'pulse-fast',
        barColor: '--error',
        bgTint: 'rgba(255, 68, 119, 0.04)',
        bgTintSelected: 'rgba(255, 68, 119, 0.10)',
        bgTintHover: 'rgba(255, 68, 119, 0.07)',
        glowShadow: 'inset 0 0 12px rgba(255, 68, 119, 0.06), 0 0 8px rgba(255, 68, 119, 0.03)',
      };
  }
}
```

**Quick-reference table** (same data as the switch above):

| Color                      | UI Status | Session Statuses                            | Meaning                            |
|----------------------------|-----------|---------------------------------------------|------------------------------------|
| 🟢 Bright green (`#00ff44`) | `running` | `processing`, `tool_executing`              | Agent is actively working          |
| 🟡 Yellow/amber (`#ffb800`) | `idle`    | `agent_launching`, `agent_ready`, `needs_input` | Agent is waiting for input     |
| 🔴 Red/pink (`#ff4477`)     | `error`   | `failed`                                    | Agent stopped with an error        |
| ⚫ No color                 | `shell`   | `shell_ready`, `exited`                     | No agent running (plain terminal)  |

| CSS Animation Class | Duration | Behavior                              |
|---------------------|----------|---------------------------------------|
| `pulse-slow`        | 2.0s     | Opacity fades between 1.0 and 0.4     |
| `pulse-fast`        | 1.5s     | Opacity fades between 1.0 and 0.4     |
| `none`              | —        | Static, full opacity                   |

---

### 3. State Machine — Valid Transitions

Below is the **complete** list of valid transitions. **No other transitions are allowed.** If code attempts an invalid transition, it must log a warning and ignore the transition (do not throw).

```
                         ┌──────────────────────────────────────────┐
                         │           VALID TRANSITIONS              │
                         └──────────────────────────────────────────┘

  ┌─────────────┐  agent command    ┌──────────────────┐
  │ shell_ready  │ ──────────────► │ agent_launching    │
  └─────────────┘                  └──────────────────┘
                                          │
                                   agent prompt detected
                                          │
                                          ▼
                               ┌──────────────────┐
                       ┌────── │ agent_ready       │ ◄──────┐
                       │       └──────────────────┘         │
                       │              │                     │
                  user sends      agent asks             agent finishes
                  a message       y/n question           task/tool
                       │              │                     │
                       ▼              ▼                     │
              ┌──────────────┐  ┌───────────────┐          │
              │ processing   │  │ needs_input   │ ─────────┤
              └──────────────┘  └───────────────┘          │
                  │       │                                 │
             runs a tool  finishes ─────────────────────────┤
                  │                                         │
                  ▼                                         │
         ┌──────────────────┐                               │
         │ tool_executing   │ ──────────────────────────────┘
         └──────────────────┘

  From ANY status ──► failed      (error detected)
  From ANY status ──► exited      (PTY close event)
  From failed     ──► agent_ready (agent recovers to prompt)
  From failed     ──► processing  (agent retries automatically)
```

**Explicit transition table** (for implementers who prefer a lookup):

| From               | To                 | Trigger                                     |
|--------------------|--------------------|---------------------------------------------|
| `shell_ready`      | `agent_launching`  | Agent command written to PTY                 |
| `agent_launching`  | `agent_ready`      | Agent prompt symbol detected in output       |
| `agent_launching`  | `failed`           | Error pattern detected or timeout (30s)      |
| `agent_ready`      | `processing`       | User sends input (data written to PTY)       |
| `agent_ready`      | `shell_ready`      | Agent exits back to shell prompt             |
| `processing`       | `agent_ready`      | Agent prompt reappears (task done)           |
| `processing`       | `tool_executing`   | Tool-execution pattern detected              |
| `processing`       | `needs_input`      | Confirmation prompt detected                 |
| `processing`       | `failed`           | Error pattern detected                       |
| `tool_executing`   | `processing`       | Tool output ends, agent resumes thinking     |
| `tool_executing`   | `agent_ready`      | Agent prompt reappears (task done)           |
| `tool_executing`   | `failed`           | Error pattern detected                       |
| `needs_input`      | `processing`       | User responds, agent resumes                 |
| `needs_input`      | `agent_ready`      | Agent prompt reappears (user declined)       |
| `failed`           | `agent_ready`      | Agent recovers to prompt                     |
| `failed`           | `processing`       | Agent retries automatically                  |
| **(any)**          | `exited`           | PTY `onExit` event fires                     |
| **(any)**          | `failed`           | Error pattern detected at any time           |

`exited` is a **terminal state** — no transitions out of it.

---

### 4. Initial Status by Session Type

| How the session was created          | Initial `status`    |
|--------------------------------------|---------------------|
| User clicks "+ New Session"          | `shell_ready`       |
| Agent launched into current tab      | `agent_launching`   |
| Agent launched into new tab          | `agent_launching`   |
| External session discovered on disk  | `agent_ready`       |
| Shell command manually typed by user | See Agent Detection |

**Agent Detection** (shell → agent promotion): When Tangent detects the user typed `copilot` or `claude` at the prompt and pressed Enter, the session's `agentType` updates and status transitions from `shell_ready` → `agent_launching`. **`name` is not changed** — see Naming Rule 3. This is the **only** way a shell session transitions to an agent status. The promotion happens **synchronously** at the moment the command is detected (before the agent actually starts).

---

### 5. Where Status Detection Runs (Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  StatusEngine (one instance per session)                 │    │
│  │                                                         │    │
│  │  Inputs:                                                │    │
│  │    1. PTY output stream (onData callback)               │    │
│  │    2. PTY exit event (onExit callback)                  │    │
│  │    3. Status file watcher (fs.watch, if file exists)    │    │
│  │    4. Agent launch events (from session manager)        │    │
│  │                                                         │    │
│  │  Output:                                                │    │
│  │    → Calls sessionStore.updateStatus(sessionId, newStatus) │  │
│  │    → sessionStore sends IPC to renderer                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Session store is the SINGLE source of truth.                   │
│  Renderer NEVER computes status — it only reads from store.     │
└─────────────────────────────────────────────────────────────────┘
         │
    IPC: 'session:status-changed' { sessionId, status }
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS                         │
│                                                                 │
│  Receives status updates via IPC.                               │
│  Calls mapStatusToUI(status) for display.                       │
│  NEVER parses PTY output for status.                            │
│  NEVER writes to session.status.                                │
└─────────────────────────────────────────────────────────────────┘
```

**Key rule**: All status computation happens in the **main process**. The renderer is a dumb consumer. This prevents race conditions from dual-writing.

---

### 6. Status Detection — Two Systems with Clear Priority

The `StatusEngine` uses two detection systems. **System A always wins over System B.**

#### System A: Status File Watcher (Primary)

Some agents write structured status to disk. Tangent watches for these files.

**File location**: `~/.tangent/status/<ptyId>.json`

**File schema**:
```typescript
interface StatusFile {
  status: 'ready' | 'processing' | 'tool' | 'input' | 'error';
  detail?: string;          // e.g. "editing src/auth.ts"
  updatedAt: number;        // Unix timestamp ms
}
```

**Mapping from status file value to SessionStatus**:
| `StatusFile.status` | → `SessionStatus`  |
|---------------------|--------------------|
| `'ready'`           | `agent_ready`      |
| `'processing'`      | `processing`       |
| `'tool'`            | `tool_executing`   |
| `'input'`           | `needs_input`      |
| `'error'`           | `failed`           |

When `StatusFile.detail` is present, it is copied to `session.lastActivity`.

**Watcher behavior**:
- On session creation, check if `~/.tangent/status/<ptyId>.json` exists. If yes, activate System A.
- Use `fs.watch()` on the file. On each change, read the file, parse JSON, map to `SessionStatus`, and apply via `sessionStore.updateStatus()`.
- If the file is deleted, fall back to System B for that session.
- If JSON parse fails, log a warning and ignore (keep current status).

**When System A is active, System B's output is completely ignored for that session.** System B still runs (to update `lastActivity` text) but it cannot change `session.status`.

#### System B: Output-Parsing Engine (Fallback)

When no status file exists, the StatusEngine parses the PTY output stream to infer status. This is inherently heuristic, so it includes debouncing to prevent flicker.

**Detection rules** (evaluated on each chunk of PTY output, in priority order):

| Priority | Pattern (regex or string match)                                  | Detected Status    |
|----------|------------------------------------------------------------------|--------------------|
| 1        | `PS {path}>` (PowerShell prompt)                                 | `shell_ready`      |
| 2        | `❯` at start of line (Copilot prompt)                            | `agent_ready`      |
| 3        | `›` at start of line (Claude prompt)                             | `agent_ready`      |
| 4        | `/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/` (spinner characters)                         | `processing`       |
| 5        | `thinking` or `Thinking` (case-insensitive)                      | `processing`       |
| 6        | `/running tool:|executing command:|Reading file|Writing file/i`  | `tool_executing`   |
| 7        | `/(y\/n)|continue\?|allow\?|permit\?|approve\?/i`               | `needs_input`      |
| 8        | `/Error:|error:|FATAL|command not found|ENOENT/`                 | `failed`           |

**Debounce & hysteresis rules**:

- **Minimum hold time**: After transitioning to a new status, ignore further transitions for **500ms**. This prevents rapid flicker (e.g., agent prints an error then immediately recovers).
- **Prompt detection requires confirmation**: When `agent_ready` is detected (rules 2–3), wait an additional **300ms** of silence (no new PTY output) before committing the transition. If new output arrives during that 300ms, cancel the pending `agent_ready` transition. This prevents falsely marking "ready" when the agent merely echoed a prompt character mid-output.
- **Processing is eager**: Transitions to `processing` (rules 4–5) apply immediately (no extra delay beyond the 500ms hold). An actively working agent should show green right away.
- **Failed requires 2 consecutive matches**: Don't transition to `failed` on a single error line — require the pattern to match in **2 separate output chunks within 3 seconds**, or match once and persist for **2 seconds** without a subsequent prompt detection overriding it. This prevents false alarms from error text in normal output (e.g., an agent discussing an error).

**Output buffer**: Keep a rolling buffer of the last **20 lines** of PTY output per session. Pattern matching runs against both the latest chunk and this buffer (for multi-line patterns like "command not found" appearing on line after the command).

**`lastActivity` extraction** (runs in BOTH System A and System B):
Separate from status detection, the engine always scans output for activity descriptions:
- Lines matching `/(?:editing|reading|writing|creating|deleting|running)\s+(.+)/i` → capture group 1 becomes `lastActivity`
- If no activity pattern matched in the last 60 seconds, `lastActivity` falls back to a relative timestamp like `3m ago`

---

### 7. Concrete Implementation Checklist

To prevent implementation drift, here is the ordered build plan for the status system:

1. **Define the `SessionStatus` type** and add it to the `Session` interface. Remove any other status-related fields. The session schema in the Sessions Panel section above uses this type for its `status` field.

2. **Implement `mapStatusToUI()`** as a pure function in a shared utils file. Write unit tests for all 8 input values.

3. **Implement the valid-transition checker**: a function `canTransition(from: SessionStatus, to: SessionStatus): boolean` using the explicit transition table above. Use this in `sessionStore.updateStatus()` as a guard. Log warnings for invalid transitions.

4. **Build the StatusEngine class** in the main process. One instance per session. It receives PTY output and exit events, runs detection, and calls `sessionStore.updateStatus()`.

5. **Implement System B (output parsing) first** — it works for all sessions and doesn't depend on external files. Include debounce timers.

6. **Implement System A (file watcher)** — check on session creation, watch for changes, override System B when active.

7. **Wire up IPC**: `session:status-changed` event from main → renderer. Renderer hooks into session store updates and re-renders.

8. **Build the `SessionItem` React component** that takes a `Session` and renders the full status-styled card: left edge color bar, tinted background, optional status dot, glow shadow on selection — all derived from `mapStatusToUI(session.status)`. Use CSS `transition: background 400ms ease, border-color 400ms ease` for smooth status changes. The left bar and dot share the same pulse animations (`pulse-slow` for running, `pulse-fast` for error).

---

### 8. Worked Examples

These step-by-step scenarios show the exact status transitions over time. Use them as test cases.

#### Example A: User clicks Copilot agent in sidebar (currentTab mode)

```
Time  Event                                          session.status      UI dot
──────────────────────────────────────────────────────────────────────────────────────
0s    Session exists, showing PowerShell prompt       shell_ready         ⚫ hidden
0s    User clicks "Copilot CLI" agent in sidebar      
0s    Tangent writes `copilot\r` to PTY               agent_launching     🟡 amber
2s    PTY output: startup text, loading...            agent_launching     🟡 amber (no change)
4s    PTY output: `❯` prompt appears                  agent_ready         🟡 amber
4.3s  300ms silence confirmed                         agent_ready         🟡 amber (committed)
10s   User types a question, presses Enter            processing          🟢 green (pulsing)
11s   PTY output: spinner ⠋ appears                   processing          🟢 green (no change)
15s   PTY output: `running tool: edit src/app.ts`     tool_executing      🟢 green (pulsing)
18s   PTY output: tool finishes, spinner resumes      processing          🟢 green (pulsing)
22s   PTY output: `❯` prompt reappears                agent_ready         🟡 amber
22.3s 300ms silence confirmed                         agent_ready         🟡 amber (committed)
```

#### Example B: Agent asks a confirmation question

```
Time  Event                                          session.status      UI dot
──────────────────────────────────────────────────────────────────────────────────────
0s    Agent is processing a request                   processing          🟢 green (pulsing)
3s    PTY output: "Apply changes? (y/n)"              needs_input         🟡 amber
5s    User types `y\r`                                processing          🟢 green (pulsing)
8s    PTY output: `❯` prompt                          agent_ready         🟡 amber
```

#### Example C: Agent hits an error and recovers

```
Time  Event                                          session.status      UI dot
──────────────────────────────────────────────────────────────────────────────────────
0s    Agent is processing                             processing          🟢 green (pulsing)
2s    PTY output: "Error: file not found"             processing          🟢 green (1st match only)
2.5s  PTY output: "Error: cannot continue"            failed              🔴 red (fast pulse)
5s    PTY output: `❯` prompt reappears                agent_ready         🟡 amber (recovery)
5.3s  300ms silence confirmed                         agent_ready         🟡 amber
```

#### Example D: User manually types `claude` in a shell session

```
Time  Event                                          session.status      UI dot
──────────────────────────────────────────────────────────────────────────────────────
0s    Fresh shell session                             shell_ready         ⚫ hidden
0s    User types `claude` and presses Enter
0s    Tangent detects "claude" →                      agent_launching     🟡 amber
      sets agentType='claude-code',
      updates name to Claude(folder)
3s    PTY output: `›` Claude prompt                   agent_ready         🟡 amber
```

#### Example E: PTY process crashes

```
Time  Event                                          session.status      UI dot
──────────────────────────────────────────────────────────────────────────────────────
0s    Agent is processing                             processing          🟢 green (pulsing)
1s    PTY fires onExit(code=1)                        exited              ⚫ hidden
      session.exitCode = 1
      (exited is terminal — no further transitions)
```

---

## Keyboard Shortcuts Summary

| Shortcut              | Action                                  |
|-----------------------|-----------------------------------------|
| `Ctrl+B`              | Toggle Sessions panel                   |
| `Ctrl+N`              | New terminal session                    |
| `Ctrl+W`              | Close active session                    |
| `Ctrl+Shift+W`        | Close active session (alias)            |
| `Ctrl+Tab`            | Next session                            |
| `Ctrl+Shift+Tab`      | Previous session                        |
| `Ctrl+Shift+1..9`     | Open sidebar to group N                 |
| `1..9` (sidebar open) | Launch agent N                          |
| `Ctrl+=` / `Ctrl++`   | Zoom in                                 |
| `Ctrl+-`              | Zoom out                                |
| `Ctrl+0`              | Reset zoom                              |
| `j` / `↓`             | Move down in session panel              |
| `k` / `↑`             | Move up in session panel                |
| `Enter`               | Select highlighted session              |
| `x` / `Delete`        | Close highlighted session               |
| `F2`                  | Rename highlighted session              |
| `/`                   | Open session filter                     |
| `Escape`              | Close filter / unfocus panel            |

---

## Data Persistence

| Data              | Location                        | Format         |
|-------------------|---------------------------------|----------------|
| Agent profiles    | `~/.tangent/agents.json`        | JSON (v2)      |
| Status files      | `~/.tangent/status/<ptyId>.json`| JSON           |

Agent profiles persist across restarts. The store auto-migrates from the old flat format (v1) to the grouped format (v2).

---

## Tech Stack

| Layer       | Technology                         |
|-------------|------------------------------------|
| Shell       | Electron (main process)            |
| Renderer    | React 19 + Vite 7                  |
| Terminal    | xterm.js 6 + @xterm/addon-fit     |
| PTY         | node-pty                           |
| IPC         | Electron contextBridge + ipcMain   |
| Testing     | Vitest (unit) + Playwright (e2e)   |
| Language    | TypeScript 5                       |

---

## MVP Scope

- **Agents**: Copilot CLI and Claude Code
- **Shell**: PowerShell only
- **Platform**: Windows
- **No**: WSL/SSH/container support, marketplace, org management, workflow engine
