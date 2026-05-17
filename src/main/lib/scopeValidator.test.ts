import { describe, it, expect } from 'vitest'
import { isInternalTarget, assertExternalScope } from './scopeValidator'

describe('isInternalTarget', () => {
  it.each([
    'localhost',
    '127.0.0.1',
    '127.0.0.2',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '192.168.0.0',
    '169.254.1.1',
    '::1',
    'fe80::1',
    '::',
    'example.local',
    'host.internal',
    'foo.localhost',
    'broadcasthost',
    'ip6-localhost',
  ])('blocks internal address: %s', (target) => {
    expect(isInternalTarget(target)).toBe(true)
  })

  it.each([
    'example.com',
    '8.8.8.8',
    '1.1.1.1',
    'https://scanme.nmap.org',
    'sub.example.com',
    '203.0.113.1',
  ])('allows external address: %s', (target) => {
    expect(isInternalTarget(target)).toBe(false)
  })

  it('handles URL with internal host', () => {
    expect(isInternalTarget('http://192.168.1.100/path')).toBe(true)
  })

  it('handles URL with external host', () => {
    expect(isInternalTarget('https://example.com/path')).toBe(false)
  })

  it('handles host:port notation', () => {
    expect(isInternalTarget('10.0.0.1:8080')).toBe(true)
  })

  it('handles multicast address', () => {
    expect(isInternalTarget('224.0.0.1')).toBe(true)
  })

  it('handles broadcast address', () => {
    expect(isInternalTarget('255.255.255.255')).toBe(true)
  })
})

describe('assertExternalScope', () => {
  it('throws for internal target', () => {
    expect(() => assertExternalScope('192.168.1.1')).toThrow('Scope violation')
  })

  it('throws with descriptive message containing the host', () => {
    expect(() => assertExternalScope('10.0.0.1')).toThrow('10.0.0.1')
  })

  it('does not throw for external target', () => {
    expect(() => assertExternalScope('example.com')).not.toThrow()
  })

  it('allows allowlisted internal host', () => {
    expect(() => assertExternalScope('192.168.1.1', ['192.168.1.1'])).not.toThrow()
  })

  it('allows allowlisted subdomain', () => {
    expect(() => assertExternalScope('sub.internal.corp', ['internal.corp'])).not.toThrow()
  })

  it('does not allow partial allowlist match (prefix without dot)', () => {
    expect(() => assertExternalScope('192.168.1.100', ['192.168.1.1'])).toThrow()
  })

  it('allowlist is case-insensitive', () => {
    expect(() => assertExternalScope('MyHost.Internal.Corp', ['internal.corp'])).not.toThrow()
  })
})
