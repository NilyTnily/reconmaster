import React, { useState, useMemo } from 'react'
import { OsintResult } from '../../types'
import { Mail, User, Globe, Server, Tag, Database, Building, Copy, Check } from 'lucide-react'

interface Props { results: OsintResult[] }

const TYPE_ICONS: Record<string, React.ElementType> = {
  email: Mail, person: User, ip: Server, domain: Globe, linkedin: Globe, other: Tag, whois: Database,
}
const TYPE_COLORS: Record<string, string> = {
  email: '#60a5fa', person: '#a78bfa', ip: '#34d399', domain: '#fbbf24',
  linkedin: '#0ea5e9', other: '#888', whois: '#22d3ee',
}

function EmailCard({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(email).catch(() => {
      const el = document.createElement('textarea')
      el.value = email
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const domain = email.split('@')[1] || ''
  const user = email.split('@')[0] || ''

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg group"
      style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
      <Mail size={13} style={{ color: '#60a5fa', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono">
          <span style={{ color: 'var(--text-primary)' }}>{user}</span>
          <span style={{ color: 'var(--text-secondary)' }}>@</span>
          <span style={{ color: '#60a5fa' }}>{domain}</span>
        </div>
      </div>
      <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} style={{ color: 'var(--text-secondary)' }} />}
      </button>
    </div>
  )
}

function WhoisCard({ records }: { records: OsintResult[] }) {
  if (records.length === 0) return null
  const get = (extra: string) => records.find(r => r.extra === extra)?.value.split(': ').slice(1).join(': ') || '—'

  const registrar = get('registrar')
  const created = get('created')
  const expiry = get('expiry')
  const updated = get('updated')
  const nameservers = records.find(r => r.extra === 'nameservers')?.value.replace('Nameservers: ', '') || ''
  const status = get('status')
  const dnssec = get('dnssec')

  return (
    <div className="p-4 rounded-xl" style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Building size={14} style={{ color: '#22d3ee' }} />
        <span className="text-xs font-semibold" style={{ color: '#22d3ee' }}>WHOIS Information</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {[
          { label: 'Registrar', value: registrar },
          { label: 'Created', value: created },
          { label: 'Expires', value: expiry },
          { label: 'Updated', value: updated },
          { label: 'DNSSEC', value: dnssec },
          { label: 'Status', value: status },
        ].map(({ label, value }) => value && value !== '—' ? (
          <div key={label} className="flex gap-2 text-xs">
            <span className="shrink-0" style={{ color: 'var(--text-secondary)', minWidth: 70 }}>{label}:</span>
            <span style={{ color: 'var(--text-primary)' }}>{value}</span>
          </div>
        ) : null)}
        {nameservers && (
          <div className="col-span-2 flex gap-2 text-xs">
            <span className="shrink-0" style={{ color: 'var(--text-secondary)', minWidth: 70 }}>Nameservers:</span>
            <span style={{ color: 'var(--text-primary)' }}>{nameservers}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function OsintTab({ results }: Props) {
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const emails = useMemo(() => [...new Set(results.filter(r => r.type === 'email').map(r => r.value))], [results])
  const whoisRecords = useMemo(() => results.filter(r => r.type === 'whois'), [results])
  const otherResults = useMemo(() => results.filter(r => r.type !== 'whois'), [results])

  const types = useMemo(() => [...new Set(otherResults.map(r => r.type))], [otherResults])

  const filtered = useMemo(() =>
    otherResults.filter(r => {
      const matchType = typeFilter === null || r.type === typeFilter
      const matchFilter = !filter
        || r.value.toLowerCase().includes(filter.toLowerCase())
        || r.source.toLowerCase().includes(filter.toLowerCase())
      return matchType && matchFilter
    }), [otherResults, filter, typeFilter])

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of otherResults) { m[r.type] = (m[r.type] || 0) + 1 }
    return m
  }, [otherResults])

  return (
    <div className="space-y-4">
      {/* WHOIS card */}
      <WhoisCard records={whoisRecords} />

      {/* Emails section */}
      {emails.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#60a5fa' }}>
            <Mail size={12} />
            Email Addresses ({emails.length})
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {emails.map(email => <EmailCard key={email} email={email} />)}
          </div>
        </div>
      )}

      {/* Filters and other results */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <input
            type="text"
            placeholder="Filter OSINT results..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', width: 240 }}
          />
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setTypeFilter(null)}
              className="px-2.5 py-1 rounded text-xs"
              style={{ background: typeFilter === null ? 'rgba(0,212,255,0.1)' : 'var(--bg-card)', color: typeFilter === null ? 'var(--accent)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              All ({otherResults.length})
            </button>
            {types.map(t => {
              const Icon = TYPE_ICONS[t] || Tag
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
        </div>

        <div className="space-y-1">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-xs" style={{ color: 'var(--text-secondary)' }}>No results</div>
          )}
          {filtered.map((r, i) => {
            const Icon = TYPE_ICONS[r.type] || Tag
            const color = TYPE_COLORS[r.type] || '#888'
            return (
              <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <Icon size={13} style={{ color, flexShrink: 0, marginTop: 1 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono break-all"
                    style={{ color: r.type === 'domain' ? '#fbbf24' : 'var(--text-primary)' }}>
                    {r.value.length > 200 ? r.value.slice(0, 200) + '…' : r.value}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.extra && r.extra !== 'disallowed' && r.extra !== 'allowed' && r.extra !== 'sitemap' && (
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                      {r.extra}
                    </span>
                  )}
                  {r.extra === 'disallowed' && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>disallow</span>
                  )}
                  {r.extra === 'sitemap' && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>sitemap</span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {r.source}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
