import { describe, expect, it } from 'vitest'
import type { ActionRequest, OperationLogEntry } from '@shared/hub-types'
import { buildWorkflowHealthMetrics } from '../WorkflowHealthPanel'

const NOW = Date.parse('2026-03-26T20:00:00.000Z')

function operation(id: string, result: 'ok' | 'failed', ts: string): OperationLogEntry {
  return {
    id,
    ts,
    actor: 'copilot',
    action: 'workflow.run',
    scope: 'org:AICraftworks',
    surface: 'desktop',
    tier: 'T2',
    result,
  }
}

function pendingRequest(id: string): ActionRequest {
  return {
    id,
    ts: new Date(NOW).toISOString(),
    actor: 'copilot',
    action: 'deploy',
    scope: 'org:AICraftworks',
    surface: 'desktop',
    tier: 'T3',
    state: 'pending',
  }
}

describe('buildWorkflowHealthMetrics', () => {
  it('marks healthy when all recent runs succeed and no pending approvals', () => {
    const metrics = buildWorkflowHealthMetrics(
      [
        operation('1', 'ok', '2026-03-26T19:00:00.000Z'),
        operation('2', 'ok', '2026-03-26T18:15:00.000Z'),
      ],
      [],
      NOW,
      new Date(NOW),
    )

    expect(metrics.status).toBe('healthy')
    expect(metrics.totalRuns).toBe(2)
    expect(metrics.failedRuns).toBe(0)
    expect(metrics.successRate).toBe(100)
  })

  it('marks degraded when there is a failure but critical threshold not reached', () => {
    const metrics = buildWorkflowHealthMetrics(
      [
        operation('1', 'ok', '2026-03-26T19:00:00.000Z'),
        operation('2', 'failed', '2026-03-26T18:30:00.000Z'),
        operation('3', 'ok', '2026-03-26T18:00:00.000Z'),
        operation('4', 'ok', '2026-03-26T17:00:00.000Z'),
      ],
      [],
      NOW,
      new Date(NOW),
    )

    expect(metrics.status).toBe('degraded')
    expect(metrics.totalRuns).toBe(4)
    expect(metrics.failedRuns).toBe(1)
    expect(metrics.successRate).toBe(75)
  })

  it('marks critical for high failure ratio', () => {
    const metrics = buildWorkflowHealthMetrics(
      [
        operation('1', 'failed', '2026-03-26T19:30:00.000Z'),
        operation('2', 'failed', '2026-03-26T19:20:00.000Z'),
        operation('3', 'ok', '2026-03-26T19:10:00.000Z'),
      ],
      [],
      NOW,
      new Date(NOW),
    )

    expect(metrics.status).toBe('critical')
    expect(metrics.successRate).toBe(33)
  })

  it('marks critical for high pending approvals even without failures', () => {
    const metrics = buildWorkflowHealthMetrics(
      [operation('1', 'ok', '2026-03-26T19:10:00.000Z')],
      Array.from({ length: 10 }, (_, i) => pendingRequest(`req-${i}`)),
      NOW,
      new Date(NOW),
    )

    expect(metrics.status).toBe('critical')
    expect(metrics.pendingRequests).toBe(10)
  })

  it('marks stale when dashboard data has not updated recently', () => {
    const staleTime = new Date(NOW - 6 * 60_000)
    const metrics = buildWorkflowHealthMetrics([], [], NOW, staleTime)

    expect(metrics.status).toBe('stale')
  })

  it('handles high-volume workflow data without changing aggregation behavior', () => {
    const entries: OperationLogEntry[] = Array.from({ length: 10_000 }, (_, i) => operation(
      `ok-${i}`,
      'ok',
      new Date(NOW - (i % 360) * 60_000).toISOString(),
    ))
    entries.push(...Array.from({ length: 2_500 }, (_, i) => operation(
      `failed-${i}`,
      'failed',
      new Date(NOW - (i % 360) * 60_000).toISOString(),
    )))
    const requests: ActionRequest[] = Array.from({ length: 12 }, (_, i) => pendingRequest(`pending-${i}`))

    const metrics = buildWorkflowHealthMetrics(entries, requests, NOW, new Date(NOW))

    expect(metrics.totalRuns).toBe(12_500)
    expect(metrics.failedRuns).toBe(2_500)
    expect(metrics.pendingRequests).toBe(12)
    expect(metrics.chart).toHaveLength(6)
    expect(metrics.status).toBe('critical')
  })
})
