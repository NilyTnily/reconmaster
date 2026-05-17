import { z } from 'zod'
import { auditLog } from '../lib/auditLog'

type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function validate<T>(schema: z.ZodSchema<T>, value: unknown, channel: string): ValidationResult<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    auditLog('IPC_VALIDATION_ERROR', { channel, issues: result.error.issues.map(i => i.message) })
    return { ok: false, error: result.error.issues.map(i => i.message).join('; ') }
  }
  return { ok: true, data: result.data }
}

// ── IPC input schemas ─────────────────────────────────────────────────────────

export const ScanStartSchema = z.object({
  scanId: z.string().min(1),
  target: z.string().min(1),
  options: z.record(z.string(), z.boolean()),
})

export const AgentConnectSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().min(1),
  label: z.string().min(1),
})

export const AgentSettingsSchema = z.object({
  autonomousMode: z.boolean().optional(),
  maxIterations: z.number().int().min(1).max(200).optional(),
})

export const AgentApproveSchema = z.object({
  toolCallId: z.string().min(1),
  approved: z.boolean(),
})

export const AttackerConfigSchema = z.record(z.string(), z.string())

export const AgentChatSchema = z.object({
  chatId: z.string().min(1).max(256),
  history: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string(),
    toolCalls: z.array(z.object({
      id: z.string(),
      name: z.string(),
      args: z.record(z.string(), z.unknown()),
    })).optional(),
    toolResults: z.array(z.object({
      id: z.string(),
      content: z.string(),
    })).optional(),
  })),
  scanData: z.unknown(),
  weaponList: z.array(z.unknown()).optional(),
})

export const ExploitRunSchema = z.object({
  weaponId: z.string().min(1),
  item: z.record(z.string(), z.unknown()),
  scanData: z.unknown(),
  attackerCfg: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const ToolNameSchema = z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/i)
