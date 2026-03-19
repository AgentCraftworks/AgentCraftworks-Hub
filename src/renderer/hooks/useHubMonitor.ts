// useHubMonitor.ts — React hook that subscribes to hub IPC events
import { useState, useEffect, useCallback } from 'react'
import type { MonitorSnapshot } from '@shared/hub-types'

export interface HubMonitorState {
  snapshot: MonitorSnapshot | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useHubMonitor(enterprise = 'AICraftworks'): HubMonitorState & { refresh: () => void } {
  const [state, setState] = useState<HubMonitorState>({
    snapshot: null,
    loading: true,
    error: null,
    lastUpdated: null,
  })

  useEffect(() => {
    let unsubSnapshot: (() => void) | undefined
    let unsubError: (() => void) | undefined

    async function init() {
      const result = await window.hubAPI.start(enterprise)
      if (!result.ok) {
        setState(s => ({ ...s, loading: false, error: result.error ?? 'Failed to start monitor' }))
        return
      }

      // Seed with current snapshot if already available
      const initial = await window.hubAPI.getSnapshot()
      if (initial) {
        setState(s => ({ ...s, snapshot: initial, loading: false, lastUpdated: new Date() }))
      }

      unsubSnapshot = window.hubAPI.onSnapshot((snapshot) => {
        setState({ snapshot, loading: false, error: null, lastUpdated: new Date() })
      })

      unsubError = window.hubAPI.onError((msg) => {
        setState(s => ({ ...s, error: msg, loading: false }))
      })
    }

    init()

    return () => {
      unsubSnapshot?.()
      unsubError?.()
    }
  }, [enterprise])

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true }))
    await window.hubAPI.refresh()
  }, [])

  return { ...state, refresh }
}
