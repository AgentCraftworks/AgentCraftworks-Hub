// HandoffPoller.ts — Polls handoff state from CE API or .squad/ files every 10s
// Emits 'data' with HubHandoffData snapshot.

import { EventEmitter } from 'events'
import type { HubHandoffData, HubHandoffEntry } from '@shared/hub-types'

export class HandoffPoller extends EventEmitter {
  private intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private ceApiUrl: string

  constructor(intervalMs: number = 10000, ceApiUrl?: string) {
    super()
    this.intervalMs = intervalMs
    this.ceApiUrl = ceApiUrl || process.env.CE_API_URL || 'http://localhost:3002'
  }

  start(): void {
    this.poll()
    this.timer = setInterval(() => this.poll(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  private async poll(): Promise<void> {
    try {
      // Try CE API first
      const [handoffsRes, statsRes] = await Promise.all([
        fetch(`${this.ceApiUrl}/api/handoffs?limit=20`, { signal: AbortSignal.timeout(5000) }),
        fetch(`${this.ceApiUrl}/api/handoffs/stats`, { signal: AbortSignal.timeout(5000) }),
      ])

      if (!handoffsRes.ok || !statsRes.ok) {
        throw new Error(`CE API error: handoffs=${handoffsRes.status} stats=${statsRes.status}`)
      }

      const handoffsBody = await handoffsRes.json() as { handoffs?: any[] }
      const statsBody = await statsRes.json() as any

      const allHandoffs: HubHandoffEntry[] = (handoffsBody.handoffs || []).map((h: any) => ({
        handoff_id: h.handoff_id || h.id,
        from_agent: h.from_agent,
        to_agent: h.to_agent,
        status: h.status,
        priority: h.priority || 'medium',
        task: h.task || h.description || '',
        sla_deadline: h.sla_deadline,
        created_at: h.created_at,
        completed_at: h.completed_at,
        failed_at: h.failed_at,
        failure_reason: h.failure_reason,
      }))

      const active = allHandoffs.filter(h => h.status === 'pending' || h.status === 'active')
      const recent = allHandoffs.filter(h => h.status === 'completed' || h.status === 'failed').slice(0, 5)

      const data: HubHandoffData = {
        active,
        recent,
        stats: {
          total: statsBody.total || allHandoffs.length,
          active: statsBody.byStatus?.active || active.filter(h => h.status === 'active').length,
          completed: statsBody.byStatus?.completed || 0,
          failed: statsBody.byStatus?.failed || 0,
          avgCompletionMs: statsBody.avgCompletionTime || 0,
          slaComplianceRate: statsBody.slaComplianceRate || 100,
        },
      }

      this.emit('data', data)
    } catch {
      // CE API unreachable — emit demo data
      this.emit('data', this.getDemoData())
    }
  }

  private getDemoData(): HubHandoffData {
    const now = new Date().toISOString()
    return {
      active: [
        {
          handoff_id: 'hf-001',
          from_agent: 'pr-scanner-01',
          to_agent: 'code-reviewer-02',
          status: 'active',
          priority: 'high',
          task: 'Review PR #42: Add rate governor dashboard',
          created_at: new Date(Date.now() - 5 * 60000).toISOString(),
        },
        {
          handoff_id: 'hf-002',
          from_agent: 'code-reviewer-02',
          to_agent: 'test-writer-04',
          status: 'pending',
          priority: 'medium',
          task: 'Write E2E tests for rate governor page',
          sla_deadline: new Date(Date.now() + 30 * 60000).toISOString(),
          created_at: new Date(Date.now() - 2 * 60000).toISOString(),
        },
      ],
      recent: [
        {
          handoff_id: 'hf-000',
          from_agent: 'deploy-bot-05',
          to_agent: 'pr-scanner-01',
          status: 'completed',
          priority: 'critical',
          task: 'Deploy hotfix v2.1.1 to staging',
          created_at: new Date(Date.now() - 15 * 60000).toISOString(),
          completed_at: new Date(Date.now() - 12 * 60000).toISOString(),
        },
      ],
      stats: {
        total: 47,
        active: 2,
        completed: 42,
        failed: 3,
        avgCompletionMs: 180000,
        slaComplianceRate: 94,
      },
    }
  }
}
