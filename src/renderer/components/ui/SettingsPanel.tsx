import React, { useState, useEffect } from 'react'
import { Settings, Crosshair, Cpu, Zap, Shield, Key } from 'lucide-react'
import { AttackerConfig } from '../../types'
import { useAiStore, getActiveProvider } from '../../store/aiStore'

export default function SettingsPanel() {
  const [resourcePath, setResourcePath] = useState('')
  const [attacker, setAttacker] = useState<AttackerConfig>({
    lhost: '', lport: '4444', c2domain: '', interactshUrl: '', sessionCookie: '', customHeaders: '',
  })
  const [attackerSaved, setAttackerSaved] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [githubTokenSaved, setGithubTokenSaved] = useState(false)
  const aiStore = useAiStore()
  const activeProvider = getActiveProvider(aiStore)
  const { autonomousMode, maxIterations, setAutonomousMode, setMaxIterations } = aiStore
  const [iterSaved, setIterSaved] = useState(false)

  useEffect(() => {
    window.electron?.getResourcePath().then(setResourcePath)
    window.electron?.getGithubToken?.().then((r: { token: string }) => {
      if (r?.token) setGithubToken(r.token)
    }).catch(() => {})
    window.electron?.getAttackerConfig?.().then((cfg) => {
      if (cfg) setAttacker(prev => ({ ...prev, ...cfg }))
    })
    window.electron?.agentGetSettings?.().then((s) => {
      if (s) {
        setAutonomousMode(!!s.autonomousMode)
        setMaxIterations(s.maxIterations || 15)
      }
    }).catch(() => {})
  }, [])

  const handleToggleAutonomous = () => {
    const next = !autonomousMode
    setAutonomousMode(next)
    window.electron?.agentSetSettings?.({ autonomousMode: next })
  }

  const handleSaveIterations = () => {
    window.electron?.agentSetSettings?.({ maxIterations })
    setIterSaved(true)
    setTimeout(() => setIterSaved(false), 1500)
  }

  const saveGithubToken = async () => {
    await window.electron?.setGithubToken?.(githubToken)
    setGithubTokenSaved(true)
    setTimeout(() => setGithubTokenSaved(false), 2000)
  }

  const saveAttackerConfig = async () => {
    await window.electron?.setAttackerConfig?.(attacker)
    setAttackerSaved(true)
    setTimeout(() => setAttackerSaved(false), 2000)
  }

  return (
    <div
      className="w-80 shrink-0 flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <Settings size={15} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-semibold">Settings</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* AI Connection */}
        <Section title="AI Agent">
          <div className="space-y-3">
            {activeProvider ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)' }}>
                  <Zap size={12} style={{ color: 'var(--accent)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: 'var(--accent)' }}>{activeProvider.label}</div>
                    <div className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{activeProvider.model}</div>
                  </div>
                </div>
                <button
                  onClick={() => aiStore.setConnectionModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium w-full justify-center transition-colors"
                  style={{ background: 'rgba(0,212,255,0.08)', color: 'var(--accent)', border: '1px solid rgba(0,212,255,0.2)' }}
                >
                  <Cpu size={12} /> Switch Provider / Model
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Connect Claude, GPT, Grok, DeepSeek, Ollama and 10+ more providers. The agent sees your scan data and can control the browser.
                </p>
                <button
                  onClick={() => aiStore.setConnectionModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium w-full justify-center transition-colors"
                  style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent)', border: '1px solid rgba(0,212,255,0.25)' }}
                >
                  <Cpu size={12} /> AI Connection
                </button>
              </div>
            )}
          </div>
        </Section>

        {/* AI Control */}
        <Section title="AI Control">
          <div className="space-y-3">
            {/* Autonomous mode toggle */}
            <div className="rounded-lg p-3 space-y-2" style={{ background: autonomousMode ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.04)', border: `1px solid ${autonomousMode ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.15)'}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {autonomousMode ? <Zap size={13} style={{ color: '#ef4444' }} /> : <Shield size={13} style={{ color: '#22c55e' }} />}
                  <span className="text-xs font-semibold" style={{ color: autonomousMode ? '#ef4444' : '#22c55e' }}>
                    {autonomousMode ? 'Autonomous Mode' : 'Controlled Mode'}
                  </span>
                </div>
                <button
                  onClick={handleToggleAutonomous}
                  className="relative inline-flex items-center shrink-0 transition-all"
                  style={{ width: 36, height: 20 }}
                  title={autonomousMode ? 'Click to require approval for actions' : 'Click to run without approval prompts'}
                >
                  <span className="sr-only">Toggle autonomous mode</span>
                  <span className="block w-full h-full rounded-full transition-all" style={{ background: autonomousMode ? '#ef4444' : '#374151' }} />
                  <span className="absolute left-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ transform: autonomousMode ? 'translateX(16px)' : 'translateX(0)' }} />
                </button>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {autonomousMode
                  ? 'Agent runs all tools without asking. No approve/deny prompts. Full speed execution.'
                  : 'Agent asks before browser clicks, commands, and nuclei scans. You approve each action.'}
              </p>
            </div>

            {/* Max iterations */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Max iterations per task</label>
                <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>{maxIterations}</span>
              </div>
              <input
                type="range"
                min={3} max={50} step={1}
                value={maxIterations}
                onChange={e => setMaxIterations(Number(e.target.value))}
                onMouseUp={handleSaveIterations}
                onTouchEnd={handleSaveIterations}
                className="w-full"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="flex justify-between mt-0.5" style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
                <span>3 (quick)</span>
                <span>{iterSaved ? '✓ saved' : '50 (deep)'}</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Attacker Config */}
        <Section title="Attacker Setup">
          <div className="space-y-2">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Set once. All weapon commands auto-fill with your values.
            </p>
            {([
              { key: 'lhost', label: 'LHOST (Your IP)', placeholder: '10.10.14.1' },
              { key: 'lport', label: 'LPORT (Listener Port)', placeholder: '4444' },
              { key: 'c2domain', label: 'C2 Domain', placeholder: 'c2.attacker.com' },
              { key: 'interactshUrl', label: 'Interactsh URL', placeholder: 'xxxxx.oast.fun' },
            ] as const).map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                <input
                  type="text"
                  value={attacker[key]}
                  onChange={e => setAttacker(a => ({ ...a, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-2 py-1.5 rounded text-xs outline-none font-mono"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            ))}
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Session Cookie (for auth scans)</label>
              <textarea
                value={attacker.sessionCookie}
                onChange={e => setAttacker(a => ({ ...a, sessionCookie: e.target.value }))}
                placeholder="session=abc123; auth=xyz"
                rows={2}
                className="w-full px-2 py-1.5 rounded text-xs outline-none font-mono resize-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <button
              onClick={saveAttackerConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium w-full justify-center transition-colors"
              style={{ background: attackerSaved ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.08)', color: attackerSaved ? 'var(--success)' : '#ef4444', border: `1px solid ${attackerSaved ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}` }}
            >
              <Crosshair size={12} />
              {attackerSaved ? 'Saved' : 'Save Attacker Config'}
            </button>
          </div>
        </Section>

        {/* GitHub Token */}
        <Section title="Tool Downloads">
          <div className="space-y-2">
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              GitHub token removes the 60 req/hr install rate limit. Create a free token at github.com/settings/tokens (no scopes needed).
            </p>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>GitHub Token (optional)</label>
              <input
                type="password"
                value={githubToken}
                onChange={e => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full px-2 py-1.5 rounded text-xs outline-none font-mono"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <button
              onClick={saveGithubToken}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium w-full justify-center transition-colors"
              style={{
                background: githubTokenSaved ? 'rgba(34,197,94,0.15)' : 'rgba(0,212,255,0.08)',
                color: githubTokenSaved ? 'var(--success)' : 'var(--accent)',
                border: `1px solid ${githubTokenSaved ? 'rgba(34,197,94,0.3)' : 'rgba(0,212,255,0.2)'}`,
              }}
            >
              <Key size={12} />
              {githubTokenSaved ? 'Saved' : 'Save Token'}
            </button>
          </div>
        </Section>

        {/* Binaries */}
        <Section title="Binaries">
          <div className="space-y-2">
            <InfoRow label="Location" value={resourcePath ? `${resourcePath}/binaries` : 'Loading...'} mono />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Place tool binaries (.exe) in this folder. ReconMaster detects them automatically.
            </p>
          </div>
        </Section>

        <Section title="About">
          <div className="space-y-1">
            <InfoRow label="Version" value="1.0.0" />
            <InfoRow label="Engine" value="Electron + React" />
            <InfoRow label="Platform" value={window.electron?.platform || 'unknown'} />
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className={`text-xs break-all ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  )
}
