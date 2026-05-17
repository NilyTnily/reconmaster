import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Globe, Server, Monitor, Lock, FolderSearch, Bug, Users, Code2,
  StopCircle, Download, ChevronDown, ChevronUp, FileText,
} from 'lucide-react'
import { ScanResult, WeaponStatus } from '../../types'
import { useScanStore } from '../../store/scanStore'
import SubdomainsTab from './SubdomainsTab'
import PortsTab from './PortsTab'
import HttpTab from './HttpTab'
import SslTab from './SslTab'
import DirsTab from './DirsTab'
import VulnsTab from './VulnsTab'
import OsintTab from './OsintTab'
import JsTab from './JsTab'
import DnsTab from './DnsTab'
import WeaponizationModal, { generateWeaponization, generateAttackChains } from './WeaponizationTab'
import CopyButton from '../ui/CopyButton'
import { generateMarkdownReport } from '../../utils/exportMarkdown'

interface Props {
  scan: ScanResult
  onCancel: (id: string) => void
}

const TABS = [
  { id: 'dns', label: 'DNS', icon: Globe },
  { id: 'subdomains', label: 'Subdomains', icon: Globe },
  { id: 'ports', label: 'Ports', icon: Server },
  { id: 'http', label: 'Web', icon: Monitor },
  { id: 'ssl', label: 'SSL', icon: Lock },
  { id: 'dirs', label: 'Directories', icon: FolderSearch },
  { id: 'vulns', label: 'Vulnerabilities', icon: Bug },
  { id: 'osint', label: 'OSINT', icon: Users },
  { id: 'js', label: 'JS/Endpoints', icon: Code2 },
]

