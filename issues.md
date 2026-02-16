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
