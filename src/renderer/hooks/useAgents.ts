import { useState, useEffect, useCallback } from 'react'
import type { AgentGroup } from '@shared/types'

export function useAgents() {
  const [groups, setGroups] = useState<AgentGroup[]>([])

  useEffect(() => {
    window.tangentAPI.agents.getGroups().then((loaded: AgentGroup[]) => {
      setGroups(loaded)
    })

    const unsubscribe = window.tangentAPI.agents.onUpdated((updated: AgentGroup[]) => {
      setGroups(updated)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const saveGroups = useCallback(async (updatedGroups: AgentGroup[]) => {
    await window.tangentAPI.agents.saveGroups(updatedGroups)
  }, [])

  const launchAgent = useCallback(async (agentId: string, sessionId: string) => {
    await window.tangentAPI.agents.launch(agentId, sessionId)
  }, [])

  return { groups, saveGroups, launchAgent }
}
