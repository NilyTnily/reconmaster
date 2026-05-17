import net from 'net'

// RFC1918, loopback, link-local, APIPA, multicast, broadcast
const BLOCKED_CIDRS: [number, number, number][] = [
  [0x7f000000, 0xff000000, 8],    // 127.0.0.0/8   loopback
  [0x0a000000, 0xff000000, 8],    // 10.0.0.0/8    RFC1918
  [0xac100000, 0xfff00000, 12],   // 172.16.0.0/12 RFC1918
  [0xc0a80000, 0xffff0000, 16],   // 192.168.0.0/16 RFC1918
  [0xa9fe0000, 0xffff0000, 16],   // 169.254.0.0/16 link-local
  [0xe0000000, 0xf0000000, 4],    // 224.0.0.0/4   multicast
  [0x00000000, 0xffffffff, 32],   // 0.0.0.0/32    unspecified
  [0xffffffff, 0xffffffff, 32],   // 255.255.255.255 broadcast
]

const BLOCKED_HOSTNAMES = new Set(['localhost', 'broadcasthost', 'ip6-localhost', 'ip6-loopback'])

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0
}

function isBlockedIp(host: string): boolean {
  if (net.isIPv6(host)) {
    // Block IPv6 loopback and link-local
    const lower = host.toLowerCase().replace(/[\[\]]/g, '')
    return lower === '::1' || lower.startsWith('fe80:') || lower === '::'
  }
  if (!net.isIPv4(host)) return false
  const int = ipv4ToInt(host)
  return BLOCKED_CIDRS.some(([network, mask]) => ((int & mask) >>> 0) === network)
}

function extractHost(target: string): string {
  // Bare IPv6 address (multiple colons, no brackets, no protocol) — URL() can't parse these
  if (!target.includes('://') && !target.includes('[') && (target.match(/:/g) || []).length > 1) {
    return target.toLowerCase()
  }
  try {
    const url = new URL(target.includes('://') ? target : `https://${target}`)
    return url.hostname.toLowerCase()
  } catch {
    // Bare host or host:port
    return target.split(':')[0].toLowerCase().split('/')[0]
  }
}

/** Returns true if the target refers to an internal/reserved address (RFC1918, loopback, link-local). */
export function isInternalTarget(target: string): boolean {
  const host = extractHost(target)
  if (BLOCKED_HOSTNAMES.has(host)) return true
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true
  if (isBlockedIp(host)) return true
  return false
}

/** Throws a descriptive error if the target is an internal/reserved address not on the allowlist. */
export function assertExternalScope(target: string, allowlist: string[] = []) {
  const host = extractHost(target)
  if (allowlist.some(a => host === a.toLowerCase() || host.endsWith('.' + a.toLowerCase()))) return
  if (isInternalTarget(target)) {
    throw new Error(
      `Scope violation: "${host}" is an internal/reserved address. ` +
      `Add it to the scope allowlist in Settings if you intend to scan it.`
    )
  }
}
