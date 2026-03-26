import { describe, expect, it } from 'vitest'
import type { GhawWorkflowPoller } from '@shared/hub-types'

describe('GhawWorkflowPoller contract', () => {
  it('supports typed method and event signatures', () => {
    const unsub = () => {}
    const poller: GhawWorkflowPoller = {
      start: async () => ({ ok: true }),
      stop: async () => ({ ok: true }),
      refresh: async () => ({ ok: true }),
      getSnapshot: async () => null,
      onSnapshot: () => unsub,
      onError: () => unsub,
    }

    expect(typeof poller.start).toBe('function')
    expect(typeof poller.onSnapshot).toBe('function')
    expect(poller.onSnapshot(() => {})).toBe(unsub)
    expect(poller.onError(() => {})).toBe(unsub)
  })
})
