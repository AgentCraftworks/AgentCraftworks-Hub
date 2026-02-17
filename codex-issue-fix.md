# Session State Issues: Current Understanding and Fix Plan

## Scope
This summarizes the recent session-state fixes and the remaining gaps in status coordination across SDK events, OSC progress signals, and SystemB parsing.

## State Precedence Table (Current Behavior)

| Signal Source | Signal | Applies To | Current Action | Relative Authority |
|---|---|---|---|---|
| PTY exit | Process exit | all sessions | `status = exited` immediately | highest (terminal) |
| SystemA (status file) | `status` events | sessions with active status file | updates status directly | highest among runtime detectors |
| SDK (`CopilotSession`) | `session.idle`, `assistant.turn_start`, `tool.*`, `session.error` | SDK-attached Copilot sessions | updates status directly in `SessionStore` | high, but currently ungated |
| OSC progress | `9;4;3/1` | all sessions | `status = processing` immediately | high |
| OSC progress | `9;4;0` | shell: immediate ready; agent: debounced 800ms to ready | idle transition with debounce | high for idle hints |
| OSC progress | `9;4;2` | shell only | `status = failed` | medium (guarded) |
| SystemB parser | regex status match | all sessions while `SystemA` inactive | status update | fallback |
| SystemB prompt ready | `❯` + silence | all sessions while `SystemA` inactive | skipped if currently processing/tool | fallback (guarded) |
| SystemB agent detection | banner pattern | shell sessions in `shell_ready` or `agent_launching` | promote to agent + set `agent_ready` | promotion-only helper |

Notes:
- SystemA blocks SystemB status updates (`systemAActive` gate), but it does **not** block OSC or SDK writes.
- SDK writes currently do **not** have a gate when SystemA is active.
- Transition legality is still enforced in `SessionStore.updateStatus()`.

## Problem Timeline From Recent Commits

1. False promotion from output text was reduced by narrowing detection windows and patterns.
2. OSC hidden-state (`9;4;0`) caused idle flicker during active turns; now debounced for agent sessions.
3. Prompt (`❯`) could override processing due to always-visible TUI prompt; now suppressed during active states.
4. SDK connection/subscription races (`client.start()`, session registration timing, duplicate attach) were patched.
5. Transition graph was too strict for real races (`shell_ready -> agent_ready/processing`); now allowed.
6. Activity subtitle noise was reduced (ignore short OSC titles, avoid shell command extraction for agents).

## Remaining Edge Cases

1. Dual-writer race (SDK vs OSC/SystemB)
- For SDK sessions, both SDK and OSC/SystemB can still write status.
- This can still produce transient status jitter if OSC lag/debounce conflicts with SDK truth.

2. SystemA is not global priority in practice
- Design intent says SystemA should override detection, but OSC/SDK paths bypass the `systemAActive` guard.
- If SystemA is introduced for an SDK session, writes may conflict.

3. `watching` leak on attach timeout path
- In `SdkSessionManager.attachToSession()`, timeout logs PTY fallback but does not clear `watching`.
- That can block future attach attempts for that session id.

4. Status promotion side effect ordering
- On `agent-detected`, code promotes + sets `agent_ready` immediately.
- If a processing signal lands right after, quick ready->processing transitions can still happen (now mostly allowed, but still noisy).

5. State machine broadening risk
- Allowing `shell_ready -> processing/agent_ready` fixed races but weakens invariants.
- Additional broadening could hide real bugs if not scoped by session kind.

## Suggested Fixes (Priority Order)

1. Single-writer policy by session kind
- Shell/PTY sessions: keep OSC + SystemB (and SystemA if active).
- Copilot SDK sessions: SDK should be canonical for status; OSC/SystemB should be activity-only or fallback when SDK disconnected.

2. Centralized arbitration in one method
- Add a `SessionStore.updateStatusFromSource(source, status, meta)` or a `StatusArbiter` in main.
- Enforce precedence in one place instead of in each producer.

3. Respect SystemA override everywhere
- If `systemAActive`, suppress OSC and SDK status writes (or define explicit policy that SDK beats SystemA for SDK sessions).
- Make the precedence explicit and test it.

4. Fix `watching` lifecycle bug
- On attach timeout or early cleanup (no port found), remove session id from `watching` so retry is possible.

5. Add source-aware transition metrics/logging
- Log dropped transitions with source and current session kind.
- Keep counters for `invalid_transition`, `suppressed_by_precedence`, `debounced_idle_cancelled`.

6. Add concurrency tests around source conflicts
- New tests for:
  - SDK `processing` arriving while OSC idle debounce is pending.
  - SystemA active while OSC emits status changes.
  - SDK disconnect fallback back to OSC/SystemB.
  - attach timeout then re-attach succeeds.

## Concrete Near-Term Implementation Plan

1. Add `statusAuthority` field per session (`shell`, `systemA`, `sdk`, `fallback`) computed by session kind + runtime connectivity.
2. Route all status writes through a single authority check.
3. Keep non-authoritative sources only for `lastActivity` and telemetry.
4. Patch `SdkSessionManager` cleanup to clear `watching` on timeout/failure.
5. Add targeted vitest coverage for authority switching and timer race conditions.

## Expected Outcome

If you enforce a strict single-writer authority for status and keep all other channels as fallback/activity-only, the remaining flicker/race bugs should drop significantly, and future fixes become localized to the arbiter rather than spread across `StatusEngine` and SDK wiring.