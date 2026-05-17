import React, { useEffect, useCallback, useRef, useState } from 'react'
import { useScanStore, createScan } from './store/scanStore'
import { useAiStore } from './store/aiStore'
import { IpcScanEvent, ScanResult, ScanPhase, ToolStatus, AiProviderConfig, ProviderDef, LogLine, AttackerConfig } from './types'
import ScanTabsBar from './components/ui/ScanTabsBar'
import ScanDashboard from './components/scan/ScanDashboard'
import HistoryPanel from './components/ui/HistoryPanel'
import SettingsPanel from './components/ui/SettingsPanel'
import ToolsPanel from './components/ui/ToolsPanel'
import WelcomeScreen from './components/ui/WelcomeScreen'
import AiChatSidebar from './components/ui/AiChatSidebar'
import AiConnectionModal from './components/ui/AiConnectionModal'
import AppTerminal from './components/ui/AppTerminal'

declare global {
  interface Window {
    electron: {
      startScan: (id: string, target: string, options: Record<string, boolean>) => Promise<{ success: boolean }>
      cancelScan: (id: string) => Promise<{ success: boolean }>
      onScanEvent: (cb: (event: IpcScanEvent) => void) => () => void
      saveScan: (scan: unknown) => Promise<{ success: boolean }>
      loadScans: () => Promise<ScanResult[]>
      deleteScan: (id: string) => Promise<{ success: boolean }>
      exportData: (data: unknown, format: 'csv' | 'json', filename: string) => Promise<{ success: boolean }>
      exportMarkdown: (content: string, filename: string) => Promise<{ success: boolean }>
      getResourcePath: () => Promise<string>
      listTools: () => Promise<ToolStatus[]>
      toggleTool: (name: string, enabled: boolean) => Promise<{ success: boolean }>
      updateTool: (name: string) => Promise<{ success: boolean; error?: string }>
      deleteTool: (name: string) => Promise<{ success: boolean; error?: string }>
      onToolProgress: (cb: (d: { tool: string; msg: string }) => void) => () => void
      // AI Agent
      agentListProviderDefs: () => Promise<ProviderDef[]>
      agentGetState: () => Promise<{ providers: AiProviderConfig[]; activeId: string | null }>
      agentConnect: (cfg: unknown) => Promise<{ success: boolean }>
      agentSetActive: (id: string | null) => Promise<{ success: boolean }>
      agentDisconnect: (id: string) => Promise<{ success: boolean }>
      agentFetchModels: (p: { providerId: string; apiKey?: string; baseUrl?: string }) => Promise<{ success: boolean; models: string[] }>
      agentSaveChat: (chatId: string, messages: unknown[]) => Promise<{ success: boolean }>
      agentLoadChat: (chatId: string) => Promise<unknown[]>
      agentChat: (p: { history: unknown[]; scanData: unknown; chatId: string; weaponList?: unknown[] }) => Promise<{ success: boolean; error?: string }>
      agentCancel: () => Promise<{ success: boolean }>
      agentApprove: (toolCallId: string, approved: boolean) => Promise<{ success: boolean }>
      onAgentChunk: (cb: (d: { chatId: string; text: string }) => void) => () => void
      onAgentToolCall: (cb: (d: { chatId: string; id: string; name: string; label: string; args: Record<string, unknown>; tier: string }) => void) => () => void
      onAgentToolResult: (cb: (d: { chatId: string; id: string; result: string }) => void) => () => void
      onAgentApprovalRequired: (cb: (d: { chatId: string; id: string; name: string; label: string; args: Record<string, unknown>; tier: string }) => void) => () => void
      onAgentBrowserUpdate: (cb: (d: { chatId: string; url: string; screenshotB64?: string }) => void) => () => void
      onAgentDone: (cb: (d: { chatId: string }) => void) => () => void
      onAgentError: (cb: (d: { chatId: string; error: string }) => void) => () => void
      onAgentWeaponStatusUpdate: (cb: (d: { chatId: string; weaponId: string; status: string; note?: string }) => void) => () => void
      onAgentScanCreated: (cb: (d: { scanId: string; target: string }) => void) => () => void
      browserShow: (visible: boolean) => Promise<{ success: boolean }>
      browserClose: () => Promise<{ success: boolean }>
      browserGetUrl: () => Promise<string>
      browserNewTab: (url?: string) => Promise<{ tabId: string; url: string; title: string }>
      browserSwitchTab: (tabId: string) => Promise<{ url: string; title: string }>
      browserCloseTab: (tabId: string) => Promise<{ success: boolean }>
      browserGetTabs: () => Promise<{ id: string; url: string; title: string }[]>
      // Exploit engine
      exploitRun: (params: { weaponId: string; item: unknown; scanData: unknown; attackerCfg: unknown }) => Promise<{ success: boolean }>
      exploitCancel: (weaponId: string) => Promise<{ success: boolean }>
      onExploitChunk: (cb: (d: { weaponId: string; text: string; phase: number }) => void) => () => void
      onExploitDone: (cb: (d: { weaponId: string; confirmed: boolean; evidence: string; phase: number; log: string }) => void) => () => void
      // Terminal
      terminalRun: (params: { tabId: string; command: string }) => Promise<{ success: boolean }>
      terminalKill: (params: { tabId: string }) => Promise<{ success: boolean }>
      onTerminalOutput: (cb: (d: { tabId: string; text: string }) => void) => () => void
      onTerminalDone: (cb: (d: { tabId: string; code: number }) => void) => () => void
      // Attacker config
      getAttackerConfig: () => Promise<AttackerConfig>
      setAttackerConfig: (cfg: AttackerConfig) => Promise<{ success: boolean }>
      // GitHub token
      getGithubToken: () => Promise<{ token: string }>
      setGithubToken: (token: string) => Promise<{ success: boolean }>
      // Legacy AI
      getAiConfig: () => Promise<{ apiKey: string; model: string }>
      setAiConfig: (cfg: { apiKey: string; model: string }) => Promise<{ success: boolean }>
      agentGetSettings: () => Promise<{ autonomousMode?: boolean; maxIterations?: number }>
      agentSetSettings: (s: { autonomousMode?: boolean; maxIterations?: number }) => Promise<{ success: boolean }>
      platform: string
      minimize: () => void
      maximize: () => void
      close: () => void
    }
  }
}

