import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'

vi.mock('fs')

const mockAppendFile = vi.mocked(fs.appendFile)

beforeEach(() => {
  vi.clearAllMocks()
  // Reset module so logPath state is cleared between tests
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('logger', () => {
  it('does not write when not initialised', async () => {
    const { logger } = await import('./logger')
    logger.info('test')
    expect(mockAppendFile).not.toHaveBeenCalled()
  })

  it('writes INFO after initLogger', async () => {
    const { initLogger, logger } = await import('./logger')
    initLogger('/tmp/test')
    logger.info('hello')
    expect(mockAppendFile).toHaveBeenCalledOnce()
    const [filePath, data] = mockAppendFile.mock.calls[0]
    expect(filePath).toContain('app.log')
    expect(String(data)).toContain('[INFO]')
    expect(String(data)).toContain('hello')
  })

  it('writes WARN level', async () => {
    const { initLogger, logger } = await import('./logger')
    initLogger('/tmp/test')
    logger.warn('warning')
    const [, data] = mockAppendFile.mock.calls[0]
    expect(String(data)).toContain('[WARN]')
  })

  it('writes ERROR level', async () => {
    const { initLogger, logger } = await import('./logger')
    initLogger('/tmp/test')
    logger.error('boom')
    const [, data] = mockAppendFile.mock.calls[0]
    expect(String(data)).toContain('[ERROR]')
    expect(String(data)).toContain('boom')
  })

  it('includes ISO timestamp in log line', async () => {
    const { initLogger, logger } = await import('./logger')
    initLogger('/tmp/test')
    logger.info('ts-check')
    const [, data] = mockAppendFile.mock.calls[0]
    expect(String(data)).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
