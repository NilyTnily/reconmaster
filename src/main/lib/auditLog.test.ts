import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'

vi.mock('fs')

const mockAppendFile = vi.mocked(fs.appendFile)

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('auditLog', () => {
  it('does not write when not initialised', async () => {
    const { auditLog } = await import('./auditLog')
    auditLog('APP_START', { version: '1.0' })
    expect(mockAppendFile).not.toHaveBeenCalled()
  })

  it('writes to audit.log after initAuditLog', async () => {
    const { initAuditLog, auditLog } = await import('./auditLog')
    initAuditLog('/tmp/test')
    auditLog('SCAN_START', { target: 'example.com' })
    expect(mockAppendFile).toHaveBeenCalledOnce()
    const [filePath, data] = mockAppendFile.mock.calls[0]
    expect(filePath).toContain('audit.log')
    expect(String(data)).toContain('SCAN_START')
    expect(String(data)).toContain('example.com')
  })

  it('serialises details as JSON', async () => {
    const { initAuditLog, auditLog } = await import('./auditLog')
    initAuditLog('/tmp/test')
    auditLog('IPC_VALIDATION_ERROR', { channel: 'scan:start', issues: ['required'] })
    const [, data] = mockAppendFile.mock.calls[0]
    const line = String(data)
    expect(line).toContain('"channel"')
    expect(line).toContain('"scan:start"')
  })

  it('includes ISO timestamp', async () => {
    const { initAuditLog, auditLog } = await import('./auditLog')
    initAuditLog('/tmp/test')
    auditLog('APP_START', {})
    const [, data] = mockAppendFile.mock.calls[0]
    expect(String(data)).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
