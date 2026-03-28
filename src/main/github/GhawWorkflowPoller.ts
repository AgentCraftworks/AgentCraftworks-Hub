// GhawWorkflowPoller.ts — Polls GitHub Actions workflow runs for a repository.
// Persists last successful payload to disk for fast recovery on app restart.
import { EventEmitter } from 'events'
import { Octokit } from '@octokit/rest'
import { homedir } from 'os'
import path from 'path'
import fs from 'fs'
import type { GhawWorkflowRun, GhawWorkflowData } from '../../shared/hub-types.js'

interface PersistedWorkflowSession {
  repository: string
  runs: GhawWorkflowRun[]
  fetchedAt: number
}

interface GhawWorkflowPollerOptions {
  sessionFilePath?: string
}

export class GhawWorkflowPoller extends EventEmitter {
  private octokit: Octokit
  private owner: string
  private repo: string
  private intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private sessionFilePath: string
  private recoveredData: GhawWorkflowData | null = null

  constructor(token: string, owner: string, repo: string, intervalMs: number, options: GhawWorkflowPollerOptions = {}) {
    super()
    this.octokit = new Octokit({ auth: token })
    this.owner = owner
    this.repo = repo
    this.intervalMs = intervalMs
    this.sessionFilePath = options.sessionFilePath ?? path.join(homedir(), '.agentcraftworks-hub', 'ghaw-workflow-session.json')
    this.recoveredData = this.loadSession()
  }

  start(): void {
    if (this.recoveredData) {
      this.emit('data', { ...this.recoveredData, recovered: true } satisfies GhawWorkflowData)
    }
    this.poll()
    this.timer = setInterval(() => this.poll(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private buildSummary(runs: GhawWorkflowRun[]): GhawWorkflowData['summary'] {
    const summary = {
      total: runs.length,
      queued: 0,
      inProgress: 0,
      completed: 0,
      success: 0,
      failed: 0,
      cancelled: 0,
    }

    for (const run of runs) {
      if (run.status === 'queued') summary.queued++
      if (run.status === 'in_progress') summary.inProgress++
      if (run.status === 'completed') summary.completed++
      if (run.conclusion === 'success') summary.success++
      if (run.conclusion === 'failure') summary.failed++
      if (run.conclusion === 'cancelled') summary.cancelled++
    }

    return summary
  }

  private loadSession(): GhawWorkflowData | null {
    try {
      if (!fs.existsSync(this.sessionFilePath)) return null
      const raw = fs.readFileSync(this.sessionFilePath, 'utf-8')
      const parsed = JSON.parse(raw) as PersistedWorkflowSession
      const runs = Array.isArray(parsed.runs) ? parsed.runs : []
      const repository = typeof parsed.repository === 'string' ? parsed.repository : `${this.owner}/${this.repo}`
      const fetchedAt = typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : Date.now()
      return {
        repository,
        runs,
        summary: this.buildSummary(runs),
        fetchedAt,
      }
    } catch {
      return null
    }
  }

  private persistSession(data: GhawWorkflowData): void {
    try {
      const dir = path.dirname(this.sessionFilePath)
      fs.mkdirSync(dir, { recursive: true })
      const payload: PersistedWorkflowSession = {
        repository: data.repository,
        runs: data.runs,
        fetchedAt: data.fetchedAt,
      }
      fs.writeFileSync(this.sessionFilePath, JSON.stringify(payload), 'utf-8')
    } catch {
      // Best-effort persistence; polling should continue even if disk write fails.
    }
  }

  private async poll(): Promise<void> {
    try {
      const { data } = await this.octokit.request(
        'GET /repos/{owner}/{repo}/actions/runs',
        { owner: this.owner, repo: this.repo, per_page: 20 },
      ) as { data: { workflow_runs?: Array<Record<string, unknown>> } }

      const runsRaw = Array.isArray(data.workflow_runs) ? data.workflow_runs : []
      const runs: GhawWorkflowRun[] = runsRaw.map((run) => {
        const workflowId = Number(run.workflow_id)
        return {
          ...(Number.isFinite(workflowId) ? { workflowId } : {}),
          id: Number(run.id ?? 0),
          name: String(run.name ?? 'unknown'),
          headBranch: String(run.head_branch ?? ''),
          status: String(run.status ?? 'unknown'),
          conclusion: run.conclusion == null ? null : String(run.conclusion),
          runNumber: Number(run.run_number ?? 0),
          event: String(run.event ?? ''),
          htmlUrl: String(run.html_url ?? ''),
          createdAt: String(run.created_at ?? ''),
          updatedAt: String(run.updated_at ?? ''),
          runStartedAt: run.run_started_at == null ? null : String(run.run_started_at),
        }
      })

      const result: GhawWorkflowData = {
        repository: `${this.owner}/${this.repo}`,
        runs,
        summary: this.buildSummary(runs),
        fetchedAt: Date.now(),
      }

      this.persistSession(result)
      this.emit('data', result)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.emit('data', {
        repository: `${this.owner}/${this.repo}`,
        runs: [],
        summary: this.buildSummary([]),
        fetchedAt: Date.now(),
        error: message,
      } satisfies GhawWorkflowData)
    }
  }
}
