import React, { useState, useMemo } from 'react'
import { DnsRecord } from '../../types'
import DataTable from '../ui/DataTable'
import { Shield, AlertTriangle } from 'lucide-react'

interface Props { records: DnsRecord[] }

const TYPE_COLOR: Record<string, string> = {
  A: '#60a5fa', AAAA: '#818cf8', MX: '#34d399', NS: '#fbbf24',
  TXT: '#f472b6', CNAME: '#a78bfa', SOA: '#fb923c', CERT: '#22d3ee',
  PTR: '#6ee7b7', CAA: '#f87171', DMARC: '#4ade80', SPF: '#a3e635',
}

const IMPORTANT_TYPES = ['A', 'AAAA', 'MX', 'NS']

export default function DnsTab({ records }: Props) {
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of records) { m[r.type] = (m[r.type] || 0) + 1 }
    return m
  }, [records])

  const types = useMemo(() => ['ALL', ...Object.keys(typeCounts).sort()], [typeCounts])

  const filtered = useMemo(() => records.filter(r => {
    const matchType = typeFilter === 'ALL' || r.type === typeFilter
    const matchFilter = !filter
      || r.value.toLowerCase().includes(filter.toLowerCase())
      || r.type.toLowerCase().includes(filter.toLowerCase())
      || (r.extra || '').toLowerCase().includes(filter.toLowerCase())
    return matchType && matchFilter
  }), [records, filter, typeFilter])

  const hasDmarc = records.some(r => r.type === 'DMARC')
  const hasSpf = records.some(r => r.type === 'SPF' || (r.type === 'TXT' && r.value.includes('v=spf1')))
  const hasCaa = records.some(r => r.type === 'CAA')

  return (
    <div className="space-y-3">
      {/* Type summary chips */}
      <div className="flex flex-wrap gap-2">
        {IMPORTANT_TYPES.filter(t => typeCounts[t]).map(t => (
          <div key={t} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: (TYPE_COLOR[t] || '#888') + '15', border: `1px solid ${TYPE_COLOR[t] || '#888'}30` }}>
            <span className="font-bold" style={{ color: TYPE_COLOR[t] }}>{t}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{typeCounts[t]}</span>
          </div>
        ))}
        {/* Email security indicators */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ml-auto"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <Shield size={12} style={{ color: hasSpf ? '#4ade80' : 'var(--text-secondary)' }} />
          <span style={{ color: hasSpf ? '#4ade80' : 'var(--text-secondary)' }}>SPF</span>
          <span className="mx-1" style={{ color: 'var(--border)' }}>·</span>
          <Shield size={12} style={{ color: hasDmarc ? '#4ade80' : 'var(--text-secondary)' }} />
          <span style={{ color: hasDmarc ? '#4ade80' : 'var(--text-secondary)' }}>DMARC</span>
          <span className="mx-1" style={{ color: 'var(--border)' }}>·</span>
          <Shield size={12} style={{ color: hasCaa ? '#4ade80' : 'var(--text-secondary)' }} />
          <span style={{ color: hasCaa ? '#4ade80' : 'var(--text-secondary)' }}>CAA</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Filter records..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 220 }}
        />
        <div className="flex gap-1 flex-wrap">
          {types.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: typeFilter === t ? (TYPE_COLOR[t] || 'var(--accent)') + '22' : 'var(--bg-card)',
                color: typeFilter === t ? (TYPE_COLOR[t] || 'var(--accent)') : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: typeFilter === t ? (TYPE_COLOR[t] || 'var(--accent)') + '55' : 'var(--border)',
              }}
            >
              {t}{t !== 'ALL' && typeCounts[t] ? ` (${typeCounts[t]})` : ''}
            </button>
          ))}
        </div>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <DataTable
        columns={[
          {
            key: 'type', label: 'Type', width: 90,
            render: (r: DnsRecord) => (
              <span className="px-2 py-0.5 rounded font-mono text-xs font-bold"
                style={{ background: (TYPE_COLOR[r.type] || '#888') + '20', color: TYPE_COLOR[r.type] || '#888' }}>
                {r.type}
              </span>
            ),
          },
          {
            key: 'value', label: 'Value',
            render: (r: DnsRecord) => (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs break-all">{r.value}</span>
                {(r.type === 'TXT' && r.value.includes('v=spf1')) && (
                  <span className="px-1.5 py-0.5 rounded text-xs shrink-0" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>SPF</span>
                )}
                {r.type === 'DMARC' && (
                  <span className="px-1.5 py-0.5 rounded text-xs shrink-0" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>DMARC</span>
                )}
                {r.type === 'NS' && (
                  <AlertTriangle size={11} className="shrink-0" style={{ color: 'var(--text-secondary)' }} />
                )}
              </div>
            ),
          },
          {
            key: 'extra', label: 'Info', width: 220,
            render: (r: DnsRecord) => r.extra
              ? <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.extra}</span>
              : null,
          },
          {
            key: 'ttl', label: 'TTL', width: 80,
            render: (r: DnsRecord) => r.ttl != null
              ? <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{r.ttl}s</span>
              : <span style={{ color: 'var(--border)' }}>—</span>,
          },
        ]}
        data={filtered}
        emptyMessage="No DNS records found"
      />
    </div>
  )
}
