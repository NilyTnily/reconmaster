import net from 'net'
import pathMod from 'path'
import fs from 'fs'
import { ScanContext, runBinary, hasBinary } from './context'

function getRisk(port: number): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  const critical = [23, 4444, 5900, 5901, 5902]
  const high = [21, 3389, 1433, 1521, 27017, 27018, 6379, 9200, 9300, 2375, 2376, 11211, 5432, 5672, 50000, 61616, 10250, 10255]
  const medium = [80, 8080, 8000, 8888, 3000, 4000, 5000, 7001, 4848, 8161, 8983, 8500, 9001]
  const low = [22, 443, 8443, 2222, 2083, 2087]
  if (critical.includes(port)) return 'critical'
  if (high.includes(port)) return 'high'
  if (medium.includes(port)) return 'medium'
  if (low.includes(port)) return 'low'
  return 'info'
}

function guessService(port: number): string {
  const map: Record<number, string> = {
    21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns', 80: 'http',
    81: 'http-alt', 88: 'kerberos', 110: 'pop3', 111: 'rpc', 135: 'msrpc',
    139: 'netbios', 143: 'imap', 443: 'https', 444: 'https-alt', 445: 'smb',
    465: 'smtps', 587: 'smtp-sub', 631: 'ipp', 636: 'ldaps', 993: 'imaps',
    995: 'pop3s', 1080: 'socks', 1194: 'openvpn', 1433: 'mssql', 1521: 'oracle',
    1723: 'pptp', 2049: 'nfs', 2083: 'cpanel-ssl', 2087: 'whm-ssl',
    2222: 'ssh-alt', 2375: 'docker', 2376: 'docker-ssl', 3000: 'node/grafana',
    3128: 'squid-proxy', 3306: 'mysql', 3389: 'rdp', 4000: 'http-alt',
    4443: 'https-alt', 4444: 'metasploit', 4848: 'glassfish', 5000: 'http-alt',
    5001: 'docker-registry', 5432: 'postgresql', 5672: 'rabbitmq',
    5900: 'vnc', 5985: 'winrm-http', 5986: 'winrm-https', 6379: 'redis',
    6443: 'kubernetes', 7001: 'weblogic', 7080: 'http-alt', 7443: 'https-alt',
    8000: 'http-alt', 8001: 'http-alt', 8008: 'http-alt', 8080: 'http-proxy',
    8081: 'http-alt', 8082: 'http-alt', 8088: 'http-alt', 8090: 'http-alt',
    8161: 'activemq', 8443: 'https-alt', 8444: 'https-alt', 8500: 'consul',
    8888: 'jupyter/http', 8983: 'solr', 9000: 'sonarqube/php-fpm',
    9001: 'supervisord', 9090: 'prometheus/cockpit', 9092: 'kafka',
    9200: 'elasticsearch', 9300: 'elasticsearch-cluster', 9418: 'git',
    9443: 'https-alt', 10250: 'kubernetes-kubelet', 10255: 'kubernetes-readonly',
    11211: 'memcached', 15672: 'rabbitmq-mgmt', 16010: 'hbase',
    27017: 'mongodb', 27018: 'mongodb', 28017: 'mongodb-http',
    50000: 'jenkins', 61616: 'activemq',
  }
  return map[port] || 'unknown'
}

function tcpScan(ctx: ScanContext, host: string, ports: number[]): Promise<number[]> {
  const open: number[] = []
  return Promise.all(
    ports.map(port => new Promise<void>(resolve => {
      if (ctx.isCancel()) return resolve()
      const sock = new net.Socket()
      sock.setTimeout(1500)
      sock.connect(port, host, () => { open.push(port); sock.destroy(); resolve() })
      sock.on('error', () => { sock.destroy(); resolve() })
      sock.on('timeout', () => { sock.destroy(); resolve() })
    }))
  ).then(() => open)
}

