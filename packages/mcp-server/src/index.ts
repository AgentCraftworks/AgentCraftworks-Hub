// packages/mcp-server/src/index.ts
// AgentCraftworks Hub MCP server — exposes GitHub monitoring data as MCP tools
// Add to Copilot Chat or Claude Desktop to query rate limits, billing, and Copilot usage conversationally.
//
// Claude Desktop config (~/.config/claude/claude_desktop_config.json):
// {
//   "mcpServers": {
//     "agentcraftworks-hub": {
//       "command": "node",
//       "args": ["/path/to/AgentCraftworks-Hub/packages/mcp-server/dist/index.js"],
//       "env": { "GITHUB_TOKEN": "ghp_...", "GITHUB_ENTERPRISE": "AICraftworks" }
//     }
//   }
// }

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { Octokit } from '@octokit/rest'

const ENTERPRISE = process.env.GITHUB_ENTERPRISE ?? 'AICraftworks'
const TOKEN = process.env.GITHUB_TOKEN ?? ''

if (!TOKEN) {
  process.stderr.write('[hub-mcp-server] Warning: GITHUB_TOKEN not set. Set it or run: gh auth login\n')
}

const octokit = new Octokit({ auth: TOKEN || undefined })

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtEta(resetUnix: number): string {
  const ms = Math.max(0, resetUnix * 1000 - Date.now())
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

async function getRateLimits() {
  const { data } = await octokit.rest.rateLimit.get()
  const r = data.resources
  const cs = (r as unknown as Record<string, { limit: number; used: number; remaining: number; reset: number }>).code_search
  return {
    core: { ...r.core, resetEta: fmtEta(r.core.reset), percentUsed: Math.round((r.core.used / r.core.limit) * 100) },
    search: { ...r.search, resetEta: fmtEta(r.search.reset) },
    graphql: r.graphql ? { ...r.graphql, resetEta: fmtEta(r.graphql.reset) } : null,
    codeSearch: cs ? { ...cs, resetEta: fmtEta(cs.reset) } : null,
  }
}

async function getTokenActivity() {
  try {
    const { data } = await octokit.request(
      'GET /enterprises/{enterprise}/audit-log',
      { enterprise: ENTERPRISE, phrase: 'action:api', per_page: 100, order: 'desc' }
    )
    const entries = Array.isArray(data) ? data as Record<string, unknown>[] : []
    const actorMap = new Map<string, { count: number; tokenType: string; appSlug?: string }>()
    for (const e of entries) {
      const actor = String(e.actor ?? 'unknown')
      const existing = actorMap.get(actor)
      if (existing) {
        existing.count++
      } else {
        actorMap.set(actor, {
          count: 1,
          tokenType: String(e.token_type ?? 'PAT'),
          appSlug: e.oauth_application_name ? String(e.oauth_application_name) : undefined,
        })
      }
    }
    return [...actorMap.entries()]
      .map(([actor, v]) => ({ actor, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  } catch {
    return { error: 'Requires read:audit_log scope (enterprise admin)' }
  }
}

async function getActionsMinutes() {
  try {
    const { data } = await octokit.request(
      'GET /enterprises/{enterprise}/settings/billing/actions',
      { enterprise: ENTERPRISE }
    )
    const b = (data as unknown as Record<string, Record<string, number>>).minutes_used_breakdown ?? {}
    return {
      totalMinutesUsed: data.total_minutes_used,
      totalPaidMinutesUsed: data.total_paid_minutes_used,
      includedMinutes: data.included_minutes,
      breakdown: { ubuntu: b.UBUNTU ?? 0, windows: b.WINDOWS ?? 0, macos: b.MACOS ?? 0 },
      percentUsed: data.included_minutes > 0
        ? Math.round((data.total_minutes_used / data.included_minutes) * 100)
        : null,
    }
  } catch (err) {
    return { error: `Requires read:enterprise scope — ${err instanceof Error ? err.message : err}` }
  }
}

async function getCopilotUsage() {
  try {
    const { data } = await octokit.request(
      'GET /enterprises/{enterprise}/copilot/usage',
      { enterprise: ENTERPRISE }
    )
    const records = Array.isArray(data) ? data as Record<string, unknown>[] : []
    const latest = records[records.length - 1] as Record<string, unknown> | undefined
    return {
      date: latest?.day ?? 'N/A',
      totalActiveUsers: Number(latest?.total_active_users ?? 0),
      totalEngagedUsers: Number(latest?.total_engaged_users ?? 0),
      breakdown: Array.isArray(latest?.breakdown)
        ? (latest.breakdown as Record<string, unknown>[]).map(m => ({
            model: m.model,
            suggestions: m.total_suggestions_count,
            acceptances: m.total_acceptances_count,
          }))
        : [],
    }
  } catch (err) {
    return { error: `Requires manage_billing:copilot scope — ${err instanceof Error ? err.message : err}` }
  }
}

async function getBillingSummary() {
  const [minutes, copilot] = await Promise.allSettled([getActionsMinutes(), getCopilotUsage()])
  const m = minutes.status === 'fulfilled' ? minutes.value : null
  const c = copilot.status === 'fulfilled' ? copilot.value : null
  const copilotSeats = (c && 'totalActiveUsers' in c && !('error' in c)) ? (c as { totalActiveUsers: number }).totalActiveUsers : 0
  const overageCost = (m && 'totalPaidMinutesUsed' in m) ? (m as { totalPaidMinutesUsed: number }).totalPaidMinutesUsed * 0.008 : 0
  const copilotCost = copilotSeats * 19
  return {
    enterprise: ENTERPRISE,
    estimatedMonthToDate: {
      copilotSeats: { seats: copilotSeats, costUsd: copilotCost },
      actionsOverage: { overageMinutes: (m && 'totalPaidMinutesUsed' in m) ? (m as { totalPaidMinutesUsed: number }).totalPaidMinutesUsed : 'unknown', costUsd: overageCost },
      totalEstimatedUsd: copilotCost + overageCost,
    },
    note: 'Copilot cost estimated from active seats at $19/seat/mo. Does not include storage, packages, or enterprise licensing.',
  }
}

// ── MCP Server ────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'agentcraftworks-hub',
  version: '0.1.0',
})

server.tool(
  'get_rate_limits',
  'Get current GitHub API rate limit status for all endpoints (core REST, search, GraphQL, code search). Shows usage, remaining calls, and ETA until reset.',
  {},
  async () => {
    const data = await getRateLimits()
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_token_activity',
  `Get the top API callers for the ${ENTERPRISE} enterprise from the audit log. Requires read:audit_log scope (enterprise admin).`,
  {},
  async () => {
    const data = await getTokenActivity()
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_actions_minutes',
  `Get GitHub Actions minutes usage for the ${ENTERPRISE} enterprise — total used, included, breakdown by OS, and overage cost. Requires read:enterprise scope.`,
  {},
  async () => {
    const data = await getActionsMinutes()
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_copilot_usage',
  `Get Copilot usage metrics for ${ENTERPRISE} — active users, engaged users, and per-model suggestion breakdown. Requires manage_billing:copilot scope.`,
  {},
  async () => {
    const data = await getCopilotUsage()
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

server.tool(
  'get_billing_summary',
  `Get an estimated month-to-date billing summary for ${ENTERPRISE} — Copilot seats, Actions overages, and total estimated spend.`,
  {},
  async () => {
    const data = await getBillingSummary()
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  }
)

// ── Start ─────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
