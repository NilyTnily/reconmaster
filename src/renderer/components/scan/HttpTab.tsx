import React, { useState, useMemo } from 'react'
import { HttpResult } from '../../types'
import { ExternalLink, ChevronDown, ChevronUp, Shield } from 'lucide-react'

interface Props { results: HttpResult[] }

const statusColor = (s: number): string => {
  if (s < 300) return 'var(--success)'
  if (s < 400) return '#fbbf24'
  if (s < 500) return 'var(--warning)'
  return 'var(--danger)'
}

function SecurityScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'
  const label = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D'
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded"
        style={{ background: color + '22', color }}>
        {label}
      </span>
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  )
}

function ExpandedRow({ r }: { r: HttpResult }) {
  return (
    <div className="px-4 py-3 space-y-3" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
      <div className="grid grid-cols-2 gap-4">
        {/* Security headers */}
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Security Headers</div>
          <div className="space-y-1">
            {[
              { key: 'strict-transport-security', label: 'HSTS' },
              { key: 'content-security-policy', label: 'CSP' },
              { key: 'x-frame-options', label: 'X-Frame-Options' },
              { key: 'x-content-type-options', label: 'X-Content-Type' },
              { key: 'referrer-policy', label: 'Referrer-Policy' },
              { key: 'permissions-policy', label: 'Permissions-Policy' },
            ].map(({ key, label }) => {
              const val = r.headers?.[key]
              return (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <Shield size={10} style={{ color: val ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                  <span style={{ color: val ? 'var(--text-primary)' : 'var(--text-secondary)', minWidth: 130 }}>{label}</span>
                  <span className="font-mono truncate" style={{ color: val ? '#22c55e' : '#ef4444' }}>
                    {val ? val.slice(0, 60) + (val.length > 60 ? '…' : '') : 'missing'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Cookies */}
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Cookies</div>
          {r.cookies && r.cookies.length > 0 ? (
            <div className="space-y-1">
              {r.cookies.map((cookie, i) => {
                const hasFlags = cookie.includes('[')
                const flags = cookie.match(/\[([^\]]+)\]/)?.[1] || ''
                const name = cookie.split('[')[0].trim()
                const isSecure = flags.includes('Secure')
                const isHttpOnly = flags.includes('HttpOnly')
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{name}</span>
                    <div className="flex gap-1 flex-wrap">
                      {hasFlags ? (
                        <>
                          {isHttpOnly && <span className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>HttpOnly</span>}
                          {isSecure && <span className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>Secure</span>}
                          {!isHttpOnly && <span className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>No HttpOnly</span>}
                          {!isSecure && <span className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>No Secure</span>}
                        </>
                      ) : (
                        <span className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>No flags</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>No cookies set</span>
          )}
        </div>
      </div>

      {/* All headers */}
      {r.headers && Object.keys(r.headers).length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Response Headers</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {Object.entries(r.headers).map(([k, v]) => (
              <div key={k} className="flex gap-2 text-xs">
                <span className="font-mono shrink-0" style={{ color: '#a78bfa', minWidth: 160 }}>{k}:</span>
                <span className="font-mono truncate" style={{ color: 'var(--text-secondary)' }} title={v}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HttpTab({ results }: Props) {
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = useMemo(() =>
    results.filter(r => {
      const matchStatus = statusFilter === null || Math.floor(r.status / 100) === Math.floor(statusFilter / 100)
      const matchFilter = !filter
        || r.url.toLowerCase().includes(filter.toLowerCase())
        || (r.title || '').toLowerCase().includes(filter.toLowerCase())
        || (r.server || '').toLowerCase().includes(filter.toLowerCase())
        || (r.waf || '').toLowerCase().includes(filter.toLowerCase())
        || (r.tech || []).some(t => t.toLowerCase().includes(filter.toLowerCase()))
      return matchStatus && matchFilter
    }), [results, filter, statusFilter])

  const statusGroups = useMemo(() => {
    const groups: Record<string, number> = {}
    for (const r of results) {
      const g = `${Math.floor(r.status / 100)}xx`
      groups[g] = (groups[g] || 0) + 1
    }
    return groups
  }, [results])

  const toggleExpand = (url: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url); else next.add(url)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Filter URL, title, tech, WAF..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 280 }}
        />
        <div className="flex gap-1">
          <button onClick={() => setStatusFilter(null)}
            className="px-2.5 py-1 rounded text-xs"
            style={{ background: statusFilter === null ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)', color: statusFilter === null ? 'var(--accent)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            All ({results.length})
          </button>
          {Object.entries(statusGroups).map(([g, count]) => (
            <button key={g} onClick={() => setStatusFilter(parseInt(g) * 100)}
              className="px-2.5 py-1 rounded text-xs"
              style={{
                background: statusFilter === parseInt(g) * 100 ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)',
                color: statusFilter === parseInt(g) * 100 ? 'var(--accent)' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}>
              {g} ({count})
            </button>
          ))}
        </div>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>{filtered.length} hosts</span>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>No HTTP results</div>
        ) : (
          filtered.map((r, i) => (
            <div key={r.url} style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
              <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.02]"
                style={{ background: 'var(--bg-card)' }}
                onClick={() => toggleExpand(r.url)}>
                {/* Status */}
                <span className="font-mono font-bold text-sm shrink-0" style={{ color: statusColor(r.status), minWidth: 36 }}>
                  {r.status}
                </span>
                {/* URL */}
                <span className="font-mono text-xs flex-1 truncate">{r.url}</span>
                {/* Title */}
                {r.title && (
                  <span className="text-xs truncate max-w-[200px] shrink-0" style={{ color: 'var(--text-secondary)' }}>{r.title}</span>
                )}
                {/* WAF badge */}
                {r.waf && (
                  <span className="px-2 py-0.5 rounded text-xs shrink-0" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                    WAF: {r.waf}
                  </span>
                )}
                {/* Security score */}
                {r.securityScore != null && (
                  <div className="shrink-0">
                    <SecurityScoreBadge score={r.securityScore} />
                  </div>
                )}
                {/* Server */}
                {r.server && (
                  <span className="font-mono text-xs shrink-0" style={{ color: '#a78bfa' }}>{r.server}</span>
                )}
                {/* Tech tags */}
                <div className="flex gap-1 shrink-0">
                  {(r.tech || []).slice(0, 3).map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded text-xs"
                      style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>{t}</span>
                  ))}
                  {(r.tech || []).length > 3 && (
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>+{(r.tech || []).length - 3}</span>
                  )}
                </div>
                {/* Size */}
                <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  {r.contentLength ? `${Math.round(r.contentLength / 1024)}KB` : '—'}
                </span>
                <button className="opacity-40 hover:opacity-100 shrink-0"
                  onClick={e => { e.stopPropagation(); window.open(r.url, '_blank') }}>
                  <ExternalLink size={11} style={{ color: 'var(--accent)' }} />
                </button>
                {expanded.has(r.url)
                  ? <ChevronUp size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  : <ChevronDown size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
              </div>
              {expanded.has(r.url) && <ExpandedRow r={r} />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
