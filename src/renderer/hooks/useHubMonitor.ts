// useHubMonitor.ts — React hook that subscribes to hub IPC events
import { useState, useEffect, useCallback } from 'react'
import type { MonitorSnapshot, RateLimitSample } from '@shared/hub-types'

export interface HubMonitorState {
  snapshot: MonitorSnapshot | null
  history: RateLimitSample[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useHubMonitor(enterprise = 'AICraftworks'): HubMonitorState & { refresh: () => void } {
  const [state, setState] = useState<HubMonitorState>({
    snapshot: null,
    history: [],
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

      // Load persisted history from disk on startup
      const persistedHistory = await window.hubAPI.getHistory()

      // Seed with current snapshot if already available
      const initial = await window.hubAPI.getSnapshot()
      if (initial) {
        setState(s => ({ ...s, snapshot: initial, history: persistedHistory, loading: false, lastUpdated: new Date() }))
      } else {
        setState(s => ({ ...s, history: persistedHistory }))
      }

      unsubSnapshot = window.hubAPI.onSnapshot((snapshot) => {
        setState(s => {
          // Append new sample to local history state (HistoryStore handles disk persistence)
          const newSample: RateLimitSample | null = snapshot.rateLimit
            ? { ts: snapshot.rateLimit.fetchedAt, coreUsed: snapshot.rateLimit.core.used, coreLimit: snapshot.rateLimit.core.limit }
            : null
          const updatedHistory = newSample
            ? [...s.history.slice(-720), newSample]
            : s.history
          return { snapshot, history: updatedHistory, loading: false, error: null, lastUpdated: new Date() }
        })
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