import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuditLogPoller } from '../AuditLogPoller'
import { Octokit } from '@octokit/rest'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const requestMock = vi.fn()

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(function () {
    return { request: requestMock }
  }),
}))

function msAgo(hours: number): number {
  return Date.now() - hours * 60 * 60_000
}

/** Build a minimal audit log event with request_id set (API-related heuristic) */
function apiEvent(actor: string, hoursAgo: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    '@timestamp': msAgo(hoursAgo),
    actor,
    action: 'some.api.action',
    request_id: `req-${Math.random().toString(36).slice(2)}`,
    ...extra,
  }
}

/** Build an event WITHOUT request_id (non-API — should be excluded) */
function nonApiEvent(actor: string): Record<string, unknown> {
  return { '@timestamp': msAgo(1), actor, action: 'repo.create' }
}

function makePoller(): AuditLogPoller {
  return new AuditLogPoller('token', 'AICraftWorks', 'AgentCraftworks', 60_000)
}

function pollOnce(poller: AuditLogPoller): Promise<ReturnType<AuditLogPoller['emit']>> {
  return new Promise((resolve) => {
    poller.once('data', (d) => {
      poller.stop()
      resolve(d)
    })
    poller.start()
  })
}

// ---------------------------------------------------------------------------
// beforeEach / afterEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(Octokit).mockImplementation(function () {
    return { request: requestMock } as unknown as Octokit
  })
  vi.useFakeTimers({ now: Date.now() })
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditLogPoller — enterprise success path', () => {
  it('emits entries from enterprise endpoint when it succeeds', async () => {
    requestMock.mockResolvedValue({
      data: [
        apiEvent('Jenp-AICraftWorks', 1),
        apiEvent('Jenp-AICraftWorks', 2),
        apiEvent('Copilot', 1),
      ],
      headers: {},
    })

    const result: any = await pollOnce(makePoller())

    expect(result.auditScope).toBe('enterprise')
    expect(result.error).toBeUndefined()
    expect(result.entries).toHaveLength(2) // 2 distinct actors
    expect(result.entries[0].actor).toBe('Jenp-AICraftWorks')
    expect(result.entries[0].count).toBe(2)
    expect(result.entries[0].actorKind).toBe('Human')
    expect(result.entries[1].actor).toBe('Copilot')
    expect(result.entries[1].actorKind).toBe('Copilot')
  })

  it('excludes non-API events from actor counts', async () => {
    requestMock.mockResolvedValue({
      data: [
        apiEvent('alice', 1),
        nonApiEvent('bob'),      // no request_id — must be excluded
        nonApiEvent('alice'),    // also excluded, should not inflate alice's count
      ],
      headers: {},
    })

    const result: any = await pollOnce(makePoller())

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].actor).toBe('alice')
    expect(result.entries[0].count).toBe(1)
  })
})

describe('AuditLogPoller — org fallback on 403', () => {
  it('falls back to org endpoint when enterprise returns 403', async () => {
    // First call: enterprise endpoint → 403
    // Second call: org endpoint → success
    requestMock
      .mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
      .mockResolvedValueOnce({
        data: [apiEvent('Jenp-AICraftWorks', 0.5)],
        headers: {},
      })

    const result: any = await pollOnce(makePoller())

    expect(result.auditScope).toBe('org')
    expect(result.error).toBeUndefined()
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].actor).toBe('Jenp-AICraftWorks')
  })

  it('falls back to org endpoint when enterprise returns 404', async () => {
    requestMock
      .mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }))
      .mockResolvedValueOnce({ data: [], headers: {} })

    const result: any = await pollOnce(makePoller())

    expect(result.auditScope).toBe('org')
    expect(result.entries).toHaveLength(0)
  })

  it('emits error when both enterprise and org endpoints fail', async () => {
    requestMock
      .mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }))
      .mockRejectedValueOnce(new Error('org also failed'))

    const result: any = await pollOnce(makePoller())

    expect(result.auditScope).toBe('org')
    expect(result.error).toContain('org also failed')
    expect(result.entries).toHaveLength(0)
  })

  it('emits error for non-403/404 enterprise errors without falling back', async () => {
    requestMock.mockRejectedValueOnce(Object.assign(new Error('Server Error'), { status: 500 }))

    const result: any = await pollOnce(makePoller())

    expect(result.auditScope).toBe('enterprise')
    expect(result.error).toContain('Server Error')
    // org endpoint should NOT have been called
    expect(requestMock).toHaveBeenCalledTimes(1)
  })
})

