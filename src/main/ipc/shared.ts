import fs from 'fs'
import path from 'path'
import { decryptSecret } from '../lib/secureStorage'
import type { ProviderEntry, ProviderState } from '../types/provider'

export interface AgentSettings {
  autonomousMode: boolean
  maxIterations: number
  scopeAllowlist: string[]
}

export function loadAgentSettings(userDataPath: string): AgentSettings {
  try { return JSON.parse(fs.readFileSync(path.join(userDataPath, 'agent-settings.json'), 'utf-8')) }
  catch { return { autonomousMode: false, maxIterations: 15, scopeAllowlist: [] } }
}

export function loadProviders(userDataPath: string): ProviderState {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(userDataPath, 'ai-providers.json'), 'utf-8'))
    const providers: ProviderEntry[] = (data.providers || []).map((p: ProviderEntry) => ({
      ...p,
      apiKey: p.apiKey ? decryptSecret(p.apiKey) : '',
    }))
    return { providers, activeId: data.activeId ?? null }
  } catch { return { providers: [], activeId: null } }
}

export function saveProviders(userDataPath: string, data: ProviderState): void {
  fs.writeFileSync(path.join(userDataPath, 'ai-providers.json'), JSON.stringify(data, null, 2))
}
