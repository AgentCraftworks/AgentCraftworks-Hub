import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StatusEngine } from '../StatusEngine'
import { SessionStore } from '../../session/SessionStore'
import type { Session } from '../../../shared/types'

// Mock SystemA to avoid real file watchers
vi.mock('../SystemA', () => ({
  SystemA: vi.fn().mockImplementation(function () {
    return {
      on: vi.fn(),
      dispose: vi.fn(),
      removeAllListeners: vi.fn(),
      emit: vi.fn()
    }
  })
}))

// Mock CwdTracker to avoid side effects
vi.mock('../CwdTracker', () => ({
  CwdTracker: vi.fn().mockImplementation(function () {
    return {
      handleOutput: vi.fn(),
      handleOscCwd: vi.fn(),
      dispose: vi.fn()
    }
  })
}))

function createStoreWithSession(agentType: string): { store: SessionStore; sessionId: string } {
  const store = new SessionStore()
  const session: Session = {
    id: 'se-test-1',
    kind: agentType === 'shell' ? 'shell' : 'copilot-sdk',
    agentType: agentType as Session['agentType'],
    name: 'Test',
    folderName: 'test',
    folderPath: 'C:\\test',
    isRenamed: false,
    status: 'agent_launching',
    lastActivity: '',
    startedAt: Date.now(),
    updatedAt: Date.now(),
    ptyId: 'pty-1',
    isExternal: false
  }
  store.add(session)
  return { store, sessionId: 'se-test-1' }
}

