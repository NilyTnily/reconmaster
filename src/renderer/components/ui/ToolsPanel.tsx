import React, { useEffect, useState, useCallback } from 'react'
import { Wrench, CheckCircle, XCircle, RefreshCw, ToggleLeft, ToggleRight, Download, Trash2 } from 'lucide-react'
import { ToolStatus } from '../../types'

type ActionStatus = { ok: boolean; msg: string }

export default function ToolsPanel() {
  const [tools, setTools] = useState<ToolStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<Record<string, ActionStatus>>({})
  const [installingAll, setInstallingAll] = useState(false)
  const [updatingAll, setUpdatingAll] = useState(false)

  const loadTools = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electron?.listTools()
      if (result) setTools(result)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadTools() }, [loadTools])

  // Live progress messages from main process
  useEffect(() => {
    const off = window.electron?.onToolProgress?.((d) => {
      setStatus(prev => ({ ...prev, [d.tool]: { ok: false, msg: d.msg } }))
    })
    return () => off?.()
  }, [])

  const handleToggle = async (name: string, currentEnabled: boolean) => {
    setTools(prev => prev.map(t => t.name === name ? { ...t, enabled: !currentEnabled } : t))
    await window.electron?.toggleTool(name, !currentEnabled)
  }

  const handleDelete = async (name: string) => {
    setBusy(prev => ({ ...prev, [name]: true }))
    setStatus(prev => ({ ...prev, [name]: { ok: false, msg: 'Deleting...' } }))
    try {
      const result = await window.electron?.deleteTool(name)
      setStatus(prev => ({
        ...prev,
        [name]: { ok: result.success, msg: result.success ? 'Deleted' : (result.error?.slice(0, 60) || 'Failed') },
      }))
      if (result.success) await loadTools()
    } catch (err) {
      setStatus(prev => ({ ...prev, [name]: { ok: false, msg: String(err).slice(0, 60) } }))
    }
    setBusy(prev => ({ ...prev, [name]: false }))
  }

  const runAction = async (name: string, label: string) => {
    setBusy(prev => ({ ...prev, [name]: true }))
    setStatus(prev => ({ ...prev, [name]: { ok: false, msg: `Starting ${label.toLowerCase()}...` } }))
    try {
      const result = await window.electron?.updateTool(name)
      setStatus(prev => ({
        ...prev,
        [name]: { ok: result.success, msg: result.success ? `${label}ed!` : (result.error?.slice(0, 60) || 'Failed') },
      }))
      if (result.success) await loadTools()
    } catch (err) {
      setStatus(prev => ({ ...prev, [name]: { ok: false, msg: String(err).slice(0, 60) } }))
    }
    setBusy(prev => ({ ...prev, [name]: false }))
  }

  const handleInstallAll = async () => {
    const missing = tools.filter(t => !t.installed)
    if (!missing.length) return
    setInstallingAll(true)
    for (const tool of missing) await runAction(tool.name, 'Install')
    setInstallingAll(false)
  }

  const handleUpdateAll = async () => {
    const present = tools.filter(t => t.installed)
    if (!present.length) return
    setUpdatingAll(true)
    for (const tool of present) await runAction(tool.name, 'Update')
    setUpdatingAll(false)
  }

  const installed = tools.filter(t => t.installed).length
  const missing = tools.filter(t => !t.installed).length
  const enabled = tools.filter(t => t.enabled).length

  return (
    <div
      className="w-80 shrink-0 flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <Wrench size={15} style={{ color: '#a78bfa' }} />
        <span className="text-sm font-semibold">Tools</span>
        <div className="ml-auto flex items-center gap-1.5">
          {missing > 0 && (
            <button
              onClick={handleInstallAll}
              disabled={installingAll || updatingAll}
              title={`Install ${missing} missing tools`}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: 'rgba(34,197,94,0.1)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.3)',
                opacity: installingAll || updatingAll ? 0.6 : 1,
              }}
            >
              <Download size={11} className={installingAll ? 'animate-pulse' : ''} />
              Install All ({missing})
            </button>
          )}
          {installed > 0 && (
            <button
              onClick={handleUpdateAll}
              disabled={installingAll || updatingAll}
              title={`Update ${installed} installed tools`}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: 'rgba(167,139,250,0.1)',
                color: '#a78bfa',
                border: '1px solid rgba(167,139,250,0.3)',
                opacity: installingAll || updatingAll ? 0.6 : 1,
              }}
            >
              <RefreshCw size={11} className={updatingAll ? 'animate-spin' : ''} />
              Update All
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div
        className="flex items-center gap-4 px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}
      >
        <div className="flex items-center gap-1.5 text-xs">
          <CheckCircle size={12} style={{ color: '#22c55e' }} />
          <span style={{ color: 'var(--text-secondary)' }}>{installed} installed</span>
        </div>
        {missing > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <XCircle size={12} style={{ color: '#ef4444' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{missing} missing</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs">
          <ToggleRight size={12} style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>{enabled} enabled</span>
        </div>
        <div className="ml-auto">
          <button
            onClick={loadTools}
            className="p-1 rounded hover:bg-white/10"
            title="Refresh"
            style={{ color: 'var(--text-secondary)' }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Tool list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="text-center py-8 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Loading tools...
          </div>
        ) : (
          tools.map(tool => {
            const isBusy = busy[tool.name]
            const toolStatus = status[tool.name]
            const actionLabel = tool.installed ? 'Update' : 'Install'
            const busyLabel = tool.installed ? 'Updating...' : 'Installing...'

            return (
              <div
                key={tool.name}
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${!tool.installed ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                  opacity: tool.enabled ? 1 : 0.65,
                }}
              >
                {/* Tool header row */}
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono">{tool.name}</span>
                      {tool.installed ? (
                        <span className="flex items-center gap-0.5 text-xs" style={{ color: '#22c55e' }}>
                          <CheckCircle size={10} />
                          {tool.sizeMB != null ? `${tool.sizeMB}MB` : 'installed'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-xs" style={{ color: '#ef4444' }}>
                          <XCircle size={10} />
                          not installed
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {tool.desc}
                    </div>
                  </div>

                  {/* Enable/Disable toggle — only meaningful when installed */}
                  <button
                    onClick={() => handleToggle(tool.name, tool.enabled)}
                    title={tool.enabled ? 'Disable tool' : 'Enable tool'}
                    className="shrink-0 transition-colors"
                  >
                    {tool.enabled ? (
                      <ToggleRight size={20} style={{ color: tool.installed ? 'var(--accent)' : 'var(--text-secondary)' }} />
                    ) : (
                      <ToggleLeft size={20} style={{ color: 'var(--text-secondary)' }} />
                    )}
                  </button>
                </div>

                {/* Action button + delete + status */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runAction(tool.name, actionLabel)}
                    disabled={isBusy}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
                    style={tool.installed ? {
                      background: 'rgba(167,139,250,0.08)',
                      color: '#a78bfa',
                      border: '1px solid rgba(167,139,250,0.2)',
                      opacity: isBusy ? 0.7 : 1,
                    } : {
                      background: 'rgba(34,197,94,0.1)',
                      color: '#22c55e',
                      border: '1px solid rgba(34,197,94,0.3)',
                      opacity: isBusy ? 0.7 : 1,
                    }}
                  >
                    {tool.installed
                      ? <RefreshCw size={10} className={isBusy ? 'animate-spin' : ''} />
                      : <Download size={10} className={isBusy ? 'animate-pulse' : ''} />
                    }
                    {isBusy ? busyLabel : actionLabel}
                  </button>
                  {tool.installed && (
                    <button
                      onClick={() => handleDelete(tool.name)}
                      disabled={isBusy}
                      title="Delete binary"
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
                      style={{
                        background: 'rgba(239,68,68,0.08)',
                        color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.2)',
                        opacity: isBusy ? 0.7 : 1,
                      }}
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                  {toolStatus && (
                    <span className="text-xs" style={{ color: toolStatus.ok ? '#22c55e' : '#ef4444' }}>
                      {toolStatus.msg.slice(0, 28)}{toolStatus.msg.length > 28 ? '…' : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
