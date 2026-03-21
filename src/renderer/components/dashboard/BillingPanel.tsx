// BillingPanel.tsx — Estimated month-to-date GitHub billing summary
import type { BillingData, CopilotUsageData } from '@shared/hub-types'
import { DollarSign, AlertTriangle } from 'lucide-react'

interface Props {
  billing: BillingData | null
  copilot: CopilotUsageData | null
}

const COPILOT_SEAT_PRICE_USD = 19 // per seat/month (Business tier)

export function BillingPanel({ billing, copilot }: Props) {
  const actionsCost = billing?.actionsMinutes?.estimatedCostUsd ?? 0
  const activeUsers = copilot?.totalActiveUsers ?? 0
  const copilotCost = activeUsers * COPILOT_SEAT_PRICE_USD
  const total = actionsCost + copilotCost

  const hasError = billing?.error || copilot?.error

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-3">
        <DollarSign size={14} />
        Billing Estimate
        <span className="ml-auto text-[10px] text-white/30 font-normal">month-to-date</span>
      </div>

      {hasError && (
        <div className="flex items-center gap-2 text-amber-400/70 text-xs mb-3">
          <AlertTriangle size={12} />
          Partial data — some scopes unavailable
        </div>
      )}

      <div className="space-y-2 text-sm">
        <LineItem
          label="Copilot seats"
          sublabel={activeUsers > 0 ? `${activeUsers} active × $${COPILOT_SEAT_PRICE_USD}/mo` : undefined}
          value={copilotCost}
          color="text-blue-400"
        />
        <LineItem
          label="Actions cost (MTD)"
          value={actionsCost}
          color="text-amber-400"
        />
        <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
          <span className="text-white/70">Est. Total</span>
          <span className="text-white font-mono">${total.toFixed(2)}</span>
        </div>
      </div>

      <p className="text-[10px] text-white/20 mt-3 leading-relaxed">
        Copilot cost estimated from active seats. Actions cost is the reported month-to-date total from the billing API.
        Does not include storage, packages, or enterprise licensing.
      </p>
    </div>
  )
}

function LineItem({
  label,
  sublabel,
  value,
  color,
}: {
  label: string
  sublabel?: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="text-white/60">{label}</div>
        {sublabel && <div className="text-[10px] text-white/30">{sublabel}</div>}
      </div>
      <span className={`font-mono tabular-nums ${color}`}>${value.toFixed(2)}</span>
    </div>
  )
}
