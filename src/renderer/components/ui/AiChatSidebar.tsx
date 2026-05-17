import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Brain, Send, X, StopCircle, Trash2, Globe, ChevronRight, ChevronLeft, Cpu, Shield, Zap } from 'lucide-react'
import { useAiStore, getActiveProvider } from '../../store/aiStore'
import { useScanStore } from '../../store/scanStore'
import { ScanResult, ChatMessage, ToolTier, WeaponStatus } from '../../types'
import ChatMessageView from './ChatMessage'
import { generateWeaponization } from '../scan/WeaponizationTab'

interface Props {
  activeScan: ScanResult | null
}

function buildAgentHistory(messages: ChatMessage[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const m of messages) {
    if (m.streaming) continue
    if (m.role === 'assistant' && m.toolCalls?.length) {
      const done = m.toolCalls.filter(tc => tc.status === 'done' || tc.status === 'denied')
      if (done.length) {
        out.push({
          role: 'assistant',
          content: m.content,
          toolCalls: done.map(tc => ({ id: tc.id, name: tc.name, args: tc.args })),
        })
        out.push({
          role: 'tool',
          content: '',
          toolResults: done.map(tc => ({
            id: tc.id,
            content: tc.status === 'denied' ? 'User declined this action.' : (tc.result || ''),
          })),
        })
      } else {
        out.push({ role: m.role, content: m.content })
      }
    } else {
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
}

export default function AiChatSidebar({ activeScan }: Props) {
  const { updateScan } = useScanStore()
  const store = useAiStore()
  const {
    isStreaming, browser,
    autonomousMode, maxIterations,
    addUserMessage, startAssistantMessage, appendChunk, finalizeMessage,
    addToolCall, updateToolCall, setStreaming, setBrowserSession,
    setConnectionModalOpen, clearChat, setChatHistory,
    setAutonomousMode, setMaxIterations,
  } = store

  const activeProvider = getActiveProvider(store)
  const chatId = activeScan?.id || 'global'
  const messages = store.getHistory(chatId)
  const weaponList = useMemo(() => activeScan ? generateWeaponization(activeScan) : [], [activeScan])

  const [input, setInput] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [width] = useState(340)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const streamingMsgRef = useRef<string | null>(null)
  const saveChatTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load agent settings on mount
  useEffect(() => {
    window.electron?.agentGetSettings?.().then((s) => {
      if (s) {
        setAutonomousMode(!!s.autonomousMode)
        setMaxIterations(s.maxIterations || 15)
      }
    }).catch(() => {})
  }, [])

  const handleToggleAutonomous = useCallback(() => {
    const next = !autonomousMode
    setAutonomousMode(next)
    window.electron?.agentSetSettings?.({ autonomousMode: next })
  }, [autonomousMode])

  // Persist chat to disk when messages change
  useEffect(() => {
    const valid = messages.filter(m => m.role && typeof m.content === 'string')
    if (!valid.length) return
    if (saveChatTimer.current) clearTimeout(saveChatTimer.current)
    saveChatTimer.current = setTimeout(() => {
      window.electron?.agentSaveChat?.(chatId, valid)
    }, 800)
  }, [messages, chatId])

  // Load persisted chat on chatId change
  useEffect(() => {
    window.electron?.agentLoadChat?.(chatId).then((msgs) => {
      if (msgs?.length) setChatHistory(chatId, msgs as ChatMessage[])
    }).catch(() => {})
  }, [chatId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isStreaming])

  // Register agent event listeners
  useEffect(() => {
    if (!window.electron?.onAgentChunk) return

    const offChunk = window.electron.onAgentChunk(({ chatId: cid, text }) => {
      if (cid !== chatId || !streamingMsgRef.current) return
      appendChunk(cid, streamingMsgRef.current, text)
    })

    const offToolCall = window.electron.onAgentToolCall((d) => {
      if (d.chatId !== chatId || !streamingMsgRef.current) return
      addToolCall(d.chatId, streamingMsgRef.current, {
        id: d.id, name: d.name, label: d.label, args: d.args, tier: d.tier as ToolTier,
        status: 'running',
      })
    })

    const offToolResult = window.electron.onAgentToolResult((d) => {
      if (d.chatId !== chatId || !streamingMsgRef.current) return
      const r: string = d.result || ''
      const isError = r.startsWith('Tool error:') || r.startsWith('Error:') || r.startsWith('Unknown tool:')
      updateToolCall(d.chatId, streamingMsgRef.current, d.id, {
        result: r,
        status: isError ? 'error' : 'done',
      })
    })

    const offApproval = window.electron.onAgentApprovalRequired((d) => {
      if (d.chatId !== chatId || !streamingMsgRef.current) return
      updateToolCall(d.chatId, streamingMsgRef.current, d.id, { status: 'waiting-approval' })
    })

    const offBrowser = window.electron.onAgentBrowserUpdate((d) => {
      if (d.chatId !== chatId) return
      if (d.url) setBrowserSession({ active: true, url: d.url, screenshotB64: d.screenshotB64 })
    })

    const offDone = window.electron.onAgentDone(({ chatId: cid }) => {
      if (cid !== chatId) return
      if (streamingMsgRef.current) {
        finalizeMessage(cid, streamingMsgRef.current)
        streamingMsgRef.current = null
      }
      setStreaming(false)
    })

    const offError = window.electron.onAgentError(({ chatId: cid, error }) => {
      if (cid !== chatId) return
      if (streamingMsgRef.current) {
        appendChunk(cid, streamingMsgRef.current, `\n\n⚠ Error: ${error}`)
        finalizeMessage(cid, streamingMsgRef.current)
        streamingMsgRef.current = null
      }
      setStreaming(false)
    })

    const offWeaponStatus = window.electron.onAgentWeaponStatusUpdate?.((d) => {
      if (d.chatId !== chatId || !activeScan) return
      const current = activeScan.weaponStatuses || {}
      updateScan(activeScan.id, { weaponStatuses: { ...current, [d.weaponId]: d.status as WeaponStatus } })
    }) ?? (() => {})

    return () => { offChunk(); offToolCall(); offToolResult(); offApproval(); offBrowser(); offDone(); offError(); offWeaponStatus() }
  }, [chatId, activeScan])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    if (!activeProvider) { setConnectionModalOpen(true); return }

    setInput('')
    addUserMessage(chatId, text)
    const msgId = startAssistantMessage(chatId)
    streamingMsgRef.current = msgId
    setStreaming(true, msgId)

    const history = buildAgentHistory(store.getHistory(chatId).slice(0, -1))

    try {
      await window.electron.agentChat({
        chatId,
        history: [...history, { role: 'user', content: text }],
        scanData: activeScan || null,
        weaponList,
      })
    } catch (err) {
      if (streamingMsgRef.current) {
        appendChunk(chatId, streamingMsgRef.current, `\n\n⚠ Failed to start agent: ${err instanceof Error ? err.message : String(err)}`)
        finalizeMessage(chatId, streamingMsgRef.current)
        streamingMsgRef.current = null
      }
      setStreaming(false)
    }
  }, [input, isStreaming, activeProvider, chatId, activeScan])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleCancel = () => {
    window.electron.agentCancel?.()
    if (streamingMsgRef.current) {
      finalizeMessage(chatId, streamingMsgRef.current)
      streamingMsgRef.current = null
    }
    setStreaming(false)
  }

  const handleApprove = (toolCallId: string) => {
    window.electron.agentApprove?.(toolCallId, true)
    if (streamingMsgRef.current) {
      updateToolCall(chatId, streamingMsgRef.current, toolCallId, { status: 'approved' })
    }
  }

  const handleDeny = (toolCallId: string) => {
    window.electron.agentApprove?.(toolCallId, false)
    if (streamingMsgRef.current) {
      updateToolCall(chatId, streamingMsgRef.current, toolCallId, { status: 'denied' })
    }
  }

  if (collapsed) {
    return (
      <div
        className="shrink-0 flex flex-col items-center py-3 gap-3 cursor-pointer"
        style={{ width: 36, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}
        onClick={() => setCollapsed(false)}
      >
        <Brain size={15} style={{ color: activeProvider ? 'var(--accent)' : 'var(--text-secondary)' }} />
        <ChevronLeft size={12} style={{ color: 'var(--text-secondary)' }} />
        {isStreaming && <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />}
      </div>
    )
  }

  return (
    <div className="shrink-0 flex flex-col overflow-hidden" style={{ width, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <Brain size={13} style={{ color: activeProvider ? 'var(--accent)' : 'var(--text-secondary)' }} />
        <span className="text-xs font-semibold flex-1 truncate">
          {activeProvider ? activeProvider.label : 'AI Agent'}
        </span>
        <div className="flex items-center gap-1">
          {!activeProvider && (
            <button onClick={() => setConnectionModalOpen(true)} className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent)', border: '1px solid rgba(0,212,255,0.2)' }}>
              Connect
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={() => clearChat(chatId)} title="Clear chat" style={{ color: 'var(--text-secondary)' }}>
              <Trash2 size={12} />
            </button>
          )}
          <button onClick={() => setCollapsed(true)} style={{ color: 'var(--text-secondary)' }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Active provider + model + autonomous toggle */}
      {activeProvider && (
        <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
          <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
            {activeProvider.model}
          </span>
          <button
            onClick={handleToggleAutonomous}
            title={autonomousMode ? 'Autonomous mode ON — click to switch to controlled mode' : 'Controlled mode — click to enable autonomous (no prompts)'}
            className="flex items-center gap-1 px-2 py-0.5 rounded font-semibold shrink-0 transition-all"
            style={{
              background: autonomousMode ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.1)',
              color: autonomousMode ? '#ef4444' : '#22c55e',
              border: `1px solid ${autonomousMode ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.25)'}`,
              fontSize: 9,
            }}
          >
            {autonomousMode ? <Zap size={9} /> : <Shield size={9} />}
            {autonomousMode ? 'AUTO' : 'CTRL'}
          </button>
          <input
            type="number"
            value={maxIterations}
            min={1}
            max={50}
            title="Max agent iterations"
            onChange={e => {
              const v = Math.max(1, Math.min(50, parseInt(e.target.value) || 15))
              setMaxIterations(v)
              window.electron?.agentSetSettings?.({ maxIterations: v })
            }}
            style={{
              width: 34, background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 3, color: 'var(--text-secondary)', fontSize: 9,
              textAlign: 'center', padding: '1px 2px', outline: 'none',
            }}
          />
          <button onClick={() => setConnectionModalOpen(true)} style={{ color: 'var(--text-secondary)' }}>
            <Cpu size={11} />
          </button>
        </div>
      )}

      {/* Scan context */}
      {activeScan && (
        <div className="px-3 py-1.5 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,212,255,0.04)' }}>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
            <span className="truncate font-mono">{activeScan.target}</span>
            <span className="ml-auto shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {activeScan.summary.vulnerabilities}v · {activeScan.summary.openPorts}p
            </span>
          </div>
        </div>
      )}

      {/* Browser URL bar + screenshot */}
      {browser.active && browser.url && (
        <div className="shrink-0 px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#3b82f6' }}>
            <Globe size={10} />
            <span className="truncate font-mono flex-1">{browser.url}</span>
            <button
              onClick={() => { window.electron.browserClose?.(); setBrowserSession({ active: false, url: '' }) }}
              style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
            >
              <X size={10} />
            </button>
          </div>
          {browser.screenshotB64 && (
            <img
              src={`data:image/png;base64,${browser.screenshotB64}`}
              alt="Browser preview"
              style={{ width: '100%', marginTop: 6, borderRadius: 4, border: '1px solid rgba(59,130,246,0.25)', display: 'block' }}
            />
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <Brain size={24} style={{ color: 'var(--text-secondary)', margin: '0 auto' }} />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {activeProvider
                ? activeScan ? `Ask me anything about ${activeScan.target}` : 'Ask me anything'
                : 'Connect an AI provider to start'}
            </p>
            {activeProvider && activeScan && (
              <div className="space-y-1 mt-3">
                {[
                  'What are the critical vulnerabilities?',
                  'Propose an exploitation chain for the top findings',
                  'Run nuclei on the target with CVE templates',
                  'Navigate to the login page and read the DOM',
                ].map(s => (
                  <button key={s} onClick={() => setInput(s)}
                    className="block w-full text-xs px-2 py-1.5 rounded text-left"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map(msg => (
          <ChatMessageView key={msg.id} msg={msg} onApprove={handleApprove} onDeny={handleDeny} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeProvider ? 'Message agent… (Enter to send)' : 'Connect a provider first'}
            disabled={!activeProvider}
            rows={2}
            className="flex-1 px-3 py-2 rounded-lg text-xs outline-none resize-none"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              opacity: activeProvider ? 1 : 0.5,
            }}
          />
          {isStreaming ? (
            <button onClick={handleCancel} className="p-2 rounded-lg shrink-0"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              <StopCircle size={15} />
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim() || !activeProvider} className="p-2 rounded-lg shrink-0"
              style={{
                background: input.trim() && activeProvider ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.05)',
                color: input.trim() && activeProvider ? 'var(--accent)' : 'var(--text-secondary)',
                border: `1px solid ${input.trim() && activeProvider ? 'rgba(0,212,255,0.3)' : 'var(--border)'}`,
              }}>
              <Send size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
