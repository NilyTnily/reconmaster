import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  startScan: (scanId: string, target: string, options: Record<string, boolean>) =>
    ipcRenderer.invoke('scan:start', scanId, target, options),

  cancelScan: (scanId: string) =>
    ipcRenderer.invoke('scan:cancel', scanId),

  onScanEvent: (callback: (event: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('scan:event', handler)
    return () => ipcRenderer.removeListener('scan:event', handler)
  },

  saveScan: (scan: unknown) =>
    ipcRenderer.invoke('scan:save', scan),

  loadScans: () =>
    ipcRenderer.invoke('scan:load'),

  deleteScan: (scanId: string) =>
    ipcRenderer.invoke('scan:delete', scanId),

  exportData: (data: unknown, format: 'csv' | 'json', filename: string) =>
    ipcRenderer.invoke('export:data', data, format, filename),

  exportMarkdown: (content: string, filename: string) =>
    ipcRenderer.invoke('export:markdown', content, filename),

  getResourcePath: () =>
    ipcRenderer.invoke('app:resourcePath'),

  listTools: () => ipcRenderer.invoke('tools:list'),
  toggleTool: (name: string, enabled: boolean) => ipcRenderer.invoke('tools:toggle', name, enabled),
  updateTool: (name: string) => ipcRenderer.invoke('tools:update', name),
  deleteTool: (name: string) => ipcRenderer.invoke('tools:delete', name),
  onToolProgress: (cb: (data: { tool: string; msg: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { tool: string; msg: string })
    ipcRenderer.on('tools:progress', h)
    return () => ipcRenderer.removeListener('tools:progress', h)
  },

  // Attacker Config
  getAttackerConfig: () => ipcRenderer.invoke('attacker:getConfig'),
  setAttackerConfig: (cfg: Record<string, string>) => ipcRenderer.invoke('attacker:setConfig', cfg),

  // GitHub token (removes tool-download rate limit)
  getGithubToken: () => ipcRenderer.invoke('tools:getGithubToken'),
  setGithubToken: (token: string) => ipcRenderer.invoke('tools:setGithubToken', token),

  // ── AI Agent ──────────────────────────────────────────────────────────────
  agentListProviderDefs: () => ipcRenderer.invoke('agent:listProviderDefs'),
  agentGetState: () => ipcRenderer.invoke('agent:getState'),
  agentConnect: (cfg: unknown) => ipcRenderer.invoke('agent:connect', cfg),
  agentSetActive: (id: string | null) => ipcRenderer.invoke('agent:setActive', id),
  agentDisconnect: (id: string) => ipcRenderer.invoke('agent:disconnect', id),
  agentFetchModels: (params: { providerId: string; apiKey?: string; baseUrl?: string }) =>
    ipcRenderer.invoke('agent:fetchModels', params),
  agentSaveChat: (chatId: string, messages: unknown[]) =>
    ipcRenderer.invoke('agent:saveChat', chatId, messages),
  agentLoadChat: (chatId: string) =>
    ipcRenderer.invoke('agent:loadChat', chatId),
  agentChat: (params: { history: unknown[]; scanData: unknown; chatId: string }) =>
    ipcRenderer.invoke('agent:chat', params),
  agentCancel: () => ipcRenderer.invoke('agent:cancel'),
  agentApprove: (toolCallId: string, approved: boolean) =>
    ipcRenderer.invoke('agent:approve', { toolCallId, approved }),
  agentGetSettings: () => ipcRenderer.invoke('agent:getSettings'),
  agentSetSettings: (settings: { autonomousMode?: boolean; maxIterations?: number }) =>
    ipcRenderer.invoke('agent:setSettings', settings),

  // Agent events (all keyed by chatId)
  onAgentChunk: (cb: (data: { chatId: string; text: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { chatId: string; text: string })
    ipcRenderer.on('agent:chunk', h)
    return () => ipcRenderer.removeListener('agent:chunk', h)
  },
  onAgentToolCall: (cb: (data: { chatId: string; id: string; name: string; label: string; args: Record<string, unknown>; tier: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { chatId: string; id: string; name: string; label: string; args: Record<string, unknown>; tier: string })
    ipcRenderer.on('agent:toolCall', h)
    return () => ipcRenderer.removeListener('agent:toolCall', h)
  },
  onAgentToolResult: (cb: (data: { chatId: string; id: string; result: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { chatId: string; id: string; result: string })
    ipcRenderer.on('agent:toolResult', h)
    return () => ipcRenderer.removeListener('agent:toolResult', h)
  },
  onAgentApprovalRequired: (cb: (data: { chatId: string; id: string; name: string; label: string; args: Record<string, unknown>; tier: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { chatId: string; id: string; name: string; label: string; args: Record<string, unknown>; tier: string })
    ipcRenderer.on('agent:approvalRequired', h)
    return () => ipcRenderer.removeListener('agent:approvalRequired', h)
  },
  onAgentBrowserUpdate: (cb: (data: { chatId: string; url: string; screenshotB64?: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { chatId: string; url: string; screenshotB64?: string })
    ipcRenderer.on('agent:browserUpdate', h)
    return () => ipcRenderer.removeListener('agent:browserUpdate', h)
  },
  onAgentDone: (cb: (data: { chatId: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { chatId: string })
    ipcRenderer.on('agent:done', h)
    return () => ipcRenderer.removeListener('agent:done', h)
  },
  onAgentError: (cb: (data: { chatId: string; error: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { chatId: string; error: string })
    ipcRenderer.on('agent:error', h)
    return () => ipcRenderer.removeListener('agent:error', h)
  },
  onAgentWeaponStatusUpdate: (cb: (d: { chatId: string; weaponId: string; status: string; note?: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { chatId: string; weaponId: string; status: string; note?: string })
    ipcRenderer.on('agent:weaponStatusUpdate', h)
    return () => ipcRenderer.removeListener('agent:weaponStatusUpdate', h)
  },
  onAgentScanCreated: (cb: (d: { scanId: string; target: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { scanId: string; target: string })
    ipcRenderer.on('agent:scanCreated', h)
    return () => ipcRenderer.removeListener('agent:scanCreated', h)
  },

  // Browser control
  browserClose: () => ipcRenderer.invoke('browser:close'),

  // ── Exploit Engine ────────────────────────────────────────────────────────
  exploitRun: (params: { weaponId: string; item: unknown; scanData: unknown; attackerCfg: unknown }) =>
    ipcRenderer.invoke('exploit:run', params),
  exploitCancel: (weaponId: string) =>
    ipcRenderer.invoke('exploit:cancel', { weaponId }),
  onExploitChunk: (cb: (d: { weaponId: string; text: string; phase: number }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { weaponId: string; text: string; phase: number })
    ipcRenderer.on('exploit:chunk', h)
    return () => ipcRenderer.removeListener('exploit:chunk', h)
  },
  onExploitDone: (cb: (d: { weaponId: string; confirmed: boolean; evidence: string; phase: number; log: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { weaponId: string; confirmed: boolean; evidence: string; phase: number; log: string })
    ipcRenderer.on('exploit:done', h)
    return () => ipcRenderer.removeListener('exploit:done', h)
  },

  // ── Integrated Terminal ────────────────────────────────────────────────────
  terminalRun: (params: { tabId: string; command: string }) =>
    ipcRenderer.invoke('terminal:run', params),
  terminalKill: (params: { tabId: string }) =>
    ipcRenderer.invoke('terminal:kill', params),
  onTerminalOutput: (cb: (d: { tabId: string; text: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { tabId: string; text: string })
    ipcRenderer.on('terminal:output', h)
    return () => ipcRenderer.removeListener('terminal:output', h)
  },
  onTerminalDone: (cb: (d: { tabId: string; code: number }) => void) => {
    const h = (_: Electron.IpcRendererEvent, d: unknown) => cb(d as { tabId: string; code: number })
    ipcRenderer.on('terminal:done', h)
    return () => ipcRenderer.removeListener('terminal:done', h)
  },

  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  platform: process.platform,
})
