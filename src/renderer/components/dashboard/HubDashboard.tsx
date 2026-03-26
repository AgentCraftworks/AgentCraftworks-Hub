// HubDashboard.tsx — Main dashboard container (Task Manager style)
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHubMonitor } from '@/hooks/useHubMonitor'
import { RateLimitPanel } from './RateLimitPanel'
import { TokenActivityPanel } from './TokenActivityPanel'
import { ActionsMinutesPanel } from './ActionsMinutesPanel'
import { CopilotUsagePanel } from './CopilotUsagePanel'
import { BillingPanel } from './BillingPanel'
import { TokenAuthPanel } from './TokenAuthPanel'
import { OperationLogPanel } from './OperationLogPanel'
import { ActionRequestPanel } from './ActionRequestPanel'
import { WorkflowHealthPanel } from './WorkflowHealthPanel'
import { RefreshCw, Loader, Settings, ShieldAlert } from 'lucide-react'
import type { ActionRequest, ActionAuthoritySnapshot, OperationLogEntry } from '@shared/hub-types'
import { buildDeepLink } from '@shared/hub-contracts'
import type { HubDeepLinkFilters } from '@shared/hub-contracts'

interface Props {
  enterprise?: string
  scopeLabel?: string
  initialFocus?: DashboardFocusSection
  initialFilters?: HubDeepLinkFilters
  onClose?: () => void
}

export type DashboardFocusSection = 'overview' | 'activity' | 'billing' | 'auth' | 'audit' | 'requests'

