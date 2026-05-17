import React, { useState, useMemo } from 'react'
import { JsEndpoint } from '../../types'
import { ExternalLink, Eye, EyeOff, AlertTriangle, Code2, Link, KeyRound } from 'lucide-react'

interface Props { endpoints: JsEndpoint[] }

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#3b82f6',
}

const TYPE_COLORS: Record<string, string> = {
  endpoint: '#60a5fa', secret: '#ef4444', link: '#a78bfa', parameter: '#34d399',
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  endpoint: Code2, secret: KeyRound, link: Link, parameter: ExternalLink,
}

function SecretCard({ item }: { item: JsEndpoint }) {
  const [revealed, setRevealed] = useState(false)
  const severity = item.severity || 'high'
  const color = SEV_COLORS[severity] || '#ef4444'
  const name = item.match?.split(':')[0] || 'Secret'

  return (
    <div className="p-3 rounded-lg" style={{ background: color + '10', border: `1px solid ${color}30` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <AlertTriangle size={13} style={{ color, flexShrink: 0, marginTop: 1 }} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color }}>{name}</span>
              <span className="px-1.5 py-0.5 rounded text-xs font-bold uppercase"
                style={{ background: color + '22', color }}>
                {severity}
              </span>
            </div>
            <div className="font-mono text-xs mt-1 break-all" style={{ color: 'var(--text-secondary)' }}>
              {revealed ? (item.match || '') : (item.masked || item.match?.replace(/:.+/, ': ****') || '****')}
            </div>
            <div className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>
              in: {item.url}
            </div>
          </div>
        </div>
        <button className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          onClick={() => setRevealed(v => !v)}
          title={revealed ? 'Hide secret' : 'Reveal secret'}>
          {revealed ? <EyeOff size={13} style={{ color }} /> : <Eye size={13} style={{ color }} />}
        </button>
      </div>
    </div>
  )
}

export default function JsTab({ endpoints }: Props) {
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const secrets = useMemo(() =>
    endpoints.filter(e => e.type === 'secret')
      .sort((a, b) => {
        const sevOrd = ['critical', 'high', 'medium', 'low', 'info']
        return sevOrd.indexOf(a.severity || 'info') - sevOrd.indexOf(b.severity || 'info')
      }), [endpoints])

  const nonSecrets = useMemo(() => endpoints.filter(e => e.type !== 'secret'), [endpoints])

  const types = useMemo(() => [...new Set(nonSecrets.map(e => e.type))], [nonSecrets])

  const filtered = useMemo(() =>
    nonSecrets.filter(e => {
      const matchType = typeFilter === null || e.type === typeFilter
      const matchFilter = !filter
        || e.url.toLowerCase().includes(filter.toLowerCase())
        || (e.match || '').toLowerCase().includes(filter.toLowerCase())
        || e.source.toLowerCase().includes(filter.toLowerCase())
      return matchType && matchFilter
    }).sort((a, b) => a.url.localeCompare(b.url)), [nonSecrets, filter, typeFilter])

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of nonSecrets) { m[e.type] = (m[e.type] || 0) + 1 }
    return m
  }, [nonSecrets])

  const uniqueJsFiles = useMemo(() => [...new Set(endpoints.map(e => e.url).filter(u => u.endsWith('.js')))], [endpoints])

  return (
    <div className="space-y-4">
      {/* Secrets section */}
      {secrets.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={13} style={{ color: '#ef4444' }} />
            <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>
              Secrets & Credentials ({secrets.length})
            </span>
          </div>
          <div className="space-y-2">
            {secrets.map((s, i) => <SecretCard key={i} item={s} />)}
          </div>
        </div>
      )}

      {/* JS files scanned */}
      {uniqueJsFiles.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            JS Files Analyzed ({uniqueJsFiles.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {uniqueJsFiles.slice(0, 10).map(f => (
              <div key={f} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', maxWidth: 300 }}>
                <span className="truncate">{f.split('/').pop()}</span>
                <button className="opacity-60 hover:opacity-100 shrink-0"
                  onClick={() => window.open(f, '_blank')}>
                  <ExternalLink size={10} />
                </button>
              </div>
            ))}
            {uniqueJsFiles.length > 10 && (
              <span className="text-xs self-center" style={{ color: 'var(--text-secondary)' }}>+{uniqueJsFiles.length - 10} more</span>
            )}
          </div>
        </div>
      )}

      {/* Endpoints & links */}
      {nonSecrets.length > 0 && (
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <input
              type="text"
              placeholder="Filter endpoints, links..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 280 }}
            />
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => setTypeFilter(null)}
                className="px-2.5 py-1 rounded text-xs"
                style={{ background: typeFilter === null ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)', color: typeFilter === null ? 'var(--accent)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                All ({nonSecrets.length})
              </button>
              {types.map(t => {
                const Icon = TYPE_ICONS[t] || ExternalLink
                const color = TYPE_COLORS[t] || '#888'
                return (
                  <button key={t} onClick={() => setTypeFilter(t === typeFilter ? null : t)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs capitalize"
                    style={{
                      background: typeFilter === t ? color + '22' : 'var(--bg-card)',
                      color, border: '1px solid var(--border)',
                    }}>
                    <Icon size={11} />
                    {t} ({typeCounts[t] || 0})
                  </button>
                )
              })}
            </div>
            <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>{filtered.length} results</span>
          </div>

          <div className="space-y-1">
            {filtered.slice(0, 200).map((e, i) => {
              const Icon = TYPE_ICONS[e.type] || ExternalLink
              const typeColor = TYPE_COLORS[e.type] || '#888'
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <Icon size={12} style={{ color: typeColor, flexShrink: 0 }} />
                  <span className="font-mono text-xs flex-1 truncate" title={e.url}>{e.url}</span>
                  {e.type === 'endpoint' && (
                    <span className="text-xs truncate max-w-[150px] shrink-0 font-mono" style={{ color: 'var(--text-secondary)' }}
                      title={e.source}>
                      {e.source.split('/').slice(-2).join('/')}
                    </span>
                  )}
                  {e.match && (
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{e.match}</span>
                  )}
                  {e.url.startsWith('http') && (
                    <button className="opacity-40 hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => window.open(e.url, '_blank')}>
                      <ExternalLink size={10} style={{ color: 'var(--accent)' }} />
                    </button>
                  )}
                </div>
              )
            })}
            {filtered.length > 200 && (
              <div className="text-center text-xs py-2" style={{ color: 'var(--text-secondary)' }}>
                Showing 200 of {filtered.length} — use filter to narrow results
              </div>
            )}
          </div>
        </div>
      )}

      {endpoints.length === 0 && (
        <div className="text-center py-12 text-xs" style={{ color: 'var(--text-secondary)' }}>
          No JS endpoints found
        </div>
      )}
    </div>
  )
}
