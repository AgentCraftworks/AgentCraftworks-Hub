import { useEffect, useRef, useState } from 'react'
import { makeStyles } from '@fluentui/react-components'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { SdkLineBuffer } from '@shared/SdkLineBuffer'
import type { SessionKind } from '@shared/types'

export const terminalRegistry = new Map<string, Terminal>()
export const searchRegistry = new Map<string, SearchAddon>()

interface TerminalViewportProps {
  sessions: { id: string; kind: SessionKind }[]
  activeId: string | null
  fontSize: number
}

interface TerminalInstance {
  terminal: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
  div: HTMLDivElement
  cleanup: () => void
}

const useStyles = makeStyles({
  root: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: '8px',
    backgroundColor: 'var(--bg-primary)',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '6px',
    paddingBottom: '6px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border)',
    backgroundColor: 'var(--bg-secondary)',
  },
  searchInput: {
    flex: 1,
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '4px',
    paddingBottom: '4px',
    fontSize: '13px',
    borderRadius: '4px',
    outlineStyle: 'none',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
  },
  searchBtn: {
    paddingLeft: '6px',
    paddingRight: '6px',
    paddingTop: '2px',
    paddingBottom: '2px',
    fontSize: '12px',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    borderWidth: 0,
    cursor: 'pointer',
    ':hover': {
      opacity: 0.8,
    },
  },
  container: {
    flex: 1,
    minWidth: 0,
  },
})

export function TerminalViewport({ sessions, activeId, fontSize }: TerminalViewportProps) {
  const s = useStyles()
  const containerRef = useRef<HTMLDivElement>(null)
  const instancesRef = useRef<Map<string, TerminalInstance>>(new Map())
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const toggleSearch = () => {
    setSearchOpen(prev => {
      if (!prev) {
        setTimeout(() => searchInputRef.current?.focus(), 50)
      } else {
        if (activeId) {
          const inst = instancesRef.current.get(activeId)
          inst?.searchAddon.clearDecorations()
        }
        setSearchQuery('')
      }
      return !prev
    })
  }

  const doSearch = (query: string, direction: 'next' | 'prev' = 'next') => {
    if (!activeId || !query) return
    const inst = instancesRef.current.get(activeId)
    if (!inst) return
    if (direction === 'next') {
      inst.searchAddon.findNext(query, { caseSensitive: false, regex: false })
    } else {
      inst.searchAddon.findPrevious(query, { caseSensitive: false, regex: false })
    }
  }

  useEffect(() => {
    const currentIds = new Set(sessions.map(s => s.id))
    const instances = instancesRef.current

    for (const [id, inst] of instances) {
      if (!currentIds.has(id)) {
        inst.cleanup()
        inst.terminal.dispose()
        inst.div.remove()
        instances.delete(id)
        terminalRegistry.delete(id)
        searchRegistry.delete(id)
      }
    }

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
        const searchAddon = new SearchAddon()
        terminal.loadAddon(searchAddon)

        const div = document.createElement('div')
        div.style.height = '100%'
        div.style.width = '100%'
        div.style.display = 'none'
        div.dataset.sessionId = session.id
        containerRef.current.appendChild(div)
        terminal.open(div)

        terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
          if (e.ctrlKey && e.key === 'Backspace' && !e.shiftKey && !e.altKey && e.type === 'keydown') {
            window.tangentAPI.terminal.write(session.id, '\x17')
            return false
          }
          if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey && !e.altKey && e.type === 'keydown') {
            window.tangentAPI.terminal.write(session.id, '\n')
            return false
          }
          if (!e.ctrlKey) return true
          const key = e.key.toLowerCase()
          if (key === 'v' && !e.shiftKey && !e.altKey) return false
          if (key === 'c' && !e.shiftKey && !e.altKey && e.type === 'keydown') {
            const selection = terminal.getSelection()
            if (selection) {
              navigator.clipboard.writeText(selection).catch(() => {})
              terminal.clearSelection()
              return false
            }
            return true
          }
          if (key === 'b' || key === 'n' || key === 'tab' || key === '=' || key === '+' || key === '-' || key === '0') return false
          if (key === 'w' && e.shiftKey) return false
          if (key === 'f' && e.shiftKey) return false
          if (e.shiftKey && /^[1-9!@#$%^&*(]$/.test(e.key)) return false
          return true
        })

        const cleanupFns: (() => void)[] = []

        if (session.kind === 'copilot-sdk') {
          const sessionId = session.id
          const lineBuffer = new SdkLineBuffer(
            (data) => terminal.write(data),
            (line) => window.tangentAPI.sdk.sendMessage(sessionId, line)
          )
          const unsubSdkOutput = window.tangentAPI.sdk.onOutput(session.id, (data: string) => { terminal.write(data) })
          cleanupFns.push(unsubSdkOutput)
          const onDataDisposable = terminal.onData((data) => { lineBuffer.handleInput(data) })
          cleanupFns.push(() => onDataDisposable.dispose())
        } else {
          window.tangentAPI.terminal.attach(session.id)
          const unsubData = window.tangentAPI.terminal.onData(session.id, (data: string) => { terminal.write(data) })
          cleanupFns.push(unsubData)
          const onDataDisposable = terminal.onData((data) => { window.tangentAPI.terminal.write(session.id, data) })
          cleanupFns.push(() => onDataDisposable.dispose())
          const onResizeDisposable = terminal.onResize(({ cols, rows }) => { window.tangentAPI.terminal.resize(session.id, cols, rows) })
          cleanupFns.push(() => onResizeDisposable.dispose())
        }

        instances.set(session.id, { terminal, fitAddon, searchAddon, div, cleanup: () => cleanupFns.forEach(fn => fn()) })
        terminalRegistry.set(session.id, terminal)
        searchRegistry.set(session.id, searchAddon)
      }
    }
  }, [sessions, fontSize])

  useEffect(() => {
    const instances = instancesRef.current
    for (const [id, inst] of instances) {
      if (id === activeId) {
        inst.div.style.display = 'block'
        requestAnimationFrame(() => { inst.fitAddon.fit(); inst.terminal.focus() })
      } else {
        inst.div.style.display = 'none'
      }
    }
  }, [activeId])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      const inst = activeId ? instancesRef.current.get(activeId) : null
      if (inst) inst.fitAddon.fit()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [activeId])

  useEffect(() => {
    for (const [, inst] of instancesRef.current) {
      inst.terminal.options.fontSize = fontSize
      inst.fitAddon.fit()
    }
  }, [fontSize])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); toggleSearch() }
      if (e.key === 'Escape' && searchOpen) { e.preventDefault(); toggleSearch() }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [searchOpen, activeId])

  return (
    <div className={s.root}>
      {searchOpen && (
        <div className={s.searchBar}>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); doSearch(e.target.value) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doSearch(searchQuery, e.shiftKey ? 'prev' : 'next')
              if (e.key === 'Escape') toggleSearch()
            }}
            placeholder="Search terminal..."
            className={s.searchInput}
          />
          <button type="button" onClick={() => doSearch(searchQuery, 'prev')} className={s.searchBtn} title="Previous (Shift+Enter)">▲</button>
          <button type="button" onClick={() => doSearch(searchQuery, 'next')} className={s.searchBtn} title="Next (Enter)">▼</button>
          <button type="button" onClick={toggleSearch} className={s.searchBtn} title="Close (Esc)">✕</button>
        </div>
      )}
      <div ref={containerRef} className={s.container} />
    </div>
  )
}
