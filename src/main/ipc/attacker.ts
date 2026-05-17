import { handle } from './handle'
import fs from 'fs'
import path from 'path'
import { encryptSecret, decryptSecret } from '../lib/secureStorage'
import { auditLog } from '../lib/auditLog'
import { validate, AttackerConfigSchema } from './validate'
import type { IpcDeps } from './types'

export function register(deps: IpcDeps): void {
  const { getUserData } = deps
  const configPath = () => path.join(getUserData(), 'attacker-config.json')

  handle('attacker:getConfig', async () => {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath(), 'utf-8'))
      if (cfg.sessionCookie) cfg.sessionCookie = decryptSecret(cfg.sessionCookie)
      return cfg
    } catch {
      return { lhost: '', lport: '4444', c2domain: '', interactshUrl: '', sessionCookie: '', customHeaders: '' }
    }
  })

  handle('attacker:setConfig', async (_, raw: unknown) => {
    const v = validate(AttackerConfigSchema, raw, 'attacker:setConfig')
    if (!v.ok) return { success: false, error: v.error }
    const cfg = v.data
    const stored = {
      ...cfg,
      sessionCookie: cfg.sessionCookie ? encryptSecret(cfg.sessionCookie) : '',
    }
    fs.writeFileSync(configPath(), JSON.stringify(stored, null, 2))
    auditLog('ATTACKER_CONFIG_UPDATE', { fields: Object.keys(cfg).filter(k => k !== 'sessionCookie') })
    return { success: true }
  })
}
