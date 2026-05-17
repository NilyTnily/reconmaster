import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEncryptString = vi.fn((s: string) => Buffer.from(`enc:${s}`))
const mockDecryptString = vi.fn((b: Buffer) => b.toString().replace('enc:', ''))
const mockIsEncryptionAvailable = vi.fn(() => true)

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: mockIsEncryptionAvailable,
    encryptString: mockEncryptString,
    decryptString: mockDecryptString,
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('encryptSecret', () => {
  it('returns plain text when encryption unavailable', async () => {
    mockIsEncryptionAvailable.mockReturnValue(false)
    const { encryptSecret } = await import('./secureStorage')
    expect(encryptSecret('secret')).toBe('secret')
  })

  it('returns plain text when input is empty', async () => {
    const { encryptSecret } = await import('./secureStorage')
    expect(encryptSecret('')).toBe('')
  })

  it('encrypts and returns base64 string', async () => {
    mockIsEncryptionAvailable.mockReturnValue(true)
    mockEncryptString.mockReturnValue(Buffer.from('encrypted-bytes'))
    const { encryptSecret } = await import('./secureStorage')
    const result = encryptSecret('my-secret')
    expect(result).toBe(Buffer.from('encrypted-bytes').toString('base64'))
  })

  it('falls back to plain text on encrypt error', async () => {
    mockIsEncryptionAvailable.mockReturnValue(true)
    mockEncryptString.mockImplementation(() => { throw new Error('OS error') })
    const { encryptSecret } = await import('./secureStorage')
    expect(encryptSecret('fallback')).toBe('fallback')
  })
})

describe('decryptSecret', () => {
  it('returns stored value when encryption unavailable', async () => {
    mockIsEncryptionAvailable.mockReturnValue(false)
    const { decryptSecret } = await import('./secureStorage')
    expect(decryptSecret('raw')).toBe('raw')
  })

  it('returns empty string for empty input', async () => {
    const { decryptSecret } = await import('./secureStorage')
    expect(decryptSecret('')).toBe('')
  })

  it('decrypts base64 buffer back to plain text', async () => {
    mockIsEncryptionAvailable.mockReturnValue(true)
    mockDecryptString.mockReturnValue('my-secret')
    const { decryptSecret } = await import('./secureStorage')
    const b64 = Buffer.from('anything').toString('base64')
    expect(decryptSecret(b64)).toBe('my-secret')
  })

  it('falls back to plain text on decrypt error (pre-migration values)', async () => {
    mockIsEncryptionAvailable.mockReturnValue(true)
    mockDecryptString.mockImplementation(() => { throw new Error('bad data') })
    const { decryptSecret } = await import('./secureStorage')
    expect(decryptSecret('plain-stored')).toBe('plain-stored')
  })
})
