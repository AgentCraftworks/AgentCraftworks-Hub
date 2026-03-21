// TokenAuthPanel.tsx — GitHub OAuth-only sign-in for enterprise dashboard access.
// Spawns "gh auth login --web" silently, captures the device code, and shows it
// inline so the user never needs a hidden terminal window.
import { useState, useEffect, useRef } from 'react'
import { CheckCircle, AlertCircle, LogIn, RefreshCw, LogOut, Loader2, Copy, Check } from 'lucide-react'

interface AuthConfig {
  enterprise: string
  ghAuthenticated: boolean
  ghScopes: string[]
  missingScopes: string[]
}

interface Props {
  onSaved?: () => void
}

const REQUIRED_SCOPES = [
  { scope: 'read:audit_log', panel: 'Token Activity', required: true },
  { scope: 'read:enterprise', panel: 'Actions Minutes', required: true },
  { scope: 'manage_billing:copilot', panel: 'Copilot Usage & Billing', required: true },
]

const POLL_INTERVAL_MS = 2500

export function TokenAuthPanel({ onSaved }: Props) {
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [enterprise, setEnterprise] = useState('AICraftWorks')
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [deviceCode, setDeviceCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadConfig() {
    const cfg = await window.hubAPI.getTokenConfig()
    setConfig(cfg)
    setEnterprise(cfg.enterprise)
  }

  useEffect(() => {
    void loadConfig()
    // Listen for device code from main process
    const unsubCode = window.hubAPI.onDeviceCode((code: string) => {
      setDeviceCode(code)
      setCopied(false)
    })
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      unsubCode()
    }
  }, [])

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setPolling(false)
  }

  function startPolling(ent: string) {
    setPolling(true)
    setMessage({ type: 'info', text: 'Paste the code below into your browser and authorize. Waiting…' })

    pollRef.current = setInterval(async () => {
      const status = await window.hubAPI.checkLoginStatus()
      if (!status.authenticated) return

      stopPolling()
      setDeviceCode(null)

      if (status.missingScopes.length > 0) {
        setMessage({
          type: 'error',
          text: `Signed in, but missing: ${status.missingScopes.join(', ')}. Re-authorize and grant all required scopes.`,
        })
      } else {
        // Complete the login — starts the monitor service
        await window.hubAPI.completeGitHubLogin({ enterprise: ent })
        setMessage({ type: 'success', text: 'Signed in with GitHub — enterprise panels are now unlocked.' })
        onSaved?.()
      }
      await loadConfig()
    }, POLL_INTERVAL_MS)
  }

  async function handleSignIn() {
    stopPolling()
    setBusy(true)
    setMessage(null)
    setDeviceCode(null)

    const ent = enterprise.trim() || 'AICraftWorks'
    const result = await window.hubAPI.beginGitHubLogin({ enterprise: ent })
    setBusy(false)

    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Unable to start GitHub login. Is gh CLI installed?' })
      return
    }

    startPolling(ent)
  }

  async function handleVerify() {
    stopPolling()
    setBusy(true)
    setMessage(null)
    const result = await window.hubAPI.completeGitHubLogin({ enterprise: enterprise.trim() })
    setBusy(false)

    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'GitHub sign-in verification failed.' })
      return
    }
    if ((result.missingScopes?.length ?? 0) > 0) {
      setMessage({
        type: 'error',
        text: `Signed in, but missing scopes: ${result.missingScopes?.join(', ')}.`,
      })
    } else {
      setMessage({ type: 'success', text: 'Signed in — enterprise panels unlocked.' })
      onSaved?.()
    }
    await loadConfig()
  }

  async function handleSignOut() {
    stopPolling()
    setBusy(true)
    setMessage(null)
    setDeviceCode(null)
    await window.hubAPI.logoutGitHub()
    setBusy(false)
    await loadConfig()
    setMessage({ type: 'success', text: 'Signed out from GitHub.' })
  }

  const allScopesGranted = config?.ghAuthenticated && config.missingScopes.length === 0

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="opacity-70">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        GitHub Authentication
      </div>

      {/* Status badge */}
      {config && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
          allScopesGranted
            ? 'bg-green-500/10 text-green-400'
            : 'bg-amber-500/10 text-amber-400'
        }`}>
          {allScopesGranted
            ? <><CheckCircle size={12} /> Signed in with GitHub — all enterprise panels unlocked</>
            : config.ghAuthenticated
              ? <><AlertCircle size={12} /> Signed in, but missing required scopes</>
              : <><AlertCircle size={12} /> Not signed in to GitHub</>
          }
        </div>
      )}

      {/* Required scopes */}
      <div className="text-xs text-white/40 space-y-1.5">
        <div className="text-white/60 font-medium">Required scopes to unlock enterprise panels:</div>
        {REQUIRED_SCOPES.map(({ scope, panel }) => {
          const granted = config?.ghScopes.includes(scope)
          return (
            <div key={scope} className="flex items-center gap-2">
              {granted
                ? <CheckCircle size={10} className="text-green-400 shrink-0" />
                : <AlertCircle size={10} className="text-amber-400/60 shrink-0" />
              }
              <code className="bg-white/5 px-1.5 py-0.5 rounded text-purple-300 font-mono">{scope}</code>
              <span className="text-white/30">→ {panel}</span>
            </div>
          )
        })}
        <p className="text-white/25 pt-1">
          Auth uses GitHub CLI (<code className="text-white/40">gh auth login</code>) — no PAT entry required.
          Your browser will open automatically.
        </p>
      </div>

      {/* Enterprise slug */}
      <div>
        <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Enterprise slug</label>
        <input
          type="text"
          value={enterprise}
          onChange={e => setEnterprise(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/50"
          placeholder="AICraftWorks"
        />
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          onClick={handleSignIn}
          disabled={busy || polling}
          className="py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white flex items-center justify-center gap-1.5"
        >
          {polling ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
          {polling ? 'Waiting…' : 'Sign in with GitHub'}
        </button>
        <button
          onClick={handleVerify}
          disabled={busy || polling}
          className="py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white flex items-center justify-center gap-1.5"
        >
          <RefreshCw size={12} /> Verify Login
        </button>
        <button
          onClick={handleSignOut}
          disabled={busy || polling}
          className="py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white flex items-center justify-center gap-1.5"
        >
          <LogOut size={12} /> Sign Out
        </button>
      </div>

      {/* Device code display — shown during OAuth device flow */}
      {deviceCode && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
          <div className="text-xs text-blue-300 font-medium">
            Enter this code on GitHub to authorize:
          </div>
          <div className="flex items-center gap-3">
            <code className="text-2xl font-bold font-mono text-white tracking-[0.2em] select-all">
              {deviceCode}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(deviceCode)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="px-2 py-1 rounded text-xs bg-white/10 hover:bg-white/20 transition-colors text-white/70 flex items-center gap-1"
            >
              {copied ? <><Check size={10} className="text-green-400" /> Copied</> : <><Copy size={10} /> Copy</>}
            </button>
          </div>
          <div className="text-[10px] text-blue-300/60">
            Your browser should open automatically. If not,{' '}
            <button
              onClick={() => window.hubAPI.openDevicePage()}
              className="underline hover:text-blue-300 transition-colors"
            >
              click here to open github.com/login/device
            </button>
          </div>
        </div>
      )}

      {/* Feedback */}
      {message && (
        <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-400'
            : message.type === 'info'
              ? 'bg-blue-500/10 text-blue-300'
              : 'bg-red-500/10 text-red-400'
        }`}>
          {message.type === 'success'
            ? <CheckCircle size={12} />
            : message.type === 'info'
              ? <Loader2 size={12} className="animate-spin" />
              : <AlertCircle size={12} />
          }
          {message.text}
        </div>
      )}
    </div>
  )
}
