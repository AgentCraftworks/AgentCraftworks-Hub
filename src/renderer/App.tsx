import { useState } from 'react'
import { useSessions } from '@/hooks/useSession'
import { SessionsPanel } from '@/components/SessionsPanel/SessionsPanel'
import { TerminalViewport } from '@/components/Terminal/TerminalViewport'
import { AgentsSidebar } from '@/components/AgentsSidebar/AgentsSidebar'
import { StatusBar } from '@/components/StatusBar/StatusBar'
import { ZOOM } from '@shared/constants'

export function App(): JSX.Element {
  const { sessions, activeId, createSession, selectSession, closeSession } = useSessions()
  const [fontSize, setFontSize] = useState(ZOOM.DEFAULT)

  return (
    <div className="flex flex-col h-screen w-screen">
      <div className="flex flex-1 min-h-0">
        <SessionsPanel
          sessions={sessions}
          activeId={activeId}
          onSelect={selectSession}
          onClose={closeSession}
          onCreate={createSession}
        />
        <TerminalViewport
          sessions={sessions}
          activeId={activeId}
          fontSize={fontSize}
        />
        <AgentsSidebar />
      </div>
      <StatusBar />
    </div>
  )
}
