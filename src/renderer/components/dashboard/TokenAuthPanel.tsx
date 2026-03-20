// TokenAuthPanel.tsx — Secure GitHub sign-in for enterprise dashboard access.
import { useState, useEffect } from 'react'
import { Key, CheckCircle, AlertCircle, LogIn, RefreshCw, LogOut, Trash2 } from 'lucide-react'

interface TokenConfig {
  hasToken: boolean
  enterprise: string
  isGhCli: boolean
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
  { scope: 'read:org', panel: 'Org membership', required: false },
  { scope: 'repo', panel: 'Repository access', required: false },
]

export function TokenAuthPanel({ onSaved }: Props) {
  const [config, setConfig] = useState<TokenConfig | null>(null)
  const [enterprise, setEnterprise] = useState('AICraftworks')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadConfig() {
    const cfg = await window.hubAPI.getTokenConfig()
    setConfig(cfg)
    setEnterprise(cfg.enterprise)
  }

  useEffect(() => {
    void loadConfig()
  }, [])

  async function handleBeginLogin() {
    setSaving(true)
    setMessage(null)
    const result = await window.hubAPI.beginGitHubLogin({ enterprise: enterprise.trim() })
    setSaving(false)

    if (result.ok) {
      setMessage({ type: 'success', text: result.message ?? 'GitHub login started.' })
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Unable to start GitHub login' })
    }
  }

  async function handleVerifyLogin() {
    setSaving(true)
    setMessage(null)
    const result = await window.hubAPI.completeGitHubLogin({ enterprise: enterprise.trim() })
    setSaving(false)

    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'GitHub sign-in verification failed.' })
      return
    }

    if ((result.missingScopes?.length ?? 0) > 0) {
      setMessage({
        type: 'error',
        text: `Signed in, but missing scopes: ${result.missingScopes?.join(', ')}. Re-run sign-in and grant all required scopes.`,
      })
    } else {
      setMessage({ type: 'success', text: 'GitHub sign-in verified. Enterprise panels are unlocked.' })
    }

    await loadConfig()
    onSaved?.()
  }

  async function handleLogout() {
    const result = await window.hubAPI.logoutGitHub()
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error ?? 'Failed to log out from GitHub.' })
      return
    }
    await loadConfig()
    setMessage({ type: 'success', text: 'Logged out from GitHub CLI for dashboard access.' })
  }

  async function handleDisablePat() {
    await window.hubAPI.clearToken()
    await loadConfig()
    setMessage({ type: 'success', text: 'Legacy PAT removed. Dashboard now uses GitHub sign-in only.' })
  }

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
        <Key size={14} />
        GitHub Authentication
      </div>

      {/* Current status */}
      {config && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${config.ghAuthenticated && config.missingScopes.length === 0 ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
          {config.ghAuthenticated && config.missingScopes.length === 0
            ? <><CheckCircle size={12} /> Signed in with GitHub — all required scopes granted</>
            : config.ghAuthenticated
              ? <><AlertCircle size={12} /> Signed in, but missing required scopes</>
              : <><AlertCircle size={12} /> Not signed in to GitHub yet</>
          }
          {config.hasToken && (
            <button
              onClick={handleDisablePat}
              className="ml-auto text-white/30 hover:text-red-400 transition-colors"
              title="Remove legacy PAT"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}

      {/* Required scopes callout */}
      <div className="text-xs text-white/40 space-y-1.5">
        <div className="text-white/60 font-medium">Required GitHub scopes to unlock all panels:</div>
        {REQUIRED_SCOPES.map(({ scope, panel, required }) => (
          <div key={scope} className="flex items-center gap-2">
            <code className="bg-white/5 px-1.5 py-0.5 rounded text-purple-300 font-mono">{scope}</code>
            <span className="text-white/30">→ {panel}</span>
            {required && <span className="text-amber-500 text-[10px]">required</span>}
          </div>
        ))}
        <div className="text-white/30 pt-1">
          Sign-in is browser-based via GitHub CLI (`gh auth login --web`) and does not require pasting PATs.
        </div>
        {config?.ghAuthenticated && config.ghScopes.length > 0 && (
          <div className="pt-1">
            <div className="text-white/50 mb-1">Detected scopes:</div>
            <div className="flex flex-wrap gap-1">
              {config.ghScopes.map((scope) => (
                <code key={scope} className="bg-white/5 px-1.5 py-0.5 rounded text-[10px] text-blue-300 font-mono">{scope}</code>
              ))}
            </div>
          </div>
        )}
        {config?.hasToken && (
          <div className="text-amber-400 pt-1">
            Legacy PAT is still stored. Click the trash icon in status to disable PAT mode.
          </div>
        )}
        {config?.missingScopes && config.missingScopes.length > 0 && (
          <div className="text-amber-400 pt-1">
            Missing scopes: {config.missingScopes.join(', ')}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Enterprise slug</label>
          <input
            type="text"
            value={enterprise}
            onChange={e => setEnterprise(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/50"
            placeholder="AICraftworks"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          onClick={handleBeginLogin}
          disabled={saving}
          className="py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white flex items-center justify-center gap-1.5"
        >
          <LogIn size={12} /> Sign in with GitHub
        </button>
        <button
          onClick={handleVerifyLogin}
          disabled={saving}
          className="py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white flex items-center justify-center gap-1.5"
        >
          <RefreshCw size={12} /> Verify Login
        </button>
        <button
          onClick={handleLogout}
          disabled={saving}
          className="py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white flex items-center justify-center gap-1.5"
        >
          <LogOut size={12} /> Sign Out
        </button>
      </div>

      {/* Feedback */}
      {message && (
        <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {message.type === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
          {message.text}
        </div>
      )}
    </div>
  )
}
