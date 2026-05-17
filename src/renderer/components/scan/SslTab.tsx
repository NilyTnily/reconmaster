import React, { useMemo } from 'react'
import { SslResult } from '../../types'
import { AlertTriangle, CheckCircle, Lock, Shield, Calendar } from 'lucide-react'

interface Props { results: SslResult[] }

function DaysBar({ days }: { days: number }) {
  const max = 365
  const pct = Math.max(0, Math.min(100, (days / max) * 100))
  const color = days < 0 ? '#ef4444' : days < 14 ? '#ef4444' : days < 30 ? '#f97316' : days < 90 ? '#eab308' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)', minWidth: 60 }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono font-bold shrink-0" style={{ color, minWidth: 50 }}>
        {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
      </span>
    </div>
  )
}

function GradeBadge({ grade }: { grade?: string }) {
  if (!grade) return null
  const colors: Record<string, string> = { 'A+': '#22c55e', A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444' }
  const color = colors[grade] || '#888'
  return (
    <span className="w-7 h-7 flex items-center justify-center rounded font-bold text-sm"
      style={{ background: color + '20', color }}>
      {grade}
    </span>
  )
}

export default function SslTab({ results }: Props) {
  const sorted = useMemo(() =>
    [...results].sort((a, b) => {
      const aIssues = (a.issues || []).length
      const bIssues = (b.issues || []).length
      if (aIssues !== bIssues) return bIssues - aIssues
      const ad = a.daysLeft ?? 999
      const bd = b.daysLeft ?? 999
      return ad - bd
    }), [results])

  if (results.length === 0) {
    return <div className="text-center py-12 text-xs" style={{ color: 'var(--text-secondary)' }}>No SSL results</div>
  }

  return (
    <div className="space-y-3">
      {sorted.map((r, i) => {
        const hasIssues = (r.issues || []).length > 0
        const isExpired = (r.daysLeft ?? 1) < 0
        const isCritical = (r.daysLeft ?? 1) < 14 && (r.daysLeft ?? 1) >= 0

        return (
          <div key={`${r.host}:${r.port}:${i}`} className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${hasIssues ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`, background: 'var(--bg-card)' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)', background: hasIssues ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
              <Lock size={16} style={{ color: hasIssues ? '#ef4444' : '#22c55e', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">{r.host}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>:{r.port}</span>
                  {isExpired && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>EXPIRED</span>
                  )}
                  {!isExpired && isCritical && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>EXPIRING SOON</span>
                  )}
                </div>
                {r.subject && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Subject: <span style={{ color: 'var(--text-primary)' }}>{r.subject}</span>
                  </div>
                )}
              </div>
              <GradeBadge grade={r.grade} />
              {hasIssues
                ? <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                : <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} />}
            </div>

            {/* Body */}
            <div className="grid grid-cols-2 gap-4 px-4 py-3">
              {/* Left column */}
              <div className="space-y-2.5">
                {/* Certificate validity */}
                <div>
                  <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <Calendar size={11} /> Validity
                  </div>
                  <div className="space-y-1 text-xs">
                    {r.validFrom && (
                      <div className="flex gap-2">
                        <span style={{ color: 'var(--text-secondary)', minWidth: 60 }}>Issued:</span>
                        <span style={{ color: 'var(--text-primary)' }}>{new Date(r.validFrom).toLocaleDateString()}</span>
                      </div>
                    )}
                    {r.expiry && (
                      <div className="flex gap-2">
                        <span style={{ color: 'var(--text-secondary)', minWidth: 60 }}>Expires:</span>
                        <span style={{ color: 'var(--text-primary)' }}>{new Date(r.expiry).toLocaleDateString()}</span>
                      </div>
                    )}
                    {r.daysLeft != null && (
                      <div className="mt-1">
                        <DaysBar days={r.daysLeft} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Issuer */}
                <div>
                  <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Certificate Authority</div>
                  <div className="text-xs" style={{ color: r.issuer ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {r.issuer || '—'}
                  </div>
                  {r.serial && (
                    <div className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }} title={r.serial}>
                      Serial: {r.serial.slice(0, 32)}…
                    </div>
                  )}
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-2.5">
                {/* Protocols */}
                <div>
                  <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <Shield size={11} /> Protocol & Cipher
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(r.protocols || []).map(p => {
                      const isWeak = p.includes('1.0') || p.includes('1.1') || p.includes('SSLv')
                      return (
                        <span key={p} className="px-2 py-0.5 rounded text-xs font-mono"
                          style={{ background: isWeak ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: isWeak ? '#ef4444' : '#22c55e' }}>
                          {isWeak && '⚠ '}{p}
                        </span>
                      )
                    })}
                  </div>
                  {(r.ciphers || []).length > 0 && (
                    <div className="mt-1.5 text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                      {r.ciphers![0]}
                    </div>
                  )}
                </div>

                {/* Issues */}
                {hasIssues && (
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: '#ef4444' }}>Issues</div>
                    <div className="space-y-1">
                      {(r.issues || []).map((issue, j) => (
                        <div key={j} className="flex items-start gap-1.5">
                          <AlertTriangle size={11} style={{ color: '#f97316', flexShrink: 0, marginTop: 1 }} />
                          <span className="text-xs" style={{ color: '#f97316' }}>{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!hasIssues && (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={13} style={{ color: '#22c55e' }} />
                    <span className="text-xs" style={{ color: '#22c55e' }}>No issues detected</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
