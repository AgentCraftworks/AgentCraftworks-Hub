import { contextBridge, ipcRenderer } from 'electron'

const tangentAPI = {
  session: {
    getAll: () => ipcRenderer.invoke('session:getAll'),
    create: () => ipcRenderer.invoke('session:create'),
    close: (id: string) => ipcRenderer.invoke('session:close', id),
    select: (id: string) => ipcRenderer.invoke('session:select', id),
    rename: (id: string, name: string) => ipcRenderer.invoke('session:rename', id, name),
    scanExternal: () => ipcRenderer.invoke('session:scanExternal'),

    onCreated: (cb: (session: any) => void) => {
      const handler = (_: any, session: any) => cb(session)
      ipcRenderer.on('session:created', handler)
      return () => { ipcRenderer.removeListener('session:created', handler) }
    },
    onUpdated: (cb: (session: any) => void) => {
      const handler = (_: any, session: any) => cb(session)
      ipcRenderer.on('session:updated', handler)
      return () => { ipcRenderer.removeListener('session:updated', handler) }
    },
    onClosed: (cb: (sessionId: string) => void) => {
      const handler = (_: any, sessionId: string) => cb(sessionId)
      ipcRenderer.on('session:closed', handler)
      return () => { ipcRenderer.removeListener('session:closed', handler) }
    }
  },

  terminal: {
    write: (sessionId: string, data: string) => {
      ipcRenderer.send('terminal:write', sessionId, data)
    },
    attach: (sessionId: string) => ipcRenderer.invoke('terminal:attach', sessionId),
    onData: (sessionId: string, cb: (data: string) => void) => {
      const channel = `terminal:data:${sessionId}`
      const handler = (_: any, data: string) => cb(data)
      ipcRenderer.on(channel, handler)
      return () => { ipcRenderer.removeListener(channel, handler) }
    },
    resize: (sessionId: string, cols: number, rows: number) => {
      ipcRenderer.send('terminal:resize', sessionId, cols, rows)
    }
  },

  agents: {
    getGroups: () => ipcRenderer.invoke('agents:getGroups'),
    saveGroups: (groups: any) => ipcRenderer.invoke('agents:saveGroups', groups),
    launch: (agentId: string, sessionId: string) =>
      ipcRenderer.invoke('agents:launch', agentId, sessionId),

    onUpdated: (cb: (groups: any) => void) => {
      const handler = (_: any, groups: any) => cb(groups)
      ipcRenderer.on('agents:updated', handler)
      return () => { ipcRenderer.removeListener('agents:updated', handler) }
    }
  },

  sdk: {
    sendMessage: (sessionId: string, prompt: string) =>
      ipcRenderer.invoke('sdk:sendMessage', sessionId, prompt),
    approvePermission: (sessionId: string, approved: boolean) =>
      ipcRenderer.invoke('sdk:approvePermission', sessionId, approved),
    answerInput: (sessionId: string, answer: string, wasFreeform: boolean) =>
      ipcRenderer.invoke('sdk:answerInput', sessionId, answer, wasFreeform),

    onOutput: (sessionId: string, cb: (data: string) => void) => {
      const channel = `sdk:output:${sessionId}`
      const handler = (_: any, data: string) => cb(data)
      ipcRenderer.on(channel, handler)
      return () => { ipcRenderer.removeListener(channel, handler) }
    },
    onPermissionRequest: (sessionId: string, cb: (request: any) => void) => {
      const channel = `sdk:permission:${sessionId}`
      const handler = (_: any, request: any) => cb(request)
      ipcRenderer.on(channel, handler)
      return () => { ipcRenderer.removeListener(channel, handler) }
    },
    onUserInput: (sessionId: string, cb: (request: any) => void) => {
      const channel = `sdk:userInput:${sessionId}`
      const handler = (_: any, request: any) => cb(request)
      ipcRenderer.on(channel, handler)
      return () => { ipcRenderer.removeListener(channel, handler) }
    }
  },

  shell: {
    openInVSCode: (folderPath: string) => ipcRenderer.invoke('shell:openInVSCode', folderPath),
    openInExplorer: (folderPath: string) => ipcRenderer.invoke('shell:openInExplorer', folderPath),
    openEditor: (folderPath: string) => ipcRenderer.invoke('shell:openEditor', { folderPath }),
    getEditor: () => ipcRenderer.invoke('shell:getEditor'),
    setEditor: (editor: string) => ipcRenderer.invoke('shell:setEditor', { editor })
  },

  fs: {
    suggestDirs: (partial: string): Promise<string[]> => ipcRenderer.invoke('fs:suggestDirs', partial)
  },

  dialog: {
    openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),
    openFile: (filters?: { name: string; extensions: string[] }[]): Promise<string | null> =>
      ipcRenderer.invoke('dialog:openFile', filters),
    saveFile: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> =>
      ipcRenderer.invoke('dialog:saveFile', options)
  },

  config: {
    get: () => ipcRenderer.invoke('config:get'),
    update: (key: string, value: unknown) => ipcRenderer.invoke('config:update', { key, value }),
    openFile: () => ipcRenderer.invoke('config:openFile'),
    exportConfig: () => ipcRenderer.invoke('config:export'),
    importConfig: (bundle: any) => ipcRenderer.invoke('config:import', bundle),
    writeExport: (filePath: string, bundle: any) => ipcRenderer.invoke('config:writeExport', filePath, bundle),
    readImport: (filePath: string) => ipcRenderer.invoke('config:readImport', filePath),
    onChanged: (cb: (config: any) => void) => {
      const handler = (_: any, config: any) => cb(config)
      ipcRenderer.on('config:changed', handler)
      return () => { ipcRenderer.removeListener('config:changed', handler) }
    }
  },

  app: {
    getZoom: () => ipcRenderer.invoke('app:getZoom'),
    setZoom: (level: number) => ipcRenderer.invoke('app:setZoom', level),
    onZoomChanged: (cb: (level: number) => void) => {
      const handler = (_: any, level: number) => cb(level)
      ipcRenderer.on('app:zoomChanged', handler)
      return () => { ipcRenderer.removeListener('app:zoomChanged', handler) }
    }
  }
}

