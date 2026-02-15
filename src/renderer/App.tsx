import { useState, useCallback } from 'react'
import { useSessions } from '@/hooks/useSession'
import { useAgents } from '@/hooks/useAgents'
import { useKeyboard } from '@/hooks/useKeyboard'
import { SessionsPanel } from '@/components/SessionsPanel/SessionsPanel'
import { TerminalViewport } from '@/components/Terminal/TerminalViewport'
import { AgentsSidebar } from '@/components/AgentsSidebar/AgentsSidebar'
import { StatusBar } from '@/components/StatusBar/StatusBar'
import { ZOOM } from '@shared/constants'

export function App(): JSX.Element {
  const { sessions, activeId, activeSession, createSession, selectSession, closeSession, renameSession } =
    useSessions()
  const { groups, launchAgent } = useAgents()
  const [fontSize, setFontSize] = useState(ZOOM.DEFAULT)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sessionsPanelVisible, setSessionsPanelVisible] = useState(true)

  const toggleSessionsPanel = useCallback(() => {
    setSessionsPanelVisible(prev => !prev)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev)
  }, [])

  const launchAgentByIndex = useCallback(
    (index: number) => {
      if (!activeId || groups.length === 0) return
      // Use the first group's agents for quick-launch
      const activeGroup = groups[0]
      if (!activeGroup || index < 0 || index >= activeGroup.agents.length) return
      launchAgent(activeGroup.agents[index].id, activeId)
    },
    [activeId, groups, launchAgent]
  )

  useKeyboard({
    createSession,
    closeSession,
    selectSession,
    sessions,
    activeId,
    fontSize,
    setFontSize,
    toggleSessionsPanel,
    toggleSidebar,
    launchAgentByIndex
  })

  return (
    <div className="flex flex-col h-screen w-screen">
      <div className="flex flex-1 min-h-0">
        {sessionsPanelVisible && (
          <SessionsPanel
            sessions={sessions}
            activeId={activeId}
            onSelect={selectSession}
            onClose={closeSession}
            onCreate={createSession}
            onRename={renameSession}
          />
        )}
        <TerminalViewport sessions={sessions} activeId={activeId} fontSize={fontSize} />
        <AgentsSidebar
          activeSessionId={activeId}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />
      </div>
      <StatusBar sessions={sessions} activeSession={activeSession} />
    </div>
  )
}
