export function StatusBar() {
  return (
    <div
      className="h-6 min-h-6 flex items-center px-3 text-xs border-t border-[var(--bg-hover)]"
      style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
    >
      <span>● 0 non-running</span>
      <span className="mx-2">│</span>
      <span>Shell</span>
      <span className="mx-2">│</span>
      <span>idle</span>
      <span className="flex-1" />
      <span>Ctrl+B panels</span>
    </div>
  )
}
