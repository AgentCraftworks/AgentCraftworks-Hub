# Issues for Copilot CLI Team

## 1. Expose session metrics via structured output

**Problem:** Tangent (and other terminal hosts) want to display real-time session metrics — token usage, context window %, request count — but Copilot CLI only renders these as human-readable terminal text via `/usage` and `/context` commands. There is no machine-readable channel.

**Current workaround:** Parse terminal output with regex, which is fragile and breaks across versions.

**Requested solution:** Emit metrics as OSC escape sequences (or similar structured format) that terminal hosts can intercept without visual side effects. For example:

```
ESC ] 633 ; Metrics ; {"input_tokens":1234,"output_tokens":567,"cached_tokens":890,"context_pct":42,"requests":3} ST
```

Ideal events:
- **Per-turn completion:** tokens used (input/output/cached), context window %, cumulative request count
- **Context compaction:** triggered at what %, how many tokens reclaimed
- **Rate limit warnings:** remaining requests, reset time

This would allow terminal hosts like Tangent to surface metrics in their own UI without scraping rendered text.

## 2. Emit structured status signals for deterministic agent state detection

### Problem

Terminal hosts like Tangent need to know the current state of a Copilot CLI session (idle, processing, waiting for input, running a tool, error) to drive UI indicators. Today there is **no structured signal** from Copilot CLI, so Tangent is forced to infer state by scraping terminal output with regex pattern matching. This is fundamentally fragile:

**What we're doing today (System B — output scraping):**

| State | Detection method | Problem |
|---|---|---|
| Processing | Match spinner chars `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` or the word "Thinking" | Spinners are a rendering detail — if Copilot changes to a bar or percentage, detection breaks. "Thinking" can appear in user content. |
| Tool executing | Match `running tool:`, `Reading file`, `Writing file`, etc. | Exact phrasing is undocumented and changes between versions. |
| Needs input | Match `(y/n)`, `continue?`, `allow?`, `approve?`, `Enter to confirm`, `Other (type your answer)` | Every new prompt phrasing requires a Tangent update. We're always one release behind. |
| Agent ready | Match `❯` or `›` prompt chars, then wait 300ms of silence | False positives when these chars appear in output content. The 300ms silence timer adds latency and races with fast output bursts. |
| Failed | Match `^Error:`, `^FATAL:`, `ENOENT`, etc. — require 2 matches within 3 seconds | Agents routinely print error text as content (e.g., explaining an error to the user). We had to restrict this to only `shell_ready` and `agent_launching` states to avoid false failures. |

**The resulting complexity in Tangent:**

To make this work even partially, we've built a layered detection system with:
- 8 regex rules with priority ordering
- A 500ms minimum hold between transitions (anti-flicker)
- A 300ms silence timer for prompt detection (anti-false-positive)
- A 3-second sliding window requiring 2 error matches (hysteresis)
- State gating that ignores error patterns during agent sessions
- ANSI stripping (4 regex passes) before pattern matching
- A 20-line rolling buffer
- 23 explicitly whitelisted state transitions (invalid ones are silently dropped)
- A file-watcher system (System A) as an override when available

All of this exists because we're parsing human-readable text to extract machine state. **It's ~180 lines of heuristic code that will break whenever Copilot CLI changes its output formatting.**

### What we've built as a workaround (System A — status file)

Because output scraping is unreliable, we designed a file-based protocol as a fallback. Tangent watches `~/.tangent/status/<ptyId>.json` for a status file that the agent can write:

```json
{
  "status": "ready" | "processing" | "tool" | "input" | "error",
  "detail": "Reading src/main/index.ts",
  "updatedAt": 1708099200000
}
```

This works perfectly — deterministic, versioned, no parsing ambiguity. But **Copilot CLI doesn't write this file**, so it sits unused and we fall back to fragile regex scraping.

### Proposed solution: OSC escape sequences for agent state

We propose that Copilot CLI emits OSC escape sequences to signal state transitions. This is the standard mechanism for terminal programs to communicate structured data to terminal hosts — it's how shell integration, progress bars, and CWD tracking already work.

