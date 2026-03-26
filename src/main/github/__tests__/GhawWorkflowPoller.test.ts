import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { GhawWorkflowPoller } from '../GhawWorkflowPoller'
import { Octokit } from '@octokit/rest'

const requestMock = vi.fn()

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(function () {
    return { request: requestMock }
  }),
}))

describe('GhawWorkflowPoller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(Octokit).mockImplementation(function () {
      return { request: requestMock } as unknown as Octokit
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits workflow data and persists session payload', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghaw-poller-'))
    const sessionFilePath = path.join(tmpDir, 'session.json')

    requestMock.mockResolvedValue({
      data: {
        workflow_runs: [
          {
            id: 101,
            workflow_id: 5001,
            name: 'CI',
            head_branch: 'main',
            status: 'completed',
            conclusion: 'success',
            run_number: 42,
            event: 'push',
            html_url: 'https://github.com/AgentCraftworks/AgentCraftworks-Hub/actions/runs/101',
            created_at: '2026-03-26T00:00:00Z',
            updated_at: '2026-03-26T00:05:00Z',
            run_started_at: '2026-03-26T00:00:30Z',
          },
        ],
      },
    })

    const poller = new GhawWorkflowPoller('token', 'AgentCraftworks', 'AgentCraftworks-Hub', 1_000, { sessionFilePath })
    const dataSpy = vi.fn()
    poller.on('data', dataSpy)

    poller.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(dataSpy).toHaveBeenCalled()
    const emitted = dataSpy.mock.calls[dataSpy.mock.calls.length - 1][0]
    expect(emitted.repository).toBe('AgentCraftworks/AgentCraftworks-Hub')
    expect(emitted.runs).toHaveLength(1)
    expect(emitted.summary.success).toBe(1)

    expect(fs.existsSync(sessionFilePath)).toBe(true)
    const persisted = JSON.parse(fs.readFileSync(sessionFilePath, 'utf-8')) as { repository: string; runs: unknown[] }
    expect(persisted.repository).toBe('AgentCraftworks/AgentCraftworks-Hub')
    expect(Array.isArray(persisted.runs)).toBe(true)
    expect(persisted.runs).toHaveLength(1)

    poller.stop()
  })

  it('recovers persisted session on start and marks recovered payload', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghaw-poller-'))
    const sessionFilePath = path.join(tmpDir, 'session.json')

    fs.writeFileSync(sessionFilePath, JSON.stringify({
      repository: 'AgentCraftworks/AgentCraftworks-Hub',
      fetchedAt: 1_717_000_000_000,
      runs: [
        {
          id: 7,
          name: 'Release',
          headBranch: 'main',
          status: 'queued',
          conclusion: null,
          runNumber: 7,
          event: 'workflow_dispatch',
          htmlUrl: 'https://example.invalid/runs/7',
          createdAt: '2026-03-26T00:00:00Z',
          updatedAt: '2026-03-26T00:00:01Z',
          runStartedAt: null,
        },
      ],
    }), 'utf-8')

    requestMock.mockResolvedValue({ data: { workflow_runs: [] } })

    const poller = new GhawWorkflowPoller('token', 'AgentCraftworks', 'AgentCraftworks-Hub', 60_000, { sessionFilePath })
    const dataSpy = vi.fn()
    poller.on('data', dataSpy)

    poller.start()
    await vi.runOnlyPendingTimersAsync()

    expect(dataSpy).toHaveBeenCalled()
    const firstEmission = dataSpy.mock.calls[0][0]
    expect(firstEmission.recovered).toBe(true)
    expect(firstEmission.repository).toBe('AgentCraftworks/AgentCraftworks-Hub')
    expect(firstEmission.runs).toHaveLength(1)
    expect(firstEmission.summary.queued).toBe(1)

    poller.stop()
  })

  it('emits error payload when API request fails', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghaw-poller-'))
    const sessionFilePath = path.join(tmpDir, 'session.json')
    requestMock.mockRejectedValue(new Error('boom'))

    const poller = new GhawWorkflowPoller('token', 'AgentCraftworks', 'AgentCraftworks-Hub', 1_000, { sessionFilePath })
    const dataSpy = vi.fn()
    poller.on('data', dataSpy)

    poller.start()
    await vi.advanceTimersByTimeAsync(0)

    const emitted = dataSpy.mock.calls[dataSpy.mock.calls.length - 1][0]
    expect(emitted.error).toBe('boom')
    expect(emitted.runs).toEqual([])
    expect(emitted.summary.total).toBe(0)

    poller.stop()
  })
})
