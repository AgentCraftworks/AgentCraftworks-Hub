import { useState } from 'react'
import { makeStyles } from '@fluentui/react-components'
import type { AgentProfile } from '@shared/types'

interface AgentItemProps {
  agent: AgentProfile
  index: number
  onLaunch: () => void
  onEdit: (agent: AgentProfile) => void
  onDelete: (id: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '6px',
    paddingBottom: '6px',
    borderRadius: '4px',
    cursor: 'pointer',
    transitionProperty: 'background',
    transitionDuration: '200ms',
    transitionTimingFunction: 'ease',
  },
  numberBadge: {
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    flexShrink: 0,
    transitionProperty: 'color, background',
    transitionDuration: '200ms',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  name: {
    fontSize: '13px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-primary)',
  },
  targetBadge: {
    fontSize: '10px',
    paddingLeft: '4px',
    paddingRight: '4px',
    paddingTop: 0,
    paddingBottom: 0,
    borderRadius: '4px',
    flexShrink: 0,
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
  },
  command: {
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-muted)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    flexShrink: 0,
    transitionProperty: 'opacity',
    transitionDuration: '200ms',
  },
  actionBtn: {
    fontSize: '12px',
    paddingLeft: '4px',
    paddingRight: '4px',
    paddingTop: '2px',
    paddingBottom: '2px',
    borderRadius: '4px',
    color: 'var(--text-muted)',
    backgroundColor: 'transparent',
    borderWidth: 0,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'var(--bg-hover)',
    },
  },
  deleteBtn: {
    fontSize: '12px',
    paddingLeft: '4px',
    paddingRight: '4px',
    paddingTop: '2px',
    paddingBottom: '2px',
    borderRadius: '4px',
    color: 'var(--error)',
    backgroundColor: 'transparent',
    borderWidth: 0,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'var(--bg-hover)',
    },
  },
})

export function AgentItem({ agent, index, onLaunch, onEdit, onDelete, onMoveUp, onMoveDown }: AgentItemProps) {
  const s = useStyles()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={s.root}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onLaunch}
    >
      <span
        className={s.numberBadge}
        style={{
          color: hovered ? 'var(--accent)' : 'var(--text-muted)',
          background: hovered ? 'rgba(88, 166, 255, 0.1)' : 'transparent',
        }}
      >
        {index + 1}
      </span>

      <div className={s.info}>
        <div className={s.nameRow}>
          <span className={s.name}>{agent.name}</span>
          {agent.launchTarget !== 'currentTab' && (
            <span className={s.targetBadge} title={agent.launchTarget === 'path' ? agent.cwdPath : undefined}>
              {agent.launchTarget === 'path' ? 'path' : 'tab'}
            </span>
          )}
        </div>
        <div className={s.command}>
          {agent.command}{agent.args.length > 0 ? ' ' + agent.args.join(' ') : ''}
        </div>
      </div>

      <div className={s.actions} style={{ opacity: hovered ? 1 : 0 }}>
        <button type="button" onClick={(e) => { e.stopPropagation(); onMoveUp() }} className={s.actionBtn} title="Move up">&#9650;</button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onMoveDown() }} className={s.actionBtn} title="Move down">&#9660;</button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(agent) }} className={s.actionBtn} title="Edit">&#9998;</button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(agent.id) }} className={s.deleteBtn} title="Delete">&times;</button>
      </div>
    </div>
  )
}
