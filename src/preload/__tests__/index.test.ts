import { beforeEach, describe, expect, it, vi } from 'vitest'

const listeners = new Map<string, Set<(event: unknown, payload: unknown) => void>>()
interface GhawApiContract {
  start: () => Promise<unknown>
  stop: () => Promise<unknown>
  refresh: () => Promise<unknown>
  getSnapshot: () => Promise<unknown>
  onSnapshot: (cb: (snapshot: unknown) => void) => () => void
  onError: (cb: (message: string) => void) => () => void
}

const exposed: Record<string, unknown> = {}

const invoke = vi.fn()
const on = vi.fn((channel: string, handler: (event: unknown, payload: unknown) => void) => {
  const existing = listeners.get(channel) ?? new Set()
  existing.add(handler)
  listeners.set(channel, existing)
})
const off = vi.fn((channel: string, handler: (event: unknown, payload: unknown) => void) => {
  const existing = listeners.get(channel)
  if (!existing) return
  existing.delete(handler)
  if (existing.size === 0) {
    listeners.delete(channel)
  }
})
const removeListener = vi.fn()
const send = vi.fn()
const exposeInMainWorld = vi.fn((name: string, value: unknown) => {
  exposed[name] = value
})

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on, off, removeListener, send },
}))

describe('preload ghawAPI integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    listeners.clear()
    for (const key of Object.keys(exposed)) delete exposed[key]
    vi.resetModules()
    await import('../index')
  })

  it('exposes ghawAPI through contextBridge', () => {
    expect(exposeInMainWorld).toHaveBeenCalledWith('ghawAPI', expect.any(Object))
    const ghawAPI = exposed.ghawAPI as GhawApiContract | undefined
    expect(ghawAPI).toBeDefined()
    expect(typeof ghawAPI?.start).toBe('function')
  })

  it('routes request/reply methods to ghaw IPC channels', async () => {
    invoke.mockResolvedValue({ ok: true })
    const ghawAPI = exposed.ghawAPI as GhawApiContract

    await ghawAPI.start()
    await ghawAPI.stop()
    await ghawAPI.refresh()
    await ghawAPI.getSnapshot()

    expect(invoke).toHaveBeenNthCalledWith(1, 'ghaw:start')
    expect(invoke).toHaveBeenNthCalledWith(2, 'ghaw:stop')
    expect(invoke).toHaveBeenNthCalledWith(3, 'ghaw:refresh')
    expect(invoke).toHaveBeenNthCalledWith(4, 'ghaw:getSnapshot')
  })

  it('subscribes and unsubscribes snapshot events via ipcRenderer.on/off', () => {
    const cb = vi.fn()
    const ghawAPI = exposed.ghawAPI as GhawApiContract
    const unsubscribe = ghawAPI.onSnapshot(cb)

    expect(on).toHaveBeenCalledWith('ghaw:snapshot', expect.any(Function))
    listeners.get('ghaw:snapshot')?.forEach((handler) => handler({}, { fetchedAt: 123 }))
    expect(cb).toHaveBeenCalledWith({ fetchedAt: 123 })

    unsubscribe()
    expect(off).toHaveBeenCalledWith('ghaw:snapshot', expect.any(Function))
  })

  it('subscribes and unsubscribes error events via ipcRenderer.on/off', () => {
    const cb = vi.fn()
    const ghawAPI = exposed.ghawAPI as GhawApiContract
    const unsubscribe = ghawAPI.onError(cb)

    expect(on).toHaveBeenCalledWith('ghaw:error', expect.any(Function))
    listeners.get('ghaw:error')?.forEach((handler) => handler({}, 'poll failed'))
    expect(cb).toHaveBeenCalledWith('poll failed')

    unsubscribe()
    expect(off).toHaveBeenCalledWith('ghaw:error', expect.any(Function))
  })
})