export function HubDashboard({ enterprise = 'AICraftWorks', scopeLabel, initialFocus = 'overview', initialFilters, onClose }: Props) {
  const { snapshot, history, loading, error, lastUpdated, refresh: refreshMonitor } = useHubMonitor(enterprise)
  const [showAuth, setShowAuth] = useState(false)
  const [operationLog, setOperationLog] = useState<OperationLogEntry[]>([])
  const [operationLogLoading, setOperationLogLoading] = useState(false)
  const [actionRequests, setActionRequests] = useState<ActionRequest[]>([])
  const [actionRequestsLoading, setActionRequestsLoading] = useState(false)
  const [authority, setAuthority] = useState<ActionAuthoritySnapshot | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const overviewRef = useRef<HTMLDivElement | null>(null)
  const activityRef = useRef<HTMLDivElement | null>(null)
  const billingRef = useRef<HTMLDivElement | null>(null)
  const auditRef = useRef<HTMLDivElement | null>(null)
  const requestsRef = useRef<HTMLDivElement | null>(null)

  const refreshOperationLog = useCallback(async () => {
    setOperationLogLoading(true)
    try {
      const entries = await window.hubAPI.getOperationLog({
        limit: initialFilters?.limit ?? 100,
        scope: scopeLabel || undefined,
        result: initialFilters?.result,
        surface: initialFilters?.surface,
      })
      setOperationLog(entries)
    } finally {
      setOperationLogLoading(false)
    }
  }, [scopeLabel, initialFilters?.limit, initialFilters?.result, initialFilters?.surface])

  const refreshActionRequests = useCallback(async () => {
    setActionRequestsLoading(true)
    try {
      const reqs = await window.hubAPI.listActionRequests({ limit: 100 })
      const filtered = reqs.filter((request) => {
        if (initialFilters?.state && request.state !== initialFilters.state) {
          return false
        }
        if (initialFilters?.actor && request.actor !== initialFilters.actor) {
          return false
        }
        return true
      })
      setActionRequests(filtered)
    } finally {
      setActionRequestsLoading(false)
    }
  }, [initialFilters?.actor, initialFilters?.state])

  const refreshAll = useCallback(() => {
    void refreshMonitor()
    void refreshOperationLog()
    void refreshActionRequests()
  }, [refreshMonitor, refreshOperationLog, refreshActionRequests])

  useEffect(() => {
    void refreshOperationLog()
    void refreshActionRequests()
    window.hubAPI.getActionAuthority().then(setAuthority).catch(() => null)
  }, [refreshOperationLog, refreshActionRequests])

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshOperationLog()
      void refreshActionRequests()
    }, 5000)

    return () => clearInterval(timer)
  }, [refreshOperationLog, refreshActionRequests])

  useEffect(() => {
    return window.hubAPI.onOperationLogUpdated((entry) => {
      setOperationLog((current) => {
        if (scopeLabel && entry.scope !== scopeLabel) {
          return current
        }

        const deduped = current.filter((item) => item.id !== entry.id)
        return [entry, ...deduped].slice(0, 100)
      })
    })
  }, [scopeLabel])

  useEffect(() => {
    return window.hubAPI.onActionRequestUpdated((req) => {
      setActionRequests((current) => {
        const deduped = current.filter((r) => r.id !== req.id)
        return [req, ...deduped].slice(0, 100)
      })
    })
  }, [])

  const handleApprove = useCallback(async (id: string, note?: string) => {
    await window.hubAPI.approveActionRequest(id, note)
    void refreshActionRequests()
  }, [refreshActionRequests])

  const handleReject = useCallback(async (id: string, note?: string) => {
    await window.hubAPI.rejectActionRequest(id, note)
    void refreshActionRequests()
  }, [refreshActionRequests])

  const handleCopyShareLink = useCallback(async () => {
    const link = buildDeepLink({
      panel: initialFocus,
      scopeRaw: scopeLabel || '',
      filters: initialFilters,
    })
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      return
    }
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [initialFocus, initialFilters, scopeLabel])

  useEffect(() => {
    if (initialFocus === 'auth') {
      setShowAuth(true)
      return
    }

    const targetRef =
      initialFocus === 'activity' ? activityRef
      : initialFocus === 'billing' ? billingRef
      : initialFocus === 'audit' ? auditRef
      : initialFocus === 'requests' ? requestsRef
      : overviewRef

    targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [initialFocus])

  return (
    <div className="flex flex-col h-full bg-black/20 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white/80">AgentCraftworks Hub</span>
          <span className="text-xs text-white/30">{enterprise} Enterprise</span>
          {scopeLabel && <span className="text-xs text-blue-300/80">Scope: {scopeLabel}</span>}
        </div>
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-white/50 hover:text-white/80 transition-colors"
              title="Return to main view"
            >
              Back to Main
            </button>
          )}
          {actionRequests.filter((r) => r.state === 'pending').length > 0 && (
            <button
              onClick={() => requestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="flex items-center gap-1 text-[10px] bg-yellow-500/15 text-yellow-300 rounded-full px-2 py-0.5 hover:bg-yellow-500/25 transition-colors"
              title="Scroll to pending action requests"
            >
              <ShieldAlert size={10} />
              {actionRequests.filter((r) => r.state === 'pending').length} pending
            </button>
          )}
          {lastUpdated && (
            <span className="text-[10px] text-white/30">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => setShowAuth(s => !s)}
            className={`flex items-center gap-1.5 text-xs transition-colors ${showAuth ? 'text-blue-400' : 'text-white/40 hover:text-white/70'}`}
            title="Configure GitHub token"
          >
            <Settings size={12} />
            Auth
          </button>
          <button
            onClick={() => { void handleCopyShareLink() }}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
            title="Copy deep-link"
          >
            {shareCopied ? 'Copied' : 'Share'}
          </button>
          <button
            onClick={refreshAll}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
          >
            {loading
              ? <Loader size={12} className="animate-spin" />
              : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Dashboard grid */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-6xl mx-auto">

          {/* Auth settings panel — shown when settings gear is clicked */}
          {showAuth && (
            <div className="xl:col-span-2">
              <TokenAuthPanel onSaved={() => setShowAuth(false)} />
            </div>
          )}

          {/* Rate Limit — always full width on smaller, left col on xl */}
          <div ref={overviewRef} className="xl:col-span-1">
            <RateLimitPanel
              data={snapshot?.rateLimit ?? null}
              history={history}
              onRefresh={refreshAll}
            />
          </div>

          {/* Token Activity */}
          <div ref={activityRef} className="xl:col-span-1">
            <TokenActivityPanel
              topCallers={snapshot?.topCallers ?? []}
              error={snapshot?.auditLogError}
            />
          </div>

          {/* Actions Minutes */}
          <div className="xl:col-span-1">
            <ActionsMinutesPanel data={snapshot?.billing ?? null} />
          </div>

          {/* Copilot Usage */}
          <div className="xl:col-span-1">
            <CopilotUsagePanel data={snapshot?.copilot ?? null} />
          </div>

          {/* Workflow Health */}
          <div className="xl:col-span-2">
            <WorkflowHealthPanel
              entries={operationLog}
              actionRequests={actionRequests}
              lastUpdated={lastUpdated}
              onRefresh={refreshAll}
            />
          </div>

          {/* Billing — spans full width */}
          <div ref={billingRef} className="xl:col-span-2">
            <BillingPanel
              billing={snapshot?.billing ?? null}
              copilot={snapshot?.copilot ?? null}
            />
          </div>

          {/* Operation Log */}
          <div ref={auditRef} className="xl:col-span-2">
            <OperationLogPanel
              entries={operationLog}
              loading={operationLogLoading}
              onRefresh={refreshOperationLog}
            />
          </div>

          {/* Action Request Queue */}
          <div ref={requestsRef} className="xl:col-span-2">
            <ActionRequestPanel
              requests={actionRequests}
              canApprove={authority?.capabilities.includes('approve_action') ?? false}
              loading={actionRequestsLoading}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
