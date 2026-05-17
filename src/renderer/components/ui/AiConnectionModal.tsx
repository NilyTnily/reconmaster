import React, { useState, useEffect } from 'react'
import { X, Zap, Check, RefreshCw, Eye, EyeOff, Cpu } from 'lucide-react'
import { useAiStore } from '../../store/aiStore'
import { ProviderDef } from '../../types'

const PROVIDER_ICONS: Record<string, string> = {
  claude: '🟠', openai: '🟢', grok: '⚡', deepseek: '🔵', openrouter: '🌐',
  groq: '⚡', mistral: '🌊', together: '🤝', perplexity: '🔮',
  gemini: '💎', ollama: '🦙', lmstudio: '🏠', custom: '⚙️',
}

const KEY_PATTERNS: Record<string, { re: RegExp; hint: string }> = {
  claude:     { re: /^sk-ant-/, hint: 'Claude keys start with sk-ant-' },
  openai:     { re: /^sk-/,     hint: 'OpenAI keys start with sk-' },
  grok:       { re: /^xai-/,    hint: 'Grok keys start with xai-' },
  deepseek:   { re: /^sk-/,     hint: 'DeepSeek keys start with sk-' },
  groq:       { re: /^gsk_/,    hint: 'Groq keys start with gsk_' },
  perplexity: { re: /^pplx-/,   hint: 'Perplexity keys start with pplx-' },
}