contextBridge.exposeInMainWorld('tangentAPI', tangentAPI)

// Hub monitoring API — separate namespace to avoid collisions with Tangent internals
const hubAPI = {
  start: (enterprise?: string): Promise<import('@shared/hub-types').HubActionResponse> =>
    ipcRenderer.invoke('hub:start', enterprise),

  stop: (): Promise<import('@shared/hub-types').HubActionResponse> =>
    ipcRenderer.invoke('hub:stop'),

  getSnapshot: (): Promise<import('@shared/hub-types').MonitorSnapshot | null> =>
    ipcRenderer.invoke('hub:getSnapshot'),

  getHistory: (): Promise<import('@shared/hub-types').RateLimitSample[]> =>
    ipcRenderer.invoke('hub:getHistory'),

  getOperationLog: (query?: import('@shared/hub-types').OperationLogQuery): Promise<import('@shared/hub-types').OperationLogEntry[]> =>
    ipcRenderer.invoke('hub:getOperationLog', query),

  appendOperationLogEntry: (
    input: import('@shared/hub-types').OperationLogAppendInput,
  ): Promise<import('@shared/hub-types').HubActionResponse & { entry?: import('@shared/hub-types').OperationLogEntry }> =>
    ipcRenderer.invoke('hub:appendOperationLogEntry', input),

  getActionAuthority: (): Promise<import('@shared/hub-types').ActionAuthoritySnapshot> =>
    ipcRenderer.invoke('hub:getActionAuthority'),

  getTokenConfig: (): Promise<{ hasToken: boolean; enterprise: string; org: string; isGhCli: boolean; ghAuthenticated: boolean; ghScopes: string[]; missingScopes: string[] }> =>
    ipcRenderer.invoke('hub:getTokenConfig'),

  checkLoginStatus: (): Promise<{ authenticated: boolean; scopes: string[]; missingScopes: string[] }> =>
    ipcRenderer.invoke('hub:checkLoginStatus'),

  // org is optional; defaults to the persisted or default org slug on the main process side
  beginGitHubLogin: (params: { enterprise: string; org?: string }): Promise<import('@shared/hub-types').HubActionResponse> =>
    ipcRenderer.invoke('hub:beginGitHubLogin', params),

  openDevicePage: (): Promise<import('@shared/hub-types').HubActionResponse> =>
    ipcRenderer.invoke('hub:openDevicePage'),

  // org is optional; defaults to the persisted or default org slug on the main process side
  completeGitHubLogin: (
    params: { enterprise: string; org?: string },
  ): Promise<import('@shared/hub-types').HubActionResponse & { scopes?: string[]; missingScopes?: string[] }> =>
    ipcRenderer.invoke('hub:completeGitHubLogin', params),

  logoutGitHub: (): Promise<import('@shared/hub-types').HubActionResponse> =>
    ipcRenderer.invoke('hub:logoutGitHub'),

  refresh: (): Promise<import('@shared/hub-types').HubActionResponse> =>
    ipcRenderer.invoke('hub:refresh'),

  onSnapshot: (cb: (snapshot: import('@shared/hub-types').MonitorSnapshot) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, snapshot: import('@shared/hub-types').MonitorSnapshot) => cb(snapshot)
    ipcRenderer.on('hub:snapshot', handler)
    return () => { ipcRenderer.removeListener('hub:snapshot', handler) }
  },

  onError: (cb: (message: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, message: string) => cb(message)
    ipcRenderer.on('hub:error', handler)
    return () => { ipcRenderer.removeListener('hub:error', handler) }
  },

  onDeviceCode: (cb: (code: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, code: string) => cb(code)
    ipcRenderer.on('hub:deviceCode', handler)
    return () => { ipcRenderer.removeListener('hub:deviceCode', handler) }
  },

  onOperationLogUpdated: (cb: (entry: import('@shared/hub-types').OperationLogEntry) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, entry: import('@shared/hub-types').OperationLogEntry) => cb(entry)
    ipcRenderer.on('hub:operationLogUpdated', handler)
    return () => { ipcRenderer.removeListener('hub:operationLogUpdated', handler) }
  },

  // Action request queue
  submitActionRequest: (
    input: import('@shared/hub-types').ActionRequestSubmitInput,
  ): Promise<import('@shared/hub-types').HubActionResponse & { request?: import('@shared/hub-types').ActionRequest }> =>
    ipcRenderer.invoke('hub:submitActionRequest', input),

  listActionRequests: (query?: import('@shared/hub-types').ActionRequestQuery): Promise<import('@shared/hub-types').ActionRequest[]> =>
    ipcRenderer.invoke('hub:listActionRequests', query),

  countPendingRequests: (): Promise<number> =>
    ipcRenderer.invoke('hub:countPendingRequests'),

  approveActionRequest: (
    id: string,
    note?: string,
  ): Promise<import('@shared/hub-types').HubActionResponse & { request?: import('@shared/hub-types').ActionRequest }> =>
    ipcRenderer.invoke('hub:approveActionRequest', id, note),

  rejectActionRequest: (
    id: string,
    note?: string,
  ): Promise<import('@shared/hub-types').HubActionResponse & { request?: import('@shared/hub-types').ActionRequest }> =>
    ipcRenderer.invoke('hub:rejectActionRequest', id, note),

  onActionRequestUpdated: (cb: (request: import('@shared/hub-types').ActionRequest) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, request: import('@shared/hub-types').ActionRequest) => cb(request)
    ipcRenderer.on('hub:actionRequestUpdated', handler)
    return () => { ipcRenderer.removeListener('hub:actionRequestUpdated', handler) }
  },

  onDeepLinkOpen: (cb: (payload: {
    rawUrl: string
    panel: string
    scopeRaw: string
    persona?: string
    scope?: unknown
    filters?: import('@shared/hub-contracts').HubDeepLinkFilters
  }) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: {
      rawUrl: string
      panel: string
      scopeRaw: string
      persona?: string
      scope?: unknown
      filters?: import('@shared/hub-contracts').HubDeepLinkFilters
    }) => cb(payload)
    ipcRenderer.on('hub:deepLinkOpen', handler)
    return () => { ipcRenderer.removeListener('hub:deepLinkOpen', handler) }
  },
}

