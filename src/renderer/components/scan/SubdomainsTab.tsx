import React, { useState, useMemo } from 'react'
import { Subdomain } from '../../types'
import DataTable from '../ui/DataTable'
import { ExternalLink, Wifi, WifiOff } from 'lucide-react'

interface Props { subdomains: Subdomain[] }

const SOURCE_COLORS: Record<string, string> = {
  subfinder: '#60a5fa', amass: '#a78bfa', assetfinder: '#34d399',
  'crt.sh': '#fbbf24', hackertarget: '#f472b6', alienvault: '#fb923c',
  rapiddns: '#22d3ee', 'brute-force': '#6ee7b7', dnsx: '#818cf8',
}

const statusColor = (status?: number): string => {
  if (!status) return 'var(--text-secondary)'
  if (status < 300) return 'var(--success)'
  if (status < 400) return '#fbbf24'
  if (status < 500) return 'var(--warning)'
  return 'var(--danger)'
}

export default function SubdomainsTab({ subdomains }: Props) {
  const [filter, setFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [showLiveOnly, setShowLiveOnly] = useState(false)

  const liveCount = useMemo(() => subdomains.filter(s => s.status && s.status < 400).length, [subdomains])
  const filtered = useMemo(() =>
    subdomains.filter(s => {
      const matchLive = !showLiveOnly || (s.status && s.status < 400)
      const matchSource = sourceFilter === null || s.source === sourceFilter
      const matchFilter = !filter
        || s.host.toLowerCase().includes(filter.toLowerCase())
        || (s.ip || '').includes(filter)
        || (s.title || '').toLowerCase().includes(filter.toLowerCase())
        || (s.source || '').toLowerCase().includes(filter.toLowerCase())
      return matchLive && matchSource && matchFilter
    }), [subdomains, filter, sourceFilter, showLiveOnly])

  const sourceBreakdown = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of subdomains) { m[s.source] = (m[s.source] || 0) + 1 }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [subdomains])

  return (
    <div className="space-y-3">
      {/* Stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          <button onClick={() => setShowLiveOnly(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ background: !showLiveOnly ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)', color: !showLiveOnly ? 'var(--accent)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            <Wifi size={11} />
            All <span className="font-bold">{subdomains.length}</span>
          </button>
          <button onClick={() => setShowLiveOnly(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ background: showLiveOnly ? 'rgba(34,197,94,0.1)' : 'var(--bg-card)', color: showLiveOnly ? 'var(--success)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            <Wifi size={11} />
            Live <span className="font-bold">{liveCount}</span>
          </button>
        </div>

        {/* Source breakdown */}
        <div className="flex gap-1 flex-wrap">
          {sourceBreakdown.map(([source, count]) => {
            const color = SOURCE_COLORS[source] || '#888'
            return (
              <button key={source} onClick={() => setSourceFilter(source === sourceFilter ? null : source)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                style={{
                  background: sourceFilter === source ? color + '22' : 'var(--bg-card)',
                  color: sourceFilter === source ? color : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: sourceFilter === source ? color + '44' : 'var(--border)',
                }}>
                <span style={{ color }}>{source}</span>
                <span className="opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Filter subdomains, IPs, titles..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 280 }}
        />
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{filtered.length} of {subdomains.length}</span>
      </div>

      <DataTable
        columns={[
          {
            key: 'host', label: 'Subdomain',
            render: (r: Subdomain) => (
              <div className="flex items-center gap-2">
                {r.status && r.status < 400
                  ? <Wifi size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  : <WifiOff size={11} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
                <span className="font-mono text-xs">{r.host}</span>
                <button className="opacity-40 hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => window.open(`https://${r.host}`, '_blank')}>
                  <ExternalLink size={11} style={{ color: 'var(--accent)' }} />
                </button>
              </div>
            ),
          },
          {
            key: 'ip', label: 'IP', width: 130,
            render: (r: Subdomain) => <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{r.ip || '—'}</span>,
          },
          {
            key: 'status', label: 'HTTP', width: 70,
            render: (r: Subdomain) => r.status
              ? <span className="font-mono text-xs font-bold" style={{ color: statusColor(r.status) }}>{r.status}</span>
              : <span style={{ color: 'var(--border)' }}>—</span>,
          },
          {
            key: 'title', label: 'Title',
            render: (r: Subdomain) => r.title
              ? <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{r.title}</span>
              : <span style={{ color: 'var(--border)' }}>—</span>,
          },
          {
            key: 'cdn', label: 'CDN', width: 90,
            render: (r: Subdomain) => r.cdn
              ? <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent)' }}>{r.cdn}</span>
              : null,
          },
          {
            key: 'source', label: 'Source', width: 120,
            render: (r: Subdomain) => {
              const color = SOURCE_COLORS[r.source] || '#888'
              return (
                <span className="px-2 py-0.5 rounded text-xs"
                  style={{ background: color + '18', color }}>
                  {r.source}
                </span>
              )
            },
          },
        ]}
        data={filtered}
        emptyMessage="No subdomains discovered"
      />
    </div>
  )
}
