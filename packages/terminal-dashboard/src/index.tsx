// packages/terminal-dashboard/src/index.tsx
// AgentCraftworks Hub — Ink terminal dashboard
// Run with: hub monitor
// Works inside VS Code integrated terminal, standard terminal, or any TTY.

import React, { useState, useEffect, useCallback } from 'react'
import { render, Box, Text, Newline, useInput, useApp } from 'ink'
import { execSync } from 'child_process'
import type { MonitorSnapshot, RateLimitData, BillingData, CopilotUsageData } from './types.js'

const ENTERPRISE = process.env.GITHUB_ENTERPRISE ?? 'AICraftworks'
const REFRESH_MS = 30_000

// ── GitHub API fetch helpers ──────────────────────────────────────────────

function ghApi(path: string): unknown {
  try {
    const out = execSync(`gh api ${path}`, { encoding: 'utf-8', timeout: 10_000 })
    return JSON.parse(out)
  } catch {
    return null
  }
}

function fetchSnapshot(): MonitorSnapshot {
  const rateRaw = ghApi('/rate_limit') as Record<string, unknown> | null
  const rateLimit: RateLimitData | null = rateRaw
    ? (() => {
        const r = (rateRaw.resources as Record<string, { limit: number; used: number; remaining: number; reset: number }>)
        const now = Date.now()
        const ep = (x: typeof r.core) => ({ ...x, resetEtaMs: Math.max(0, x.reset * 1000 - now) })
        return {
          core: ep(r.core),
          search: ep(r.search),
          graphql: ep(r.graphql),
          codeSearch: ep((r as unknown as Record<string, typeof r.core>).code_search ?? { limit: 10, used: 0, remaining: 10, reset: r.core.reset }),
          history: [],
          fetchedAt: now,
        }
      })()
    : null

  const billingRaw = ghApi(`/enterprises/${ENTERPRISE}/settings/billing/actions`) as Record<string, unknown> | null
  const billing: BillingData | null = billingRaw
    ? {
        actionsMinutes: {
          totalMinutesUsed: Number(billingRaw.total_minutes_used ?? 0),
          totalPaidMinutesUsed: Number(billingRaw.total_paid_minutes_used ?? 0),
          includedMinutes: Number(billingRaw.included_minutes ?? 0),
          minutesUsedBreakdown: {
            ubuntu: Number((billingRaw as Record<string, Record<string, number>>).minutes_used_breakdown?.UBUNTU ?? 0),
            macos: Number((billingRaw as Record<string, Record<string, number>>).minutes_used_breakdown?.MACOS ?? 0),
            windows: Number((billingRaw as Record<string, Record<string, number>>).minutes_used_breakdown?.WINDOWS ?? 0),
          },
          estimatedOverageCostUsd: 0,
          billingCycleResetAt: null,
        },
        fetchedAt: Date.now(),
      }
    : { actionsMinutes: null, fetchedAt: Date.now(), error: 'Requires read:enterprise scope' }

  return {
    rateLimit,
    billing,
    copilot: null,
    topCallers: [],
    lastUpdated: { rateLimit: Date.now() },
  }
}

// ── UI Components ─────────────────────────────────────────────────────────

function formatEta(ms: number): string {
  if (ms <= 0) return 'resetting...'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function bar(used: number, limit: number, width = 20): string {
  const pct = limit > 0 ? Math.min(1, used / limit) : 0
  const filled = Math.round(pct * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function RateLimitSection({ data }: { data: RateLimitData }) {
  const pct = Math.round((data.core.used / data.core.limit) * 100)
  const color = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green'
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">  API Rate Limits</Text>
      <Box flexDirection="column" paddingLeft={2}>
        <Text>
          <Text color={color}>{bar(data.core.used, data.core.limit)}</Text>
          {'  '}
          <Text color={color} bold>{pct}%</Text>
          <Text dimColor>  {data.core.remaining.toLocaleString()}/{data.core.limit.toLocaleString()} core  reset in </Text>
          <Text color="white">{formatEta(data.core.resetEtaMs)}</Text>
        </Text>
        <Text dimColor>
          {'Search: '}<Text color="white">{data.search.remaining}/{data.search.limit}</Text>
          {'  GraphQL: '}<Text color="white">{data.graphql.remaining}/{data.graphql.limit}</Text>
          {'  Code: '}<Text color="white">{data.codeSearch.remaining}/{data.codeSearch.limit}</Text>
        </Text>
      </Box>
    </Box>
  )
}

function ActionsSection({ data }: { data: BillingData }) {
  if (data.error || !data.actionsMinutes) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">  Actions Minutes</Text>
        <Text paddingLeft={2} dimColor>{data.error ?? 'No data'}</Text>
      </Box>
    )
  }
  const m = data.actionsMinutes
  const pct = m.includedMinutes > 0 ? Math.min(100, Math.round((m.totalMinutesUsed / m.includedMinutes) * 100)) : 0
  const color = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green'
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">  Actions Minutes</Text>
      <Box flexDirection="column" paddingLeft={2}>
        <Text>
          <Text color={color}>{bar(m.totalMinutesUsed, m.includedMinutes)}</Text>
          {'  '}
          <Text color={color} bold>{pct}%</Text>
          <Text dimColor>  {m.totalMinutesUsed.toLocaleString()}/{m.includedMinutes.toLocaleString()} min</Text>
        </Text>
        <Text dimColor>
          Ubuntu:<Text color="white"> {m.minutesUsedBreakdown.ubuntu.toLocaleString()}</Text>
          {'  Windows:'}<Text color="white"> {m.minutesUsedBreakdown.windows.toLocaleString()}</Text>
          {'  macOS:'}<Text color="white"> {m.minutesUsedBreakdown.macos.toLocaleString()}</Text>
        </Text>
        {m.estimatedOverageCostUsd > 0 && (
          <Text color="red">  Est. overage: ${m.estimatedOverageCostUsd.toFixed(2)}</Text>
        )}
      </Box>
    </Box>
  )
}

function Footer({ lastRefresh, refreshing }: { lastRefresh: Date | null; refreshing: boolean }) {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
      <Text dimColor>
        {refreshing ? '↻ Refreshing...' : lastRefresh ? `Last refresh: ${lastRefresh.toLocaleTimeString()}` : 'Starting...'}
        {'  '}
        <Text>r</Text><Text dimColor>: refresh  </Text>
        <Text>q</Text><Text dimColor>: quit  </Text>
        <Text>?</Text><Text dimColor>: help</Text>
        {'  Enterprise: '}<Text color="cyan">{ENTERPRISE}</Text>
      </Text>
    </Box>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────

function Dashboard() {
  const { exit } = useApp()
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const s = fetchSnapshot()
      setSnapshot(s)
      setLastRefresh(new Date())
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh])

  useInput((input) => {
    if (input === 'q' || input === 'Q') exit()
    if (input === 'r' || input === 'R') refresh()
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="blue">AgentCraftworks Hub</Text>
        <Text dimColor> — GitHub Enterprise Monitor</Text>
      </Box>

      {snapshot?.rateLimit && <RateLimitSection data={snapshot.rateLimit} />}
      {snapshot?.billing && <ActionsSection data={snapshot.billing} />}

      {!snapshot && (
        <Text dimColor>Fetching GitHub data via gh CLI…</Text>
      )}

      <Footer lastRefresh={lastRefresh} refreshing={refreshing} />
    </Box>
  )
}

render(<Dashboard />)
