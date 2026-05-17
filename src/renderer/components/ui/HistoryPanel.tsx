import React from 'react'
import { Trash2, RotateCcw, Clock } from 'lucide-react'
import { useScanStore } from '../../store/scanStore'

export default function HistoryPanel() {
  const { scans, activeTabId, setActiveTab, deleteScan } = useScanStore()

  return (
    <div
      className="w-72 shrink-0 flex flex-col overflow-hidden"
      style={{
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <Clock size={15} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-semibold">Scan History</span>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--accent)' }}
        >
          {scans.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {scans.length === 0 && (
          <div className="text-center py-8 text-xs" style={{ color: 'var(--text-secondary)' }}>
            No scans yet
          </div>
        )}
        {scans.map(scan => (
          <div
            key={scan.id}
            onClick={() => setActiveTab(scan.id)}
            className="group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
            style={{
              background: scan.id === activeTabId ? 'rgba(0,212,255,0.08)' : 'transparent',
              border: '1px solid',
              borderColor: scan.id === activeTabId ? 'rgba(0,212,255,0.25)' : 'transparent',
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{scan.name}</div>
              <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                {scan.target}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={scan.status} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(scan.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {scan.summary.subdomains} hosts · {scan.summary.openPorts} ports · {scan.summary.vulnerabilities} vulns
              </div>
            </div>

            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={e => { e.stopPropagation(); setActiveTab(scan.id) }}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Open"
              >
                <RotateCcw size={12} style={{ color: 'var(--accent)' }} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); window.electron?.deleteScan(scan.id); deleteScan(scan.id) }}
                className="p-1 rounded hover:bg-red-500/20 transition-colors"
                title="Delete"
              >
                <Trash2 size={12} style={{ color: 'var(--danger)' }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    running: { label: 'Running', color: 'var(--accent)' },
    completed: { label: 'Done', color: 'var(--success)' },
    error: { label: 'Error', color: 'var(--danger)' },
    cancelled: { label: 'Cancelled', color: 'var(--text-secondary)' },
    idle: { label: 'Idle', color: 'var(--text-secondary)' },
  }
  const c = cfg[status] || cfg.idle
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded-full font-medium"
      style={{ background: `${c.color}22`, color: c.color }}
    >
      {c.label}
    </span>
  )
}
