import { describe, it, expect, vi, beforeEach } from 'vitest'
import os from 'os'
import path from 'path'

vi.mock('./lib/auditLog', () => ({ auditLog: vi.fn() }))
vi.mock('./lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('./lib/secureStorage', () => ({
  encryptSecret: (s: string) => `enc:${s}`,
  decryptSecret: (s: string) => (s.startsWith('enc:') ? s.slice(4) : s),
}))

const mockStream = vi.fn()
vi.mock('./providers/index', () => ({
  getAdapter: vi.fn(() => ({ streamWithTools: mockStream, fetchModels: vi.fn() })),
}))

import { resolveApproval, cancelAgentLoop, runAgentLoop, compressHistory, estimateTokens } from './agentLoop'
import type { AgentCallbacks, LoopConfig } from './agentLoop'
import type { AgentContext } from './agentTools'
import type { AgentMsg } from './providers/index'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMsg(role: AgentMsg['role'], chars: number): AgentMsg {
  return { role, content: 'x'.repeat(chars) }
}

function makeCallbacks() {
  const chunks: string[] = []
  const errors: string[] = []
  const state = { done: false }
  const cbs: AgentCallbacks = {
    onChunk: (t) => chunks.push(t),
    onToolCall: vi.fn(),
    onToolResult: vi.fn(),
    onApprovalRequired: vi.fn(),
    onBrowserUpdate: vi.fn(),
    onDone: () => { state.done = true },
    onError: (e) => errors.push(e),
  }
  return { cbs, chunks, errors, state }
}

function makeCtx(): AgentContext {
  return {
    scanData: null,
    memoryPath: path.join(os.tmpdir(), `test-mem-${Date.now()}.json`),
    binDir: os.tmpdir(),
    agentOutputDir: os.tmpdir(),
    attackerConfig: {},
    toolList: [],
    weaponList: [],
    browserNavigate: vi.fn(),
    browserReadDom: vi.fn(),
    browserScreenshot: vi.fn(),
    browserClick: vi.fn(),
    browserFill: vi.fn(),
    browserFillForm: vi.fn(),
    browserExecuteJs: vi.fn(),
    browserNewTab: vi.fn(),
    browserSwitchTab: vi.fn(),
    browserCloseTab: vi.fn(),
    browserGetTabs: vi.fn().mockReturnValue([]),
    runCommand: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    sendToTerminal: vi.fn(),
    setWeaponStatus: vi.fn(),
    setAttackerConfig: vi.fn(),
  }
}

const BASE_CONFIG: LoopConfig = {
  providerId: 'openai',
  model: 'gpt-4',
  apiKey: 'test-key',
  maxIterations: 3,
}

// ── estimateTokens ────────────────────────────────────────────────────────────

describe('estimateTokens', () => {
  it('approximates 1 token per 4 chars', () => {
    expect(estimateTokens('x'.repeat(400))).toBe(100)
  })

  it('rounds up fractional tokens', () => {
    expect(estimateTokens('abc')).toBe(1) // 3/4 → ceil → 1
  })

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })
})

// ── compressHistory ───────────────────────────────────────────────────────────

describe('compressHistory', () => {
  it('returns the same array reference when tokens fit', () => {
    const msgs = [makeMsg('user', 100), makeMsg('assistant', 100)]
    expect(compressHistory(msgs, 10000)).toBe(msgs)
  })

  it('returns the same array when length <= HEAD+TAIL even if over budget', () => {
    // HEAD=2, TAIL=15 → threshold is 17 messages
    const msgs = Array.from({ length: 17 }, (_, i) => makeMsg(i % 2 === 0 ? 'user' : 'assistant', 1000))
    const result = compressHistory(msgs, 1)
    expect(result).toBe(msgs)
  })

  it('compresses middle messages when over budget and length > 17', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => makeMsg(i % 2 === 0 ? 'user' : 'assistant', 400))
    const result = compressHistory(msgs, 100)
    // HEAD(2) + summary(1) + TAIL(15) = 18
    expect(result.length).toBe(18)
  })

  it('inserts a summary message with role user', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => makeMsg(i % 2 === 0 ? 'user' : 'assistant', 400))
    const result = compressHistory(msgs, 100)
    expect(result[2].role).toBe('user')
    expect(result[2].content).toContain('Context compressed')
    expect(result[2].content).toContain('3 messages')
  })

  it('preserves the first 2 and last 15 messages', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => makeMsg(i % 2 === 0 ? 'user' : 'assistant', 400))
    const result = compressHistory(msgs, 100)
    expect(result[0]).toBe(msgs[0])
    expect(result[1]).toBe(msgs[1])
    const tail = msgs.slice(-15)
    tail.forEach((m, i) => expect(result[3 + i]).toBe(m))
  })
})

