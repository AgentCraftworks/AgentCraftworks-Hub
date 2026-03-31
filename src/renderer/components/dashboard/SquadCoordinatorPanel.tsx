// SquadCoordinatorPanel.tsx — Squad overview, S2S communication, routing decisions, engagement gate
import type { HubSquadData, HubSquadInfo, HubRoutingDecision, HubSquadHandoff } from '@shared/hub-types'
import { RefreshCw, Users, ArrowRight } from 'lucide-react'

interface Props {
  data: HubSquadData | null
  onRefresh: () => void
}

const dialColors = ['', 'text-gray-400', 'text-blue-400', 'text-green-400', 'text-amber-400', 'text-red-400']
const dialLabels = ['', 'Observer', 'Advisor', 'Peer', 'Agent Team', 'Full Agent']

const responseModeColors = {
  DIRECT: 'text-green-400',
  LIGHTWEIGHT: 'text-blue-400',
  STANDARD: 'text-amber-400',
  FULL: 'text-red-400',
}

const handoffTypeStyles = {
  'request-response': { arrow: '→', style: 'border-blue-500/30' },
  'scatter-gather': { arrow: '⇉', style: 'border-amber-500/30' },
  'event-broadcast': { arrow: '⟶', style: 'border-white/10 border-dashed' },
}

function SquadCard({ squad }: { squad: HubSquadInfo }) {
  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10" data-testid={`squad-${squad.squadId}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users size={12} className="text-white/40" />
          <span className="text-white/80 text-xs font-medium">{squad.squadId}</span>
        </div>
        <span className="text-[10px] text-white/40">
          Cap: L{squad.ceiling} <span className={dialColors[squad.ceiling]}>{dialLabels[squad.ceiling]}</span>
        </span>
      </div>
      {/* Agent dial indicators */}
      <div className="flex flex-wrap gap-1.5">
        {squad.agents.map((a) => (
          <div key={a.id} className="flex items-center gap-1 bg-white/5 rounded px-1.5 py-0.5" title={`${a.name} — L${a.engagementLevel} ${a.priority}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              a.engagementLevel >= 4 ? 'bg-amber-500' :
              a.engagementLevel >= 3 ? 'bg-green-500' :
              a.engagementLevel >= 2 ? 'bg-blue-500' : 'bg-gray-500'
            }`} />
            <span className="text-[10px] text-white/60 font-mono">{a.id.slice(0, 12)}</span>
            <span className="text-[9px] text-white/30">L{a.engagementLevel}</span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[10px] text-white/30">
        {squad.agents.length} agent{squad.agents.length !== 1 ? 's' : ''} • {squad.defaultLane}
      </div>
    </div>
  )
}

function SquadHandoffRow({ handoff }: { handoff: HubSquadHandoff }) {
  const style = handoffTypeStyles[handoff.type]
  return (
    <div className={`flex items-center gap-2 text-xs p-2 rounded border ${style.style}`}>
      <span className="text-white/70 font-mono">{handoff.fromSquadId}</span>
      <span className="text-white/30">{style.arrow}</span>
      <span className="text-white/70 font-mono">{handoff.toSquadId}</span>
      <span className="text-white/40 ml-auto text-[10px]">{handoff.type}</span>
      <span className={`text-[10px] ${
        handoff.status === 'active' ? 'text-green-400' :
        handoff.status === 'pending' ? 'text-blue-400' :
        handoff.status === 'failed' ? 'text-red-400' : 'text-white/40'
      }`}>{handoff.status}</span>
    </div>
  )
}

function RoutingRow({ decision }: { decision: HubRoutingDecision }) {
  const modeColor = responseModeColors[decision.responseMode] || 'text-white/40'
  const age = `${Math.round((Date.now() - decision.timestamp) / 60000)}m`
  return (
    <div className="flex items-center gap-2 text-[11px] py-1 border-b border-white/5 last:border-0">
      <span className="text-white/60 font-mono truncate max-w-[80px]">{decision.agentId}</span>
      <ArrowRight size={10} className="text-white/20" />
      <span className="text-white/50 truncate max-w-[80px]">{decision.toolName}</span>
      <span className={modeColor}>{decision.responseMode}</span>
      <span className={`text-[10px] ${
        decision.zone === 'GREEN' ? 'text-green-400' :
        decision.zone === 'AMBER' ? 'text-amber-400' : 'text-red-400'
      }`}>{decision.zone}</span>
      <span className={`ml-auto text-[10px] ${decision.allowed ? 'text-green-400' : 'text-red-400'}`}>
        {decision.allowed ? '✓' : '✗'}
      </span>
      <span className="text-white/20 text-[10px]">{age}</span>
    </div>
  )
}

export function SquadCoordinatorPanel({ data, onRefresh }: Props) {
  if (!data) {
    return (
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 col-span-2" data-testid="hub-squad-coordinator">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
            <Users size={14} /> Squad Coordinator
          </div>
          <button onClick={onRefresh} className="text-white/40 hover:text-white/80 transition"><RefreshCw size={12} /></button>
        </div>
        <div className="text-white/30 text-xs text-center py-6">No squad data</div>
      </div>
    )
  }

  const { squads, recentRouting, squadHandoffs } = data

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10 col-span-2" data-testid="hub-squad-coordinator">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
          <Users size={14} /> Squad Coordinator
        </div>
        <button onClick={onRefresh} className="text-white/40 hover:text-white/80 transition"><RefreshCw size={12} /></button>
      </div>

      {/* Squad cards */}
      {squads.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Squads ({squads.length})</div>
          <div className="grid grid-cols-2 gap-2">
            {squads.map((s) => <SquadCard key={s.squadId} squad={s} />)}
          </div>
        </div>
      )}

      {/* Squad-to-Squad handoffs */}
      {squadHandoffs.length > 0 && (
        <div className="mb-4" data-testid="hub-squad-handoffs">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Squad-to-Squad ({squadHandoffs.length})</div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {squadHandoffs.map((h, i) => <SquadHandoffRow key={i} handoff={h} />)}
          </div>
        </div>
      )}

      {/* Recent routing decisions */}
      {recentRouting.length > 0 && (
        <div data-testid="hub-routing-decisions">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Recent Routing ({recentRouting.length})</div>
          <div className="max-h-36 overflow-y-auto">
            {recentRouting.slice(0, 10).map((d, i) => <RoutingRow key={i} decision={d} />)}
          </div>
        </div>
      )}

      {/* Engagement legend */}
      <div className="mt-3 flex items-center gap-3 text-[10px] text-white/30">
        <span>Engagement:</span>
        {[1, 2, 3, 4, 5].map((l) => (
          <span key={l} className={dialColors[l]}>L{l} {dialLabels[l]}</span>
        ))}
      </div>
    </div>
  )
}
