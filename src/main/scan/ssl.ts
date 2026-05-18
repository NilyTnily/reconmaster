import tls from 'tls'
import pathMod from 'path'
import fs from 'fs'
import { ScanContext, runBinary, hasBinary } from './context'

function checkSsl(ctx: ScanContext, host: string, results: { host: string; port: number; expiry?: string; validFrom?: string; issuer?: string; subject?: string; serial?: string; protocols?: string[]; ciphers?: string[]; issues?: string[]; daysLeft?: number }[]): Promise<void> {
  return new Promise(resolve => {
    const socket = tls.connect({ host, port: 443, rejectUnauthorized: false, timeout: 6000 }, () => {
      try {
        const cert = socket.getPeerCertificate()
        const cipher = socket.getCipher()
        const protocol = socket.getProtocol() || ''
        const issues: string[] = []

        const expiry = cert.valid_to
        const validFrom = cert.valid_from
        let daysLeft: number | undefined

        if (expiry) {
          daysLeft = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
          if (daysLeft < 0) issues.push(`Certificate EXPIRED (${Math.abs(daysLeft)} days ago)`)
          else if (daysLeft < 14) issues.push(`Expires in ${daysLeft} days — CRITICAL`)
          else if (daysLeft < 30) issues.push(`Expires in ${daysLeft} days — renew soon`)
        }

        if (cert.subject?.CN === cert.issuer?.CN) issues.push('Self-signed certificate')
        if (protocol === 'TLSv1' || protocol === 'TLSv1.1') issues.push(`Weak protocol: ${protocol} (deprecated)`)

        const rawIssuer = cert.issuer?.O
        const issuer = Array.isArray(rawIssuer) ? rawIssuer[0] : (typeof rawIssuer === 'string' ? rawIssuer : undefined)
        const rawSubject = cert.subject?.CN
        const subject = Array.isArray(rawSubject) ? rawSubject[0] : (typeof rawSubject === 'string' ? rawSubject : undefined)
        const serial = cert.serialNumber

        results.push({
          host, port: 443, expiry, validFrom, issuer, subject, serial,
          protocols: [protocol || 'unknown'],
          ciphers: cipher ? [`${cipher.name} (${cipher.version})`] : [],
          issues, daysLeft,
        })
        ctx.log('ssl', `${host}: ${protocol} | expires in ${daysLeft ?? '?'}d | ${issuer || 'unknown issuer'}`, issues.length ? 'warn' : 'success')
      } catch { /* cert parse error */ }
      socket.destroy()
      resolve()
    })
    socket.on('error', () => resolve())
    socket.on('timeout', () => { socket.destroy(); resolve() })
  })
}

export async function runSsl(ctx: ScanContext, hosts: string[]) {
  if (ctx.isCancel() || hosts.length === 0) return []
  ctx.phaseStart('ssl')
  const results: { host: string; port: number; expiry?: string; validFrom?: string; issuer?: string; subject?: string; serial?: string; protocols?: string[]; ciphers?: string[]; issues?: string[]; daysLeft?: number }[] = []

  if (hasBinary(ctx, 'tlsx')) {
    const hostsFile = pathMod.join(ctx.outputDir, 'hosts.txt')
    fs.writeFileSync(hostsFile, hosts.join('\n'))
    await runBinary(ctx, 'tlsx', [
      '-l', hostsFile,
      '-json', '-silent',
      '-san', '-cn', '-so',
      '-tls-version', '-cipher',
      '-expired', '-self-signed', '-mismatched',
      '-t', '50', '-rl', '150',
    ], line => {
      try {
        const obj = JSON.parse(line)
        const expiry = obj.not_after
        const daysLeft = expiry ? Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000) : undefined
        results.push({
          host: obj.host, port: obj.port || 443,
          expiry, validFrom: obj.not_before,
          issuer: obj.issuer_org?.[0], subject: obj.subject_cn,
          protocols: obj.tls_versions, ciphers: obj.cipher ? [obj.cipher] : [],
          issues: obj.misconfigurations || [], daysLeft,
        })
      } catch { /* not json */ }
    }, 90_000)
  } else {
    ctx.log('ssl', `TLS inspection on ${hosts.length} hosts`, 'info')
    await Promise.all(hosts.map(host => checkSsl(ctx, host, results)))
  }

  ctx.phaseEnd('ssl', results)
  return results
}