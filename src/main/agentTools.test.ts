import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { executeTool, AgentContext } from './agentTools'

vi.mock('./lib/auditLog', () => ({ auditLog: vi.fn() }))
vi.mock('./lib/secureStorage', () => ({
  encryptSecret: (s: string) => `enc:${s}`,
  decryptSecret: (s: string) => s.startsWith('enc:') ? s.slice(4) : s,
}))

function makeCtx(outputDir: string): AgentContext {
  return {
    scanData: null,
    memoryPath: path.join(outputDir, 'memory.json'),
    binDir: outputDir,
    agentOutputDir: outputDir,
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

describe('save_file — path restriction', () => {
  let tmpDir: string
  let ctx: AgentContext

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-test-'))
    ctx = makeCtx(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes a file by bare filename inside output dir', async () => {
    const result = await executeTool({ id: 'test-id', name: 'save_file', args: { path: 'output.txt', content: 'hello' } }, ctx)
    expect(result).toContain('Saved:')
    const written = fs.readFileSync(path.join(tmpDir, 'output.txt'), 'utf-8')
    expect(written).toBe('hello')
  })

  it('rejects absolute path outside output dir', async () => {
    const outsidePath = path.join(os.tmpdir(), 'evil.txt')
    const result = await executeTool({ id: 'test-id', name: 'save_file', args: { path: outsidePath, content: 'pwned' } }, ctx)
    expect(result).toContain('Error: Writes are restricted')
    expect(fs.existsSync(outsidePath)).toBe(false)
  })

  it('rejects path traversal', async () => {
    const result = await executeTool({ id: 'test-id', name: 'save_file', args: { path: '../../evil.txt', content: 'pwned' } }, ctx)
    expect(result).toContain('Error: Writes are restricted')
  })

  it('appends when append flag is set', async () => {
    const filePath = path.join(tmpDir, 'log.txt')
    fs.writeFileSync(filePath, 'first\n')
    await executeTool({ id: 'test-id', name: 'save_file', args: { path: 'log.txt', content: 'second\n', append: true } }, ctx)
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('first\nsecond\n')
  })

  it('overwrites by default', async () => {
    const filePath = path.join(tmpDir, 'data.txt')
    fs.writeFileSync(filePath, 'original')
    await executeTool({ id: 'test-id', name: 'save_file', args: { path: 'data.txt', content: 'new' } }, ctx)
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('new')
  })
})

describe('read_file — path restriction', () => {
  let tmpDir: string
  let ctx: AgentContext

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-test-'))
    ctx = makeCtx(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('reads a file by bare filename inside output dir', async () => {
    fs.writeFileSync(path.join(tmpDir, 'notes.txt'), 'secret data')
    const result = await executeTool({ id: 'test-id', name: 'read_file', args: { path: 'notes.txt' } }, ctx)
    expect(result).toBe('secret data')
  })

  it('rejects absolute path outside output dir', async () => {
    const outsideFile = path.join(os.tmpdir(), 'sensitive.txt')
    fs.writeFileSync(outsideFile, 'should not be readable')
    try {
      const result = await executeTool({ id: 'test-id', name: 'read_file', args: { path: outsideFile } }, ctx)
      expect(result).toContain('Error: Reads are restricted')
    } finally {
      fs.unlinkSync(outsideFile)
    }
  })

  it('rejects path traversal', async () => {
    const result = await executeTool({ id: 'test-id', name: 'read_file', args: { path: '../../passwd' } }, ctx)
    expect(result).toContain('Error: Reads are restricted')
  })

  it('truncates output at max_chars', async () => {
    const content = 'x'.repeat(200)
    fs.writeFileSync(path.join(tmpDir, 'big.txt'), content)
    const result = await executeTool({ id: 'test-id', name: 'read_file', args: { path: 'big.txt', max_chars: 50 } }, ctx)
    expect(result).toContain('truncated')
    expect(result.slice(0, 50)).toBe('x'.repeat(50))
  })

  it('returns error for non-existent file', async () => {
    const result = await executeTool({ id: 'test-id', name: 'read_file', args: { path: 'missing.txt' } }, ctx)
    expect(result).toContain('Error reading file:')
  })
})

describe('unknown tool', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns unknown tool message for unrecognized tool name', async () => {
    const ctx = makeCtx(tmpDir)
    const result = await executeTool({ id: 'test-id', name: 'nonexistent_tool', args: {} }, ctx)
    expect(result).toContain('Unknown tool:')
  })
})
