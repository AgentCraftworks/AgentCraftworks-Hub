import { useRef, useEffect } from 'react'

interface SessionFilterProps {
  value: string
  onChange: (value: string) => void
  onClose: () => void
}

export function SessionFilter({ value, onChange, onClose }: SessionFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="px-2 pb-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        placeholder="Filter sessions..."
        className="w-full px-2 py-1 text-sm rounded border border-[var(--bg-hover)] outline-none focus:border-[var(--accent)]"
        style={{
          background: 'var(--bg-tertiary)',
          color: 'var(--text-primary)'
        }}
      />
    </div>
  )
}
