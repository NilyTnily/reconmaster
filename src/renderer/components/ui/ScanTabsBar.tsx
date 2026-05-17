import React, { useState } from 'react'
import { Plus, X, Shield, Minus, Square, Settings, Wrench, History } from 'lucide-react'
import { useScanStore } from '../../store/scanStore'
import NewScanModal from './NewScanModal'

interface Props {
  onNewScan: (target: string, options: Record<string, boolean>) => Promise<void>
}

export default function ScanTabsBar({ onNewScan }: Props) {
  const { scans, activeTabId, setActiveTab, deleteScan, toggleHistory, toggleSettings, toggleTools } = useScanStore()
  const [showModal, setShowModal] = useState(false)

  const statusColor = (status: string) => {
    if (status === 'running') return '#00d4ff'
    if (status === 'completed') return '#22c55e'
    if (status === 'error') return '#ef4444'
    if (status === 'cancelled') return '#666'
    return '#444'
  }

  return (
    <>
      <div
        style={{
          height: 42,
          background: '#080b12',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          WebkitAppRegion: 'drag',
          flexShrink: 0,
          paddingLeft: 8,
          paddingRight: 4,
          userSelect: 'none',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 10, WebkitAppRegion: 'no-drag', flexShrink: 0 }}>
          <Shield size={15} style={{ color: '#ef4444' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', letterSpacing: 2 }}>RECON</span>
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', marginRight: 8, flexShrink: 0 }} />

        {/* New scan */}
        <button
          onClick={() => setShowModal(true)}
          style={{
            WebkitAppRegion: 'no-drag',
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 5,
            background: 'rgba(0,212,255,0.1)', color: '#00d4ff',
            border: '1px solid rgba(0,212,255,0.25)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            flexShrink: 0, marginRight: 8,
          }}
        >
          <Plus size={11} /> New
        </button>

        {/* Scan tabs */}
        <div className="tabs-scroll" style={{ WebkitAppRegion: 'no-drag', display: 'flex', alignItems: 'center', gap: 2, flex: 1, overflowX: 'auto', minWidth: 0 }}>
          {scans.map(scan => {
            const isActive = scan.id === activeTabId
            return (
              <div
                key={scan.id}
                onClick={() => setActiveTab(scan.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px 4px 10px', borderRadius: 6, cursor: 'pointer',
                  background: isActive ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)'}`,
                  borderBottom: `2px solid ${isActive ? '#00d4ff' : 'transparent'}`,
                  maxWidth: 220, minWidth: 90, flexShrink: 0,
                  transition: 'all .12s',
                }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: statusColor(scan.status), flexShrink: 0,
                  animation: scan.status === 'running' ? 'tabPulse 1.5s infinite' : 'none',
                }} />
                <span style={{
                  fontSize: 11, fontFamily: 'monospace',
                  color: isActive ? '#e0e0e0' : 'rgba(255,255,255,0.35)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  {scan.target}
                </span>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    window.electron?.deleteScan(scan.id)
                    deleteScan(scan.id)
                  }}
                  style={{
                    padding: 2, borderRadius: 3, background: 'transparent', border: 'none',
                    cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex',
                    alignItems: 'center', flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)' }}
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Right: utility + window controls */}
        <div style={{ WebkitAppRegion: 'no-drag', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, marginLeft: 8 }}>
          {[
            { Icon: History, action: toggleHistory, tip: 'History' },
            { Icon: Settings, action: toggleSettings, tip: 'Settings' },
            { Icon: Wrench, action: toggleTools, tip: 'Tools' },
          ].map(({ Icon, action, tip }) => (
            <button
              key={tip}
              onClick={action}
              title={tip}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <Icon size={13} />
            </button>
          ))}

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.09)', margin: '0 4px' }} />

          <button onClick={() => window.electron?.minimize?.()} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
            <Minus size={11} />
          </button>
          <button onClick={() => window.electron?.maximize?.()} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
            <Square size={10} />
          </button>
          <button onClick={() => window.electron?.close?.()} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.65)'; (e.currentTarget as HTMLElement).style.color = '#fff' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)' }}>
            <X size={12} />
          </button>
        </div>
      </div>

      <style>{`@keyframes tabPulse { 0%,100%{opacity:1} 50%{opacity:.35} } .tabs-scroll::-webkit-scrollbar{display:none} .tabs-scroll{scrollbar-width:none}`}</style>

      {showModal && (
        <NewScanModal
          onClose={() => setShowModal(false)}
          onStart={async (target, opts) => { setShowModal(false); await onNewScan(target, opts) }}
        />
      )}
    </>
  )
}
