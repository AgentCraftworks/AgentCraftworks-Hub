import { useEffect, useState, useCallback } from 'react'
import { makeStyles } from '@fluentui/react-components'

interface PermissionRequest {
  kind: 'shell' | 'write' | 'mcp' | 'read' | 'url'
  detail: string
  [key: string]: unknown
}

interface PermissionDialogProps {
  sessionId: string | null
}

const LABELS: Record<string, string> = {
  shell: 'Run Shell Command',
  write: 'Write File',
  read: 'Read File',
  mcp: 'MCP Server Call',
  url: 'Fetch URL'
}

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    inset: '0',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dialog: {
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    maxWidth: '448px',
    width: '100%',
    marginLeft: '16px',
    marginRight: '16px',
    backgroundColor: 'var(--bg-secondary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--bg-hover)',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '12px',
    color: 'var(--text-primary)',
  },
  detail: {
    fontSize: '12px',
    marginBottom: '16px',
    color: 'var(--text-secondary)',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  denyBtn: {
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '6px',
    paddingBottom: '6px',
    fontSize: '12px',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: 'var(--bg-hover)',
    color: 'var(--text-secondary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--bg-hover)',
  },
  approveBtn: {
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '6px',
    paddingBottom: '6px',
    fontSize: '12px',
    borderRadius: '4px',
    fontWeight: 500,
    cursor: 'pointer',
    backgroundColor: 'var(--running)',
    color: '#fff',
    borderWidth: 0,
  },
})

export function PermissionDialog({ sessionId }: PermissionDialogProps) {
  const s = useStyles()
  const [request, setRequest] = useState<PermissionRequest | null>(null)

  useEffect(() => {
    if (!sessionId) return
    const unsub = window.tangentAPI.sdk.onPermissionRequest(sessionId, (req: PermissionRequest) => {
      setRequest(req)
    })
    return () => unsub()
  }, [sessionId])

  const handleApprove = useCallback(() => {
    if (sessionId) window.tangentAPI.sdk.approvePermission(sessionId, true)
    setRequest(null)
  }, [sessionId])

  const handleDeny = useCallback(() => {
    if (sessionId) window.tangentAPI.sdk.approvePermission(sessionId, false)
    setRequest(null)
  }, [sessionId])

  if (!request) return null

  return (
    <div className={s.overlay}>
      <div className={s.dialog}>
        <h3 className={s.title}>{LABELS[request.kind] ?? 'Permission Request'}</h3>
        <p className={s.detail}>{request.detail}</p>
        <div className={s.actions}>
          <button type="button" onClick={handleDeny} className={s.denyBtn}>Deny</button>
          <button type="button" onClick={handleApprove} className={s.approveBtn}>Approve</button>
        </div>
      </div>
    </div>
  )
}
