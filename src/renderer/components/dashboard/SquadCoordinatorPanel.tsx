// SquadCoordinatorPanel.tsx — Squad overview, S2S communication, routing decisions, engagement gate
import type { HubSquadData, HubSquadInfo, HubRoutingDecision, HubSquadHandoff } from '@shared/hub-types'
import { RefreshCw, Users, ArrowRight } from 'lucide-react'
import * as ps from './panel-styles'

interface Props {
  data: HubSquadData | null
  onRefresh: () => void
}

const dialColors = ['', '#9ca3af', '#60a5fa', '#4ade80', '#fbbf24', '#f87171']
const dialLabels = ['', 'Observer', 'Advisor', 'Peer', 'Agent Team', 'Full Agent']

const responseModeColors: Record<string, string> = {
  DIRECT: '#4ade80', LIGHTWEIGHT: '#60a5fa', STANDARD: '#fbbf24', FULL: '#f87171',
}

const handoffTypeStyles: Record<string, { arrow: string; border: string }> = {
  'request-response': { arrow: '→', border: '1px solid rgba(59,130,246,0.3)' },
  'scatter-gather': { arrow: '⇉', border: '1px solid rgba(245,158,11,0.3)' },
  'event-broadcast': { arrow: '⟶', border: '1px dashed rgba(255,255,255,0.1)' },
}

function SquadCard({ squad }: { squad: HubSquadInfo }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.1)' }} data-testid={`squad-${squad.squadId}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ ...ps.flexRow, gap: '8px' }}>
          <Users size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
          <span style={{ ...ps.textPrimary, fontSize: '12px', fontWeight: 500 }}>{squad.squadId}</span>
        </div>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
          Cap: L{squad.ceiling} <span style={{ color: dialColors[squad.ceiling] }}>{dialLabels[squad.ceiling]}</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {squad.agents.map((a) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', paddingLeft: '6px', paddingRight: '6px', paddingTop: '2px', paddingBottom: '2px' }} title={`${a.name} — L${a.engagementLevel} ${a.priority}`}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: a.engagementLevel >= 4 ? '#f59e0b' : a.engagementLevel >= 3 ? '#22c55e' : a.engagementLevel >= 2 ? '#3b82f6' : '#6b7280' }} />
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{a.id.slice(0, 12)}</span>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>L{a.engagementLevel}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
        {squad.agents.length} agent{squad.agents.length !== 1 ? 's' : ''} • {squad.defaultLane}
      </div>
    </div>
  )
}

function SquadHandoffRow({ handoff }: { handoff: HubSquadHandoff }) {
  const style = handoffTypeStyles[handoff.type]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '8px', borderRadius: '4px', border: style.border }}>
      <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{handoff.fromSquadId}</span>
      <span style={ps.textFaint}>{style.arrow}</span>
      <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{handoff.toSquadId}</span>
      <span style={{ ...ps.textMuted, marginLeft: 'auto', fontSize: '10px' }}>{handoff.type}</span>
      <span style={{ fontSize: '10px', color: handoff.status === 'active' ? '#4ade80' : handoff.status === 'pending' ? '#60a5fa' : handoff.status === 'failed' ? '#f87171' : 'rgba(255,255,255,0.4)' }}>{handoff.status}</span>
    </div>
  )
}

function RoutingRow({ decision }: { decision: HubRoutingDecision }) {
  const modeColor = responseModeColors[decision.responseMode] || 'rgba(255,255,255,0.4)'
  const age = `${Math.round((Date.now() - decision.timestamp) / 60000)}m`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', paddingTop: '4px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>{decision.agentId}</span>
      <ArrowRight size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
      <span style={{ color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>{decision.toolName}</span>
      <span style={{ color: modeColor }}>{decision.responseMode}</span>
      <span style={{ fontSize: '10px', color: decision.zone === 'GREEN' ? '#4ade80' : decision.zone === 'AMBER' ? '#fbbf24' : '#f87171' }}>{decision.zone}</span>
      <span style={{ marginLeft: 'auto', fontSize: '10px', color: decision.allowed ? '#4ade80' : '#f87171' }}>{decision.allowed ? '✓' : '✗'}</span>
      <span style={{ ...ps.finePrint, fontSize: '10px' }}>{age}</span>
    </div>
  )
}

export function SquadCoordinatorPanel({ data, onRefresh }: Props) {
  if (!data) {
    return (
      <div style={ps.panelCard} data-testid="hub-squad-coordinator">
        <div style={ps.panelHeaderSpaced}>
          <div style={{ ...ps.flexRow, fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
            <Users size={14} /> Squad Coordinator
          </div>
          <button type="button" onClick={onRefresh} style={ps.refreshBtn}><RefreshCw size={12} /></button>
        </div>
        <div style={{ ...ps.loadingState, paddingTop: '24px', paddingBottom: '24px' }}>No squad data</div>
      </div>
    )
  }

  const { squads, recentRouting, squadHandoffs } = data

  return (
    <div style={ps.panelCard} data-testid="hub-squad-coordinator">
      <div style={ps.panelHeaderSpaced}>
        <div style={{ ...ps.flexRow, fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>
          <Users size={14} /> Squad Coordinator
        </div>
        <button type="button" onClick={onRefresh} style={ps.refreshBtn}><RefreshCw size={12} /></button>
      </div>

      {squads.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Squads ({squads.length})</div>
          <div style={ps.grid2}>
            {squads.map((s) => <SquadCard key={s.squadId} squad={s} />)}
          </div>
        </div>
      )}

      {squadHandoffs.length > 0 && (
        <div style={{ marginBottom: '16px' }} data-testid="hub-squad-handoffs">
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Squad-to-Squad ({squadHandoffs.length})</div>
          <div style={{ ...ps.stackSm, gap: '6px', maxHeight: '128px', overflowY: 'auto' }}>
            {squadHandoffs.map((h, i) => <SquadHandoffRow key={i} handoff={h} />)}
          </div>
        </div>
      )}

      {recentRouting.length > 0 && (
        <div data-testid="hub-routing-decisions">
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Recent Routing ({recentRouting.length})</div>
          <div style={{ maxHeight: '144px', overflowY: 'auto' }}>
            {recentRouting.slice(0, 10).map((d, i) => <RoutingRow key={i} decision={d} />)}
          </div>
        </div>
      )}

      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
        <span>Engagement:</span>
        {[1, 2, 3, 4, 5].map((l) => (
          <span key={l} style={{ color: dialColors[l] }}>L{l} {dialLabels[l]}</span>
        ))}
      </div>
    </div>
  )
}
