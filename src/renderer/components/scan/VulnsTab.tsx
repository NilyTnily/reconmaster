import React, { useState, useMemo } from 'react'
import { Vulnerability } from '../../types'
import { ExternalLink, AlertTriangle, ChevronDown, ChevronUp, Wrench } from 'lucide-react'

interface Props { vulnerabilities: Vulnerability[] }

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info']
const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#3b82f6',
}
const SEV_LABELS: Record<string, string> = {
  critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', info: 'INFO',
}

function SeverityBar({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return null
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
      {SEV_ORDER.filter(s => counts[s]).map(s => (
        <div key={s} title={`${counts[s]} ${s}`}
          className="transition-all"
          style={{ width: `${(counts[s] / total) * 100}%`, background: SEV_COLORS[s] }} />
      ))}
    </div>
  )
}

function VulnCard({ vuln, expanded, onToggle }: { vuln: Vulnerability; expanded: boolean; onToggle: () => void }) {
  const color = SEV_COLORS[vuln.severity] || '#888'

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${color}30`, background: 'var(--bg-card)' }}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.02]"
        onClick={onToggle}>
        <span className="px-2 py-0.5 rounded text-xs font-bold shrink-0"
          style={{ background: color + '22', color }}>
          {SEV_LABELS[vuln.severity]}
        </span>
        {vuln.cvss != null && vuln.cvss > 0 && (
          <span className="text-xs font-mono font-bold shrink-0" style={{ color }}>
            {vuln.cvss.toFixed(1)}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold">{vuln.name}</div>
          <div className="font-mono text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            {vuln.host}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(vuln.tags || []).slice(0, 2).map(t => (
            <span key={t} className="px-1.5 py-0.5 rounded text-xs"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>{t}</span>
          ))}
          {vuln.reference && (
            <button className="opacity-60 hover:opacity-100"
              onClick={e => { e.stopPropagation(); window.open(vuln.reference, '_blank') }}>
              <ExternalLink size={12} style={{ color: 'var(--accent)' }} />
            </button>
          )}
          {expanded
            ? <ChevronUp size={13} style={{ color: 'var(--text-secondary)' }} />
            : <ChevronDown size={13} style={{ color: 'var(--text-secondary)' }} />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-3 space-y-3" style={{ borderTop: `1px solid ${color}20`, background: color + '06' }}>
          {vuln.description && (
            <div>
              <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <AlertTriangle size={11} />
                Description
              </div>
              <p className="text-xs" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>{vuln.description}</p>
            </div>
          )}
          {vuln.remediation && (
            <div>
              <div className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: '#22c55e' }}>
                <Wrench size={11} />
                Remediation
              </div>
              <p className="text-xs" style={{ color: '#22c55e', lineHeight: 1.6, opacity: 0.9 }}>{vuln.remediation}</p>
            </div>
          )}
          {vuln.matched && vuln.matched !== vuln.host && (
            <div>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Matched at</div>
              <div className="font-mono text-xs" style={{ color: 'var(--accent)' }}>{vuln.matched}</div>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span>ID: <span className="font-mono">{vuln.id}</span></span>
            {vuln.cvss != null && vuln.cvss > 0 && <span>CVSS: <span className="font-bold" style={{ color }}>{vuln.cvss.toFixed(1)}</span></span>}
            {(vuln.tags || []).map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,255,255,0.06)' }}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function VulnsTab({ vulnerabilities }: Props) {
  const [filter, setFilter] = useState('')
  const [sevFilter, setSevFilter] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const sorted = useMemo(() =>
    [...vulnerabilities].sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)),
    [vulnerabilities])

  const filtered = useMemo(() =>
    sorted.filter(v => {
      const matchSev = sevFilter === null || v.severity === sevFilter
      const matchFilter = !filter
        || v.name.toLowerCase().includes(filter.toLowerCase())
        || v.id.toLowerCase().includes(filter.toLowerCase())
        || v.host.toLowerCase().includes(filter.toLowerCase())
        || (v.description || '').toLowerCase().includes(filter.toLowerCase())
        || (v.tags || []).some(t => t.toLowerCase().includes(filter.toLowerCase()))
      return matchSev && matchFilter
    }), [sorted, filter, sevFilter])

  const sevCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const v of vulnerabilities) { m[v.severity] = (m[v.severity] || 0) + 1 }
    return m
  }, [vulnerabilities])

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {/* Severity distribution */}
      {vulnerabilities.length > 0 && (
        <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <SeverityBar counts={sevCounts} />
          <div className="flex flex-wrap gap-2">
            {SEV_ORDER.filter(s => sevCounts[s]).map(s => (
              <div key={s} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SEV_COLORS[s] }} />
                <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{s}</span>
                <span className="font-bold" style={{ color: SEV_COLORS[s] }}>{sevCounts[s]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Filter by name, ID, host, tag..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 280 }}
        />
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setSevFilter(null)}
            className="px-2.5 py-1 rounded text-xs"
            style={{ background: sevFilter === null ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)', color: sevFilter === null ? 'var(--accent)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            All ({vulnerabilities.length})
          </button>
          {SEV_ORDER.filter(s => sevCounts[s]).map(s => (
            <button key={s} onClick={() => setSevFilter(s === sevFilter ? null : s)}
              className="px-2.5 py-1 rounded text-xs font-medium capitalize"
              style={{
                background: sevFilter === s ? SEV_COLORS[s] + '22' : 'var(--bg-card)',
                color: SEV_COLORS[s],
                border: `1px solid ${sevFilter === s ? SEV_COLORS[s] + '44' : 'var(--border)'}`,
              }}>
              {SEV_LABELS[s]} ({sevCounts[s]})
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-secondary)' }}>
          {filtered.length} finding{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-xs" style={{ color: 'var(--text-secondary)' }}>
          No vulnerabilities found
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v, i) => {
            const key = `${v.id}::${v.host}::${i}`
            return (
              <VulnCard
                key={key}
                vuln={v}
                expanded={expanded.has(key)}
                onToggle={() => toggleExpand(key)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