contextBridge.exposeInMainWorld('hubAPI', hubAPI)

// GHAW workflows API — isolated namespace for dashboard workflow polling
const ghawAPI: import('@shared/hub-types').GhawWorkflowPoller = {
  start: (): Promise<import('@shared/hub-types').HubActionResponse> =>
    ipcRenderer.invoke('ghaw:start'),

  stop: (): Promise<import('@shared/hub-types').HubActionResponse> =>
    ipcRenderer.invoke('ghaw:stop'),

  refresh: (): Promise<import('@shared/hub-types').HubActionResponse> =>
    ipcRenderer.invoke('ghaw:refresh'),

  getSnapshot: (): Promise<import('@shared/hub-types').GhawInsightsSnapshot | null> =>
    ipcRenderer.invoke('ghaw:getSnapshot'),

  onSnapshot: (cb: (snapshot: import('@shared/hub-types').GhawInsightsSnapshot) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, snapshot: import('@shared/hub-types').GhawInsightsSnapshot) => cb(snapshot)
    ipcRenderer.on('ghaw:snapshot', handler)
    return () => {
      ipcRenderer.off('ghaw:snapshot', handler)
    }
  },

  onError: (cb: (message: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, message: string) => cb(message)
    ipcRenderer.on('ghaw:error', handler)
    return () => {
      ipcRenderer.off('ghaw:error', handler)
    }
  },
}

contextBridge.exposeInMainWorld('ghawAPI', ghawAPI)

// Entitlement API — persona + capability gating
const entitlementAPI = {
  getSnapshot: () => ipcRenderer.invoke('entitlement:getSnapshot'),
  setPersona: (personaId: string) => ipcRenderer.invoke('entitlement:setPersona', personaId),
  setLicenseLevel: (level: string) => ipcRenderer.invoke('entitlement:setLicenseLevel', level),
  setLicenseKey: (key: string) => ipcRenderer.invoke('entitlement:setLicenseKey', key),
  setLastScope: (scope: unknown) => ipcRenderer.invoke('entitlement:setLastScope', scope),
  allows: (capabilityKey: string) => ipcRenderer.invoke('entitlement:allows', capabilityKey),
}

contextBridge.exposeInMainWorld('entitlementAPI', entitlementAPI)
