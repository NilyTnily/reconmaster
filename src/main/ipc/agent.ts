import { shell } from 'electron'
import { handle } from './handle'
import fs from 'fs'
import path from 'path'
import { PROVIDERS, getAdapter, getProviderDef } from '../providers/index'
import type { AgentMsg } from '../providers/index'
import { runAgentLoop, cancelAgentLoop, resolveApproval } from '../agentLoop'
import {
  browserNavigate, browserReadDom, browserScreenshot,
  browserClick, browserFill, browserFillForm, browserExecuteJs,
  browserNewTab, browserSwitchTab, browserCloseTab, getOpenTabs,
} from '../browserAgent'
import { AgentContext } from '../agentTools'
import { ScanOrchestrator } from '../orchestrator'
import { encryptSecret } from '../lib/secureStorage'
import { runCommand as safeRunCommand, spawnStreaming as safeSpawnStreaming } from '../lib/commandRunner'
import { assertExternalScope } from '../lib/scopeValidator'
import { auditLog } from '../lib/auditLog'
import { logger } from '../lib/logger'
import { loadAgentSettings, loadProviders, saveProviders } from './shared'
import { validate, AgentConnectSchema, AgentSettingsSchema, AgentApproveSchema, AgentChatSchema } from './validate'
import type { ProviderEntry } from '../types/provider'
import type { ScanData } from '../types/scan'
import { TOOL_DEFS } from './tools'
import type { IpcDeps } from './types'

