export function AgentsSidebar() {
  return (
    <div
      className="w-[220px] min-w-[220px] h-full border-l border-[var(--bg-hover)] flex flex-col"
      style={{ background: 'var(--bg-secondary)' }}
    >
      <div className="p-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Agents
      </div>
    </div>
  )
}