describe('StatusEngine OSC progress handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('OSC state 3 (indeterminate) sets processing immediately for agent sessions', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    // Feed OSC 9;4;3;0 (indeterminate/thinking)
    engine.feed('\x1b]9;4;3;0\x07')

    expect(store.get(sessionId)?.status).toBe('processing')
    engine.dispose()
  })

  it('OSC state 0 (hidden) sets agent_ready immediately for shell sessions', () => {
    const { store, sessionId } = createStoreWithSession('shell')
    store.updateStatus(sessionId, 'agent_ready')
    store.updateStatus(sessionId, 'processing')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    // Feed OSC 9;4;0;0 (hidden/idle)
    engine.feed('\x1b]9;4;0;0\x07')

    expect(store.get(sessionId)?.status).toBe('agent_ready')
    engine.dispose()
  })

  it('OSC state 0 (hidden) is debounced for agent sessions (not immediate)', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    store.updateStatus(sessionId, 'processing')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    // Feed OSC 9;4;0;0 (hidden/idle)
    engine.feed('\x1b]9;4;0;0\x07')

    // Should NOT be agent_ready yet — debounced
    expect(store.get(sessionId)?.status).toBe('processing')

    // After 800ms, it should transition
    vi.advanceTimersByTime(800)
    expect(store.get(sessionId)?.status).toBe('agent_ready')

    engine.dispose()
  })

  it('OSC state 3 cancels pending idle transition for agent sessions', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    store.updateStatus(sessionId, 'processing')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    // Agent finishes one tool, CLI sends state 0
    engine.feed('\x1b]9;4;0;0\x07')
    expect(store.get(sessionId)?.status).toBe('processing')

    // 400ms later, agent starts thinking again (state 3)
    vi.advanceTimersByTime(400)
    engine.feed('\x1b]9;4;3;0\x07')

    // Now even after 800ms total, should stay processing (not agent_ready)
    vi.advanceTimersByTime(400)
    expect(store.get(sessionId)?.status).toBe('processing')

    engine.dispose()
  })

  it('multiple rapid state 0 signals only result in one transition', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    store.updateStatus(sessionId, 'processing')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    const handler = vi.fn()
    store.on('updated', handler)

    // Rapid state 0 signals
    engine.feed('\x1b]9;4;0;0\x07')
    engine.feed('\x1b]9;4;0;0\x07')
    engine.feed('\x1b]9;4;0;0\x07')

    // Wait for debounce
    vi.advanceTimersByTime(800)

    // Should only have one agent_ready transition
    const readyUpdates = handler.mock.calls.filter(
      (call) => call[0].status === 'agent_ready'
    )
    expect(readyUpdates.length).toBe(1)

    engine.dispose()
  })

  it('dispose cancels pending idle timer', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    store.updateStatus(sessionId, 'processing')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    // Start debounce
    engine.feed('\x1b]9;4;0;0\x07')

    // Dispose before debounce fires
    engine.dispose()

    // Timer should not fire
    vi.advanceTimersByTime(1000)
    expect(store.get(sessionId)?.status).toBe('processing')
  })

  it('full agent turn lifecycle: processing → idle → processing → idle', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    // Turn 1: start thinking
    engine.feed('\x1b]9;4;3;0\x07')
    expect(store.get(sessionId)?.status).toBe('processing')

    // Turn 1: finish
    engine.feed('\x1b]9;4;0;0\x07')
    vi.advanceTimersByTime(800)
    expect(store.get(sessionId)?.status).toBe('agent_ready')

    // Turn 2: start thinking again
    engine.feed('\x1b]9;4;3;0\x07')
    expect(store.get(sessionId)?.status).toBe('processing')

    // Turn 2: finish
    engine.feed('\x1b]9;4;0;0\x07')
    vi.advanceTimersByTime(800)
    expect(store.get(sessionId)?.status).toBe('agent_ready')

    engine.dispose()
  })

  it('OSC state 2 (error) is ignored for agent sessions', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    store.updateStatus(sessionId, 'processing')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    engine.feed('\x1b]9;4;2;0\x07')
    expect(store.get(sessionId)?.status).toBe('processing') // not failed

    engine.dispose()
  })

  it('OSC state 2 (error) sets failed for shell sessions', () => {
    const { store, sessionId } = createStoreWithSession('shell')
    store.updateStatus(sessionId, 'agent_ready')
    store.updateStatus(sessionId, 'processing')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    engine.feed('\x1b]9;4;2;0\x07')
    expect(store.get(sessionId)?.status).toBe('failed')

    engine.dispose()
  })

  it('OSC title updates lastActivity for agent sessions', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    engine.feed('\x1b]2;🤖 Building the app\x07')
    expect(store.get(sessionId)?.lastActivity).toBe('Building the app')

    engine.dispose()
  })

  it('OSC title ignores short titles (< 3 chars) for agent sessions', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    store.updateActivity(sessionId, 'Real activity')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    engine.feed('\x1b]2;a\x07')
    expect(store.get(sessionId)?.lastActivity).toBe('Real activity')

    engine.feed('\x1b]2;ab\x07')
    expect(store.get(sessionId)?.lastActivity).toBe('Real activity')

    engine.dispose()
  })

  it('OSC state 3 (indeterminate) clears needs_input — user answered, Copilot resumed', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    store.updateStatus(sessionId, 'needs_input')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    // User answers the question, Copilot starts thinking (OSC state 3)
    engine.feed('\x1b]9;4;3;0\x07')

    // needs_input should be cleared — processing is the new authoritative state
    expect(store.get(sessionId)?.status).toBe('processing')

    engine.dispose()
  })

  it('OSC state 0 debounce clears needs_input after user answers and Copilot finishes', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    store.updateStatus(sessionId, 'needs_input')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    // User answers → Copilot thinks → finishes
    engine.feed('\x1b]9;4;3;0\x07')
    expect(store.get(sessionId)?.status).toBe('processing')

    engine.feed('\x1b]9;4;0;0\x07')
    vi.advanceTimersByTime(800)
    expect(store.get(sessionId)?.status).toBe('agent_ready')

    engine.dispose()
  })

  it('stale TUI redraws with needs_input text do not re-enter needs_input after OSC clears it', () => {
    const { store, sessionId } = createStoreWithSession('copilot-cli')
    store.updateStatus(sessionId, 'agent_ready')
    store.updateStatus(sessionId, 'needs_input')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    // OSC state 3 clears needs_input → processing
    engine.feed('\x1b]9;4;3;0\x07')
    expect(store.get(sessionId)?.status).toBe('processing')

    // TUI redraws the screen — stale "Asking user" text is still visible
    engine.feed('Asking user Which color?\nOther (type your answer)')
    expect(store.get(sessionId)?.status).toBe('processing') // NOT needs_input

    // Copilot finishes processing
    engine.feed('\x1b]9;4;0;0\x07')
    vi.advanceTimersByTime(800)
    expect(store.get(sessionId)?.status).toBe('agent_ready')

    engine.dispose()
  })

  it('OSC title is ignored for shell sessions', () => {
    const { store, sessionId } = createStoreWithSession('shell')
    store.updateStatus(sessionId, 'agent_ready')
    const engine = new StatusEngine(sessionId, 'pty-1', store)

    engine.feed('\x1b]2;Some Process\x07')
    expect(store.get(sessionId)?.lastActivity).toBe('')

    engine.dispose()
  })
})
