import { create } from 'zustand'
import { ScanResult, ScanPhase, LogLine, HttpResult, Vulnerability } from '../types'

interface ScanStore {
  scans: ScanResult[]
  activeTabId: string | null
  historyOpen: boolean
  settingsOpen: boolean
  toolsOpen: boolean
  scanUiState: Record<string, { mainView: 'recon' | 'weapons' }>

  addScan: (scan: ScanResult) => void
  updateScan: (id: string, updates: Partial<ScanResult>) => void
  deleteScan: (id: string) => void
  renameScan: (id: string, name: string) => void
  setActiveTab: (id: string | null) => void
  toggleHistory: () => void
  toggleSettings: () => void
  toggleTools: () => void
  loadScans: (scans: ScanResult[], savedActiveId?: string | null) => void
  appendLog: (scanId: string, log: LogLine) => void
  markPhaseStart: (scanId: string, phase: ScanPhase, startedAt: string) => void
  patchPhase: (scanId: string, phase: ScanPhase, field: keyof ScanResult, results: unknown, completedAt: string) => void
  completeScan: (scanId: string, d: Record<string, unknown>) => void
  setMainView: (scanId: string, view: 'recon' | 'weapons') => void
  patchExploitResult: (scanId: string, weaponId: string, confirmed: boolean, evidence: string) => void
}

function createEmptyScan(id: string, target: string): ScanResult {
  return {
    id,
    target,
    name: target,
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phases: {},
    summary: { subdomains: 0, openPorts: 0, vulnerabilities: 0, emails: 0, technologies: [], criticalVulns: 0, highVulns: 0 },
    dns: [],
    subdomains: [],
    ports: [],
    http: [],
    dirs: [],
    ssl: [],
    vulnerabilities: [],
    osint: [],
    jsEndpoints: [],
    logs: [],
    xssResults: [],
    idorResults: [],
  }
}

export const useScanStore = create<ScanStore>((set, _get) => ({
  scans: [],
  activeTabId: null,
  historyOpen: false,
  settingsOpen: false,
  toolsOpen: false,
  scanUiState: {},

  addScan: (scan) => set(state => ({
    scans: [scan, ...state.scans.filter(s => s.id !== scan.id)],
    activeTabId: scan.id,
  })),

  updateScan: (id, updates) => set(state => ({
    scans: state.scans.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s),
  })),

  deleteScan: (id) => set(state => {
    const remaining = state.scans.filter(s => s.id !== id)
    return {
      scans: remaining,
      activeTabId: state.activeTabId === id ? (remaining[0]?.id ?? null) : state.activeTabId,
    }
  }),

  renameScan: (id, name) => set(state => ({
    scans: state.scans.map(s => s.id === id ? { ...s, name } : s),
  })),

  setActiveTab: (id) => {
    try { localStorage.setItem('activeTabId', id ?? '') } catch { /* ignore */ }
    set({ activeTabId: id })
  },
  toggleHistory: () => set(state => ({ historyOpen: !state.historyOpen, settingsOpen: false, toolsOpen: false })),
  toggleSettings: () => set(state => ({ settingsOpen: !state.settingsOpen, historyOpen: false, toolsOpen: false })),
  toggleTools: () => set(state => ({ toolsOpen: !state.toolsOpen, historyOpen: false, settingsOpen: false })),

  loadScans: (scans, savedActiveId) => {
    const restoredId = savedActiveId && scans.some(s => s.id === savedActiveId)
      ? savedActiveId
      : scans[0]?.id ?? null
    set({ scans, activeTabId: restoredId })
  },

  appendLog: (scanId, log) => set(state => ({
    scans: state.scans.map(s =>
      s.id === scanId
        ? { ...s, logs: [...s.logs.slice(-500), log] }
        : s
    ),
  })),

  markPhaseStart: (scanId, phase, startedAt) => set(state => ({
    scans: state.scans.map(s => {
      if (s.id !== scanId) return s
      return {
        ...s,
        phases: { ...s.phases, [phase]: { phase, status: 'running' as const, startedAt } },
        updatedAt: new Date().toISOString(),
      }
    }),
  })),

  patchPhase: (scanId, phase, field, results, completedAt) => set(state => ({
    scans: state.scans.map(s => {
      if (s.id !== scanId) return s
      const updated = { ...s, [field]: results } as ScanResult
      updated.summary = {
        subdomains: updated.subdomains.length,
        openPorts: updated.ports.filter(p => p.state === 'open').length,
        vulnerabilities: updated.vulnerabilities.length,
        emails: updated.osint.filter(o => o.type === 'email').length,
        technologies: [...new Set(updated.http.flatMap((h: HttpResult) => h.tech || []))],
        criticalVulns: updated.vulnerabilities.filter((v: Vulnerability) => v.severity === 'critical').length,
        highVulns: updated.vulnerabilities.filter((v: Vulnerability) => v.severity === 'high').length,
      }
      updated.phases = {
        ...s.phases,
        [phase]: { ...(s.phases[phase] || {}), status: 'completed' as const, completedAt },
      }
      updated.updatedAt = new Date().toISOString()
      return updated
    }),
  })),

  setMainView: (scanId, view) => set(state => ({
    scanUiState: { ...state.scanUiState, [scanId]: { ...(state.scanUiState[scanId] || {}), mainView: view } },
  })),

  patchExploitResult: (scanId, weaponId, confirmed, evidence) => set(state => ({
    scans: state.scans.map(s => s.id !== scanId ? s : {
      ...s,
      exploitResults: { ...(s.exploitResults || {}), [weaponId]: { confirmed, evidence } },
    }),
  })),

  completeScan: (scanId, d) => set(state => ({
    scans: state.scans.map(s => {
      if (s.id !== scanId) return s
      const updated = {
        ...s,
        status: 'completed' as const,
        dns: d.dns || s.dns,
        subdomains: d.subdomains || s.subdomains,
        ports: d.ports || s.ports,
        http: d.http || s.http,
        ssl: d.ssl || s.ssl,
        dirs: d.dirs || s.dirs,
        vulnerabilities: d.vulnerabilities || s.vulnerabilities,
        osint: d.osint || s.osint,
        jsEndpoints: d.jsEndpoints || s.jsEndpoints,
        xssResults: d.xssResults || s.xssResults,
        idorResults: d.idorResults || s.idorResults,
        exploitResults: (d.exploitResults as ScanResult['exploitResults']) || s.exploitResults,
        weaponStatuses: (d.weaponStatuses as ScanResult['weaponStatuses']) || s.weaponStatuses,
        updatedAt: new Date().toISOString(),
      } as ScanResult
      updated.summary = {
        subdomains: updated.subdomains.length,
        openPorts: updated.ports.filter(p => p.state === 'open').length,
        vulnerabilities: updated.vulnerabilities.length,
        emails: updated.osint.filter(o => o.type === 'email').length,
        technologies: [...new Set(updated.http.flatMap((h: HttpResult) => h.tech || []))],
        criticalVulns: updated.vulnerabilities.filter((v: Vulnerability) => v.severity === 'critical').length,
        highVulns: updated.vulnerabilities.filter((v: Vulnerability) => v.severity === 'high').length,
      }
      return updated
    }),
  })),
}))

export function createScan(target: string, id?: string): ScanResult {
  const scanId = id || `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return createEmptyScan(scanId, target)
}
