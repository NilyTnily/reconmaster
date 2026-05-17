import React, { useState, useEffect, useRef } from 'react'
import {
  Zap, AlertTriangle,
  ChevronDown, ChevronUp, Copy, Check, Download, Brain,
  ArrowRight, Tag, RefreshCw, X, Play,
} from 'lucide-react'
import { ScanResult, WeaponizationItem, WeaponStatus, AttackerConfig, AttackChain } from '../../types'
import ExploitConsole from './ExploitConsole'
import { scoreWeapon, scoreColor } from '../../utils/exploitConfidence'
import { SEV_COLORS, STATUS_CYCLE, STATUS_CFG, CAT_LABELS, CAT_ICONS, PROOF, SOURCES, applyAttackerConfig, getMissionBrief } from './weaponizationData'
export { CAT_LABELS, generateWeaponization, generateAttackChains } from './weaponizationData'

// ג”€ג”€ Main Modal ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

type ModalView = 'brief' | 'chains' | 'weapons' | 'exploit' | 'config'

interface ModalProps {
  isOpen: boolean
  inline?: boolean
  onClose: () => void
  scan: ScanResult
  items: WeaponizationItem[]
  chains: AttackChain[]
  onStatusChange: (weaponId: string, status: WeaponStatus) => void
  onNoteChange: (weaponId: string, note: string) => void
  onExploitResult?: (weaponId: string, confirmed: boolean, evidence: string) => void
}

const W_STYLES = `
  @keyframes wpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.5)}}
  @keyframes wglow{0%,100%{box-shadow:0 0 8px rgba(239,68,68,.25)}50%{box-shadow:0 0 28px rgba(239,68,68,.6),0 0 60px rgba(239,68,68,.15)}}
  @keyframes wslidein{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes wflow{0%{transform:translateX(-3px);opacity:.4}50%{transform:translateX(0);opacity:1}100%{transform:translateX(3px);opacity:.4}}
  .wpulse{animation:wpulse 2s infinite}
  .wglow{animation:wglow 3s infinite}
  .wslide{animation:wslidein .25s ease-out}
  .wflow{animation:wflow 1.4s infinite}
`
if (typeof document !== 'undefined' && !document.getElementById('w-styles')) {
  const s = document.createElement('style'); s.id = 'w-styles'; s.textContent = W_STYLES; document.head.appendChild(s)
}