export default function App() {
  const { scans, activeTabId, historyOpen, settingsOpen, toolsOpen, addScan, updateScan, appendLog, loadScans, markPhaseStart, patchPhase, completeScan } = useScanStore()
  const { setProviderDefs, setSavedProviders, connectionModalOpen } = useAiStore()
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const lastSavedAt = useRef<Map<string, string>>(new Map())

  // Load AI provider state on startup
  useEffect(() => {
    window.electron?.agentListProviderDefs?.().then(defs => { if (defs) setProviderDefs(defs) })
    window.electron?.agentGetState?.().then(state => { if (state) setSavedProviders(state.providers, state.activeId) })
  }, [])

  const debouncedSave = useCallback((scan: ScanResult) => {
    const prev = saveTimers.current.get(scan.id)
    if (prev) clearTimeout(prev)
    const t = setTimeout(() => {
      lastSavedAt.current.set(scan.id, scan.updatedAt)
      window.electron?.saveScan(scan)
    }, 2000)
    saveTimers.current.set(scan.id, t)
  }, [])

  useEffect(() => {
    window.electron?.loadScans().then(saved => {
      if (!saved?.length) return
      const normalized = saved.map(s => s.status === 'running' ? { ...s, status: 'error' as const } : s)
      const savedActiveId = localStorage.getItem('activeTabId')
      loadScans(normalized, savedActiveId)
    })
  }, [loadScans])

  // Flush any pending debounced saves immediately when the window is about to close
  useEffect(() => {
    const flush = () => {
      for (const scan of useScanStore.getState().scans) {
        if (lastSavedAt.current.get(scan.id) !== scan.updatedAt) {
          window.electron?.saveScan(scan)
          lastSavedAt.current.set(scan.id, scan.updatedAt)
        }
      }
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  useEffect(() => {
    if (!window.electron?.onScanEvent) return
    const fieldMap: Record<ScanPhase, keyof ScanResult> = {
      dns: 'dns',
      subdomains: 'subdomains',
      ports: 'ports',
      http: 'http',
      fingerprint: 'http',
      dirs: 'dirs',
      ssl: 'ssl',
      vulns: 'vulnerabilities',
      osint: 'osint',
      crawl: 'jsEndpoints',
      xss: 'xssResults',
      idor: 'idorResults',
    }
    const cleanup = window.electron.onScanEvent((event: IpcScanEvent) => {
      const { scanId, type, phase, data } = event

      if (type === 'log') {
        appendLog(scanId, data as LogLine)
        return
      }

      if (type === 'phase-start' && phase) {
        markPhaseStart(scanId, phase, (data as { startedAt: string }).startedAt)
        return
      }

      if (type === 'phase-end' && phase) {
        const field = fieldMap[phase]
        const phaseData = data as { results: unknown; completedAt: string }
        if (field) patchPhase(scanId, phase, field, phaseData.results, phaseData.completedAt)
        return
      }

      if (type === 'scan-complete') {
        completeScan(scanId, data as Record<string, unknown>)
        const finalScan = useScanStore.getState().scans.find(s => s.id === scanId)
        if (finalScan) window.electron?.saveScan(finalScan)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        setToast({ msg: `Scan complete: ${finalScan?.target || scanId}`, color: '#22c55e' })
        toastTimer.current = setTimeout(() => setToast(null), 4000)
        return
      }

      if (type === 'scan-error') {
        updateScan(scanId, { status: 'error' })
        if (toastTimer.current) clearTimeout(toastTimer.current)
        setToast({ msg: `Scan error: ${scanId}`, color: '#ef4444' })
        toastTimer.current = setTimeout(() => setToast(null), 4000)
      }
    })

    return cleanup
  }, [])

  // Auto-save only scans whose updatedAt changed since last save
  useEffect(() => {
    for (const scan of scans) {
      if (lastSavedAt.current.get(scan.id) !== scan.updatedAt) {
        debouncedSave(scan)
      }
    }
  }, [scans, debouncedSave])

  // Add scan when AI initiates one from the agent loop
  useEffect(() => {
    if (!window.electron?.onAgentScanCreated) return
    const off = window.electron.onAgentScanCreated(({ scanId, target }) => {
      addScan(createScan(target, scanId))
    })
    return off
  }, [addScan])

  // Auto-expand terminal when AI Shell writes output to it
  useEffect(() => {
    if (!window.electron?.onTerminalOutput) return
    const off = window.electron.onTerminalOutput(({ tabId }) => {
      if (tabId === 'ai') setTermCollapsed(false)
    })
    return off
  }, [])

  const handleNewScan = useCallback(async (target: string, options: Record<string, boolean>) => {
    const scan = createScan(target)
    addScan(scan)
    window.electron?.saveScan(scan)
    await window.electron?.startScan(scan.id, target, options)
  }, [addScan])

  const handleCancelScan = useCallback(async (scanId: string) => {
    await window.electron?.cancelScan(scanId)
    updateScan(scanId, { status: 'cancelled' })
  }, [updateScan])

  const activeScan = scans.find(s => s.id === activeTabId)
  const [termHeight, setTermHeight] = useState(180)
  const [termCollapsed, setTermCollapsed] = useState(false)
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Unified tab bar */}
      <ScanTabsBar onNewScan={handleNewScan} />

      {/* Main row: panels + content + AI sidebar */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Slide-in panels */}
        {historyOpen && <HistoryPanel />}
        {settingsOpen && <SettingsPanel />}
        {toolsOpen && <ToolsPanel />}

        {/* Center column: scan content + terminal */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {activeScan ? (
              <ScanDashboard scan={activeScan} onCancel={handleCancelScan} />
            ) : (
              <WelcomeScreen onNewScan={handleNewScan} />
            )}
          </div>

          {/* Integrated terminal */}
          <AppTerminal
            height={termCollapsed ? 34 : termHeight}
            onHeightChange={setTermHeight}
            collapsed={termCollapsed}
            onToggleCollapse={() => setTermCollapsed(c => !c)}
          />
        </div>

        {/* AI sidebar — always visible */}
        <AiChatSidebar activeScan={activeScan ?? null} />
      </div>

      {connectionModalOpen && <AiConnectionModal />}

      {/* Scan complete / error toast */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(10,14,22,0.95)', border: `1px solid ${toast.color}50`,
            color: toast.color, fontSize: 12, fontFamily: 'monospace',
            padding: '8px 16px', borderRadius: 8, zIndex: 9999,
            boxShadow: `0 0 16px ${toast.color}25`, cursor: 'pointer',
            animation: 'fadeInUp .18s ease',
          }}
        >
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  )
}