export default function ScanDashboard({ scan, onCancel }: Props) {
  const [activeTab, setActiveTab] = useState('dns')
  const [logExpanded, setLogExpanded] = useState(false)

  const logRef = useRef<HTMLDivElement>(null)
  const { updateScan, scanUiState, setMainView: setStoreMainView, patchExploitResult } = useScanStore()
  const mainView = scanUiState[scan.id]?.mainView ?? 'recon'
  const setMainView = useCallback((v: 'recon' | 'weapons') => setStoreMainView(scan.id, v), [scan.id, setStoreMainView])

  const weaponItems = useMemo(() => generateWeaponization(scan), [scan.vulnerabilities, scan.ports, scan.xssResults, scan.idorResults, scan.http, scan.dns, scan.osint, scan.jsEndpoints, scan.dirs, scan.subdomains])
  const weaponChains = useMemo(() => generateAttackChains(scan, weaponItems), [scan.vulnerabilities, scan.ports, scan.xssResults, scan.idorResults, scan.dns, scan.osint, scan.jsEndpoints, weaponItems])

  const handleStatusChange = useCallback((weaponId: string, status: WeaponStatus) => {
    updateScan(scan.id, { weaponStatuses: { ...scan.weaponStatuses, [weaponId]: status } })
  }, [scan.id, scan.weaponStatuses, updateScan])

  const handleNoteChange = useCallback((weaponId: string, note: string) => {
    updateScan(scan.id, { weaponNotes: { ...scan.weaponNotes, [weaponId]: note } })
  }, [scan.id, scan.weaponNotes, updateScan])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [scan.logs])

  const handleExport = async (format: 'csv' | 'json') => {
    const data = {
      target: scan.target, subdomains: scan.subdomains, ports: scan.ports,
      http: scan.http, ssl: scan.ssl, dirs: scan.dirs,
      vulnerabilities: scan.vulnerabilities, osint: scan.osint, jsEndpoints: scan.jsEndpoints,
    }
    await window.electron?.exportData(
      format === 'json' ? data : scan.vulnerabilities,
      format,
      `reconmaster_${scan.target}_${Date.now()}.${format}`
    )
  }

  const handleExportMarkdown = async () => {
    const md = generateMarkdownReport(scan)
    await window.electron?.exportMarkdown(md, `reconmaster_${scan.target}_${Date.now()}.md`)
  }

  const getTabCopyText = useCallback((): string => {
    switch (activeTab) {
      case 'dns': return scan.dns.map(r => `${r.type}\t${r.value}\tTTL:${r.ttl ?? '-'}`).join('\n')
      case 'subdomains': return scan.subdomains.map(s => `${s.host}\t${s.ip || ''}\t${s.source}`).join('\n')
      case 'ports': return scan.ports.filter(p => p.state === 'open').map(p => `${p.host}:${p.port}\t${p.protocol}\t${p.service || ''}\t${p.version || ''}`).join('\n')
      case 'http': return scan.http.map(h => `${h.status}\t${h.url}\t${h.title || ''}\t${h.server || ''}\t${(h.tech || []).join(',')}`).join('\n')
      case 'ssl': return scan.ssl.map(s => `${s.host}:${s.port}\t${s.expiry || ''}\t${s.issuer || ''}\t${(s.issues || []).join('; ')}`).join('\n')
      case 'dirs': return scan.dirs.map(d => `${d.status}\t${d.url}`).join('\n')
      case 'vulns': return scan.vulnerabilities.map(v => `[${v.severity.toUpperCase()}] ${v.name}\t${v.host}\t${v.description || ''}`).join('\n')
      case 'osint': return scan.osint.map(o => `${o.type}\t${o.value}\t${o.source}`).join('\n')
      case 'js': return scan.jsEndpoints.map(e => `${e.type}\t${e.severity || ''}\t${e.url}\t${e.match || ''}`).join('\n')
      default: return ''
    }
  }, [activeTab, scan, weaponItems])

  const runningPhases = Object.values(scan.phases).filter(p => p.status === 'running')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Compact scan header ───────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ height: 40, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
      >
        <StatusChip status={scan.status} />
        {runningPhases.length > 0 && (
          <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>
            {runningPhases.map(p => p.phase).join(', ')}…
          </span>
        )}
        <div className="flex items-center gap-1.5 flex-1 overflow-hidden min-w-0">
          {scan.summary.criticalVulns > 0 && <PillBadge label={`${scan.summary.criticalVulns} crit`} color="#ef4444" />}
          {scan.summary.highVulns > 0 && <PillBadge label={`${scan.summary.highVulns} high`} color="#f97316" />}
          {scan.summary.openPorts > 0 && <PillBadge label={`${scan.summary.openPorts} ports`} color="#a78bfa" />}
          {scan.summary.subdomains > 0 && <PillBadge label={`${scan.summary.subdomains} subs`} color="#00d4ff" />}
          {weaponItems.length > 0 && <PillBadge label={`${weaponItems.length} weapons`} color="#ef4444" />}
          {scan.summary.technologies.slice(0, 3).map(t => <PillBadge key={t} label={t} color="#555" />)}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {scan.status === 'running' && (
            <button onClick={() => onCancel(scan.id)} className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
              <StopCircle size={12} /> Stop
            </button>
          )}
          <button onClick={handleExportMarkdown} className="flex items-center gap-1 px-2.5 py-1 rounded text-xs" style={{ color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.07)' }}>
            <FileText size={12} /> .md
          </button>
          <button onClick={() => handleExport('json')} className="flex items-center gap-1 px-2.5 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            <Download size={12} /> JSON
          </button>
        </div>
      </div>

      {/* ── Main view switcher ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 shrink-0" style={{ height: 36, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        {([
          { id: 'recon' as const,   label: '🔍 Recon',              count: scan.summary.vulnerabilities, danger: false },
          { id: 'weapons' as const, label: '💀 Weapons & Exploit',  count: weaponItems.length,           danger: true  },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setMainView(tab.id)}
            className="flex items-center gap-1.5 px-4 rounded text-xs font-semibold whitespace-nowrap transition-all"
            style={{
              height: 32,
              color: mainView === tab.id ? (tab.danger ? '#ef4444' : 'var(--accent)') : 'var(--text-secondary)',
              background: mainView === tab.id ? (tab.danger ? 'rgba(239,68,68,0.1)' : 'rgba(0,212,255,0.08)') : 'transparent',
              borderBottom: mainView === tab.id ? `2px solid ${tab.danger ? '#ef4444' : 'var(--accent)'}` : '2px solid transparent',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 999, background: tab.danger && mainView === tab.id ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)', color: tab.danger ? '#ef4444' : undefined }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── RECON VIEW ────────────────────────────────────────────────────── */}
      {mainView === 'recon' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-1 px-3 shrink-0 overflow-x-auto" style={{ height: 36, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', scrollbarWidth: 'none' }}>
            {TABS.map(tab => {
              const count = getTabCount(tab.id, scan)
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1 px-3 rounded text-xs font-medium whitespace-nowrap"
                  style={{
                    height: 32,
                    color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                    background: activeTab === tab.id ? 'rgba(0,212,255,0.08)' : 'transparent',
                    borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  <tab.icon size={11} /> {tab.label}
                  {count > 0 && <span className="px-1.5 rounded-full" style={{ fontSize: 10, background: activeTab === tab.id ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.07)' }}>{count}</span>}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div className="flex justify-end mb-3"><CopyButton getText={getTabCopyText} /></div>
            {activeTab === 'dns' && <DnsTab records={scan.dns} />}
            {activeTab === 'subdomains' && <SubdomainsTab subdomains={scan.subdomains} />}
            {activeTab === 'ports' && <PortsTab ports={scan.ports} />}
            {activeTab === 'http' && <HttpTab results={scan.http} />}
            {activeTab === 'ssl' && <SslTab results={scan.ssl} />}
            {activeTab === 'dirs' && <DirsTab results={scan.dirs} />}
            {activeTab === 'vulns' && <VulnsTab vulnerabilities={scan.vulnerabilities} />}
            {activeTab === 'osint' && <OsintTab results={scan.osint} />}
            {activeTab === 'js' && <JsTab endpoints={scan.jsEndpoints} />}
          </div>

          {/* Live log */}
          <div className="shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between px-4 py-1.5 cursor-pointer select-none" onClick={() => setLogExpanded(e => !e)}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Live Output</span>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{scan.logs.length} lines</span>
                {logExpanded ? <ChevronDown size={13} style={{ color: 'var(--text-secondary)' }} /> : <ChevronUp size={13} style={{ color: 'var(--text-secondary)' }} />}
              </div>
            </div>
            {logExpanded && (
              <div ref={logRef} className="overflow-y-auto font-mono text-xs px-4 pb-2" style={{ maxHeight: 130, background: '#0a0d15' }}>
                {scan.logs.length === 0 && <div className="py-2" style={{ color: 'var(--text-secondary)' }}>Waiting for output…</div>}
                {scan.logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 py-0.5">
                    <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="font-semibold" style={{ color: log.tool === 'orchestrator' ? 'var(--accent)' : '#a78bfa', flexShrink: 0, minWidth: 70 }}>[{log.tool}]</span>
                    <span style={{ color: log.level === 'error' ? 'var(--danger)' : log.level === 'warn' ? 'var(--warning)' : log.level === 'success' ? 'var(--success)' : 'var(--text-primary)' }}>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── WEAPONS & EXPLOIT (inline, no modal) ─────────────────────────── */}
      {mainView === 'weapons' && (
        <div className="flex-1 overflow-hidden">
          <WeaponizationModal
            isOpen={true}
            inline={true}
            onClose={() => setMainView('recon')}
            scan={scan}
            items={weaponItems}
            chains={weaponChains}
            onStatusChange={handleStatusChange}
            onNoteChange={handleNoteChange}
            onExploitResult={(weaponId, confirmed, evidence) => patchExploitResult(scan.id, weaponId, confirmed, evidence)}
          />
        </div>
      )}
    </div>
  )
}

function PillBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}20`, color, border: `1px solid ${color}40`, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    running:   { label: 'Scanning',  bg: 'rgba(0,212,255,0.1)',   color: 'var(--accent)' },
    completed: { label: 'Complete',  bg: 'rgba(34,197,94,0.1)',   color: 'var(--success)' },
    error:     { label: 'Error',     bg: 'rgba(239,68,68,0.1)',   color: 'var(--danger)' },
    cancelled: { label: 'Cancelled', bg: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' },
    idle:      { label: 'Idle',      bg: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' },
  }
  const c = cfg[status] || cfg.idle
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: c.bg, color: c.color }}>{c.label}</span>
}

function getTabCount(tabId: string, scan: ScanResult): number {
  switch (tabId) {
    case 'dns':        return scan.dns.length
    case 'subdomains': return scan.subdomains.length
    case 'ports':      return scan.ports.filter(p => p.state === 'open').length
    case 'http':       return scan.http.length
    case 'ssl':        return scan.ssl.length
    case 'dirs':       return scan.dirs.length
    case 'vulns':      return scan.vulnerabilities.length
    case 'osint':      return scan.osint.length
    case 'js':         return scan.jsEndpoints.length
    default:           return 0
  }
}
