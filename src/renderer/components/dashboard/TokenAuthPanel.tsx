// TokenAuthPanel.tsx — GitHub OAuth-only sign-in for enterprise dashboard access.
import { useState, useEffect, useRef } from 'react'
import { CheckCircle, AlertCircle, LogIn, RefreshCw, LogOut, Loader2, Copy, Check } from 'lucide-react'
import * as ps from './panel-styles'

interface AuthConfig {
  enterprise: string; org: string; ghAuthenticated: boolean; ghScopes: string[]; missingScopes: string[]
}

interface Props { onSaved?: () => void }

const REQUIRED_SCOPES = [
  { scope: 'read:audit_log', panel: 'Token Activity', required: true },
  { scope: 'read:enterprise', panel: 'Actions Minutes', required: true },
  { scope: 'manage_billing:copilot', panel: 'Copilot Usage & Billing', required: true },
]

const POLL_INTERVAL_MS = 2500

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', paddingLeft: '12px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px',
  fontSize: '13px', color: 'rgba(255,255,255,0.8)', outline: 'none',
}

const primaryBtn: React.CSSProperties = {
  paddingTop: '6px', paddingBottom: '6px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
  background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background 150ms',
}

const secondaryBtn: React.CSSProperties = {
  ...primaryBtn, background: 'rgba(255,255,255,0.1)', color: '#fff',
}

