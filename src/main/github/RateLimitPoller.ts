// RateLimitPoller.ts — Polls GET /rate_limit every 30s
// Emits 'data' with full rate limit breakdown and per-endpoint ETA.

import { EventEmitter } from 'events'
import { Octokit } from '@octokit/rest'

export interface RateLimitEndpoint {
  limit: number
  used: number
  remaining: number
  reset: number       // Unix timestamp
  resetEtaMs: number  // milliseconds until reset (computed)
}

export interface RateLimitData {
  core: RateLimitEndpoint
  search: RateLimitEndpoint
  graphql: RateLimitEndpoint
  codeSearch: RateLimitEndpoint
  // Ring buffer: last 60 samples of core.used (one per poll cycle)
  history: number[]
  fetchedAt: number
}

function toEndpoint(raw: { limit: number; used: number; remaining: number; reset: number }): RateLimitEndpoint {
  return {
    ...raw,
    resetEtaMs: Math.max(0, raw.reset * 1000 - Date.now()),
  }
}

export class RateLimitPoller extends EventEmitter {
  private octokit: Octokit
  private intervalMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private history: number[] = []

  constructor(token: string, intervalMs: number) {
    super()
    this.octokit = new Octokit({ auth: token })
    this.intervalMs = intervalMs
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
      const { data } = await this.octokit.rest.rateLimit.get()
      const r = data.resources

      // Maintain a 60-sample ring buffer of core.used
      this.history = [...this.history.slice(-59), r.core.used]

      const result: RateLimitData = {
        core: toEndpoint(r.core),
        search: toEndpoint(r.search),
        graphql: toEndpoint(r.graphql),
        codeSearch: toEndpoint((r as unknown as Record<string, typeof r.core>).code_search ?? { limit: 10, used: 0, remaining: 10, reset: r.core.reset }),
        history: [...this.history],
        fetchedAt: Date.now(),
      }

      this.emit('data', result)
    } catch (err) {
      this.emit('error', err)
    }
  }
}
