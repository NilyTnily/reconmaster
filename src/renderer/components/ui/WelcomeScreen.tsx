import React, { useState } from 'react'
import { Shield, Search, Globe, Server, Lock, Bug } from 'lucide-react'
import NewScanModal from './NewScanModal'

interface Props {
  onNewScan: (target: string, options: Record<string, boolean>) => Promise<void>
}

export default function WelcomeScreen({ onNewScan }: Props) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-4">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div
            className="p-4 rounded-2xl"
            style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}
          >
            <Shield size={40} style={{ color: 'var(--accent)' }} />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">ReconMaster</h1>
        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
          Professional web reconnaissance &amp; enumeration platform
        </p>
      </div>

      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105"
        style={{
          background: 'var(--accent)',
          color: '#000',
          boxShadow: '0 0 30px rgba(0,212,255,0.3)',
        }}
      >
        <Search size={16} />
        Start New Scan
      </button>

      <div className="grid grid-cols-3 gap-4 max-w-2xl w-full">
        {FEATURES.map(f => (
          <div
            key={f.label}
            className="p-4 rounded-xl text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex justify-center mb-2">
              <f.icon size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="text-sm font-semibold mb-1">{f.label}</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {showModal && (
        <NewScanModal
          onClose={() => setShowModal(false)}
          onStart={async (target, opts) => {
            setShowModal(false)
            await onNewScan(target, opts)
          }}
        />
      )}
    </div>
  )
}

const FEATURES = [
  { icon: Globe, label: 'DNS & Subdomains', desc: 'Full DNS enumeration + subdomain discovery from multiple sources' },
  { icon: Server, label: 'Port & Service Scan', desc: 'Fast naabu scan + deep nmap with version detection & NSE scripts' },
  { icon: Search, label: 'HTTP Probing', desc: 'Probe all live hosts for status, tech, title, redirects' },
  { icon: Lock, label: 'SSL/TLS Analysis', desc: 'Cipher suites, cert expiry, protocol versions, misconfigurations' },
  { icon: Bug, label: 'Vulnerability Scan', desc: 'nuclei with full community templates — CVEs, misconfigs, exposures' },
  { icon: Shield, label: 'OSINT', desc: 'Email, personnel, WHOIS, cert transparency history' },
]
