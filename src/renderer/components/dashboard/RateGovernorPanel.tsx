// RateGovernorPanel.tsx — Traffic light zone, quota pools, priority tiers, circuit breakers
import type { HubRateGovernorData } from '@shared/hub-types'
import { RefreshCw, Shield } from 'lucide-react'
import * as ps from './panel-styles'

interface Props {
  data: HubRateGovernorData | null
  onRefresh: () => void
}

const zoneColors = {
  GREEN: { bg: '#22c55e', glow: '0 0 8px rgba(34,197,94,0.4)', text: '#4ade80', label: 'Normal' },
  AMBER: { bg: '#f59e0b', glow: '0 0 8px rgba(245,158,11,0.4)', text: '#fbbf24', label: 'Pressure' },
  RED: { bg: '#ef4444', glow: '0 0 8px rgba(239,68,68,0.4)', text: '#f87171', label: 'Critical' },
} as const

const circuitLabels = {
  CLOSED: { text: '#4ade80', label: '●' },
  PRE_EMPTIVE_OPEN: { text: '#fbbf24', label: '◐' },
  HALF_OPEN: { text: '#fbbf24', label: '◑' },
  OPEN: { text: '#f87171', label: '○' },
} as const

function QuotaBar({ label, remaining, total }: { label: string; remaining: number; total: number }) {
  const pct = total > 0 ? (remaining / total) * 100 : 0
  const color = pct > 40 ? '#22c55e' : pct > 15 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ ...ps.stackSm, gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
        <span style={ps.textSecondary}>{label}</span>
        <span style={{ ...ps.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{remaining.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <div style={{ ...ps.thinBarTrack, height: '6px' }}>
        <div style={{ height: '100%', borderRadius: '999px', transition: 'width 500ms', backgroundColor: color, width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  )
}

function PriorityBadge({ tier, zone }: { tier: 'P0' | 'P1' | 'P2'; zone: 'GREEN' | 'AMBER' | 'RED' }) {
  const status =
    tier === 'P0' ? { label: 'Active', color: '#4ade80' } :
    tier === 'P1' ? (zone === 'RED' ? { label: 'Constrained', color: '#fbbf24' } : { label: 'Active', color: '#4ade80' }) :
    zone === 'RED' ? { label: 'Parked', color: '#f87171' } :
    zone === 'AMBER' ? { label: 'Throttled', color: '#fbbf24' } :
    { label: 'Active', color: '#4ade80' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }} data-testid={`hub-priority-${tier.toLowerCase()}`}>
      <span style={{ ...ps.textSecondary, fontFamily: 'monospace' }}>{tier}</span>
      <span style={{ fontWeight: 500, color: status.color }}>{status.label}</span>
    </div>
  )
}

export function RateGovernorPanel({ data, onRefresh }: Props) {
  if (!data) {
    return (
      <div style={ps.panelCard} data-testid="hub-rate-governor">
        <div style={ps.panelHeaderSpaced}>
          <div style={{ ...ps.flexRow, fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
            <Shield size={14} /> Rate Governor
          </div>
          <button type="button" onClick={onRefresh} style={ps.refreshBtn}><RefreshCw size={12} /></button>
        </div>
        <div style={{ ...ps.loadingState, paddingTop: '24px', paddingBottom: '24px' }}>No rate governor data</div>
      </div>
    )
  }

  const { state, github, copilot, agents } = data
  const zone = zoneColors[state.trafficLight]

  return (
    <div style={ps.panelCard} data-testid="hub-rate-governor">
      <div style={ps.panelHeaderSpaced}>
        <div style={{ ...ps.flexRow, fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
          <Shield size={14} /> Rate Governor
        </div>
        <button type="button" onClick={onRefresh} style={ps.refreshBtn}><RefreshCw size={12} /></button>
      </div>

      {/* Traffic Light */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['GREEN', 'AMBER', 'RED'] as const).map((z) => (
            <div
              key={z}
              style={{
                width: '20px', height: '20px', borderRadius: '50%', transition: 'all 300ms',
                backgroundColor: z === state.trafficLight ? zoneColors[z].bg : 'rgba(255,255,255,0.1)',
                boxShadow: z === state.trafficLight ? zoneColors[z].glow : 'none',
              }}
              data-testid={`hub-zone-${z.toLowerCase()}`}
            />
          ))}
        </div>
        <div>
          <span style={{ fontSize: '18px', fontWeight: 700, color: zone.text }} data-testid="hub-zone-label">{state.trafficLight}</span>
          <span style={{ ...ps.textMuted, fontSize: '12px', marginLeft: '8px' }}>{zone.label}</span>
        </div>
      </div>

      {/* Quota Pools */}
      <div style={{ ...ps.stackSm, marginBottom: '16px' }} data-testid="hub-quota-pools">
        <QuotaBar label="GitHub" remaining={github.windowRemaining} total={github.windowTotal} />
        <QuotaBar label="Copilot" remaining={copilot.windowRemaining} total={copilot.windowTotal} />
      </div>

      {/* Priority Tiers */}
      <div style={{ ...ps.stackSm, gap: '6px', marginBottom: '16px' }} data-testid="hub-priority-tiers">
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority Tiers</div>
        <PriorityBadge tier="P0" zone={state.trafficLight} />
        <PriorityBadge tier="P1" zone={state.trafficLight} />
        <PriorityBadge tier="P2" zone={state.trafficLight} />
      </div>

      {/* Circuit Breakers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', marginBottom: '12px' }} data-testid="hub-circuits">
        <span style={ps.textMuted}>Circuits:</span>
        <span style={{ color: circuitLabels[state.circuitStateByQuota.github].text }}>
          {circuitLabels[state.circuitStateByQuota.github].label} GitHub
        </span>
        <span style={{ color: circuitLabels[state.circuitStateByQuota.copilot].text }}>
          {circuitLabels[state.circuitStateByQuota.copilot].label} Copilot
        </span>
        {state.cascadeMode === 'sequential' && (
          <span style={{ color: '#fbbf24' }}>◐ Sequential</span>
        )}
      </div>

      {/* Agent Tokens */}
      {agents.length > 0 && (
        <div data-testid="hub-agent-tokens">
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Agents ({agents.length})</div>
          <div style={{ ...ps.stackSm, gap: '4px', maxHeight: '112px', overflowY: 'auto' }}>
            {agents.map((a) => {
              const utilPct = a.reserved > 0 ? Math.round((a.used / a.reserved) * 100) : 0
              return (
                <div key={a.agentId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{a.agentId}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={ps.textMuted}>{a.priority}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: utilPct > 80 ? '#f87171' : utilPct > 50 ? '#fbbf24' : '#4ade80' }}>
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
