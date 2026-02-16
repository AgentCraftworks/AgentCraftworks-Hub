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

The [Copilot SDK](https://github.com/github/copilot-sdk) (`github/copilot-sdk`) already defines the exact event taxonomy that would solve this problem. When running Copilot CLI in server mode, the SDK communicates via JSON-RPC notifications (`session.event`) with structured `SessionEvent` objects. The relevant event types map directly to Tangent's internal statuses:

| SDK Event | Tangent Status | Description |
|---|---|---|
| `session.idle` | `agent_ready` | Agent finished processing, ready for input |
| `assistant.turn_start` | `processing` | Started processing user request |
| `assistant.message_delta` | `processing` | Streaming LLM response tokens |
| `assistant.turn_end` | `agent_ready` | Finished processing turn |
| `tool.invocation_start` | `tool_executing` | Agent invoking a tool (file read, shell cmd, etc.) |
| `tool.invocation_end` | `processing` | Tool finished, back to LLM processing |
| `tool.invocation_error` | `failed` | Tool execution failed |
| `session.error` | `failed` | Session-level error |
| (permission request) | `needs_input` | Agent needs user approval |

**How Tangent could integrate with the SDK:**

Instead of spawning Copilot CLI as a raw PTY process and scraping its terminal output, Tangent would:

1. **Start Copilot CLI in server mode** — the SDK exposes a JSON-RPC server over stdio or TCP
2. **Connect as an SDK client** — using `@github/copilot-sdk` (TypeScript) to create a session
3. **Register event handlers** — structured callbacks for each state transition
4. **Render terminal output separately** — the SDK streams `assistant.message_delta` events with the actual text content, which Tangent would render in xterm.js

```typescript
import { CopilotClient } from '@github/copilot-sdk'

const client = new CopilotClient()
const session = await client.createSession({ model: 'gpt-4' })

session.on('assistant.turn_start', () => {
  store.updateStatus(sessionId, 'processing')
})

session.on('tool.invocation_start', (event) => {
  store.updateStatus(sessionId, 'tool_executing')
  store.updateActivity(sessionId, event.data.tool_name)
})

session.on('tool.invocation_end', () => {
  store.updateStatus(sessionId, 'processing')
})

session.on('session.idle', () => {
  store.updateStatus(sessionId, 'agent_ready')
})

session.on('session.error', () => {
  store.updateStatus(sessionId, 'failed')
})
```

**This would eliminate the entire StatusEngine for SDK-based sessions** — no SystemB output scraping, no regex rules, no debounce timers, no hysteresis, no transition validation. The SDK provides deterministic, typed events with zero ambiguity.

**Tradeoffs and open questions:**

| Consideration | Details |
|---|---|
| **Terminal rendering** | Today Tangent gets free terminal rendering because Copilot CLI writes directly to the PTY. With the SDK, Tangent would need to render assistant output itself (write `message_delta` text to xterm.js). This is actually better — we get full control over formatting. |
| **Tool output** | Tool invocations (shell commands, file reads) produce output that Copilot CLI currently renders inline. The SDK would need to provide this output as event data so Tangent can display it. |
| **PTY passthrough** | For shell commands the agent runs, Tangent may still need a PTY — but it would be a controlled sub-PTY managed by the SDK, not the primary session PTY. |
| **Backward compatibility** | The SDK approach is a fundamentally different architecture (API client vs. PTY wrapper). Tangent would need to support both paths during the transition — SDK mode for new integrations, PTY+SystemB for legacy/fallback. |
| **SDK maturity** | The Copilot SDK is relatively new. We need to validate that it's stable enough for production use and that the event taxonomy is complete for our needs. |
| **Authentication** | The SDK handles GitHub auth internally. Tangent would need to pass through auth tokens or delegate to the SDK's auth flow. |

**Recommended phased approach:**

1. **Now (Issue #2 above):** Ask Copilot CLI to emit OSC escape sequences for status. This is a small, backward-compatible change that works within the existing PTY architecture. It immediately reduces Tangent's fragility.

2. **Near-term:** Prototype a Copilot SDK integration in Tangent as an alternative session type (`sdk-session` vs. `pty-session`). Validate the event taxonomy covers all status needs. Identify gaps.

3. **Long-term:** Migrate fully to the SDK for Copilot sessions. Keep the PTY path for raw shell sessions and other agents (Claude Code) that don't have an SDK. SystemB becomes a fallback for non-SDK agents only.
