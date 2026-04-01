import { useState, useCallback, useEffect } from 'react'
import { makeStyles } from '@fluentui/react-components'
import { v4 as uuidv4 } from 'uuid'
import { useSessions } from '@/hooks/useSession'
import { useAgents } from '@/hooks/useAgents'
import { useKeyboard } from '@/hooks/useKeyboard'
import { SessionsPanel } from '@/components/SessionsPanel/SessionsPanel'
import { TerminalViewport } from '@/components/Terminal/TerminalViewport'
import { AgentsSidebar } from '@/components/AgentsSidebar/AgentsSidebar'
import { StatusBar } from '@/components/StatusBar/StatusBar'
import { SettingsPanel } from '@/components/SettingsPanel/SettingsPanel'
import { PermissionDialog } from '@/components/PermissionDialog'
import { UserInputDialog } from '@/components/UserInputDialog'
import { HubDashboard } from '@/components/dashboard/HubDashboard'
import type { DashboardFocusSection } from '@/components/dashboard/HubDashboard'
import { ZOOM } from '@shared/constants'
import type { AgentProfile, Session } from '@shared/types'
import type { HubDeepLinkFilters } from '@shared/hub-contracts'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    position: 'relative',
  },
  main: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  hubOverlay: {
    position: 'absolute',
    inset: '0',
    zIndex: 10,
    backgroundColor: '#0d1117',
  },
})

export function App(): JSX.Element {
  const styles = useStyles()
  const { sessions, activeId, activeSession, createSession, selectSession, closeSession, renameSession } =
    useSessions()
  const { groups, launchAgent } = useAgents()
  const [fontSize, setFontSize] = useState(ZOOM.DEFAULT)
  const [sessionsPanelVisible, setSessionsPanelVisible] = useState(true)
  const [sessionsPanelWidth, setSessionsPanelWidth] = useState(240)
  const [prefillAgent, setPrefillAgent] = useState<AgentProfile | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hubOpen, setHubOpen] = useState(false)
  const [hubEnterprise, setHubEnterprise] = useState<string>('AICraftWorks')
  const [hubScopeLabel, setHubScopeLabel] = useState<string>('')
  const [hubFocus, setHubFocus] = useState<DashboardFocusSection>('overview')
  const [hubFilters, setHubFilters] = useState<HubDeepLinkFilters | undefined>(undefined)

  useEffect(() => {
    if (!window.hubAPI?.onDeepLinkOpen) {
      return
    }

    const unsub = window.hubAPI.onDeepLinkOpen((payload: {
      panel?: string
      scopeRaw?: string
      filters?: HubDeepLinkFilters
    }) => {
      const scopeRaw = payload.scopeRaw || ''
      const panel = payload.panel || 'overview'
      const mappedFocus: DashboardFocusSection =
        panel === 'my-scope' ? 'activity'
        : panel === 'agent-ops' ? 'billing'
        : panel === 'audit' ? 'audit'
        : panel === 'auth' ? 'auth'
        : panel === 'requests' ? 'requests'
        : panel === 'workflows' ? 'workflows'
        : panel === 'workflow-run' ? 'workflows'
        : 'overview'

      let enterpriseFromScope = 'AICraftWorks'
      if (scopeRaw.startsWith('org:')) {
        enterpriseFromScope = scopeRaw.slice(4)
      } else if (scopeRaw.startsWith('repo:')) {
        const repoValue = scopeRaw.slice(5)
        const [org] = repoValue.split('/', 1)
        if (org) {
          enterpriseFromScope = org
        }
      }

      setHubEnterprise(enterpriseFromScope)
      setHubScopeLabel(scopeRaw)
      setHubFocus(mappedFocus)
      setHubFilters(payload.filters)
      setHubOpen(true)
    })

    return () => {
      unsub()
    }
  }, [])

  const handleCreateAgentFromSession = useCallback((session: Session) => {
    const command = session.agentCommand || ''
    const args = session.agentArgs || []
    const agent: AgentProfile = {
      id: uuidv4(),
      name: session.name || 'New Agent',
      command,
      args,
      env: session.agentEnv,
      cwdMode: 'activeSession',
      launchTarget: 'path',
      cwdPath: session.folderPath || '',
    }
    setPrefillAgent(agent)
  }, [])

  const toggleSettings = useCallback(() => {
    setSettingsOpen(prev => !prev)
  }, [])

  const toggleHub = useCallback(() => {
    setHubOpen(prev => !prev)
  }, [])

  const toggleSessionsPanel = useCallback(() => {
    setSessionsPanelVisible(prev => !prev)
  }, [])

  const toggleSidebar = useCallback(() => {
    // No-op — sidebar is now always-visible tabs
  }, [])

  const launchAgentByIndex = useCallback(
    (index: number) => {
      if (!activeId || groups.length === 0) return
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
    <div className={styles.root}>
      <div className={styles.main}>
        {sessionsPanelVisible && (
          <SessionsPanel
            sessions={sessions}
            activeId={activeId}
            onSelect={selectSession}
            onClose={closeSession}
            onCreate={createSession}
            onRename={renameSession}
            onCreateAgent={handleCreateAgentFromSession}
            width={sessionsPanelWidth}
            onWidthChange={setSessionsPanelWidth}
            onCollapse={() => setSessionsPanelVisible(false)}
          />
        )}
        <TerminalViewport sessions={sessions} activeId={activeId} fontSize={fontSize} />
        {hubOpen && (
          <div className={styles.hubOverlay}>
            <HubDashboard
              enterprise={hubEnterprise}
              scopeLabel={hubScopeLabel}
              initialFocus={hubFocus}
              initialFilters={hubFilters}
              onClose={toggleHub}
            />
          </div>
        )}
        <AgentsSidebar activeSessionId={activeId} prefillAgent={prefillAgent} onPrefillConsumed={() => setPrefillAgent(null)} />
      </div>
      <StatusBar sessions={sessions} activeSession={activeSession} onToggleSettings={toggleSettings} onToggleHub={toggleHub} hubOpen={hubOpen} />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} fontSize={fontSize} setFontSize={setFontSize} />}
      {activeSession?.kind === 'copilot-sdk' && (
        <>
          <PermissionDialog sessionId={activeId} />
          <UserInputDialog sessionId={activeId} />
        </>
      )}
    </div>
  )
}
