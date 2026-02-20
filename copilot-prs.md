# Copilot PR Summaries

## Copilot SDK (`copilot-sdk/nodejs`) — 3 commits

**File changed:** `src/client.ts`

**What:** Adds deterministic detection of `ask_user` tool execution via session event notifications, enabling external consumers (like Tangent) to track when Copilot is waiting for user input and when the user responds.

**Changes:**

1. **`onUserInputRequested()` callback** — New public method. Fires when Copilot's `ask_user` tool starts, providing `{ sessionId, question, choices? }`. Detected from `tool.execution_start` session events with `toolName === "ask_user"`.

2. **`onUserInputCompleted()` callback** — New public method. Fires when the user answers, providing `{ sessionId, answer }`. Detected by tracking `toolCallId` from `tool.execution_start` and matching it in `tool.execution_complete`.

3. **Session event notification handling** — `handleSessionEventNotification()` now extracts `ask_user` tool events from the broadcast `session.event` notifications. This works **without** a successful `session.resume` call, since session events are broadcast to all connections. Added `pendingAskUserCallIds` set for toolCallId tracking.

4. **Notification dispatch ordering** — Moved `onUserInputRequested` dispatch before `resolveSessionForInboundRequest` in `handleUserInputRequest`, so it fires even when the session isn't registered.

5. **`cliUrl` connection fixes** (prior commit) — Skip `getBundledCliPath` for `cliUrl` connections, strip auth options to avoid rejection.

---

## Copilot CLI (`copilot-agent-runtime`) — 2 commits

**File changed:** `src/cli/server.ts`

**What:** Enables SDK clients connected via `--ui-server` to receive session events from the TUI's foreground session, even without a successful `session.resume`.

**Changes:**

1. **Foreground session event forwarding** — `registerForegroundSession()` now sets up a `session.on("*")` listener that broadcasts all session events (including `tool.execution_start`, `tool.execution_complete`, `assistant.turn_start`, etc.) to every connected SDK client via `session.event` notifications. Previously, event forwarding was only set up during `initializeSession()` (called from `session.resume`), so SDK clients never received events if `session.resume` failed.

2. **Cleanup on session change** — When the foreground session changes, the previous session's event listener is cleaned up (if it wasn't already tracked via `activeSessions`).

3. **Debug logging** — Added `logger.info` for `session.resume` lookup diagnostics showing `foregroundSessionId` match status.
