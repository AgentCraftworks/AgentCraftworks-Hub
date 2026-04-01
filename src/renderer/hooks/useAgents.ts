import { useState, useEffect, useCallback } from 'react'
import type { ProjectFolder } from '@shared/types'

export function useAgents() {
  const [groups, setGroups] = useState<ProjectFolder[]>([])

  useEffect(() => {
    window.agentCraftworksAPI.agents.getGroups().then((loaded: ProjectFolder[]) => {
      setGroups(loaded)
    })

    const unsubscribe = window.agentCraftworksAPI.agents.onUpdated((updated: ProjectFolder[]) => {
      setGroups(updated)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const saveGroups = useCallback(async (updatedGroups: ProjectFolder[]) => {
    await window.agentCraftworksAPI.agents.saveGroups(updatedGroups)
  }, [])

  const launchAgent = useCallback(async (agentId: string, sessionId: string) => {
    await window.agentCraftworksAPI.agents.launch(agentId, sessionId)
  }, [])

  return { groups, saveGroups, launchAgent }
}
