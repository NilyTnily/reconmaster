import React, { useState, useMemo } from 'react'
import { DirResult } from '../../types'
import DataTable from '../ui/DataTable'
import { ExternalLink, AlertTriangle, Star } from 'lucide-react'

interface Props { results: DirResult[] }

const statusColor = (s: number): string => {
  if (s === 200 || s === 201) return 'var(--success)'
  if (s < 300) return '#34d399'
  if (s < 400) return '#fbbf24'
  if (s === 401 || s === 403) return 'var(--warning)'
  return 'var(--text-secondary)'
}

const statusLabel = (s: number): string => {
  const labels: Record<number, string> = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    301: 'Moved', 302: 'Found', 307: 'Redirect', 308: 'Permanent',
    401: 'Unauth', 403: 'Forbidden', 404: 'Not Found',
    500: 'Error', 503: 'Unavail',
  }
  return labels[s] || String(s)
}

function formatSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function ContentTypeBadge({ ct }: { ct?: string }) {
  if (!ct) return null
  const map: Record<string, string> = {
    'text/html': '#60a5fa',
    'application/json': '#34d399',
    'application/javascript': '#fbbf24',
    'text/javascript': '#fbbf24',
    'text/plain': '#888',
    'application/xml': '#fb923c',
    'text/xml': '#fb923c',
    'application/pdf': '#ef4444',
    'application/zip': '#a78bfa',
    'image/': '#22d3ee',
  }
  const color = Object.entries(map).find(([k]) => ct.includes(k))?.[1] || '#888'
  const label = ct.split('/').pop()?.split(';')[0] || ct
  return (
    <span className="px-1.5 py-0.5 rounded text-xs"
      style={{ background: color + '18', color }}>
      {label}
    </span>
  )
}

export default function DirsTab({ results }: Props) {
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<number | null>(null)
  const [showInterestingOnly, setShowInterestingOnly] = useState(false)

  const interestingCount = useMemo(() => results.filter(r => r.interesting).length, [results])

  const statusCounts = useMemo(() => {
    const m: Record<number, number> = {}
    for (const r of results) { m[r.status] = (m[r.status] || 0) + 1 }
    return m
  }, [results])

  const filtered = useMemo(() =>
    results.filter(r => {
      const matchStatus = statusFilter === null || r.status === statusFilter
      const matchFilter = !filter || r.url.toLowerCase().includes(filter.toLowerCase()) || (r.contentType || '').includes(filter)
      const matchInteresting = !showInterestingOnly || r.interesting
      return matchStatus && matchFilter && matchInteresting
    }).sort((a, b) => {
      if (a.interesting && !b.interesting) return -1
      if (!a.interesting && b.interesting) return 1
      return a.status - b.status
    }), [results, filter, statusFilter, showInterestingOnly])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Filter paths, content types..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 260 }}
        />
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setStatusFilter(null)}
            className="px-2 py-1 rounded text-xs"
            style={{ background: statusFilter === null && !showInterestingOnly ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
            All ({results.length})
          </button>
          {interestingCount > 0 && (
            <button onClick={() => setShowInterestingOnly(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs"
              style={{ background: showInterestingOnly ? 'rgba(249,115,22,0.15)' : 'var(--bg-card)', color: '#f97316', border: '1px solid var(--border)' }}>
              <Star size={10} />
              Interesting ({interestingCount})
            </button>
          )}
          {Object.entries(statusCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([s, c]) => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === parseInt(s) ? null : parseInt(s))}
              className="px-2 py-1 rounded text-xs"
              style={{
                background: statusFilter === parseInt(s) ? statusColor(parseInt(s)) + '22' : 'var(--bg-card)',
                color: statusColor(parseInt(s)),
                border: '1px solid var(--border)',
              }}>
              {s} ({c})
            </button>
          ))}
        </div>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>{filtered.length} paths</span>
      </div>

      <DataTable
        columns={[
          {
            key: 'status', label: 'Status', width: 85,
            render: (r: DirResult) => (
              <div className="flex items-center gap-1">
                <span className="font-mono font-bold text-xs" style={{ color: statusColor(r.status) }}>{r.status}</span>
                <span className="text-xs" style={{ color: statusColor(r.status), opacity: 0.7 }}>{statusLabel(r.status)}</span>
              </div>
            ),
          },
          {
            key: 'url', label: 'Path',
            render: (r: DirResult) => (
              <div className="flex items-center gap-1.5">
                {r.interesting && (
                  <AlertTriangle size={11} style={{ color: '#f97316', flexShrink: 0 }} />
                )}
                <span className="font-mono text-xs truncate" style={{ color: r.interesting ? '#f97316' : 'var(--text-primary)' }}>
                  {r.url}
                </span>
                <button className="opacity-40 hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => window.open(r.url, '_blank')}>
                  <ExternalLink size={10} style={{ color: 'var(--accent)' }} />
                </button>
              </div>
            ),
          },
          {
            key: 'contentType', label: 'Type', width: 110,
            render: (r: DirResult) => <ContentTypeBadge ct={r.contentType} />,
          },
          {
            key: 'size', label: 'Size', width: 75,
            render: (r: DirResult) => (
              <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{formatSize(r.size)}</span>
            ),
          },
          {
            key: 'redirect', label: 'Redirect',
            render: (r: DirResult) => r.redirect
              ? <span className="font-mono text-xs truncate" style={{ color: '#fbbf24' }}>{r.redirect}</span>
              : null,
          },
        ]}
        data={filtered}
        emptyMessage="No directories found"
      />
    </div>
  )
}