export default function AiConnectionModal() {
  const { providerDefs, savedProviders, activeProviderId, fetchingModels, availableModels,
    setConnectionModalOpen, setSavedProviders, setActiveProvider, setAvailableModels, setFetchingModels } = useAiStore()

  const [selectedDef, setSelectedDef] = useState<ProviderDef | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'connect' | 'manage'>('connect')

  // Pre-fill from existing active provider
  useEffect(() => {
    const active = savedProviders.find(p => p.id === activeProviderId)
    if (active && providerDefs.length) {
      const def = providerDefs.find(d => d.id === active.providerId)
      if (def) {
        setSelectedDef(def)
        setApiKey(active.apiKey || '')
        setBaseUrl(active.baseUrl || def.defaultBaseUrl)
        setModel(active.model)
      }
    } else if (providerDefs.length && !selectedDef) {
      const def = providerDefs.find(d => d.id === 'claude') || providerDefs[0]
      setSelectedDef(def)
      setBaseUrl(def.defaultBaseUrl)
    }
  }, [providerDefs, savedProviders, activeProviderId])

  const handleSelectProvider = (def: ProviderDef) => {
    setSelectedDef(def)
    setBaseUrl(def.defaultBaseUrl)
    setApiKey('')
    setModel('')
    setAvailableModels(def.staticModels)
    setError('')
  }

  const handleFetchModels = async () => {
    if (!selectedDef) return
    setFetchingModels(true)
    setError('')
    try {
      const res = await window.electron.agentFetchModels({
        providerId: selectedDef.id,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
      })
      if (res.models?.length) {
        setAvailableModels(res.models)
        if (!model) setModel(res.models[0])
      } else {
        setAvailableModels(selectedDef.staticModels)
        setError('Could not fetch models — showing defaults.')
      }
    } catch {
      setAvailableModels(selectedDef.staticModels)
      setError('Fetch failed — showing defaults.')
    }
    setFetchingModels(false)
  }

  const handleConnect = async () => {
    if (!selectedDef) return
    if (selectedDef.authType !== 'none' && !apiKey.trim()) { setError('API key required'); return }
    const keyRule = KEY_PATTERNS[selectedDef.id]
    if (keyRule && apiKey.trim() && !keyRule.re.test(apiKey.trim())) {
      setError(`Invalid key format — ${keyRule.hint}`)
      return
    }
    if (!model) { setError('Select a model'); return }
    setSaving(true)
    setError('')
    try {
      const id = `${selectedDef.id}-${Date.now()}`
      await window.electron.agentConnect({
        id, providerId: selectedDef.id,
        label: selectedDef.name,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || selectedDef.defaultBaseUrl || undefined,
        model,
      })
      const state = await window.electron.agentGetState()
      setSavedProviders(state.providers, state.activeId)
      setActiveProvider(id)
      setSaved(true)
      setTimeout(() => { setSaved(false); setConnectionModalOpen(false) }, 1200)
    } catch (e) { setError(String(e)) }
    setSaving(false)
  }

  const handleDisconnect = async (id: string) => {
    await window.electron.agentDisconnect(id)
    const state = await window.electron.agentGetState()
    setSavedProviders(state.providers, state.activeId)
  }

  const handleSetActive = async (id: string) => {
    await window.electron.agentSetActive(id)
    const state = await window.electron.agentGetState()
    setSavedProviders(state.providers, state.activeId)
  }

  const models = availableModels.length ? availableModels : (selectedDef?.staticModels || [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setConnectionModalOpen(false) }}
    >
      <div
        className="w-[560px] max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <Cpu size={16} style={{ color: 'var(--accent)' }} />
          <span className="font-semibold">AI Connection</span>
          <div className="ml-auto flex items-center gap-2">
            {savedProviders.length > 0 && (
              <>
                <button onClick={() => setTab('connect')} className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ color: tab === 'connect' ? 'var(--accent)' : 'var(--text-secondary)', background: tab === 'connect' ? 'rgba(0,212,255,0.1)' : 'transparent' }}>
                  Connect
                </button>
                <button onClick={() => setTab('manage')} className="text-xs px-2 py-1 rounded transition-colors"
                  style={{ color: tab === 'manage' ? 'var(--accent)' : 'var(--text-secondary)', background: tab === 'manage' ? 'rgba(0,212,255,0.1)' : 'transparent' }}>
                  Manage ({savedProviders.length})
                </button>
              </>
            )}
            <button onClick={() => setConnectionModalOpen(false)} style={{ color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'connect' ? (
            <div className="p-5 space-y-5">
              {/* Provider grid */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Choose Provider
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {providerDefs.map(def => (
                    <button
                      key={def.id}
                      onClick={() => handleSelectProvider(def)}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg text-xs transition-colors"
                      style={{
                        background: selectedDef?.id === def.id ? 'rgba(0,212,255,0.12)' : 'var(--bg-secondary)',
                        border: `1px solid ${selectedDef?.id === def.id ? 'rgba(0,212,255,0.4)' : 'var(--border)'}`,
                        color: selectedDef?.id === def.id ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                    >
                      <span className="text-lg">{PROVIDER_ICONS[def.id] || '🤖'}</span>
                      <span className="text-center leading-tight" style={{ fontSize: 10 }}>{def.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedDef && (
                <>
                  {/* API Key */}
                  {selectedDef.authType !== 'none' && (
                    <div>
                      <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={e => setApiKey(e.target.value)}
                          placeholder={selectedDef.authType === 'x-api-key' ? 'sk-ant-...' : 'sk-...'}
                          className="w-full px-3 py-2 rounded-lg text-xs outline-none font-mono"
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', paddingRight: 36 }}
                        />
                        <button onClick={() => setShowKey(s => !s)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2"
                          style={{ color: 'var(--text-secondary)' }}>
                          {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Base URL (for local providers or custom) */}
                  {selectedDef.needsBaseUrl && (
                    <div>
                      <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Base URL
                      </label>
                      <input
                        type="text"
                        value={baseUrl}
                        onChange={e => setBaseUrl(e.target.value)}
                        placeholder={selectedDef.defaultBaseUrl || 'http://localhost:11434'}
                        className="w-full px-3 py-2 rounded-lg text-xs outline-none font-mono"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  )}

                  {/* Model selector */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Model</label>
                      <button
                        onClick={handleFetchModels}
                        disabled={fetchingModels}
                        className="flex items-center gap-1 text-xs transition-colors"
                        style={{ color: 'var(--accent)' }}
                      >
                        <RefreshCw size={10} className={fetchingModels ? 'animate-spin' : ''} />
                        Fetch models
                      </button>
                    </div>
                    {models.length > 0 ? (
                      <select
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      >
                        {!model && <option value="">— select model —</option>}
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        Click "Fetch models" above
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>
                  )}

                  <button
                    onClick={handleConnect}
                    disabled={saving || saved}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      background: saved ? 'rgba(34,197,94,0.15)' : 'rgba(0,212,255,0.12)',
                      color: saved ? '#22c55e' : 'var(--accent)',
                      border: `1px solid ${saved ? 'rgba(34,197,94,0.4)' : 'rgba(0,212,255,0.3)'}`,
                    }}
                  >
                    {saved ? <><Check size={14} /> Connected!</> : saving ? 'Connecting...' : <><Zap size={14} /> Connect</>}
                  </button>
                </>
              )}
            </div>
          ) : (
            // Manage tab
            <div className="p-5 space-y-2">
              {savedProviders.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: 'var(--bg-secondary)', border: `1px solid ${p.id === activeProviderId ? 'rgba(0,212,255,0.3)' : 'var(--border)'}` }}>
                  <span className="text-lg">{PROVIDER_ICONS[p.providerId] || '🤖'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{p.label}</div>
                    <div className="text-xs truncate font-mono" style={{ color: 'var(--text-secondary)' }}>{p.model}</div>
                  </div>
                  {p.id === activeProviderId && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent)' }}>Active</span>
                  )}
                  {p.id !== activeProviderId && (
                    <button onClick={() => handleSetActive(p.id)} className="text-xs px-2 py-0.5 rounded transition-colors"
                      style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                      Set active
                    </button>
                  )}
                  <button onClick={() => handleDisconnect(p.id)} style={{ color: '#ef4444' }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
