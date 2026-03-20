// TokenAuthPanel.tsx — GitHub PAT configuration for enterprise admin access
// Allows user to paste a PAT with the required scopes; stored securely via keytar.
import { useState, useEffect } from 'react'
import { Key, CheckCircle, AlertCircle, Eye, EyeOff, Trash2 } from 'lucide-react'

interface TokenConfig {
  hasToken: boolean
  enterprise: string
  isGhCli: boolean
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
  const [token, setToken] = useState('')
  const [enterprise, setEnterprise] = useState('AICraftworks')
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    window.hubAPI.getTokenConfig().then((cfg) => {
      setConfig(cfg)
      setEnterprise(cfg.enterprise)
    })
  }, [])

  async function handleSave() {
    if (!token.trim()) return
    setSaving(true)
    setMessage(null)
    const result = await window.hubAPI.setToken({ token: token.trim(), enterprise: enterprise.trim() })
    setSaving(false)
    if (result.ok) {
      setToken('')
      setMessage({ type: 'success', text: 'Token saved and applied. Enterprise panels are now unlocking…' })
      const cfg = await window.hubAPI.getTokenConfig()
      setConfig(cfg)
      onSaved?.()
    } else {
      setMessage({ type: 'error', text: result.error ?? 'Failed to save token' })
    }
  }

  async function handleClear() {
    await window.hubAPI.clearToken()
    const cfg = await window.hubAPI.getTokenConfig()
    setConfig(cfg)
    setMessage({ type: 'success', text: 'Token cleared. Using gh CLI token.' })
  }

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
        <Key size={14} />
        GitHub Authentication
      </div>

      {/* Current status */}
      {config && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${config.hasToken ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
          {config.hasToken
            ? <><CheckCircle size={12} /> Enterprise PAT configured — {config.enterprise}</>
            : <><AlertCircle size={12} /> Using gh CLI token (limited scope — enterprise panels locked)</>
          }
          {config.hasToken && (
            <button
              onClick={handleClear}
              className="ml-auto text-white/30 hover:text-red-400 transition-colors"
              title="Remove saved token"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}

      {/* Required scopes callout */}
      <div className="text-xs text-white/40 space-y-1.5">
        <div className="text-white/60 font-medium">Required PAT scopes to unlock all panels:</div>
        {REQUIRED_SCOPES.map(({ scope, panel, required }) => (
          <div key={scope} className="flex items-center gap-2">
            <code className="bg-white/5 px-1.5 py-0.5 rounded text-purple-300 font-mono">{scope}</code>
            <span className="text-white/30">→ {panel}</span>
            {required && <span className="text-amber-500 text-[10px]">required</span>}
          </div>
        ))}
        <div className="text-white/30 pt-1">
          Create at: <a
            href="https://github.com/settings/tokens"
            className="text-blue-400 underline cursor-pointer"
            onClick={(e) => { e.preventDefault(); window.open?.('https://github.com/settings/tokens') }}
          >
            github.com/settings/tokens
          </a> (classic token, not fine-grained)
        </div>
      </div>

      {/* Form */}
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
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">GitHub Personal Access Token (classic)</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 pr-9 text-sm text-white/80 font-mono focus:outline-none focus:border-blue-500/50"
              placeholder="ghp_…"
            />
            <button
              onClick={() => setShowToken(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!token.trim() || saving}
          className="w-full py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white"
        >
          {saving ? 'Saving…' : 'Save & Apply Token'}
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
