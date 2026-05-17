import React, { useState, useMemo } from 'react'
import { PortResult } from '../../types'
import DataTable from '../ui/DataTable'
import { AlertTriangle, ExternalLink } from 'lucide-react'

interface Props { ports: PortResult[] }

const RISK_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#3b82f6',
}

const RISK_LABEL: Record<string, string> = {
  critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', info: 'INFO',
}

const SERVICE_CATEGORIES: Record<string, { label: string; color: string }> = {
  ftp: { label: 'File Transfer', color: '#fb923c' },
  ssh: { label: 'Remote Shell', color: '#60a5fa' },
  'ssh-alt': { label: 'Remote Shell', color: '#60a5fa' },
  telnet: { label: 'Remote Shell', color: '#ef4444' },
  smtp: { label: 'Mail', color: '#34d399' },
  smtps: { label: 'Mail', color: '#34d399' },
  'smtp-sub': { label: 'Mail', color: '#34d399' },
  dns: { label: 'DNS', color: '#fbbf24' },
  http: { label: 'Web', color: '#22d3ee' },
  https: { label: 'Web', color: '#22d3ee' },
  'http-alt': { label: 'Web', color: '#22d3ee' },
  'https-alt': { label: 'Web', color: '#22d3ee' },
  'http-proxy': { label: 'Proxy', color: '#a78bfa' },
  mysql: { label: 'Database', color: '#f472b6' },
  postgresql: { label: 'Database', color: '#f472b6' },
  mssql: { label: 'Database', color: '#f472b6' },
  oracle: { label: 'Database', color: '#f472b6' },
  mongodb: { label: 'Database', color: '#f472b6' },
  redis: { label: 'In-Memory DB', color: '#ef4444' },
  elasticsearch: { label: 'Search', color: '#f97316' },
  'elasticsearch-cluster': { label: 'Search', color: '#f97316' },
  rdp: { label: 'Remote Desktop', color: '#ef4444' },
  vnc: { label: 'Remote Desktop', color: '#ef4444' },
  docker: { label: 'Container', color: '#60a5fa' },
  'docker-ssl': { label: 'Container', color: '#60a5fa' },
  kubernetes: { label: 'Orchestration', color: '#60a5fa' },
  'kubernetes-kubelet': { label: 'Orchestration', color: '#ef4444' },
  memcached: { label: 'Cache', color: '#fbbf24' },
  rabbitmq: { label: 'Message Queue', color: '#f97316' },
  kafka: { label: 'Message Queue', color: '#f97316' },
  jenkins: { label: 'CI/CD', color: '#f97316' },
}

export default function PortsTab({ ports }: Props) {
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<'port' | 'host' | 'risk'>('risk')
  const [riskFilter, setRiskFilter] = useState<string | null>(null)

  const open = useMemo(() => ports.filter(p => p.state === 'open'), [ports])

  const riskOrder = ['critical', 'high', 'medium', 'low', 'info']

  const filtered = useMemo(() => {
    let items = open.filter(p =>
      (!riskFilter || p.risk === riskFilter) &&
      (!filter
        || String(p.port).includes(filter)
        || p.host.toLowerCase().includes(filter.toLowerCase())
        || (p.service || '').toLowerCase().includes(filter.toLowerCase())
        || (p.version || '').toLowerCase().includes(filter.toLowerCase())
        || (p.banner || '').toLowerCase().includes(filter.toLowerCase()))
    )
    if (sortKey === 'risk') {
      items = items.sort((a, b) => riskOrder.indexOf(a.risk || 'info') - riskOrder.indexOf(b.risk || 'info'))
    } else if (sortKey === 'port') {
      items = items.sort((a, b) => a.port - b.port)
    } else {
      items = items.sort((a, b) => a.host.localeCompare(b.host))
    }
    return items
  }, [open, filter, sortKey, riskFilter])

  const riskCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of open) { const r = p.risk || 'info'; m[r] = (m[r] || 0) + 1 }
    return m
  }, [open])

  return (
    <div className="space-y-3">
      {/* Risk breakdown */}
      <div className="flex gap-2 flex-wrap">
        {riskOrder.filter(r => riskCounts[r]).map(r => (
          <button key={r} onClick={() => setRiskFilter(r === riskFilter ? null : r)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: riskFilter === r ? RISK_COLOR[r] + '22' : 'var(--bg-card)',
              color: RISK_COLOR[r],
              border: `1px solid ${riskFilter === r ? RISK_COLOR[r] + '44' : 'var(--border)'}`,
            }}>
            {r === 'critical' || r === 'high' ? <AlertTriangle size={11} /> : null}
            {RISK_LABEL[r]} <span className="opacity-70">{riskCounts[r]}</span>
          </button>
        ))}
        <span className="ml-auto text-xs self-center" style={{ color: 'var(--text-secondary)' }}>
          {open.length} open ports
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Filter ports, hosts, services, banners..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 280 }}
        />
        <div className="flex gap-1">
          {(['risk', 'port', 'host'] as const).map(k => (
            <button key={k} onClick={() => setSortKey(k)}
              className="px-2.5 py-1 rounded text-xs capitalize"
              style={{ background: sortKey === k ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)', color: sortKey === k ? 'var(--accent)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              {k}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={[
          {
            key: 'risk', label: 'Risk', width: 85,
            render: (r: PortResult) => {
              const risk = r.risk || 'info'
              return (
                <span className="px-2 py-0.5 rounded text-xs font-bold"
                  style={{ background: RISK_COLOR[risk] + '20', color: RISK_COLOR[risk] }}>
                  {RISK_LABEL[risk]}
                </span>
              )
            },
          },
          {
            key: 'port', label: 'Port', width: 75,
            render: (r: PortResult) => (
              <span className="font-mono text-sm font-bold" style={{ color: 'var(--accent)' }}>{r.port}</span>
            ),
          },
          {
            key: 'host', label: 'Host',
            render: (r: PortResult) => (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs">{r.host}</span>
                <button className="opacity-40 hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => window.open(`http://${r.host}:${r.port}`, '_blank')}>
                  <ExternalLink size={10} style={{ color: 'var(--accent)' }} />
                </button>
              </div>
            ),
          },
          {
            key: 'service', label: 'Service', width: 130,
            render: (r: PortResult) => {
              const svc = r.service || 'unknown'
              const cat = SERVICE_CATEGORIES[svc]
              return (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium" style={{ color: '#a78bfa' }}>{svc}</span>
                  {cat && (
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: cat.color + '18', color: cat.color, fontSize: '10px' }}>
                      {cat.label}
                    </span>
                  )}
                </div>
              )
            },
          },
          {
            key: 'version', label: 'Version / Banner',
            render: (r: PortResult) => {
              const display = r.version || r.banner
              if (!display) return <span style={{ color: 'var(--border)' }}>—</span>
              return (
                <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}
                  title={display}>
                  {display.slice(0, 80)}
                </span>
              )
            },
          },
        ]}
        data={filtered}
        emptyMessage="No open ports found"
      />
    </div>
  )
}
