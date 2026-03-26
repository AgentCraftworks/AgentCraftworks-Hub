import { describe, expect, it } from 'vitest'
import type { GhawInsightsSnapshot, GhawWorkflowPoller } from '@shared/hub-types'

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

  it('accepts a complete GhawInsightsSnapshot payload shape', () => {
    const snapshot: GhawInsightsSnapshot = {
      definitions: [],
      runs7d: [],
      runs30d: [],
      anomalies: [],
      topHotspots: [],
      minutes7d: {
        window: '7d',
        ghawRuntimeMinutes: 0,
        estimatedBillableMinutes: { total: 0 },
        methodology: 'run_duration_estimate',
      },
      minutes30d: {
        window: '30d',
        ghawRuntimeMinutes: 0,
        estimatedBillableMinutes: { total: 0 },
        methodology: 'run_duration_estimate',
      },
      fetchedAt: Date.now(),
    }

    expect(snapshot.minutes7d.window).toBe('7d')
    expect(snapshot.minutes30d.window).toBe('30d')
    expect(snapshot.minutes7d.estimatedBillableMinutes.total).toBe(0)
  })
})