**Recommended format using existing ConEmu/iTerm2-style OSC 633 sequences:**

```
# Agent ready / idle
ESC ] 633 ; AgentStatus ; ready ST

# Processing user request (LLM thinking/streaming)
ESC ] 633 ; AgentStatus ; processing ST

# Executing a tool (file read, shell command, etc.)
ESC ] 633 ; AgentStatus ; tool ; Reading src/index.ts ST

# Waiting for user input (approval prompt, y/n, etc.)
ESC ] 633 ; AgentStatus ; input ; Allow edit to src/index.ts? ST

# Error state
ESC ] 633 ; AgentStatus ; error ; Rate limit exceeded ST
```

**Why OSC:**
- Already supported by every terminal emulator (invisible to users, parsed by hosts)
- Copilot CLI already runs inside terminals that handle OSC for shell integration
- No file I/O, no polling, no race conditions
- Instant — emitted inline with output, zero latency
- Forward-compatible — unknown sequences are silently ignored by terminals that don't support them

**State lifecycle for a typical Copilot turn:**
```
ready → processing → tool → processing → tool → processing → ready
                                                      ↘ input → (user responds) → processing → ready
```

### Impact

If Copilot CLI adopted this, Tangent could **delete ~180 lines of fragile heuristic code** (all of System B's status detection rules, timers, and hysteresis logic) and replace it with a single OSC parser that reads deterministic signals. The status would always be correct, with zero lag, and would never break across Copilot CLI version updates.

### Alternative: custom OSC namespace

If OSC 633 is too crowded, a dedicated namespace works too:

```
ESC ] 9001 ; status=processing ; detail=Thinking... ST
ESC ] 9001 ; status=tool ; detail=Reading file src/main/index.ts ST
ESC ] 9001 ; status=input ; detail=Allow shell command: npm test? ST
ESC ] 9001 ; status=ready ST
```

The key requirement is: **any structured, machine-parseable signal emitted inline with terminal output that tells us the current agent state.** The specific encoding matters less than the fact that it exists.

### Copilot SDK as a longer-term solution

The [Copilot SDK](https://github.com/github/copilot-sdk) (`@github/copilot-sdk` on npm) already defines the exact event taxonomy that solves this problem. The SDK communicates with Copilot CLI running in server mode via JSON-RPC over stdio or TCP. Session events are typed TypeScript discriminated unions generated from `session-events.schema.json`.

**Complete event taxonomy from SDK source (`nodejs/src/generated/session-events.ts`):**

The SDK defines 30+ `SessionEvent` types. The ones relevant to status detection are:

| SDK Event Type | Tangent Status | Data Fields | Notes |
|---|---|---|---|
| `session.idle` | `agent_ready` | `{}` (ephemeral) | Definitive "ready for input" signal |
| `session.error` | `failed` | `errorType`, `message`, `stack?`, `statusCode?` | Structured error with stack trace |
| `session.warning` | *(informational)* | `warningType`, `message` | Non-fatal warnings |
| `session.shutdown` | `exited` | `shutdownType`, `totalPremiumRequests`, `modelMetrics`, `codeChanges` | Rich shutdown telemetry |
| `assistant.turn_start` | `processing` | `turnId` | Start of LLM processing |
| `assistant.message_delta` | `processing` | `messageId`, `deltaContent` | Streaming response tokens (ephemeral) |
| `assistant.message` | `processing` | `messageId`, `content`, `toolRequests?` | Final assembled message |
| `assistant.intent` | *(activity update)* | `intent` | Agent's current intent (e.g., "Fixing CSS") |
| `assistant.reasoning_delta` | `processing` | `reasoningId`, `deltaContent` | Streaming thinking tokens |
| `assistant.turn_end` | → triggers `session.idle` | `turnId` | End of LLM processing |
| `assistant.usage` | *(metrics — Issue #1)* | `model`, `inputTokens`, `outputTokens`, `cacheReadTokens`, `cost`, `quotaSnapshots` | Per-request token/cost metrics |
| `tool.execution_start` | `tool_executing` | `toolCallId`, `toolName`, `arguments?`, `mcpServerName?` | Tool name + args for activity display |
| `tool.execution_progress` | `tool_executing` | `toolCallId`, `progressMessage` | Live progress within a tool |
| `tool.execution_partial_result` | `tool_executing` | `toolCallId`, `partialOutput` | Streaming tool output |
| `tool.execution_complete` | `processing` | `toolCallId`, `success`, `result?`, `error?` | Includes structured result content |
| `subagent.started` | `processing` | `toolCallId`, `agentName`, `agentDisplayName` | Sub-agent spawned |
| `subagent.completed` | `processing` | `toolCallId`, `agentName` | Sub-agent finished |
| `subagent.failed` | *(informational)* | `toolCallId`, `error` | Sub-agent error |
| `session.compaction_start` | *(informational)* | `{}` | Context compaction began |
| `session.compaction_complete` | *(informational)* | `preCompactionTokens`, `postCompactionTokens`, `tokensRemoved` | Compaction metrics |
| `session.context_changed` | *(CWD update)* | `cwd`, `gitRoot?`, `repository?`, `branch?` | Replaces OSC CWD tracking |
| `session.title_changed` | *(activity update)* | `title` | Session title change |
| `session.usage_info` | *(metrics — Issue #1)* | `tokenLimit`, `currentTokens`, `messagesLength` | Context window utilization |
| `session.truncation` | *(metrics)* | `tokenLimit`, `tokensRemovedDuringTruncation`, `messagesRemovedDuringTruncation` | Message truncation stats |

The SDK also handles **permission requests** via a dedicated `onPermissionRequest` handler (not an event) — the agent calls this when it needs approval for shell commands, file writes, MCP calls, or URL fetches. This maps directly to Tangent's `needs_input` status. Similarly, **user input requests** via `onUserInputRequest` handle the `ask_user` tool.

**Additionally, the SDK solves Issue #1 (metrics) for free.** The `assistant.usage` event provides per-request token counts, costs, and quota snapshots. The `session.shutdown` event provides complete session-level metrics including total premium requests, API duration, and code changes (lines added/removed, files modified). The `session.usage_info` event provides real-time context window utilization.

**How Tangent would integrate (from actual SDK API in `nodejs/src/session.ts`):**

```typescript
import { CopilotClient } from '@github/copilot-sdk'

// SDK manages CLI process lifecycle automatically
const client = new CopilotClient({
  useStdio: true,      // communicate via stdin/stdout pipes
  cwd: sessionFolder,  // working directory
})

const session = await client.createSession({
  model: 'gpt-4',
  streaming: true,     // enable assistant.message_delta events

  // Permission requests → drives needs_input status
  onPermissionRequest: async (request) => {
    store.updateStatus(sessionId, 'needs_input')
    store.updateActivity(sessionId, `${request.kind}: approve?`)
    const approved = await showPermissionDialog(request)
    store.updateStatus(sessionId, 'processing')
    return { kind: approved ? 'approved' : 'denied-interactively-by-user' }
  },

  // User input requests → drives needs_input status
  onUserInputRequest: async (request) => {
    store.updateStatus(sessionId, 'needs_input')
    const answer = await showInputDialog(request.question, request.choices)
    return { answer, wasFreeform: !request.choices?.includes(answer) }
  },
})

// Typed event handlers — no regex, no debounce, no heuristics
session.on('assistant.turn_start', () => {
  store.updateStatus(sessionId, 'processing')
})

session.on('assistant.intent', (event) => {
  store.updateActivity(sessionId, event.data.intent)
})

session.on('assistant.message_delta', (event) => {
  // Write streamed text to xterm.js for display
  terminal.write(event.data.deltaContent)
})

session.on('tool.execution_start', (event) => {
  store.updateStatus(sessionId, 'tool_executing')
  store.updateActivity(sessionId, `${event.data.toolName}`)
})

session.on('tool.execution_progress', (event) => {
  store.updateActivity(sessionId, event.data.progressMessage)
})

session.on('tool.execution_complete', (event) => {
  // Display tool results (terminal output, file contents, etc.)
  if (event.data.result?.contents) {
    for (const content of event.data.result.contents) {
      if (content.type === 'terminal') terminal.write(content.text)
    }
  }
  store.updateStatus(sessionId, 'processing')
})

session.on('session.idle', () => {
  store.updateStatus(sessionId, 'agent_ready')
})

session.on('session.error', (event) => {
  store.updateStatus(sessionId, 'failed')
  store.updateActivity(sessionId, event.data.message)
})

// Metrics (solves Issue #1)
session.on('assistant.usage', (event) => {
  store.updateMetrics(sessionId, {
    inputTokens: event.data.inputTokens,
    outputTokens: event.data.outputTokens,
    cacheReadTokens: event.data.cacheReadTokens,
    cost: event.data.cost,
    quota: event.data.quotaSnapshots,
  })
})

session.on('session.context_changed', (event) => {
  store.updateCwd(sessionId, event.data.cwd)
})

// Send user message
await session.send({ prompt: userInput })

// Or send and wait for completion
const response = await session.sendAndWait({ prompt: userInput }, 60_000)
```

**This would eliminate the entire StatusEngine for SDK-based sessions** — no SystemB output scraping, no regex rules, no debounce timers, no hysteresis, no transition validation. The SDK provides deterministic, typed events with zero ambiguity.

**Tradeoffs and open questions:**

| Consideration | Details |
|---|---|
| **Terminal rendering** | Today Tangent gets free terminal rendering because Copilot CLI writes directly to the PTY. With the SDK, Tangent renders `assistant.message_delta` and `tool.execution_complete` content itself via xterm.js. This is actually better — full control over formatting, and tool results include structured `contents` (text, terminal output with exit codes, images, resource links). |
| **Tool output** | The SDK's `tool.execution_complete` event includes rich `result.contents` with typed entries: `text`, `terminal` (with exit code and cwd), `image` (base64), `resource_link`, and `resource`. This is far richer than what we can scrape from PTY output. |
| **Permission UX** | The SDK's `onPermissionRequest` handler receives structured `{ kind: "shell" | "write" | "mcp" | "read" | "url" }` requests. Tangent can show a native approval dialog instead of trying to detect `(y/n)` prompts from output text. |
| **Sub-agents** | The SDK emits `subagent.started/completed/failed` events — Tangent can show which sub-agent is running. Currently invisible via PTY scraping. |
| **Hooks** | SDK supports `onPreToolUse`, `onPostToolUse`, `onSessionStart`, `onSessionEnd`, `onErrorOccurred` hooks. Tangent could use these to intercept and modify tool behavior or add custom logic. |
| **Authentication** | SDK supports multiple auth methods: GitHub OAuth (stored from `copilot` CLI login), environment variables (`GH_TOKEN`), and BYOK (bring your own key). Tangent would pass `githubToken` or set `useLoggedInUser: true`. |
| **Backward compatibility** | The SDK approach is a fundamentally different architecture (API client vs. PTY wrapper). Tangent would need to support both paths during transition — SDK mode for Copilot, PTY+SystemB for shell sessions and Claude Code. |
| **SDK maturity** | Currently in "Technical Preview". The event schema is auto-generated and well-typed. Available on npm as `@github/copilot-sdk`. |

**Recommended phased approach:**

1. **Now (Issue #2 above):** Ask Copilot CLI to emit OSC escape sequences for status. This is a small, backward-compatible change that works within the existing PTY architecture. It immediately reduces Tangent's fragility.

2. **Near-term:** Prototype a Copilot SDK integration in Tangent as an alternative session type (`sdk-session` vs. `pty-session`). The SDK manages the CLI process lifecycle automatically via `CopilotClient({ useStdio: true })`. Validate the event taxonomy covers all status needs. Identify gaps.

3. **Long-term:** Migrate fully to the SDK for Copilot sessions. Keep the PTY path for raw shell sessions and other agents (Claude Code) that don't have an SDK. SystemB becomes a fallback for non-SDK agents only. The SDK also eliminates the need for Issue #1 (metrics) since `assistant.usage`, `session.usage_info`, and `session.shutdown` events provide all metrics data natively.
