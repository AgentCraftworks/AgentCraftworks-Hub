// BillingPanel.tsx — Estimated month-to-date GitHub billing summary
import type { BillingData, CopilotUsageData } from '@shared/hub-types'
import { DollarSign, AlertTriangle } from 'lucide-react'
import * as ps from './panel-styles'

interface Props {
  billing: BillingData | null
  copilot: CopilotUsageData | null
}

const COPILOT_SEAT_PRICE_USD = 19

export function BillingPanel({ billing, copilot }: Props) {
  const actionsCost = billing?.actionsMinutes?.estimatedCostUsd ?? 0
  const activeUsers = copilot?.totalActiveUsers ?? 0
  const copilotCost = activeUsers * COPILOT_SEAT_PRICE_USD
  const total = actionsCost + copilotCost
  const hasError = billing?.error || copilot?.error

  return (
    <div style={ps.panelCard}>
      <div style={ps.panelHeader}>
        <DollarSign size={14} />
        Billing Estimate
        <span style={ps.headerSubtext}>month-to-date</span>
      </div>

      {hasError && (
        <div style={{ ...ps.flexRow, color: 'rgba(251,191,36,0.7)', fontSize: '12px', marginBottom: '12px' }}>
          <AlertTriangle size={12} />
          Partial data — some scopes unavailable
        </div>
      )}

      <div style={ps.stackSm}>
        <LineItem label="Copilot seats" sublabel={activeUsers > 0 ? `${activeUsers} active × $${COPILOT_SEAT_PRICE_USD}/mo` : undefined} value={copilotCost} color="#60a5fa" />
        <LineItem label="Actions cost (MTD)" value={actionsCost} color="#fbbf24" />
        <div style={{ ...ps.divider, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>Est. Total</span>
          <span style={{ color: '#fff', fontFamily: 'monospace' }}>${total.toFixed(2)}</span>
        </div>
      </div>

      <p style={{ ...ps.finePrint, marginTop: '12px' }}>
        Copilot cost estimated from active seats. Actions cost is the reported month-to-date total from the billing API.
        Does not include storage, packages, or enterprise licensing.
      </p>
    </div>
  )
}

function LineItem({ label, sublabel, value, color }: { label: string; sublabel?: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', fontSize: '13px' }}>
      <div>
        <div style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</div>
        {sublabel && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{sublabel}</div>}
      </div>
      <span style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color }}>${value.toFixed(2)}</span>
    </div>
  )
}
