// RateGovernorPanel.tsx — Traffic light zone, quota pools, priority tiers, circuit breakers
import type { HubRateGovernorData } from '@shared/hub-types'
import { RefreshCw, Shield, Zap } from 'lucide-react'

interface Props {
  data: HubRateGovernorData | null
  onRefresh: () => void
}

const zoneColors = {
  GREEN: { bg: 'bg-green-500', glow: 'shadow-green-500/40', text: 'text-green-400', label: 'Normal' },
  AMBER: { bg: 'bg-amber-500', glow: 'shadow-amber-500/40', text: 'text-amber-400', label: 'Pressure' },
  RED: { bg: 'bg-red-500', glow: 'shadow-red-500/40', text: 'text-red-400', label: 'Critical' },
} as const

const circuitLabels = {
  CLOSED: { text: 'text-green-400', label: '●' },
  PRE_EMPTIVE_OPEN: { text: 'text-amber-400', label: '◐' },
  HALF_OPEN: { text: 'text-amber-400', label: '◑' },
  OPEN: { text: 'text-red-400', label: '○' },
} as const

function QuotaBar({ label, remaining, total }: { label: string; remaining: number; total: number }) {
  const pct = total > 0 ? (remaining / total) * 100 : 0
  const color = pct > 40 ? 'bg-green-500' : pct > 15 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="text-white/80 tabular-nums">{remaining.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  )
}

function PriorityBadge({ tier, zone }: { tier: 'P0' | 'P1' | 'P2'; zone: 'GREEN' | 'AMBER' | 'RED' }) {
  const status =
    tier === 'P0' ? { label: 'Active', color: 'text-green-400' } :
    tier === 'P1' ? (zone === 'RED' ? { label: 'Constrained', color: 'text-amber-400' } : { label: 'Active', color: 'text-green-400' }) :
    zone === 'RED' ? { label: 'Parked', color: 'text-red-400' } :
    zone === 'AMBER' ? { label: 'Throttled', color: 'text-amber-400' } :
    { label: 'Active', color: 'text-green-400' }

  return (
    <div className="flex items-center justify-between text-xs" data-testid={`hub-priority-${tier.toLowerCase()}`}>
      <span className="text-white/60 font-mono">{tier}</span>
      <span className={`font-medium ${status.color}`}>{status.label}</span>
    </div>
  )
}

export function RateGovernorPanel({ data, onRefresh }: Props) {
  if (!data) {
    return (
      <div className="bg-white/5 rounded-xl p-4 border border-white/10" data-testid="hub-rate-governor">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
            <Shield size={14} /> Rate Governor
          </div>
          <button onClick={onRefresh} className="text-white/40 hover:text-white/80 transition"><RefreshCw size={12} /></button>
        </div>
        <div className="text-white/30 text-xs text-center py-6">No rate governor data</div>
      </div>
    )
  }

  const { state, github, copilot, agents } = data
  const zone = zoneColors[state.trafficLight]

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10" data-testid="hub-rate-governor">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
          <Shield size={14} /> Rate Governor
        </div>
        <button onClick={onRefresh} className="text-white/40 hover:text-white/80 transition"><RefreshCw size={12} /></button>
      </div>

      {/* Traffic Light */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1.5">
          {(['GREEN', 'AMBER', 'RED'] as const).map((z) => (
            <div
              key={z}
              className={`w-5 h-5 rounded-full transition-all ${
                z === state.trafficLight
                  ? `${zoneColors[z].bg} ${zoneColors[z].glow} shadow-lg`
                  : 'bg-white/10'
              }`}
              data-testid={`hub-zone-${z.toLowerCase()}`}
            />
          ))}
        </div>
        <div>
          <span className={`text-lg font-bold ${zone.text}`} data-testid="hub-zone-label">{state.trafficLight}</span>
          <span className="text-white/40 text-xs ml-2">{zone.label}</span>
        </div>
      </div>

      {/* Quota Pools */}
      <div className="space-y-2 mb-4" data-testid="hub-quota-pools">
        <QuotaBar label="GitHub" remaining={github.windowRemaining} total={github.windowTotal} />
        <QuotaBar label="Copilot" remaining={copilot.windowRemaining} total={copilot.windowTotal} />
      </div>

      {/* Priority Tiers */}
      <div className="space-y-1.5 mb-4" data-testid="hub-priority-tiers">
        <div className="text-[10px] text-white/40 uppercase tracking-wider">Priority Tiers</div>
        <PriorityBadge tier="P0" zone={state.trafficLight} />
        <PriorityBadge tier="P1" zone={state.trafficLight} />
        <PriorityBadge tier="P2" zone={state.trafficLight} />
      </div>

      {/* Circuit Breakers */}
      <div className="flex items-center gap-3 text-xs mb-3" data-testid="hub-circuits">
        <span className="text-white/40">Circuits:</span>
        <span className={circuitLabels[state.circuitStateByQuota.github].text}>
          {circuitLabels[state.circuitStateByQuota.github].label} GitHub
        </span>
        <span className={circuitLabels[state.circuitStateByQuota.copilot].text}>
          {circuitLabels[state.circuitStateByQuota.copilot].label} Copilot
        </span>
        {state.cascadeMode === 'sequential' && (
          <span className="text-amber-400">◐ Sequential</span>
        )}
      </div>

      {/* Agent Tokens (compact) */}
      {agents.length > 0 && (
        <div data-testid="hub-agent-tokens">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Agents ({agents.length})</div>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {agents.map((a) => {
              const utilPct = a.reserved > 0 ? Math.round((a.used / a.reserved) * 100) : 0
              return (
                <div key={a.agentId} className="flex items-center justify-between text-[11px]">
                  <span className="text-white/60 font-mono truncate max-w-[120px]">{a.agentId}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40">{a.priority}</span>
                    <span className={`tabular-nums ${utilPct > 80 ? 'text-red-400' : utilPct > 50 ? 'text-amber-400' : 'text-green-400'}`}>
                      {utilPct}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
