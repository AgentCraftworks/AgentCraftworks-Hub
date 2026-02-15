import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewportProps {
  sessions: { id: string }[]
  activeId: string | null
  fontSize: number
}

interface TerminalInstance {
  terminal: Terminal
  fitAddon: FitAddon
  div: HTMLDivElement
  cleanup: () => void
}

export function TerminalViewport({ sessions, activeId, fontSize }: TerminalViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instancesRef = useRef<Map<string, TerminalInstance>>(new Map())

  // Create/destroy terminal instances as sessions change
  useEffect(() => {
    const currentIds = new Set(sessions.map(s => s.id))
    const instances = instancesRef.current

    // Remove terminals for closed sessions
    for (const [id, inst] of instances) {
      if (!currentIds.has(id)) {
        inst.cleanup()
        inst.terminal.dispose()
        inst.div.remove()
        instances.delete(id)
      }
    }

    // Create terminals for new sessions
    for (const session of sessions) {
      if (!instances.has(session.id) && containerRef.current) {
        const terminal = new Terminal({
          fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace",
          fontSize,
          theme: {
            background: '#0d1117',
            foreground: '#e6edf3',
            cursor: '#58a6ff',
            selectionBackground: '#264f78',
            black: '#484f58',
            red: '#ff7b72',
            green: '#3fb950',
            yellow: '#d29922',
            blue: '#58a6ff',
            magenta: '#bc8cff',
            cyan: '#39d353',
            white: '#e6edf3'
          },
          cursorBlink: true,
          allowProposedApi: true
        })
        const fitAddon = new FitAddon()
        terminal.loadAddon(fitAddon)

        const div = document.createElement('div')
        div.style.height = '100%'
        div.style.width = '100%'
        div.style.display = 'none'
        div.dataset.sessionId = session.id
        containerRef.current.appendChild(div)

        terminal.open(div)

        // Attach to PTY data stream
        window.tangentAPI.terminal.attach(session.id)
        const unsubData = window.tangentAPI.terminal.onData(session.id, (data: string) => {
          terminal.write(data)
        })

        // Forward user input to PTY
        const onDataDisposable = terminal.onData((data) => {
          window.tangentAPI.terminal.write(session.id, data)
        })

        // Report resize
        const onResizeDisposable = terminal.onResize(({ cols, rows }) => {
          window.tangentAPI.terminal.resize(session.id, cols, rows)
        })

        instances.set(session.id, {
          terminal,
          fitAddon,
          div,
          cleanup: () => {
            unsubData()
            onDataDisposable.dispose()
            onResizeDisposable.dispose()
          }
        })
      }
    }
  }, [sessions, fontSize])

  // Show/hide terminals based on active session
  useEffect(() => {
    const instances = instancesRef.current
    for (const [id, inst] of instances) {
      if (id === activeId) {
        inst.div.style.display = 'block'
        // Small delay to let DOM render before fitting
        requestAnimationFrame(() => {
          inst.fitAddon.fit()
          inst.terminal.focus()
        })
      } else {
        inst.div.style.display = 'none'
      }
    }
  }, [activeId])

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      const inst = activeId ? instancesRef.current.get(activeId) : null
      if (inst) {
        inst.fitAddon.fit()
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [activeId])

  // Update font size across all terminals
  useEffect(() => {
    for (const [, inst] of instancesRef.current) {
      inst.terminal.options.fontSize = fontSize
      inst.fitAddon.fit()
    }
  }, [fontSize])

  return (
    <div ref={containerRef} className="flex-1 min-w-0 h-full" style={{ background: 'var(--bg-primary)' }} />
  )
}
