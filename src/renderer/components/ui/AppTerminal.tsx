import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, X, Terminal, ChevronDown, ChevronUp, Square } from 'lucide-react'

interface TermTab {
  id: string
  label: string
  lines: string[]
  input: string
  running: boolean
  inputHistory: string[]
  histIdx: number
}

let _counter = 0
const mkTab = (label?: string): TermTab => ({
  id: String(++_counter),
  label: label ?? `bash ${_counter}`,
  lines: [],
  input: '',
  running: false,
  inputHistory: [],
  histIdx: -1,
})

interface Props {
  height: number
  onHeightChange: (h: number) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function AppTerminal({ height, onHeightChange, collapsed, onToggleCollapse }: Props) {
  const [tabs, setTabs] = useState<TermTab[]>(() => [mkTab('bash 1')])
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0]

  // IPC: stream output — auto-creates 'ai' tab when AI routes output to it
  useEffect(() => {
    if (!window.electron?.onTerminalOutput) return
    const off = window.electron.onTerminalOutput(({ tabId, text }) => {
      setTabs(prev => {
        const exists = prev.some(t => t.id === tabId)
        if (!exists) {
          const newTab: TermTab = { id: tabId, label: tabId === 'ai' ? 'AI Shell' : tabId, lines: [text], input: '', running: false, inputHistory: [], histIdx: -1 }
          setActiveId(tabId)
          return [...prev, newTab]
        }
        return prev.map(t => t.id === tabId ? { ...t, lines: [...t.lines, text] } : t)
      })
    })
    return off
  }, [])

  useEffect(() => {
    if (!window.electron?.onTerminalDone) return
    const off = window.electron.onTerminalDone(({ tabId }) => {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, running: false } : t))
    })
    return off
  }, [])

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [activeTab?.lines])

  const runCmd = useCallback(async (tabId: string, cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed) return
    setTabs(prev => prev.map(t => {
      if (t.id !== tabId) return t
      return {
        ...t,
        lines: [...t.lines, `\x00green\x00$ ${trimmed}\n`],
        input: '',
        running: true,
        inputHistory: [trimmed, ...t.inputHistory.slice(0, 49)],
        histIdx: -1,
      }
    }))
    try {
      await window.electron?.terminalRun?.({ tabId, command: trimmed })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTabs(prev => prev.map(t => t.id === tabId ? {
        ...t, running: false, lines: [...t.lines, `\x00red\x00[Error: ${msg}]\n`],
      } : t))
    }
  }, [])

  const killCmd = (tabId: string) => {
    window.electron?.terminalKill?.({ tabId })
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, running: false, lines: [...t.lines, '\x00dim\x00^C\n'] } : t))
  }

  const addTab = () => {
    const t = mkTab()
    setTabs(prev => [...prev, t])
    setActiveId(t.id)
  }

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    killCmd(id)
    const remaining = tabs.filter(t => t.id !== id)
    if (!remaining.length) { const t = mkTab('bash 1'); setTabs([t]); setActiveId(t.id); return }
    setTabs(remaining)
    if (activeId === id) setActiveId(remaining[remaining.length - 1].id)
  }

  // Drag resize
  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: height }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      onHeightChange(Math.max(80, Math.min(560, dragRef.current.startH + delta)))
    }
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Color a line based on sentinel prefix
  const lineColor = (raw: string) => {
    if (raw.startsWith('\x00green\x00')) return { color: '#22c55e', text: raw.slice(8) }
    if (raw.startsWith('\x00red\x00'))   return { color: '#ef4444', text: raw.slice(6) }
    if (raw.startsWith('\x00dim\x00'))   return { color: 'rgba(255,255,255,0.2)', text: raw.slice(6) }
    const lower = raw.toLowerCase()
    if (lower.includes('error') || lower.includes('failed') || lower.includes('fatal'))
      return { color: '#ef4444', text: raw }
    if (lower.includes('warn')) return { color: '#eab308', text: raw }
    if (raw.startsWith('[+]') || raw.startsWith('[*]')) return { color: '#00d4ff', text: raw }
    if (raw.startsWith('[!]')) return { color: '#f97316', text: raw }
    return { color: 'rgba(255,255,255,0.75)', text: raw }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, tab: TermTab) => {
    if (e.key === 'Enter') { runCmd(tab.id, tab.input); return }
    if (e.key === 'c' && e.ctrlKey) { killCmd(tab.id); return }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(tab.histIdx + 1, tab.inputHistory.length - 1)
      setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, histIdx: next, input: t.inputHistory[next] ?? '' } : t))
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.max(tab.histIdx - 1, -1)
      setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, histIdx: next, input: next === -1 ? '' : t.inputHistory[next] } : t))
    }
  }

  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#040609', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        style={{ height: 4, cursor: 'row-resize', flexShrink: 0 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.25)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      />

      {/* Tab strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', height: 30, flexShrink: 0, background: '#05080f' }}>
        <Terminal size={11} style={{ color: '#22c55e', marginRight: 4, flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, overflow: 'hidden' }}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => { setActiveId(tab.id); setTimeout(() => inputRef.current?.focus(), 0) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                background: tab.id === activeId ? 'rgba(255,255,255,0.07)' : 'transparent',
                color: tab.id === activeId ? '#d0d0d0' : 'rgba(255,255,255,0.3)',
                fontSize: 11, fontWeight: tab.id === activeId ? 600 : 400,
              }}
            >
              {tab.running && (
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', flexShrink: 0, animation: 'tabPulse 1s infinite' }} />
              )}
              <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.label}</span>
              <button
                onClick={e => closeTab(tab.id, e)}
                style={{ padding: 1, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', display: 'flex', lineHeight: 1 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)' }}
              >
                <X size={9} />
              </button>
            </div>
          ))}
          <button
            onClick={addTab}
            style={{ padding: '2px 5px', borderRadius: 3, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)' }}
          >
            <Plus size={10} />
          </button>
        </div>
        <button
          onClick={onToggleCollapse}
          style={{ padding: '2px 6px', borderRadius: 3, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)' }}
        >
          {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Output + input */}
      {!collapsed && (
        <div style={{ height: height - 34, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            ref={outputRef}
            onClick={() => inputRef.current?.focus()}
            style={{ flex: 1, overflow: 'auto', padding: '8px 12px', cursor: 'text' }}
          >
            {activeTab.lines.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace', fontSize: 12 }}>
                {activeTab.label} — type a command and press Enter · Ctrl+C to kill · ↑↓ history
              </div>
            )}
            {activeTab.lines.map((raw, i) => {
              const { color, text } = lineColor(raw)
              return (
                <div key={i} style={{ color, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {text}
                </div>
              )
            })}
          </div>

          {/* Input row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <span style={{ color: '#22c55e', fontFamily: 'monospace', fontSize: 12, flexShrink: 0 }}>$</span>
            <input
              ref={inputRef}
              value={activeTab.input}
              onChange={e => setTabs(prev => prev.map(t => t.id === activeId ? { ...t, input: e.target.value } : t))}
              onKeyDown={e => handleKeyDown(e, activeTab)}
              disabled={activeTab.running}
              placeholder={activeTab.running ? 'running… (Ctrl+C to kill)' : 'command…'}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#e0e0e0', fontFamily: 'monospace', fontSize: 12,
                opacity: activeTab.running ? 0.45 : 1,
              }}
            />
            {activeTab.running && (
              <button
                onClick={() => killCmd(activeId)}
                style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', fontSize: 10, fontWeight: 600, flexShrink: 0 }}
              >
                <Square size={8} fill="#ef4444" /> kill
              </button>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes tabPulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
    </div>
  )
}