export function TokenAuthPanel({ onSaved }: Props) {
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [enterprise, setEnterprise] = useState('AICraftworks')
  const [org, setOrg] = useState('AgentCraftworks')
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [deviceCode, setDeviceCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function loadConfig() {
    const cfg = await window.hubAPI.getTokenConfig()
    setConfig(cfg); setEnterprise(cfg.enterprise); setOrg(cfg.org)
  }

  useEffect(() => {
    void loadConfig()
    const unsubCode = window.hubAPI.onDeviceCode((code: string) => { setDeviceCode(code); setCopied(false) })
    return () => { if (pollRef.current) clearTimeout(pollRef.current); unsubCode() }
  }, [])

  function stopPolling() { if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }; setPolling(false) }

  function startPolling(ent: string, orgSlug: string) {
    setPolling(true)
    setMessage({ type: 'info', text: 'Paste the code below into your browser and authorize. Waiting…' })
    async function poll() {
      try {
        const status = await window.hubAPI.checkLoginStatus()
        if (!status.authenticated) { pollRef.current = setTimeout(poll, POLL_INTERVAL_MS); return }
        stopPolling(); setDeviceCode(null)
        if (status.missingScopes.length > 0) { setMessage({ type: 'error', text: `Signed in, but missing: ${status.missingScopes.join(', ')}. Re-authorize and grant all required scopes.` }) }
        else { await window.hubAPI.completeGitHubLogin({ enterprise: ent, org: orgSlug }); setMessage({ type: 'success', text: 'Signed in with GitHub — enterprise panels are now unlocked.' }); onSaved?.() }
        await loadConfig()
      } catch (err) { console.error('[TokenAuthPanel] Poll error:', err); pollRef.current = setTimeout(poll, POLL_INTERVAL_MS) }
    }
    pollRef.current = setTimeout(poll, POLL_INTERVAL_MS)
  }

  async function handleSignIn() {
    stopPolling(); setBusy(true); setMessage(null); setDeviceCode(null)
    const ent = enterprise.trim() || 'AICraftworks'; const orgSlug = org.trim() || 'AgentCraftworks'
    const result = await window.hubAPI.beginGitHubLogin({ enterprise: ent, org: orgSlug })
    setBusy(false)
    if (!result.ok) { setMessage({ type: 'error', text: result.error ?? 'Unable to start GitHub login. Is gh CLI installed?' }); return }
    startPolling(ent, orgSlug)
  }

  async function handleVerify() {
    stopPolling(); setBusy(true); setMessage(null)
    const result = await window.hubAPI.completeGitHubLogin({ enterprise: enterprise.trim(), org: org.trim() })
    setBusy(false)
    if (!result.ok) { setMessage({ type: 'error', text: result.error ?? 'GitHub sign-in verification failed.' }); return }
    if ((result.missingScopes?.length ?? 0) > 0) { setMessage({ type: 'error', text: `Signed in, but missing scopes: ${result.missingScopes?.join(', ')}.` }) }
    else { setMessage({ type: 'success', text: 'Signed in — enterprise panels unlocked.' }); onSaved?.() }
    await loadConfig()
  }

  async function handleSignOut() {
    stopPolling(); setBusy(true); setMessage(null); setDeviceCode(null)
    await window.hubAPI.logoutGitHub(); setBusy(false); await loadConfig()
    setMessage({ type: 'success', text: 'Signed out from GitHub.' })
  }

  const allScopesGranted = config?.ghAuthenticated && config.missingScopes.length === 0

  return (
    <div style={{ ...ps.panelCard, ...ps.stackSm, gap: '16px' }}>
      <div style={ps.panelHeader}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.7 }}>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        GitHub Authentication
      </div>

      {config && (
        <div style={{ ...ps.flexRow, fontSize: '12px', paddingLeft: '12px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', borderRadius: '8px', background: allScopesGranted ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: allScopesGranted ? '#4ade80' : '#fbbf24' }}>
          {allScopesGranted ? <><CheckCircle size={12} /> Signed in with GitHub — all enterprise panels unlocked</> : config.ghAuthenticated ? <><AlertCircle size={12} /> Signed in, but missing required scopes</> : <><AlertCircle size={12} /> Not signed in to GitHub</>}
        </div>
      )}

      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', ...ps.stackSm, gap: '6px' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Required scopes to unlock enterprise panels:</div>
        {REQUIRED_SCOPES.map(({ scope, panel }) => {
          const granted = config?.ghScopes.includes(scope)
          return (
            <div key={scope} style={ps.flexRow}>
              {granted ? <CheckCircle size={10} style={{ color: '#4ade80', flexShrink: 0 }} /> : <AlertCircle size={10} style={{ color: 'rgba(251,191,36,0.6)', flexShrink: 0 }} />}
              <code style={{ background: 'rgba(255,255,255,0.05)', paddingLeft: '6px', paddingRight: '6px', paddingTop: '2px', paddingBottom: '2px', borderRadius: '4px', color: '#c084fc', fontFamily: 'monospace' }}>{scope}</code>
              <span style={ps.textFaint}>→ {panel}</span>
            </div>
          )
        })}
        <p style={{ ...ps.finePrint, paddingTop: '4px' }}>Auth uses GitHub CLI (<code style={ps.textMuted}>gh auth login</code>) — no PAT entry required.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Enterprise slug</label>
          <input type="text" value={enterprise} onChange={e => setEnterprise(e.target.value)} style={inputStyle} placeholder="AICraftworks" />
          <p style={{ ...ps.finePrint, marginTop: '4px' }}>Used for audit log (enterprise API)</p>
        </div>
        <div>
          <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Org slug</label>
          <input type="text" value={org} onChange={e => setOrg(e.target.value)} style={inputStyle} placeholder="AgentCraftworks" />
          <p style={{ ...ps.finePrint, marginTop: '4px' }}>Used for billing &amp; Copilot (org API)</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <button type="button" onClick={handleSignIn} disabled={busy || polling} style={{ ...primaryBtn, opacity: (busy || polling) ? 0.4 : 1 }}>
          {polling ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <LogIn size={12} />}
          {polling ? 'Waiting…' : 'Sign in with GitHub'}
        </button>
        <button type="button" onClick={handleVerify} disabled={busy || polling} style={{ ...secondaryBtn, opacity: (busy || polling) ? 0.4 : 1 }}>
          <RefreshCw size={12} /> Verify Login
        </button>
        <button type="button" onClick={handleSignOut} disabled={busy || polling} style={{ ...secondaryBtn, opacity: (busy || polling) ? 0.4 : 1 }}>
          <LogOut size={12} /> Sign Out
        </button>
      </div>

      {deviceCode && (
        <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', padding: '12px', ...ps.stackSm }}>
          <div style={{ fontSize: '12px', color: '#93c5fd', fontWeight: 500 }}>Enter this code on GitHub to authorize:</div>
          <div style={ps.flexRow}>
            <code style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', color: '#fff', letterSpacing: '0.2em', userSelect: 'all' }}>{deviceCode}</code>
            <button type="button" onClick={() => { navigator.clipboard.writeText(deviceCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={{ ...secondaryBtn, paddingLeft: '8px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px', fontSize: '12px' }}>
              {copied ? <><Check size={10} style={{ color: '#4ade80' }} /> Copied</> : <><Copy size={10} /> Copy</>}
            </button>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(147,197,253,0.6)' }}>
            Your browser should open automatically. If not,{' '}
            <button type="button" onClick={() => window.hubAPI.openDevicePage()} style={{ textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit', fontSize: 'inherit' }}>click here to open github.com/login/device</button>
          </div>
        </div>
      )}

      {message && (
        <div style={{ ...ps.flexRow, fontSize: '12px', paddingLeft: '12px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', borderRadius: '8px', background: message.type === 'success' ? 'rgba(34,197,94,0.1)' : message.type === 'info' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)', color: message.type === 'success' ? '#4ade80' : message.type === 'info' ? '#93c5fd' : '#f87171' }}>
          {message.type === 'success' ? <CheckCircle size={12} /> : message.type === 'info' ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <AlertCircle size={12} />}
          {message.text}
        </div>
      )}
    </div>
  )
}
