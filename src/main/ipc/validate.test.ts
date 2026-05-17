import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validate, ScanStartSchema, AgentConnectSchema, AgentSettingsSchema,
  AgentApproveSchema, AttackerConfigSchema,
  ExploitRunSchema, ToolNameSchema } from './validate'

vi.mock('../lib/auditLog', () => ({ auditLog: vi.fn() }))

import { auditLog } from '../lib/auditLog'

beforeEach(() => vi.clearAllMocks())

describe('validate()', () => {
  it('returns ok:true with parsed data on valid input', () => {
    const result = validate(ScanStartSchema, { scanId: 'abc', target: 'example.com', options: {} }, 'test')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.target).toBe('example.com')
  })

  it('returns ok:false with error message on invalid input', () => {
    const result = validate(ScanStartSchema, { scanId: '', target: 'x', options: {} }, 'test')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeTruthy()
  })

  it('calls auditLog on validation failure', () => {
    validate(ScanStartSchema, null, 'scan:start')
    expect(auditLog).toHaveBeenCalledWith('IPC_VALIDATION_ERROR', expect.objectContaining({ channel: 'scan:start' }))
  })

  it('does not call auditLog on success', () => {
    validate(ScanStartSchema, { scanId: 'x', target: 'y', options: {} }, 'scan:start')
    expect(auditLog).not.toHaveBeenCalled()
  })
})

describe('ScanStartSchema', () => {
  it('accepts valid input', () => {
    const r = ScanStartSchema.safeParse({ scanId: 'scan_1', target: 'example.com', options: { ports: true } })
    expect(r.success).toBe(true)
  })
  it('rejects empty scanId', () => {
    expect(ScanStartSchema.safeParse({ scanId: '', target: 'x', options: {} }).success).toBe(false)
  })
  it('rejects missing target', () => {
    expect(ScanStartSchema.safeParse({ scanId: 'x', options: {} }).success).toBe(false)
  })
})

describe('AgentConnectSchema', () => {
  const valid = { id: 'p1', providerId: 'anthropic', model: 'claude-3', label: 'My Provider' }
  it('accepts valid input', () => expect(AgentConnectSchema.safeParse(valid).success).toBe(true))
  it('accepts optional apiKey and baseUrl', () => {
    expect(AgentConnectSchema.safeParse({ ...valid, apiKey: 'key', baseUrl: 'http://x' }).success).toBe(true)
  })
  it('rejects empty model', () => {
    expect(AgentConnectSchema.safeParse({ ...valid, model: '' }).success).toBe(false)
  })
})

describe('AgentSettingsSchema', () => {
  it('accepts empty object', () => expect(AgentSettingsSchema.safeParse({}).success).toBe(true))
  it('accepts valid fields', () => {
    expect(AgentSettingsSchema.safeParse({ autonomousMode: true, maxIterations: 50 }).success).toBe(true)
  })
  it('rejects maxIterations > 200', () => {
    expect(AgentSettingsSchema.safeParse({ maxIterations: 201 }).success).toBe(false)
  })
  it('rejects maxIterations < 1', () => {
    expect(AgentSettingsSchema.safeParse({ maxIterations: 0 }).success).toBe(false)
  })
})

describe('AgentApproveSchema', () => {
  it('accepts valid input', () => {
    expect(AgentApproveSchema.safeParse({ toolCallId: 'tc_1', approved: true }).success).toBe(true)
  })
  it('rejects empty toolCallId', () => {
    expect(AgentApproveSchema.safeParse({ toolCallId: '', approved: true }).success).toBe(false)
  })
})

describe('AttackerConfigSchema', () => {
  it('accepts record of strings', () => {
    expect(AttackerConfigSchema.safeParse({ lhost: '1.2.3.4', lport: '4444' }).success).toBe(true)
  })
  it('rejects non-string values', () => {
    expect(AttackerConfigSchema.safeParse({ lport: 4444 }).success).toBe(false)
  })
})

describe('ToolNameSchema', () => {
  it('accepts valid tool names', () => {
    expect(ToolNameSchema.safeParse('nuclei').success).toBe(true)
    expect(ToolNameSchema.safeParse('interactsh-client').success).toBe(true)
  })
  it('rejects empty string', () => expect(ToolNameSchema.safeParse('').success).toBe(false))
  it('rejects names with shell injection chars', () => {
    expect(ToolNameSchema.safeParse('nmap;rm -rf').success).toBe(false)
    expect(ToolNameSchema.safeParse('../../../etc/passwd').success).toBe(false)
  })
  it('rejects names longer than 64 chars', () => {
    expect(ToolNameSchema.safeParse('a'.repeat(65)).success).toBe(false)
  })
})

describe('ExploitRunSchema', () => {
  const valid = { weaponId: 'w1', item: { type: 'xss' }, scanData: null, attackerCfg: null }
  it('accepts valid input', () => expect(ExploitRunSchema.safeParse(valid).success).toBe(true))
  it('rejects empty weaponId', () => {
    expect(ExploitRunSchema.safeParse({ ...valid, weaponId: '' }).success).toBe(false)
  })
})
