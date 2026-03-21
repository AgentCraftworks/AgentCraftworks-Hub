// ActionsMinutesPanel.tsx — GitHub Actions minutes usage and estimated total cost
import type { BillingData } from '@shared/hub-types'
import { Timer, AlertTriangle } from 'lucide-react'

interface Props {
  data: BillingData | null
}

const OS_MULTIPLIERS = [
  { label: 'Ubuntu (1×)', key: 'ubuntu' as const, color: 'bg-green-500' },
  { label: 'Windows (2×)', key: 'windows' as const, color: 'bg-blue-500' },
  { label: 'macOS (10×)', key: 'macos' as const, color: 'bg-orange-500' },
]

export function ActionsMinutesPanel({ data }: Props) {
  if (!data) {
    return (
      <Panel>
        <div className="text-white/30 text-xs flex items-center justify-center h-16">Loading…</div>
      </Panel>
    )
  }

  if (data.error) {
    return (
      <Panel>
        <div className="flex flex-col items-center justify-center h-24 gap-2 text-white/30">
          <AlertTriangle size={18} />
          <p className="text-xs text-center">
            Requires <span className="text-white/60">read:enterprise</span> scope
          </p>
        </div>
      </Panel>
    )
  }

  const m = data.actionsMinutes!
  const pct = m.includedMinutes > 0
    ? Math.min(100, Math.round((m.totalMinutesUsed / m.includedMinutes) * 100))
    : 0
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'
  const breakdown = m.minutesUsedBreakdown
  const total = m.totalMinutesUsed || 1

  return (
    <Panel>
      {/* Main progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-white/60">{m.totalMinutesUsed.toLocaleString()} min used</span>
          <span className="text-white/40">{m.includedMinutes.toLocaleString()} included</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[10px] text-white/30 mt-1">{pct}% of included minutes used</div>
      </div>

      {/* OS breakdown bars */}
      <div className="space-y-1.5 mb-4">
        {OS_MULTIPLIERS.map(({ label, key, color }) => {
          const mins = breakdown[key] ?? 0
          const barW = Math.round((mins / total) * 100)
          return (
            <div key={key} className="flex items-center gap-2 text-[11px]">
              <span className="text-white/40 w-28 flex-shrink-0">{label}</span>
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${barW}%` }} />
              </div>
              <span className="text-white/50 tabular-nums w-14 text-right">
                {mins.toLocaleString()} min
              </span>
            </div>
          )
        })}
      </div>

      {/* Overage */}
      {m.totalPaidMinutesUsed > 0 && (
        <div className="border-t border-white/10 pt-3 flex justify-between text-xs">
          <span className="text-amber-400">Overage minutes</span>
          <span className="text-amber-400 font-mono">{m.totalPaidMinutesUsed.toLocaleString()}</span>
        </div>
      )}
      {m.estimatedCostUsd > 0 && (
        <div className="flex justify-between text-xs mt-1">
          <span className="text-white/40">Est. total cost</span>
          <span className="text-amber-400 font-mono">${m.estimatedCostUsd.toFixed(2)}</span>
        </div>
      )}
    </Panel>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-3">
        <Timer size={14} />
        Actions Minutes
      </div>
      {children}
    </div>
  )
}