export default function WeaponizationModal({ isOpen, inline, onClose, scan, items, chains, onStatusChange, onNoteChange, onExploitResult }: ModalProps) {
  const [view, setView] = useState<ModalView>('brief')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterSev, setFilterSev] = useState('all')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [attacker, setAttacker] = useState<AttackerConfig>({ lhost: '', lport: '4444', c2domain: '', interactshUrl: '', sessionCookie: '', customHeaders: '' })

  const [exploitResults, setExploitResults] = useState<Record<string, { confirmed: boolean; evidence: string }>>({})

  const [aiText, setAiText] = useState('')
  const [aiRunning, setAiRunning] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [aiError, setAiError] = useState('')
  const aiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electron?.getAttackerConfig?.().then((cfg) => { if (cfg) setAttacker(prev => ({ ...prev, ...cfg })) })
  }, [])

  useEffect(() => {
    if (aiRef.current) aiRef.current.scrollTop = aiRef.current.scrollHeight
  }, [aiText])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const statuses = scan.weaponStatuses || {}
  const notes = scan.weaponNotes || {}
  const brief = getMissionBrief(scan, items)

  const sevCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const i of items) {
    const s = i.adjustedSeverity || i.severity
    if (s in sevCounts) sevCounts[s]++
  }

  const filteredItems = items.filter(i => {
    if (filterCat !== 'all' && i.category !== filterCat) return false
    if (filterSev !== 'all' && (i.adjustedSeverity || i.severity) !== filterSev) return false
    return true
  })

  const cats = [...new Set(items.map(i => i.category))]

  const handleCopy = (id: string, command: string) => {
    navigator.clipboard.writeText(applyAttackerConfig(command, attacker)).then(() => {
      setCopiedId(id); setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const cycleStatus = (id: string) => {
    const cur = statuses[id] || 'untested'
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length]
    onStatusChange(id, next)
  }

  const startAi = async () => {
    setAiText(''); setAiError(''); setAiRunning(true); setAiDone(false)
    const chatId = `weaponize-${Date.now()}`
    let cleanup: (() => void) | null = null
    const chunkUnsub = window.electron.onAgentChunk((d: { chatId: string; text: string }) => {
      if (d.chatId === chatId) setAiText(t => t + d.text)
    })
    const doneUnsub = window.electron.onAgentDone((d: { chatId: string }) => {
      if (d.chatId === chatId) { setAiRunning(false); setAiDone(true); cleanup?.() }
    })
    const errUnsub = window.electron.onAgentError((d: { chatId: string; error: string }) => {
      if (d.chatId === chatId) { setAiError(d.error); setAiRunning(false); cleanup?.() }
    })
    cleanup = () => { chunkUnsub(); doneUnsub(); errUnsub() }
    const openPorts = scan.ports.filter(p => p.state === 'open').slice(0, 20)
    try {
      const result = await window.electron.agentChat({
        history: [{ role: 'user', content: `You are an expert penetration tester. Perform a deep technical analysis of the following recon data for target: ${scan.target}\n\nProvide:\n1. Top 5 attack vectors prioritized by exploitability ֳ— business impact\n2. CVE-specific exploit chains with metasploit/PoC commands\n3. Non-obvious attack paths (business logic, chaining, post-exploit pivoting)\n4. Custom payloads tailored to the detected tech stack\n5. Full pentest executive summary\n\nScan Summary:\n- Vulnerabilities: ${scan.vulnerabilities.length} (${scan.vulnerabilities.filter(v=>v.severity==='critical').length} critical)\n- Open ports: ${openPorts.map(p=>`${p.port}/${p.protocol} ${p.service||''} ${p.version||''}`).join(', ')}\n- Technologies: ${[...new Set(scan.http.flatMap(h=>h.tech||[]))].slice(0,15).join(', ')}\n- XSS findings: ${scan.xssResults?.length || 0}\n- IDOR findings: ${scan.idorResults?.length || 0}\n- Exposed secrets: ${scan.jsEndpoints.filter(e=>e.type==='secret').length}\n- Emails found: ${scan.osint.filter(o=>o.type==='email').length}\n\nTop vulnerabilities:\n${scan.vulnerabilities.slice(0,10).map(v=>`- ${v.name} (${v.severity}) on ${v.host}: ${v.description||''}`).join('\n')}\n\nWeaponized items: ${items.length} total across ${[...new Set(items.map(i=>i.category))].join(', ')}` }],
        scanData: scan,
        chatId,
      })
      if (result && !result.success) { setAiError(result.error || 'Failed'); setAiRunning(false); cleanup?.() }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err)); setAiRunning(false); cleanup?.()
    }
  }

  const exportSh = () => {
    const lines = ['#!/usr/bin/env bash', `# ReconMaster Weaponization ג€” ${scan.target}`, `# Generated: ${new Date().toISOString()}`, '']
    for (const item of filteredItems) {
      if (!item.command) continue
      lines.push(`# ג”€ג”€ ${item.vulnName} [${(item.adjustedSeverity || item.severity).toUpperCase()}] ג”€ג”€`)
      lines.push(`# Host: ${item.host}`)
      if (item.warning) lines.push(`# WARNING: ${item.warning}`)
      lines.push(applyAttackerConfig(item.command, attacker))
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `exploit_${scan.target}_${Date.now()}.sh`; a.click()
  }

  const exportMsf = () => {
    const lines = [`# Metasploit RC ג€” ${scan.target}`, '']
    for (const item of filteredItems.filter(i => i.command?.includes('msfconsole'))) {
      const cmds = item.command!.split('\n').filter(l => l.includes('use ') || l.includes('set ') || l.includes('run') || l.includes('exploit'))
      if (cmds.length) { lines.push(...cmds.map(l => applyAttackerConfig(l, attacker))); lines.push('') }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `msf_${scan.target}_${Date.now()}.rc`; a.click()
  }

  const S: React.CSSProperties = { boxSizing: 'border-box' }

  const confirmedCount = Object.values(exploitResults).filter(r => r.confirmed).length
  const runnableCount = items.filter(i => scoreWeapon(i, scan).canRun).length

  const NAV_TABS: { id: ModalView; label: string; emoji: string; count?: number }[] = [
    { id: 'brief', label: 'Mission Brief', emoji: 'נ¯' },
    { id: 'chains', label: 'Attack Chains', emoji: 'ג›“ן¸', count: chains.length },
    { id: 'weapons', label: 'Weapons', emoji: 'נ’€', count: items.length },
    { id: 'exploit', label: 'Exploit', emoji: 'נ’¥', count: confirmedCount || runnableCount },
    { id: 'config', label: 'Config & Export', emoji: 'ג™ן¸' },
  ]

  const inner = (
    <div className="wslide" style={{ flex: 1, background: '#05080f', border: inline ? 'none' : '1px solid rgba(239,68,68,0.22)', borderRadius: inline ? 0 : 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#0e0808 0%,#0b0606 50%,#07090f 100%)', borderBottom: '1px solid rgba(239,68,68,0.18)', padding: '14px 20px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} className="wpulse" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', letterSpacing: 2, textTransform: 'uppercase' }}>Weaponization Space</span>
                  {brief.criticalCount > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', letterSpacing: 1 }}>
                      {brief.criticalCount} CRITICAL
                    </span>
                  )}
                  {brief.wafInfo && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}>
                      WAF: {brief.wafInfo}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{scan.target}</span>
                  {' ֲ· '}{items.length} weapons ֲ· {chains.length} chains
                </div>
              </div>
              <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 11 }}>
                <X size={13} /> ESC
              </button>
            </div>

            {/* Nav */}
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              {NAV_TABS.map(tab => (
                <button key={tab.id} onClick={() => setView(tab.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                  background: view === tab.id ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                  color: view === tab.id ? '#ef4444' : 'rgba(255,255,255,0.4)',
                  border: view === tab.id ? '1px solid rgba(239,68,68,0.38)' : '1px solid rgba(255,255,255,0.07)',
                }}>
                  <span>{tab.emoji}</span>
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 999, background: view === tab.id ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)', color: view === tab.id ? '#ef4444' : 'rgba(255,255,255,0.35)' }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>

            {/* ג”€ג”€ MISSION BRIEF ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ */}
            {view === 'brief' && (
              <div className="wslide" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.2)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>נ¯</div>
                    <div style={{ fontSize: 14 }}>No weapons generated yet</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>Weapons appear automatically as scan findings arrive.</div>
                  </div>
                ) : (
                  <>
                    {/* Stats grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                      {[
                        { label: 'Critical', value: brief.criticalCount, color: '#ef4444', pulse: brief.criticalCount > 0 },
                        { label: 'High', value: brief.highCount, color: '#f97316' },
                        { label: 'Attack Chains', value: chains.length, color: '#a78bfa' },
                        { label: 'Exposed Secrets', value: brief.secretCount, color: '#eab308' },
                        { label: 'Emails Found', value: brief.emailCount, color: '#34d399' },
                        { label: 'Danger Ports', value: brief.dangerPorts.length, color: '#ef4444' },
                      ].map(card => (
                        <div key={card.label} style={{ padding: '14px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${card.color}28`, textAlign: 'center', position: 'relative' }}>
                          {card.pulse && card.value > 0 && <div style={{ position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: '50%', background: card.color }} className="wpulse" />}
                          <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Primary vector */}
                    {brief.primaryVector && (
                      <div className="wglow" style={{ padding: 16, borderRadius: 10, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.28)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(239,68,68,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Primary Attack Vector</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.2)', color: '#ef4444', textTransform: 'uppercase' }}>
                            {brief.primaryVector.adjustedSeverity || brief.primaryVector.severity}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{brief.primaryVector.vulnName}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{brief.primaryVector.host}</span>
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 8, lineHeight: 1.6 }}>{brief.primaryVector.description}</p>
                      </div>
                    )}

                    {/* Top critical */}
                    {brief.topCritical.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Top Critical Findings</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {brief.topCritical.map(item => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(239,68,68,0.18)' }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} className="wpulse" />
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', flex: 1 }}>{item.vulnName}</span>
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{item.host.slice(0, 40)}</span>
                              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>
                                {CAT_LABELS[item.category] || item.category}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Danger ports */}
                    {brief.dangerPorts.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Danger Ports Open</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {brief.dangerPorts.map(p => (
                            <div key={`${p.host}:${p.port}`} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', textAlign: 'center' }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{p.port}</div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{p.service || p.protocol}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tech stack */}
                    {brief.techStack.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Tech Stack</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {brief.techStack.map(t => (
                            <span key={t} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ג”€ג”€ ATTACK CHAINS ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ */}
            {view === 'chains' && (
              <div className="wslide" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {chains.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.2)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>ג›“ן¸</div>
                    <div style={{ fontSize: 14 }}>No attack chains identified</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>Chains appear when complementary vulnerabilities are found.</div>
                  </div>
                ) : chains.map((chain, ci) => (
                  <div key={chain.id} className="wglow" style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${SEV_COLORS[chain.severity]}38`, animationDelay: `${ci * 0.15}s` }}>
                    <div style={{ padding: '12px 18px', background: `linear-gradient(90deg,${SEV_COLORS[chain.severity]}12 0%,transparent 100%)`, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 4, background: `${SEV_COLORS[chain.severity]}22`, color: SEV_COLORS[chain.severity], textTransform: 'uppercase', letterSpacing: 1 }}>
                        {chain.severity}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{chain.title}</span>
                    </div>
                    <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                      {chain.steps.map((step, i) => (
                        <React.Fragment key={i}>
                          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minWidth: 130, maxWidth: 200 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Step {i + 1}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{step.label}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.4 }}>{step.action.slice(0, 70)}{step.action.length > 70 ? 'ג€¦' : ''}</div>
                          </div>
                          {i < chain.steps.length - 1 && (
                            <div className="wflow" style={{ color: `${SEV_COLORS[chain.severity]}90`, alignSelf: 'center', flexShrink: 0 }}>
                              <ArrowRight size={16} />
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div style={{ padding: '9px 18px', background: 'rgba(239,68,68,0.05)', borderTop: '1px solid rgba(239,68,68,0.1)' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(239,68,68,0.55)', textTransform: 'uppercase', letterSpacing: 1, marginRight: 8 }}>IMPACT:</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{chain.impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ג”€ג”€ WEAPONS ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ */}
            {view === 'weapons' && (
              <div className="wslide" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                  {Object.entries(sevCounts).filter(([, c]) => c > 0).map(([sev, count]) => (
                    <button key={sev} onClick={() => setFilterSev(filterSev === sev ? 'all' : sev)} style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', textTransform: 'uppercase',
                      background: filterSev === sev ? `${SEV_COLORS[sev]}22` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${filterSev === sev ? SEV_COLORS[sev] : 'rgba(255,255,255,0.08)'}`,
                      color: SEV_COLORS[sev],
                    }}>{count} {sev}</button>
                  ))}
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setFilterCat('all')} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: filterCat === 'all' ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)', color: filterCat === 'all' ? '#00d4ff' : 'rgba(255,255,255,0.35)', border: `1px solid ${filterCat === 'all' ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}` }}>All</button>
                  {cats.map(cat => (
                    <button key={cat} onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: filterCat === cat ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)', color: filterCat === cat ? '#00d4ff' : 'rgba(255,255,255,0.35)', border: `1px solid ${filterCat === cat ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
                      {CAT_LABELS[cat] || cat}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 4 }}>{filteredItems.length} weapon{filteredItems.length !== 1 ? 's' : ''}</div>

                {filteredItems.map(item => {
                  const Icon = CAT_ICONS[item.category] || Zap
                  const isExp = expandedId === item.id
                  const isCopied = copiedId === item.id
                  const dispSev = item.adjustedSeverity || item.severity
                  const status = statuses[item.id] || 'untested'
                  const stCfg = STATUS_CFG[status]
                  const note = notes[item.id] || ''
                  const isCrit = dispSev === 'critical'
                  const proof = PROOF[item.category] || 'Document the vulnerability with screenshots and response body captures.'
                  const sources = SOURCES[item.category] || []
                  const conf = scoreWeapon(item, scan)
                  const exploitResult = exploitResults[item.id]

                  return (
                    <div key={item.id} style={{ borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.025)', border: `1px solid ${exploitResult?.confirmed ? 'rgba(34,197,94,0.4)' : isExp ? SEV_COLORS[dispSev] + '55' : isCrit ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.07)'}`, transition: 'border-color .2s' }}>
                      {/* Card header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer' }} onClick={() => setExpandedId(isExp ? null : item.id)}>
                        {isCrit && !exploitResult?.confirmed && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} className="wpulse" />}
                        {exploitResult?.confirmed && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} className="wpulse" />}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, background: `${SEV_COLORS[dispSev]}18`, flexShrink: 0 }}>
                          <Icon size={13} style={{ color: SEV_COLORS[dispSev] }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{item.vulnName}</span>
                            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: `${SEV_COLORS[dispSev]}18`, color: SEV_COLORS[dispSev], textTransform: 'uppercase' }}>{dispSev}</span>
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>{CAT_LABELS[item.category] || item.category}</span>
                            {exploitResult?.confirmed && (
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.2)', color: '#22c55e', textTransform: 'uppercase' }}>ג“ CONFIRMED</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            {/* Confidence bar */}
                            <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', maxWidth: 100 }}>
                              <div style={{ height: '100%', width: `${conf.score}%`, background: scoreColor(conf.score), borderRadius: 999, transition: 'width .3s' }} />
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, color: scoreColor(conf.score), flexShrink: 0 }}>{conf.score}%</span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.host}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {conf.canRun && (
                            <button
                              onClick={e => { e.stopPropagation(); setView('exploit' as ModalView) }}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 5, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', cursor: 'pointer', letterSpacing: 0.5 }}
                            >
                              <Play size={9} /> RUN
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); cycleStatus(item.id) }} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: stCfg.bg, color: stCfg.color, border: `1px solid ${stCfg.color}40`, cursor: 'pointer' }}>{stCfg.label}</button>
                          {item.command && (
                            <button onClick={e => { e.stopPropagation(); handleCopy(item.id, item.command!) }} style={{ padding: 5, borderRadius: 5, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              {isCopied ? <Check size={12} style={{ color: '#22c55e' }} /> : <Copy size={12} style={{ color: 'rgba(255,255,255,0.45)' }} />}
                            </button>
                          )}
                          {isExp ? <ChevronUp size={13} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                        </div>
                      </div>

                      {/* Expanded body */}
                      {isExp && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: 0 }}>{item.description}</p>

                          {item.warning && (
                            <div style={{ display: 'flex', gap: 8, padding: '9px 12px', borderRadius: 7, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                              <AlertTriangle size={12} style={{ color: '#ef4444', marginTop: 1, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: '#ef4444' }}>{item.warning}</span>
                            </div>
                          )}

                          {item.evidence && (
                            <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)', wordBreak: 'break-all' }}>
                              Evidence: {item.evidence}
                            </div>
                          )}

                          {/* Commands */}
                          {item.command && (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>Commands</span>
                                <button onClick={() => handleCopy(item.id, item.command!)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 10px', borderRadius: 5, background: 'rgba(0,212,255,0.08)', color: isCopied ? '#22c55e' : '#00d4ff', border: 'none', cursor: 'pointer' }}>
                                  {isCopied ? <Check size={11} /> : <Copy size={11} />}{isCopied ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                              <pre style={{ fontSize: 12, padding: 14, borderRadius: 8, background: '#020408', color: '#00ff88', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7, border: '1px solid rgba(0,255,136,0.08)', margin: 0, ...S }}>
                                {applyAttackerConfig(item.command, attacker)}
                              </pre>
                            </div>
                          )}

                          {/* PROOF REQUIRED */}
                          <div style={{ padding: '11px 14px', borderRadius: 8, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.22)' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#eab308', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>ג¡ PROOF REQUIRED</div>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>{proof}</p>
                          </div>

                          {/* Sources */}
                          {sources.length > 0 && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>References</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {sources.map(s => (
                                  <button key={s.url} onClick={() => window.open(s.url, '_blank')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa', cursor: 'pointer' }}>
                                    {s.name} ג†—
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Note */}
                          <div>
                            {editingNote === item.id ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <input value={noteText} onChange={e => setNoteText(e.target.value)}
                                  style={{ flex: 1, fontSize: 12, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', outline: 'none', ...S }}
                                  placeholder="Add note..." autoFocus
                                  onKeyDown={e => { if (e.key === 'Enter') { onNoteChange(item.id, noteText); setEditingNote(null) } if (e.key === 'Escape') setEditingNote(null) }}
                                />
                                <button onClick={() => { onNoteChange(item.id, noteText); setEditingNote(null) }} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 5, background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditingNote(null)} style={{ padding: '4px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}><X size={12} /></button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingNote(item.id); setNoteText(note) }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, background: 'transparent', border: '1px dashed rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Tag size={10} />{note || 'Add note...'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ג”€ג”€ EXPLOIT CONSOLE ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ */}
            {view === 'exploit' && (
              <div className="wslide" style={{ height: '100%' }}>
                <ExploitConsole
                  scan={scan}
                  items={items}
                  attackerCfg={attacker}
                  results={exploitResults}
                  onResult={(id, confirmed, evidence) => {
                    setExploitResults(prev => ({ ...prev, [id]: { confirmed, evidence } }))
                    onExploitResult?.(id, confirmed, evidence)
                  }}
                />
              </div>
            )}

            {/* ג”€ג”€ CONFIG & EXPORT ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ */}
            {view === 'config' && (
              <div className="wslide" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* Attacker config */}
                <div style={{ padding: 18, borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Attacker Configuration</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {([
                      { key: 'lhost', label: 'LHOST (Your IP)', placeholder: '10.10.14.1' },
                      { key: 'lport', label: 'LPORT', placeholder: '4444' },
                      { key: 'c2domain', label: 'C2 Domain', placeholder: 'evil.com' },
                      { key: 'interactshUrl', label: 'Interactsh URL', placeholder: 'xxx.oast.fun' },
                      { key: 'sessionCookie', label: 'Session Cookie', placeholder: 'PHPSESSID=abc123' },
                    ] as const).map(f => (
                      <div key={f.key}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{f.label}</div>
                        <input
                          value={attacker[f.key] || ''}
                          onChange={e => setAttacker(a => ({ ...a, [f.key]: e.target.value }))}
                          onBlur={() => window.electron?.setAttackerConfig?.(attacker)}
                          placeholder={f.placeholder}
                          style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', fontFamily: 'monospace', ...S }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Values replace LHOST, LPORT, C2_DOMAIN, INTERACTSH_URL placeholders in all commands.</div>
                </div>

                {/* Exports */}
                <div style={{ padding: 18, borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Export</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={exportSh} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '9px 18px', borderRadius: 7, background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', cursor: 'pointer' }}>
                      <Download size={14} /> Export .sh
                    </button>
                    <button onClick={exportMsf} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '9px 18px', borderRadius: 7, background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', cursor: 'pointer' }}>
                      <Download size={14} /> Export .rc
                    </button>
                  </div>
                </div>

                {/* AI Analysis */}
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(167,139,250,0.28)', background: 'rgba(167,139,250,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: '1px solid rgba(167,139,250,0.14)' }}>
                    <Brain size={15} style={{ color: '#a78bfa' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>AI Deep Analysis</span>
                    <div style={{ flex: 1 }} />
                    {!aiRunning && !aiDone && (
                      <button onClick={startAi} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 16px', borderRadius: 7, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', cursor: 'pointer', fontWeight: 600 }}>
                        <Zap size={12} /> Analyze with Claude
                      </button>
                    )}
                    {aiRunning && (
                      <button onClick={() => { window.electron.agentCancel(); setAiRunning(false) }} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 13px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}>
                        <X size={12} /> Stop
                      </button>
                    )}
                    {aiDone && (
                      <button onClick={startAi} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '5px 13px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                        <RefreshCw size={12} /> Re-analyze
                      </button>
                    )}
                  </div>
                  {aiError && <div style={{ padding: '12px 18px', fontSize: 12, color: '#ef4444' }}>Error: {aiError}</div>}
                  {(aiText || aiRunning) && (
                    <div ref={aiRef} style={{ maxHeight: 400, overflow: 'auto' }}>
                      {aiRunning && !aiText && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', fontSize: 12, color: '#a78bfa' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa' }} className="wpulse" />
                          Analyzing {scan.target} with {items.length} findingsג€¦
                        </div>
                      )}
                      {aiText && (
                        <div style={{ padding: '14px 18px' }}>
                          <AiMarkdown text={aiText} />
                          {aiRunning && <span style={{ display: 'inline-block', width: 8, height: 12, background: '#a78bfa', marginLeft: 4, verticalAlign: 'middle' }} className="wpulse" />}
                        </div>
                      )}
                    </div>
                  )}
                  {!aiText && !aiRunning && !aiError && (
                    <div style={{ padding: '14px 18px', fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 1.7 }}>
                      Claude will analyze all {items.length} findings: attack chains, version CVEs, custom payloads, non-obvious vectors, business impact, and a full pentest report draft.<br /><br />
                      Requires Claude API key in Settings.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
  )

  if (inline) return inner

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.87)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'stretch' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{ margin: 10, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {inner}
        </div>
      </div>
    </>
  )
}

// ג”€ג”€ AI markdown renderer ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

function AiMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i} style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginTop: 10, marginBottom: 3 }}>{line.slice(3)}</h2>
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 4 }}>{line.slice(2, -2)}</p>
        if (line.startsWith('```')) return null
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginLeft: 16 }}>{line.slice(2)}</li>
        if (line.trim() === '') return <div key={i} style={{ height: 5 }} />
        return <p key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>{line}</p>
      })}
    </div>
  )
}