describe('AuditLogPoller — actor classification', () => {
  it.each([
    ['Copilot', 'Copilot'],
    ['github-copilot[bot]', 'Copilot'],
    ['my-copilot-app', 'Copilot'],
    ['github-actions[bot]', 'Bot'],
    ['dependabot[bot]', 'Bot'],
    ['Jenp-AICraftWorks', 'Human'],
    ['jenperret', 'Human'],
  ])('classifies "%s" as %s', async (actor, expectedKind) => {
    requestMock.mockResolvedValue({
      data: [apiEvent(actor, 1)],
      headers: {},
    })

    const result: any = await pollOnce(makePoller())

    const entry = result.entries.find((e: any) => e.actor === actor)
    expect(entry?.actorKind).toBe(expectedKind)
  })
})

describe('AuditLogPoller — topCallers1h', () => {
  it('includes only events from the last hour in topCallers1h', async () => {
    requestMock.mockResolvedValue({
      data: [
        apiEvent('alice', 0.5),  // 30 min ago — in 1h window
        apiEvent('alice', 0.5),  // 30 min ago — in 1h window
        apiEvent('bob', 2),      // 2 h ago — outside 1h window
      ],
      headers: {},
    })

    const result: any = await pollOnce(makePoller())

    // 24h entries: alice(2), bob(1)
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0].actor).toBe('alice')

    // 1h entries: only alice
    expect(result.topCallers1h).toHaveLength(1)
    expect(result.topCallers1h[0].actor).toBe('alice')
    expect(result.topCallers1h[0].count).toBe(2)
  })
})

describe('AuditLogPoller — hourlyBuckets', () => {
  it('produces stacked hourly buckets per actor kind', async () => {
    const fakeNow = new Date('2026-03-27T10:00:00Z').getTime()
    vi.setSystemTime(fakeNow)

    requestMock.mockResolvedValue({
      data: [
        // 09:30 — Copilot (2) + Human (1)
        { '@timestamp': new Date('2026-03-27T09:30:00Z').getTime(), actor: 'Copilot', action: 'a', request_id: 'r1' },
        { '@timestamp': new Date('2026-03-27T09:45:00Z').getTime(), actor: 'Copilot', action: 'a', request_id: 'r2' },
        { '@timestamp': new Date('2026-03-27T09:50:00Z').getTime(), actor: 'alice', action: 'a', request_id: 'r3' },
        // 08:15 — Human (1)
        { '@timestamp': new Date('2026-03-27T08:15:00Z').getTime(), actor: 'alice', action: 'a', request_id: 'r4' },
      ],
      headers: {},
    })

    const result: any = await pollOnce(makePoller())
    const buckets: any[] = result.hourlyBuckets

    // Two distinct hour buckets
    expect(buckets).toHaveLength(2)

    const h08 = buckets.find((b: any) => b.hourUtc.startsWith('2026-03-27 08'))
    const h09 = buckets.find((b: any) => b.hourUtc.startsWith('2026-03-27 09'))

    expect(h08).toBeDefined()
    expect(h08.human).toBe(1)
    expect(h08.copilot).toBe(0)
    expect(h08.total).toBe(1)

    expect(h09).toBeDefined()
    expect(h09.copilot).toBe(2)
    expect(h09.human).toBe(1)
    expect(h09.total).toBe(3)
  })

  it('returns empty hourlyBuckets when there are no API events', async () => {
    requestMock.mockResolvedValue({ data: [nonApiEvent('alice')], headers: {} })

    const result: any = await pollOnce(makePoller())

    expect(result.hourlyBuckets).toHaveLength(0)
  })
})

describe('AuditLogPoller — pagination', () => {
  it('stops fetching pages when response is not full', async () => {
    // Page 1: full (100 items), page 2: partial (5 items) — should not fetch page 3
    const fullPage = Array.from({ length: 100 }, (_, i) => apiEvent('alice', 1))
    const partialPage = Array.from({ length: 5 }, (_, i) => apiEvent('bob', 1))

    requestMock
      .mockResolvedValueOnce({ data: fullPage, headers: { link: '<...>; rel="next"' } })
      .mockResolvedValueOnce({ data: partialPage, headers: {} })

    const result: any = await pollOnce(makePoller())

    expect(requestMock).toHaveBeenCalledTimes(2)
    expect(result.entries.find((e: any) => e.actor === 'alice').count).toBe(100)
    expect(result.entries.find((e: any) => e.actor === 'bob').count).toBe(5)
  })
})