export function register(deps: IpcDeps): void {
  const { getWindow, getUserData, orchestrators } = deps

  // ── Agent settings ───────────────────────────────────────────────────────────

  handle('agent:getSettings', async () => loadAgentSettings(getUserData()))

  handle('agent:setSettings', async (_, raw: unknown) => {
    const v = validate(AgentSettingsSchema, raw, 'agent:setSettings')
    if (!v.ok) return { success: false, error: v.error }
    const current = loadAgentSettings(getUserData())
    fs.writeFileSync(
      path.join(getUserData(), 'agent-settings.json'),
      JSON.stringify({ ...current, ...v.data }, null, 2),
    )
    return { success: true }
  })

  // ── Provider management ──────────────────────────────────────────────────────

  handle('agent:listProviderDefs', () => PROVIDERS)
  handle('agent:getState', () => loadProviders(getUserData()))

  handle('agent:connect', async (_, raw: unknown) => {
    const v = validate(AgentConnectSchema, raw, 'agent:connect')
    if (!v.ok) return { success: false, error: v.error }
    const cfg = v.data
    const state = loadProviders(getUserData())
    state.providers = state.providers.filter(p => p.id !== cfg.id)
    const entry: ProviderEntry = {
      id: cfg.id,
      providerId: cfg.providerId,
      apiKey: cfg.apiKey ? encryptSecret(cfg.apiKey) : '',
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      label: cfg.label,
      connectedAt: new Date().toISOString(),
    }
    state.providers.push(entry)
    state.activeId = cfg.id
    saveProviders(getUserData(), state)
    return { success: true }
  })

  handle('agent:setActive', async (_, rawId: unknown) => {
    const id = rawId as string | null
    const state = loadProviders(getUserData())
    state.activeId = id
    saveProviders(getUserData(), state)
    return { success: true }
  })

  handle('agent:disconnect', async (_, rawId: unknown) => {
    const id = rawId as string
    const state = loadProviders(getUserData())
    state.providers = state.providers.filter(p => p.id !== id)
    if (state.activeId === id) state.activeId = state.providers[0]?.id || null
    saveProviders(getUserData(), state)
    return { success: true }
  })

  handle('agent:fetchModels', async (_, rawPayload: unknown) => {
    const { providerId, apiKey, baseUrl } = rawPayload as { providerId: string; apiKey?: string; baseUrl?: string }
    try {
      const def = getProviderDef(providerId)
      const adapter = getAdapter(providerId)
      const models = await adapter.fetchModels(apiKey || '', baseUrl || def?.defaultBaseUrl)
      if (!models.length && def?.staticModels.length) return { success: true, models: def.staticModels }
      return { success: true, models }
    } catch {
      const def = getProviderDef(providerId)
      return { success: true, models: def?.staticModels || [] }
    }
  })

  handle('agent:saveChat', async (_, rawChatId: unknown, rawMessages: unknown) => {
    const chatId = rawChatId as string
    const messages = rawMessages as unknown[]
    const chatDir = path.join(getUserData(), 'chats')
    fs.mkdirSync(chatDir, { recursive: true })
    fs.writeFileSync(path.join(chatDir, `${chatId}.json`), JSON.stringify(messages, null, 2))
    return { success: true }
  })

  handle('agent:loadChat', async (_, rawChatId: unknown) => {
    const chatId = rawChatId as string
    try {
      return JSON.parse(fs.readFileSync(path.join(getUserData(), 'chats', `${chatId}.json`), 'utf-8'))
    } catch { return [] }
  })

  // ── Agent chat ───────────────────────────────────────────────────────────────

  handle('agent:chat', async (_, raw: unknown) => {
    const v = validate(AgentChatSchema, raw, 'agent:chat')
    if (!v.ok) return { success: false, error: v.error }
    const { history, scanData, chatId, weaponList } = v.data

    const state = loadProviders(getUserData())
    const active: ProviderEntry | undefined = state.providers.find(p => p.id === state.activeId)
    if (!active) return { success: false, error: 'No AI provider connected. Go to Settings → AI Connection.' }

    const binDir = path.join(getUserData(), 'binaries')

    const memoryDir = path.join(getUserData(), 'memories')
    fs.mkdirSync(memoryDir, { recursive: true })
    const memoryPath = path.join(memoryDir, `${chatId}.json`)

    let attackerConfig: Record<string, string> = { lhost: '', lport: '4444', c2domain: '', interactshUrl: '', sessionCookie: '', customHeaders: '' }
    try { attackerConfig = JSON.parse(fs.readFileSync(path.join(getUserData(), 'attacker-config.json'), 'utf-8')) } catch (err) { logger.warn(`agent:chat — attacker config not loaded: ${err instanceof Error ? err.message : String(err)}`) }

    const toolList = TOOL_DEFS.map(t => ({
      name: t.name, desc: t.desc,
      installed: fs.existsSync(path.join(binDir, t.exe)),
      enabled: true,
    }))

    const enrichedScanData: ScanData | null = scanData
      ? { ...(scanData as ScanData), weaponList: weaponList || [], attackerConfig }
      : null

    const agentOutputDir = path.join(getUserData(), 'agent-output')
    fs.mkdirSync(agentOutputDir, { recursive: true })

    const ctx: AgentContext = {
      scanData: enrichedScanData,
      memoryPath,
      binDir,
      agentOutputDir,
      attackerConfig,
      toolList,
      weaponList: weaponList || [],
      browserNavigate: (url, waitMs) => browserNavigate(url, waitMs),
      browserReadDom,
      browserScreenshot,
      browserClick: (selector, byText) => browserClick(selector, byText),
      browserFill: (selector, value, clearFirst) => browserFill(selector, value, clearFirst),
      browserFillForm: (formSelector) => browserFillForm(formSelector),
      browserExecuteJs,
      browserNewTab: (url) => browserNewTab(url),
      browserSwitchTab: (tabId) => browserSwitchTab(tabId),
      browserCloseTab: (tabId) => browserCloseTab(tabId),
      browserGetTabs: () => getOpenTabs(),
      runCommand: (command, timeoutMs = 30000) => safeRunCommand(command, timeoutMs),
      spawnStreaming: (command, onData, timeoutMs = 60000) => safeSpawnStreaming(command, onData, timeoutMs),
      openFile: (filePath) => { shell.openPath(filePath).catch(() => {}) },
      sendToTerminal: (text) => getWindow()?.webContents.send('terminal:output', { tabId: 'ai', text }),
      setWeaponStatus: (weaponId, status, note) => getWindow()?.webContents.send('agent:weaponStatusUpdate', { chatId, weaponId, status, note }),
      setAttackerConfig: (cfg) => {
        try {
          const stored = { ...cfg, sessionCookie: cfg.sessionCookie ? encryptSecret(cfg.sessionCookie) : '' }
          fs.writeFileSync(path.join(getUserData(), 'attacker-config.json'), JSON.stringify(stored, null, 2))
          auditLog('AGENT_ATTACKER_CONFIG_UPDATE', { fields: Object.keys(cfg).filter(k => k !== 'sessionCookie') })
        } catch (err) {
          logger.error(`agent:setAttackerConfig — ${err instanceof Error ? err.message : String(err)}`)
        }
      },
      startScan: async (target: string, options: Record<string, boolean> = {}) => {
        const agentSettings = loadAgentSettings(getUserData())
        assertExternalScope(target, agentSettings.scopeAllowlist ?? [])
        const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        auditLog('AGENT_SCAN_START', { scanId, target, options })
        getWindow()?.webContents.send('agent:scanCreated', { scanId, target })
        const orchestrator = new ScanOrchestrator(scanId, target, options, getUserData(), (event) => {
          getWindow()?.webContents.send('scan:event', event)
        })
        orchestrators.set(scanId, orchestrator)
        orchestrator.start()
          .then(() => orchestrators.delete(scanId))
          .catch((err: unknown) => {
            orchestrators.delete(scanId)
            getWindow()?.webContents.send('scan:event', { scanId, type: 'scan-error', data: { error: String(err) } })
          })
        return scanId
      },
      cancelScan: async (scanId: string) => {
        const orch = orchestrators.get(scanId)
        if (orch) { orch.cancel(); orchestrators.delete(scanId) }
      },
      exportReport: async (format: 'json' | 'markdown') => {
        const exportDir = path.join(getUserData(), 'exports')
        fs.mkdirSync(exportDir, { recursive: true })
        const s = enrichedScanData
        const safeTarget = (s?.target || 'scan').replace(/[^a-z0-9.-]/gi, '_')
        const ts = Date.now()
        if (format === 'markdown') {
          const vulns = (s?.vulnerabilities || []).slice(0, 30)
            .map(v => `- [${v.severity.toUpperCase()}] **${v.name}** @ \`${v.host}\``).join('\n')
          const ports = (s?.ports || []).filter(p => p.state === 'open').slice(0, 30)
            .map(p => `| ${p.host} | ${p.port} | ${p.service || '?'} |`).join('\n')
          const subs = (s?.subdomains || []).slice(0, 20).map(x => `- ${x.host}`).join('\n')
          const md = [
            `# Recon Report: ${s?.target || 'Unknown'}`,
            `\nGenerated: ${new Date().toISOString()}`,
            `\n## Summary\n\n\`\`\`json\n${JSON.stringify(s?.summary || {}, null, 2)}\n\`\`\``,
            `\n## Vulnerabilities\n\n${vulns || '_None found._'}`,
            `\n## Open Ports\n\n| Host | Port | Service |\n|------|------|---------|  \n${ports || '| - | - | - |'}`,
            `\n## Subdomains (${(s?.subdomains || []).length})\n\n${subs || '_None found._'}`,
          ].join('\n')
          const fp = path.join(exportDir, `${safeTarget}_${ts}.md`)
          fs.writeFileSync(fp, md)
          return fp
        } else {
          const fp = path.join(exportDir, `${safeTarget}_${ts}.json`)
          fs.writeFileSync(fp, JSON.stringify(enrichedScanData, null, 2))
          return fp
        }
      },
    }

    const { autonomousMode, maxIterations } = loadAgentSettings(getUserData())

    runAgentLoop(
      history as AgentMsg[],
      enrichedScanData,
      {
        providerId: active.providerId,
        model: active.model,
        apiKey: active.apiKey || '',
        baseUrl: active.baseUrl,
        autonomousMode,
        maxIterations,
      },
      ctx,
      {
        onChunk: (text) => getWindow()?.webContents.send('agent:chunk', { chatId, text }),
        onToolCall: (id, name, label, args, tier) => getWindow()?.webContents.send('agent:toolCall', { chatId, id, name, label, args, tier }),
        onToolResult: (id, result) => getWindow()?.webContents.send('agent:toolResult', { chatId, id, result }),
        onApprovalRequired: (id, name, label, args, tier) => getWindow()?.webContents.send('agent:approvalRequired', { chatId, id, name, label, args, tier }),
        onBrowserUpdate: (url, screenshotB64) => getWindow()?.webContents.send('agent:browserUpdate', { chatId, url, screenshotB64 }),
        onDone: () => getWindow()?.webContents.send('agent:done', { chatId }),
        onError: (err) => getWindow()?.webContents.send('agent:error', { chatId, error: err }),
      },
    ).catch((err) => getWindow()?.webContents.send('agent:error', { chatId, error: String(err) }))

    return { success: true }
  })

  handle('agent:cancel', async () => {
    cancelAgentLoop()
    return { success: true }
  })

  handle('agent:approve', async (_, raw: unknown) => {
    const v = validate(AgentApproveSchema, raw, 'agent:approve')
    if (!v.ok) return { success: false, error: v.error }
    resolveApproval(v.data.toolCallId, v.data.approved)
    return { success: true }
  })
}
