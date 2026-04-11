// HubDashboard.tsx — Main dashboard container (Task Manager style)
import { useCallback, useEffect, useRef, useState } from 'react'
import { makeStyles, Spinner } from '@fluentui/react-components'
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
import { RateGovernorPanel } from './RateGovernorPanel'
import { HandoffFlowPanel } from './HandoffFlowPanel'
import { SquadCoordinatorPanel } from './SquadCoordinatorPanel'
import { RefreshCw, Settings, ShieldAlert } from 'lucide-react'
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

export type DashboardFocusSection = 'overview' | 'activity' | 'workflows' | 'billing' | 'auth' | 'audit' | 'requests'

function canApproveRequests(authority: ActionAuthoritySnapshot | null): boolean {
  if (!authority || typeof authority !== 'object') {
    return false
  }

  const value = authority as Record<string, unknown>
  const capabilities = value.capabilities
  if (Array.isArray(capabilities)) {
    return capabilities.includes('approve_action')
  }

  const tier = typeof value.currentTier === 'string' ? value.currentTier : null
  return tier === 'T3' || tier === 'T4' || tier === 'T5'
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: '24px',
    paddingRight: '24px',
    paddingTop: '10px',
    paddingBottom: '10px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.8)',
  },
  headerEnterprise: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.3)',
  },
  headerScope: {
    fontSize: '12px',
    color: 'rgba(147,197,253,0.8)',
  },
  headerBtn: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
    backgroundColor: 'transparent',
    borderWidth: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transitionProperty: 'color',
    transitionDuration: '150ms',
    ':hover': {
      color: 'rgba(255,255,255,0.7)',
    },
  },
  pendingBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
    backgroundColor: 'rgba(234,179,8,0.15)',
    color: 'rgb(253,224,71)',
    borderRadius: '999px',
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '2px',
    paddingBottom: '2px',
    cursor: 'pointer',
    borderWidth: 0,
    transitionProperty: 'background-color',
    transitionDuration: '150ms',
    ':hover': {
      backgroundColor: 'rgba(234,179,8,0.25)',
    },
  },
  timestamp: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.3)',
  },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'rgba(239,68,68,0.2)',
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingTop: '8px',
    paddingBottom: '8px',
    fontSize: '12px',
    color: 'rgb(248,113,113)',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    paddingLeft: '24px',
    paddingRight: '24px',
    paddingTop: '16px',
    paddingBottom: '16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
    maxWidth: '1152px',
    marginLeft: 'auto',
    marginRight: 'auto',
    '@media (min-width: 1280px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  fullWidth: {
    '@media (min-width: 1280px)': {
      gridColumn: 'span 2',
    },
  },
})

