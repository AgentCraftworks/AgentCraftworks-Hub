export type ScopeWindow = '7d' | '30d' | 'custom'

export interface ParsedScope {
  org?: string
  repo?: string
  workspace?: string
  team?: string
  squad?: string
  window?: ScopeWindow
}

export interface HubDeepLinkFilters {
  repo?: string
  workflowId?: number
  runId?: number
  status?: string
  conclusion?: string
  result?: string
  state?: string
  surface?: string
  actor?: string
  limit?: number
}

export interface HubDeepLinkPayload {
  rawUrl: string
  panel: string
  scopeRaw: string
  persona?: string
  scope?: ParsedScope
  filters?: HubDeepLinkFilters
}

const WINDOWS = new Set<ScopeWindow>(['7d', '30d', 'custom'])

function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }
  if (!/^\d+$/.test(value.trim())) {
    return undefined
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function normalizeRoutePath(url: URL): string {
  const host = url.hostname ? `/${url.hostname}` : ''
  const pathname = url.pathname === '/' ? '' : url.pathname
  return `${host}${pathname}` || '/'
}

function inferPanel(path: string): string {
  const normalized = path.replace(/\/+$/, '') || '/'
  if (normalized === '/my-scope') return 'my-scope'
  if (normalized === '/agent-ops') return 'agent-ops'
  if (normalized === '/audit') return 'audit'
  if (normalized === '/auth') return 'auth'
  if (normalized === '/requests') return 'requests'
  if (normalized === '/ghaw' || normalized === '/ghaw/workflows') return 'workflows'
  if (/^\/ghaw\/workflows\/[^/]+$/i.test(normalized)) return 'workflows'
  if (/^\/ghaw\/runs\/[^/]+$/i.test(normalized)) return 'workflow-run'
  if (/^\/ghaw\/workflows\/[^/]+\/runs\/[^/]+$/i.test(normalized)) return 'workflow-run'
  return 'overview'
}

function extractPathFilters(path: string): HubDeepLinkFilters {
  const filters: HubDeepLinkFilters = {}
  const workflowRunMatch = path.match(/^\/ghaw\/workflows\/(\d+)\/runs\/(\d+)$/i)
  if (workflowRunMatch) {
    filters.workflowId = Number.parseInt(workflowRunMatch[1], 10)
    filters.runId = Number.parseInt(workflowRunMatch[2], 10)
    return filters
  }

  const workflowMatch = path.match(/^\/ghaw\/workflows\/(\d+)$/i)
  if (workflowMatch) {
    filters.workflowId = Number.parseInt(workflowMatch[1], 10)
    return filters
  }

  const runMatch = path.match(/^\/ghaw\/runs\/(\d+)$/i)
  if (runMatch) {
    filters.runId = Number.parseInt(runMatch[1], 10)
  }
  return filters
}

export function parseScopeString(scopeRaw: string): ParsedScope {
  const raw = scopeRaw.trim()
  const parsed: ParsedScope = {}
  if (!raw) {
    return parsed
  }

  const setWindow = (value: string): void => {
    if (WINDOWS.has(value as ScopeWindow)) {
      parsed.window = value as ScopeWindow
    }
  }

  if (!raw.includes(',') && raw.startsWith('org:')) {
    parsed.org = raw.slice(4)
    return parsed
  }

  if (!raw.includes(',') && raw.startsWith('repo:')) {
    const repoRef = raw.slice(5)
    parsed.repo = repoRef
    const [org] = repoRef.split('/', 1)
    if (org) {
      parsed.org = org
    }
    return parsed
  }

  const segments = raw
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)

  for (const segment of segments) {
    const [key, ...rest] = segment.split(':')
    const value = rest.join(':').trim()
    if (!value) continue

    switch (key.trim()) {
      case 'org':
        parsed.org = value
        break
      case 'repo':
        parsed.repo = value
        if (!parsed.org) {
          const [org] = value.split('/', 1)
          if (org) parsed.org = org
        }
        break
      case 'workspace':
        parsed.workspace = value
        break
      case 'team':
        parsed.team = value
        break
      case 'squad':
        parsed.squad = value
        break
      case 'window':
        setWindow(value)
        break
      default:
        break
    }
  }

  return parsed
}

export function parseDeepLink(rawUrl: string): HubDeepLinkPayload | null {
  const parsed = new URL(rawUrl)
  if (parsed.protocol !== 'agentcraftworks-hub:') {
    return null
  }

  const routePath = normalizeRoutePath(parsed)
  const panel = parsed.searchParams.get('panel') || inferPanel(routePath)
  const scopeRaw = parsed.searchParams.get('scope') || ''
  const persona = parsed.searchParams.get('persona') || undefined
  const scope = scopeRaw ? parseScopeString(scopeRaw) : undefined

  const pathFilters = extractPathFilters(routePath)
  const filters: HubDeepLinkFilters = {
    ...pathFilters,
    repo: parsed.searchParams.get('repo') || pathFilters.repo,
    workflowId:
      parseOptionalNumber(parsed.searchParams.get('workflowId'))
      ?? parseOptionalNumber(parsed.searchParams.get('workflow'))
      ?? pathFilters.workflowId,
    runId:
      parseOptionalNumber(parsed.searchParams.get('runId'))
      ?? parseOptionalNumber(parsed.searchParams.get('run'))
      ?? parseOptionalNumber(parsed.searchParams.get('workflowRunId'))
      ?? pathFilters.runId,
    status: parsed.searchParams.get('status') || undefined,
    conclusion: parsed.searchParams.get('conclusion') || undefined,
    result: parsed.searchParams.get('result') || undefined,
    state: parsed.searchParams.get('state') || undefined,
    surface: parsed.searchParams.get('surface') || undefined,
    actor: parsed.searchParams.get('actor') || undefined,
    limit: parseOptionalNumber(parsed.searchParams.get('limit')),
  }

  const hasFilters = Object.values(filters).some((value) => value !== undefined)

  return {
    rawUrl,
    panel,
    scopeRaw,
    persona,
    scope,
    filters: hasFilters ? filters : undefined,
  }
}

export function buildDeepLink(payload: Omit<HubDeepLinkPayload, 'rawUrl'>): string {
  const url = new URL('agentcraftworks-hub://dashboard')
  url.searchParams.set('panel', payload.panel)
  if (payload.scopeRaw) {
    url.searchParams.set('scope', payload.scopeRaw)
  }
  if (payload.persona) {
    url.searchParams.set('persona', payload.persona)
  }
  if (payload.filters) {
    const { filters } = payload
    if (filters.repo) url.searchParams.set('repo', filters.repo)
    if (filters.workflowId !== undefined) url.searchParams.set('workflowId', String(filters.workflowId))
    if (filters.runId !== undefined) url.searchParams.set('runId', String(filters.runId))
    if (filters.status) url.searchParams.set('status', filters.status)
    if (filters.conclusion) url.searchParams.set('conclusion', filters.conclusion)
    if (filters.result) url.searchParams.set('result', filters.result)
    if (filters.state) url.searchParams.set('state', filters.state)
    if (filters.surface) url.searchParams.set('surface', filters.surface)
    if (filters.actor) url.searchParams.set('actor', filters.actor)
    if (filters.limit !== undefined) url.searchParams.set('limit', String(filters.limit))
  }
  return url.toString()
}
