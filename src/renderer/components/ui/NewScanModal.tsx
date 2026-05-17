import React, { useState } from 'react'
import { X, Shield, Globe } from 'lucide-react'

interface Props {
  onClose: () => void
  onStart: (target: string, options: Record<string, boolean>) => Promise<void>
}

const SCAN_OPTIONS = [
  { key: 'dns', label: 'DNS Enumeration', desc: 'A, AAAA, MX, NS, TXT, CNAME, SOA, zone transfer' },
  { key: 'subdomains', label: 'Subdomain Discovery', desc: 'subfinder, amass, assetfinder, crt.sh' },
  { key: 'ports', label: 'Port Scanning', desc: 'naabu (fast) + nmap (deep with scripts)' },
  { key: 'http', label: 'HTTP Probing', desc: 'httpx — status, title, tech, redirects' },
  { key: 'ssl', label: 'SSL/TLS Analysis', desc: 'tlsx — cipher suites, expiry, misconfigs' },
  { key: 'dirs', label: 'Directory Enumeration', desc: 'ffuf + gobuster with wordlists' },
  { key: 'vulns', label: 'Vulnerability Scan', desc: 'nuclei — CVEs, misconfigs, exposures, takeovers' },
  { key: 'osint', label: 'OSINT', desc: 'theHarvester, WHOIS, email & personnel discovery' },
  { key: 'crawl', label: 'Crawling & JS Analysis', desc: 'katana spidering, endpoint & secret extraction' },
]

const VALID_TARGET = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$|^(\d{1,3}\.){3}\d{1,3}$|^[a-f0-9:]{2,39}$/i

export default function NewScanModal({ onClose, onStart }: Props) {
  const [target, setTarget] = useState('')
  const [targetError, setTargetError] = useState('')
  const [options, setOptions] = useState<Record<string, boolean>>(
    Object.fromEntries(SCAN_OPTIONS.map(o => [o.key, true]))
  )
  const [starting, setStarting] = useState(false)

  const toggleAll = (val: boolean) => {
    setOptions(Object.fromEntries(SCAN_OPTIONS.map(o => [o.key, val])))
  }

  const handleStart = async () => {
    const t = target.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!t) return
    if (!VALID_TARGET.test(t)) {
      setTargetError('Enter a valid domain or IP address (e.g. example.com, 192.168.1.1)')
      return
    }
    setTargetError('')
    setStarting(true)
    await onStart(t, options)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="rounded-xl w-full max-w-lg mx-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Globe size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="font-semibold text-base">New Scan</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Target input */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Target Domain / URL
            </label>
            <input
              type="text"
              value={target}
              onChange={e => { setTarget(e.target.value); if (targetError) setTargetError('') }}
              onKeyDown={e => e.key === 'Enter' && handleStart()}
              placeholder="example.com or https://example.com"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{
                background: 'var(--bg-secondary)',
                border: `1px solid ${targetError ? '#ef4444' : 'var(--border)'}`,
                color: 'var(--text-primary)',
              }}
            />
            {targetError && (
              <p className="text-xs mt-1.5" style={{ color: '#ef4444' }}>{targetError}</p>
            )}
          </div>

          {/* Scan options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Scan Modules
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleAll(true)}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ color: 'var(--accent)' }}
                >
                  All
                </button>
                <button
                  onClick={() => toggleAll(false)}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  None
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {SCAN_OPTIONS.map(opt => (
                <label
                  key={opt.key}
                  className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{
                    background: options[opt.key] ? 'rgba(0,212,255,0.05)' : 'transparent',
                    border: '1px solid',
                    borderColor: options[opt.key] ? 'rgba(0,212,255,0.2)' : 'var(--border)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={options[opt.key]}
                    onChange={e => setOptions(o => ({ ...o, [opt.key]: e.target.checked }))}
                    className="mt-0.5"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{opt.label}</div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                      {opt.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!target.trim() || starting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            <Shield size={14} />
            {starting ? 'Starting...' : 'Start Scan'}
          </button>
        </div>
      </div>
    </div>
  )
}