// ── resolveApproval ───────────────────────────────────────────────────────────

describe('resolveApproval', () => {
  it('does nothing for an unknown toolCallId without throwing', () => {
    expect(() => resolveApproval('unknown-id', true)).not.toThrow()
    expect(() => resolveApproval('unknown-id', false)).not.toThrow()
  })
})

// ── runAgentLoop ──────────────────────────────────────────────────────────────

describe('runAgentLoop', () => {
  beforeEach(() => {
    mockStream.mockReset()
    cancelAgentLoop()
  })

  it('streams text and calls onDone for a single-turn response', async () => {
    mockStream.mockImplementation((_m: unknown, _t: unknown, _mo: unknown, _k: unknown, _b: unknown, onChunk: (s: string) => void) => {
      onChunk('Task complete.')
      return Promise.resolve({ text: 'Task complete.', toolCalls: [] })
    })
    const { cbs, chunks, state } = makeCallbacks()
    await runAgentLoop([], null, BASE_CONFIG, makeCtx(), cbs)
    expect(chunks.join('')).toBe('Task complete.')
    expect(state.done).toBe(true)
  })

  it('calls onError when the adapter throws and does not call onDone', async () => {
    mockStream.mockRejectedValue(new Error('API unavailable'))
    const { cbs, errors, state } = makeCallbacks()
    await runAgentLoop([], null, BASE_CONFIG, makeCtx(), cbs)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('API unavailable')
    expect(state.done).toBe(false)
  })

  it('rejects a concurrent second call with onError', async () => {
    let resolveFirst!: () => void
    mockStream.mockImplementationOnce(
      () => new Promise(res => { resolveFirst = () => res({ text: 'done', toolCalls: [] }) }),
    )
    const { cbs: cbs1 } = makeCallbacks()
    const { cbs: cbs2, errors: errors2 } = makeCallbacks()

    const p1 = runAgentLoop([], null, BASE_CONFIG, makeCtx(), cbs1)
    await runAgentLoop([], null, BASE_CONFIG, makeCtx(), cbs2)

    expect(errors2).toHaveLength(1)
    expect(errors2[0]).toContain('already running')

    resolveFirst()
    await p1
  })

  it('stops the loop after cancelAgentLoop is called', async () => {
    let callCount = 0
    mockStream.mockImplementation(() => {
      callCount++
      cancelAgentLoop()
      return Promise.resolve({ text: 'response', toolCalls: [] })
    })
    const { cbs } = makeCallbacks()
    await runAgentLoop([], null, { ...BASE_CONFIG, maxIterations: 10 }, makeCtx(), cbs)
    expect(callCount).toBe(1)
  })

  it('executes a tool call and sends result back in the next message', async () => {
    mockStream
      .mockResolvedValueOnce({ text: '', toolCalls: [{ id: 'tc1', name: 'read_memory', args: {} }] })
      .mockImplementationOnce((_m: unknown, _t: unknown, _mo: unknown, _k: unknown, _b: unknown, onChunk: (s: string) => void) => {
        onChunk('All done.')
        return Promise.resolve({ text: 'All done.', toolCalls: [] })
      })
    const { cbs, chunks } = makeCallbacks()
    await runAgentLoop([], null, BASE_CONFIG, makeCtx(), cbs)
    expect(chunks.join('')).toContain('All done.')
    expect(mockStream).toHaveBeenCalledTimes(2)
  })
})