export function HubDashboard({ enterprise = 'AICraftWorks', scopeLabel, initialFocus = 'overview', initialFilters, onClose }: Props) {
  const s = useStyles()
  const { snapshot, history, loading, error, lastUpdated, refresh: refreshMonitor } = useHubMonitor(enterprise)
  const [showAuth, setShowAuth] = useState(false)
  const [operationLog, setOperationLog] = useState<OperationLogEntry[]>([])
  const [operationLogLoading, setOperationLogLoading] = useState(false)
  const [actionRequests, setActionRequests] = useState<ActionRequest[]>([])
  const [actionRequestsLoading, setActionRequestsLoading] = useState(false)
  const [authority, setAuthority] = useState<ActionAuthoritySnapshot | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const shareCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overviewRef = useRef<HTMLDivElement | null>(null)
  const activityRef = useRef<HTMLDivElement | null>(null)
  const workflowsRef = useRef<HTMLDivElement | null>(null)
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
        if (initialFilters?.state && request.state !== initialFilters.state) return false
        if (initialFilters?.actor && request.actor !== initialFilters.actor) return false
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
        if (scopeLabel && entry.scope !== scopeLabel) return current
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
    const link = buildDeepLink({ panel: initialFocus, scopeRaw: scopeLabel || '', filters: initialFilters })
    try { await navigator.clipboard.writeText(link) } catch { return }
    setShareCopied(true)
    if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current)
    shareCopiedTimerRef.current = setTimeout(() => setShareCopied(false), 2000)
  }, [initialFocus, initialFilters, scopeLabel])

  useEffect(() => () => {
    if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current)
  }, [])

  useEffect(() => {
    if (initialFocus === 'auth') { setShowAuth(true); return }
    const targetRef =
      initialFocus === 'activity' ? activityRef
      : initialFocus === 'workflows' ? workflowsRef
      : initialFocus === 'billing' ? billingRef
      : initialFocus === 'audit' ? auditRef
      : initialFocus === 'requests' ? requestsRef
      : overviewRef
    targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [initialFocus])

  const pendingCount = actionRequests.filter((r) => r.state === 'pending').length

  return (
    <div className={s.root}>
      {/* Header bar */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.headerTitle}>AgentCraftworks Hub</span>
          <span className={s.headerEnterprise}>{enterprise} Enterprise</span>
          {scopeLabel && <span className={s.headerScope}>Scope: {scopeLabel}</span>}
        </div>
        <div className={s.headerRight}>
          {onClose && (
            <button type="button" onClick={onClose} className={s.headerBtn} title="Return to main view">
              Back to Main
            </button>
          )}
          {pendingCount > 0 && (
            <button type="button" onClick={() => requestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={s.pendingBadge} title="Scroll to pending action requests">
              <ShieldAlert size={10} />
              {pendingCount} pending
            </button>
          )}
          {lastUpdated && (
            <span className={s.timestamp}>Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button
            type="button"
            onClick={() => setShowAuth(prev => !prev)}
            className={s.headerBtn}
            style={{ color: showAuth ? 'rgb(96,165,250)' : undefined }}
            title="Configure GitHub token"
          >
            <Settings size={12} />
            Auth
          </button>
          <button type="button" onClick={handleCopyShareLink} className={s.headerBtn} title="Copy deep-link">
            {shareCopied ? 'Copied' : 'Share'}
          </button>
          <button type="button" onClick={refreshAll} disabled={loading} className={s.headerBtn} style={{ opacity: loading ? 0.4 : undefined }}>
            {loading ? <Spinner size="extra-small" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>
      </div>

      {error && <div className={s.errorBanner}>{error}</div>}

      {/* Dashboard grid */}
      <div className={s.scrollArea}>
        <div className={s.grid}>
          {showAuth && (
            <div className={s.fullWidth}>
              <TokenAuthPanel onSaved={() => setShowAuth(false)} />
            </div>
          )}

          <div ref={overviewRef}>
            <RateLimitPanel data={snapshot?.rateLimit ?? null} history={history} onRefresh={refreshAll} />
          </div>

          <div>
            <RateGovernorPanel data={snapshot?.rateGovernor ?? null} onRefresh={refreshAll} />
          </div>

          <div className={s.fullWidth}>
            <HandoffFlowPanel data={snapshot?.handoffs ?? null} onRefresh={refreshAll} />
          </div>

          <div className={s.fullWidth}>
            <SquadCoordinatorPanel data={snapshot?.squadState ?? null} onRefresh={refreshAll} />
          </div>

          <div ref={activityRef}>
            <TokenActivityPanel
              topCallers={snapshot?.topCallers ?? []}
              topCallers1h={snapshot?.topCallers1h ?? []}
              hourlyBuckets={snapshot?.hourlyBuckets ?? []}
              auditScope={snapshot?.auditScope ?? null}
              error={snapshot?.auditLogError}
            />
          </div>

          <div>
            <ActionsMinutesPanel data={snapshot?.billing ?? null} />
          </div>

          <div>
            <CopilotUsagePanel data={snapshot?.copilot ?? null} />
          </div>

          <div ref={workflowsRef} className={s.fullWidth}>
            <WorkflowHealthPanel entries={operationLog} actionRequests={actionRequests} lastUpdated={lastUpdated} onRefresh={refreshAll} />
          </div>

          <div ref={billingRef} className={s.fullWidth}>
            <BillingPanel billing={snapshot?.billing ?? null} copilot={snapshot?.copilot ?? null} />
          </div>

          <div ref={auditRef} className={s.fullWidth}>
            <OperationLogPanel entries={operationLog} loading={operationLogLoading} onRefresh={refreshOperationLog} />
          </div>

          <div ref={requestsRef} className={s.fullWidth}>
            <ActionRequestPanel
              requests={actionRequests}
              canApprove={canApproveRequests(authority)}
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