function grabBanner(host: string, port: number): Promise<string | undefined> {
  return new Promise(resolve => {
    const sock = new net.Socket()
    let banner = ''
    sock.setTimeout(3000)
    sock.connect(port, host, () => {
      if (port === 80 || port === 8080 || port === 8000 || port === 8888) {
        sock.write(`HEAD / HTTP/1.0\r\nHost: ${host}\r\n\r\n`)
      } else if (port === 21 || port === 22 || port === 25 || port === 110 || port === 143 || port === 6379 || port === 11211) {
        // These send banners on connect — just wait
      } else {
        sock.write('\r\n')
      }
    })
    sock.on('data', (d: Buffer) => {
      banner += d.toString().slice(0, 512)
      sock.destroy()
    })
    sock.on('close', () => resolve(banner.trim().slice(0, 256) || undefined))
    sock.on('error', () => resolve(undefined))
    sock.on('timeout', () => { sock.destroy(); resolve(undefined) })
  })
}

export async function runPorts(ctx: ScanContext, hosts: string[]) {
  if (ctx.isCancel() || hosts.length === 0) return []
  ctx.phaseStart('ports')

  const results: { host: string; port: number; protocol: string; state: string; service?: string; version?: string; banner?: string; risk?: string }[] = []

  // rustscan: ultra-fast pre-scan to find open ports, then naabu/nmap refines
  if (hasBinary(ctx, 'rustscan')) {
    ctx.log('rustscan', `Ultra-fast port scan on ${hosts.slice(0, 5).join(', ')}`, 'info')
    for (const host of hosts.slice(0, 5)) {
      if (ctx.isCancel()) break
      await runBinary(ctx, 'rustscan', ['-a', host, '--ulimit', '5000', '--range', '1-65535', '-q', '--no-nmap', '--timeout', '1500'], line => {
        const m = line.match(/^Open\s+(.+):(\d+)$/) || line.match(/^(.+):(\d+)\s*$/)
        if (m) {
          const port = parseInt(m[2])
          if (port > 0 && port <= 65535 && !results.find(r => r.host === m[1] && r.port === port)) {
            results.push({ host: m[1], port, protocol: 'tcp', state: 'open', service: guessService(port), risk: getRisk(port) })
          }
        }
      })
    }
  }

  // uncover: search-engine based host/port discovery (Shodan InternetDB — no key needed)
  if (hasBinary(ctx, 'uncover')) {
    ctx.log('uncover', `Search-engine host/port discovery for ${ctx.target}`, 'info')
    await runBinary(ctx, 'uncover', ['-q', ctx.target, '-silent', '-e', 'shodan-idb'], line => {
      const m = line.match(/^(.+):(\d+)$/)
      if (m) {
        const port = parseInt(m[2])
        if (port > 0 && port <= 65535 && !results.find(r => r.host === m[1] && r.port === port)) {
          results.push({ host: m[1], port, protocol: 'tcp', state: 'open', service: guessService(port), risk: getRisk(port), banner: 'uncover/shodan' })
          ctx.log('uncover', `${m[1]}:${port}`, 'info')
        }
      }
    }, 60_000)
  }

  if (hasBinary(ctx, 'naabu')) {
    const hostsFile = pathMod.join(ctx.outputDir, 'hosts.txt')
    fs.writeFileSync(hostsFile, hosts.join('\n'))
    await runBinary(ctx, 'naabu', ['-list', hostsFile, '-p', '1-10000', '-silent', '-rate', '1000', '-timeout', '1000', '-retries', '1'], line => {
      const m = line.match(/^(.+):(\d+)$/)
      if (m) {
        const port = parseInt(m[2])
        const service = guessService(port)
        if (!results.find(r => r.host === m[1] && r.port === port))
          results.push({ host: m[1], port, protocol: 'tcp', state: 'open', service, risk: getRisk(port) })
      }
    }, 300_000)
  } else {
    const ports = [
      21, 22, 23, 25, 53, 80, 81, 88, 110, 111, 135, 139, 143, 443, 444, 445,
      465, 587, 631, 636, 993, 995, 1080, 1194, 1433, 1521, 1723, 2049, 2083,
      2087, 2222, 2375, 2376, 3000, 3128, 3306, 3389, 4000, 4443, 4444, 4848,
      5000, 5001, 5432, 5672, 5900, 5985, 5986, 6379, 6443, 7001, 7080, 7443,
      8000, 8001, 8008, 8080, 8081, 8082, 8088, 8090, 8161, 8443, 8444, 8500,
      8888, 8983, 9000, 9001, 9090, 9092, 9200, 9300, 9418, 9443, 10250, 10255,
      11211, 15672, 16010, 27017, 27018, 28017, 50000, 61616,
    ]
    const scanHosts = hosts.slice(0, 15)
    ctx.log('ports', `TCP connect scan on ${scanHosts.length} hosts × ${ports.length} ports`, 'info')

    await Promise.all(scanHosts.map(async host => {
      if (ctx.isCancel()) return
      const openPorts = await tcpScan(ctx, host, ports)
      for (const port of openPorts) {
        const service = guessService(port)
        results.push({ host, port, protocol: 'tcp', state: 'open', service, risk: getRisk(port) })
        ctx.log('ports', `${host}:${port} open (${service})`, 'success')
      }
    }))
  }

  // Banner grabbing for open ports
  ctx.log('ports', `Grabbing banners for ${Math.min(results.length, 30)} open ports...`, 'info')
  await Promise.all(
    results.slice(0, 30).map(async r => {
      if (ctx.isCancel()) return
      const banner = await grabBanner(r.host, r.port)
      if (banner) {
        r.banner = banner
        // Try to extract version from banner
        const ver = banner.match(/(?:SSH|Apache|nginx|IIS|OpenSSH|vsftpd|ProFTPD|postfix|sendmail)[\/\s-]*([\d.]+[^\s,]*)/i)?.[0]
        if (ver) r.version = ver
      }
    })
  )

  if (hasBinary(ctx, 'nmap') && results.length > 0) {
    const hostsFile = pathMod.join(ctx.outputDir, 'hosts.txt')
    fs.writeFileSync(hostsFile, hosts.join('\n'))
    const openPorts = [...new Set(results.map(r => r.port))].join(',')
    await runBinary(ctx, 'nmap', ['-sV', '-Pn', '-T4', '-p', openPorts, '-iL', hostsFile, '--open', '-oN', pathMod.join(ctx.outputDir, 'nmap.txt')], line => {
      const m = line.match(/^(\d+)\/(tcp|udp)\s+open\s+(\S+)\s*(.*)$/)
      if (m) {
        const port = parseInt(m[1])
        const r = results.find(x => x.port === port)
        if (r) { r.service = m[3]; r.version = m[4].trim() }
      }
    }, 180_000)
  }

  // zgrab2: multi-protocol banner grabbing for open ports
  if (hasBinary(ctx, 'zgrab2') && results.length > 0) {
    const httpPorts = results.filter(r => [80, 8080, 8000, 8008, 8888, 3000, 4000, 5000].includes(r.port))
    const tlsPorts = results.filter(r => [443, 8443, 4443, 9443].includes(r.port))
    if (httpPorts.length > 0) {
      const zgrabHosts = [...new Set(httpPorts.map(r => r.host))].join('\n')
      const zgrabFile = pathMod.join(ctx.outputDir, 'zgrab_http.txt')
      fs.writeFileSync(zgrabFile, zgrabHosts)
      await runBinary(ctx, 'zgrab2', ['--input-file', zgrabFile, '--output-file', pathMod.join(ctx.outputDir, 'zgrab2_http.json'), 'http', '--timeout', '10'], line => {
        try {
          const obj = JSON.parse(line)
          const host = obj.ip || obj.domain
          const server = obj.data?.http?.result?.response?.headers?.server?.[0]
          if (host && server) {
            const r = results.find(x => x.host === host && [80, 8080, 8000].includes(x.port))
            if (r && !r.version) r.version = server
          }
        } catch { /* not json */ }
      })
    }
    if (tlsPorts.length > 0) {
      const zgrabTlsHosts = [...new Set(tlsPorts.map(r => r.host))].join('\n')
      const zgrabTlsFile = pathMod.join(ctx.outputDir, 'zgrab_tls.txt')
      fs.writeFileSync(zgrabTlsFile, zgrabTlsHosts)
      await runBinary(ctx, 'zgrab2', ['--input-file', zgrabTlsFile, '--output-file', pathMod.join(ctx.outputDir, 'zgrab2_tls.json'), 'tls'], () => {})
    }
  }

  // CDN check — tag which hosts are behind CDN
  if (hasBinary(ctx, 'cdncheck') && hosts.length > 0) {
    const hostsFile2 = pathMod.join(ctx.outputDir, 'hosts_cdn.txt')
    fs.writeFileSync(hostsFile2, hosts.join('\n'))
    ctx.log('cdncheck', 'Detecting CDN/cloud infrastructure on discovered hosts', 'info')
    await runBinary(ctx, 'cdncheck', ['-l', hostsFile2, '-silent', '-resp'], line => {
      // cdncheck outputs: host [CDN-Name]
      const m = line.match(/^(.+?)\s+\[(.+?)\]/)
      if (m) {
        const host = m[1].trim()
        const cdn = m[2].trim()
        for (const r of results) {
          if (r.host === host && !r.banner?.includes('CDN:')) {
            r.banner = (r.banner ? r.banner + ' | ' : '') + `CDN: ${cdn}`
          }
        }
        ctx.log('cdncheck', `${host} → ${cdn}`, 'info')
      }
    })
  }

  // ASN mapping — log IP-to-ASN for context
  if (hasBinary(ctx, 'asnmap') && hosts.length > 0) {
    ctx.log('asnmap', 'Mapping hosts to ASN/organization info', 'info')
    const hostsFile3 = pathMod.join(ctx.outputDir, 'hosts_asn.txt')
    fs.writeFileSync(hostsFile3, hosts.join('\n'))
    await runBinary(ctx, 'asnmap', ['-l', hostsFile3, '-silent'], line => {
      ctx.log('asnmap', line, 'info')
    })
  }

  // smap: passive Shodan InternetDB port lookup (no API key required)
  if (hasBinary(ctx, 'smap') && hosts.length > 0) {
    ctx.log('smap', `Passive Shodan port scan for ${hosts.slice(0, 5).join(', ')}`, 'info')
    const smapHostsFile = pathMod.join(ctx.outputDir, 'hosts_smap.txt')
    fs.writeFileSync(smapHostsFile, hosts.slice(0, 10).join('\n'))
    await runBinary(ctx, 'smap', ['-iL', smapHostsFile, '-oG', pathMod.join(ctx.outputDir, 'smap.gnmap')], line => {
      // smap outputs nmap-grepable format: Host: IP  Ports: PORT/open/PROTO/SERVICE...
      const hostMatch = line.match(/Host:\s+(\S+)/)
      const portsMatch = line.match(/Ports:\s+(.+)/)
      if (hostMatch && portsMatch) {
        const host = hostMatch[1]
        for (const portEntry of portsMatch[1].split(',')) {
          const pm = portEntry.trim().match(/(\d+)\/open\/(\w+)/)
          if (pm) {
            const port = parseInt(pm[1])
            if (!results.find(r => r.host === host && r.port === port)) {
              results.push({ host, port, protocol: pm[2], state: 'open', service: guessService(port), risk: getRisk(port), banner: 'smap/shodan' })
              ctx.log('smap', `${host}:${port} open`, 'info')
            }
          }
        }
      }
    }, 60_000)
  }

  ctx.log('ports', `Found ${results.length} open ports`, 'success')
  ctx.phaseEnd('ports', results)
  return results
}