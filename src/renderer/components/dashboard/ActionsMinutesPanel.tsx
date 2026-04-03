// ActionsMinutesPanel.tsx — GitHub Actions minutes usage and estimated total cost
import type { BillingData } from '@shared/hub-types'
import { Timer, AlertTriangle } from 'lucide-react'
import * as ps from './panel-styles'

interface Props {
  data: BillingData | null
}

const OS_MULTIPLIERS = [
  { label: 'Ubuntu (1×)', key: 'ubuntu' as const, color: '#22c55e' },
  { label: 'Windows (2×)', key: 'windows' as const, color: '#3b82f6' },
  { label: 'macOS (10×)', key: 'macos' as const, color: '#f97316' },
]

export function ActionsMinutesPanel({ data }: Props) {
  if (!data) {
    return (
      <Panel>
        <div style={{ ...ps.loadingState, height: '64px' }}>Loading…</div>
      </Panel>
    )
  }

  if (data.error) {
    return (
      <Panel>
        <div style={{ ...ps.errorState, height: '96px' }}>
          <AlertTriangle size={18} />
          <p style={ps.errorDetail}>
            Requires <span style={ps.scopeHighlight}>read:enterprise</span> scope
          </p>
        </div>
      </Panel>
    )
  }

  const m = data.actionsMinutes!
  const pct = m.includedMinutes > 0 ? Math.min(100, Math.round((m.totalMinutesUsed / m.includedMinutes) * 100)) : 0
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'
  const breakdown = m.minutesUsedBreakdown
  const total = m.totalMinutesUsed || 1

  return (
    <Panel>
      {/* Main progress */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{m.totalMinutesUsed.toLocaleString()} min used</span>
          <span style={ps.textMuted}>{m.includedMinutes.toLocaleString()} included</span>
        </div>
        <div style={ps.barTrack}>
          <div style={{ height: '100%', borderRadius: '999px', transition: 'width 300ms', backgroundColor: barColor, width: `${pct}%` }} />
        </div>
        <div style={{ ...ps.finePrint, marginTop: '4px' }}>{pct}% of included minutes used</div>
      </div>

      {/* OS breakdown bars */}
      <div style={{ ...ps.stackSm, gap: '6px', marginBottom: '16px' }}>
        {OS_MULTIPLIERS.map(({ label, key, color }) => {
          const mins = breakdown[key] ?? 0
          const barW = Math.round((mins / total) * 100)
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
              <span style={{ ...ps.textMuted, width: '112px', flexShrink: 0 }}>{label}</span>
              <div style={{ ...ps.thinBarTrack, flex: 1 }}>
                <div style={{ height: '100%', borderRadius: '999px', backgroundColor: color, width: `${barW}%` }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums', width: '56px', textAlign: 'right' }}>
                {mins.toLocaleString()} min
              </span>
            </div>
          )
        })}
      </div>

      {/* Overage */}
      {m.totalPaidMinutesUsed > 0 && (
        <div style={{ ...ps.divider, display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#fbbf24' }}>Overage minutes</span>
          <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{m.totalPaidMinutesUsed.toLocaleString()}</span>
        </div>
      )}
      {m.estimatedCostUsd > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
          <span style={ps.textMuted}>Est. total cost</span>
          <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>${m.estimatedCostUsd.toFixed(2)}</span>
        </div>
      )}
    </Panel>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={ps.panelCard}>
      <div style={ps.panelHeader}>
        <Timer size={14} />
        Actions Minutes
      </div>
      {children}
    </div>
  )
}
