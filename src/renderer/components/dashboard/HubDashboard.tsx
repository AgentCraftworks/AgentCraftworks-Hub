// HubDashboard.tsx — Main dashboard container (Task Manager style)
import { useHubMonitor } from '@/hooks/useHubMonitor'
import { RateLimitPanel } from './RateLimitPanel'
import { TokenActivityPanel } from './TokenActivityPanel'
import { ActionsMinutesPanel } from './ActionsMinutesPanel'
import { CopilotUsagePanel } from './CopilotUsagePanel'
import { BillingPanel } from './BillingPanel'
import { RefreshCw, Loader } from 'lucide-react'

interface Props {
  enterprise?: string
}

export function HubDashboard({ enterprise = 'AICraftworks' }: Props) {
  const { snapshot, loading, error, lastUpdated, refresh } = useHubMonitor(enterprise)

  return (
    <div className="flex flex-col h-full bg-black/20 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white/80">AgentCraftworks Hub</span>
          <span className="text-xs text-white/30">AICraftworks Enterprise</span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-white/30">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
          >
            {loading
              ? <Loader size={12} className="animate-spin" />
              : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Dashboard grid — Task Manager style */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {/* Rate Limit — always full width on smaller, left col on xl */}
          <div className="xl:col-span-1">
            <RateLimitPanel
              data={snapshot?.rateLimit ?? null}
              onRefresh={refresh}
            />
          </div>

          {/* Token Activity */}
          <div className="xl:col-span-1">
            <TokenActivityPanel
              topCallers={snapshot?.topCallers ?? []}
              error={snapshot !== null && snapshot.topCallers.length === 0 && snapshot.lastUpdated.auditLog !== undefined}
            />
          </div>

          {/* Actions Minutes */}
          <div className="xl:col-span-1">
            <ActionsMinutesPanel data={snapshot?.billing ?? null} />
          </div>

          {/* Copilot Usage */}
          <div className="xl:col-span-1">
            <CopilotUsagePanel data={snapshot?.copilot ?? null} />
          </div>

          {/* Billing — spans full width */}
          <div className="xl:col-span-2">
            <BillingPanel
              billing={snapshot?.billing ?? null}
              copilot={snapshot?.copilot ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
