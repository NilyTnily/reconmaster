import dns from 'dns/promises'
import https from 'https'
import pathMod from 'path'
import fs from 'fs'
import { ScanContext, runBinary, runBinaryFile, httpsGet, hasBinary } from './context'
import { COMMON_SUBDOMAINS } from '../wordlists'

async function subdomainsFromHackerTarget(ctx: ScanContext, found: Map<string, { host: string; source: string }>) {
  ctx.log('hackertarget', `Querying HackerTarget for ${ctx.target}`, 'info')
  const data = await httpsGet(ctx, `https://api.hackertarget.com/hostsearch/?q=${ctx.target}`, 15000)
  if (data && !data.includes('error') && !data.includes('API count exceeded')) {
    for (const line of data.split('\n')) {
      const host = line.split(',')[0]?.trim()
      if (host && host.endsWith(ctx.target) && !found.has(host)) {
        found.set(host, { host, source: 'hackertarget' })
      }
    }
    ctx.log('hackertarget', `Found ${found.size} via HackerTarget`, 'success')
  }
}

async function subdomainsFromAlienVault(ctx: ScanContext, found: Map<string, { host: string; source: string }>) {
  ctx.log('alienvault', `Querying AlienVault OTX for ${ctx.target}`, 'info')
  const data = await httpsGet(ctx, `https://otx.alienvault.com/api/v1/indicators/domain/${ctx.target}/passive_dns`, 15000)
  if (!data) return
  try {
    const obj = JSON.parse(data) as { passive_dns?: Array<{ hostname?: string }> }
    for (const entry of obj.passive_dns || []) {
      const host = entry.hostname?.toLowerCase()
      if (host && host.endsWith(ctx.target) && !found.has(host)) {
        found.set(host, { host, source: 'alienvault' })
      }
    }
    ctx.log('alienvault', `AlienVault found ${found.size} total subdomains`, 'success')
  } catch { /* parse error */ }
}

async function subdomainsFromRapidDns(ctx: ScanContext, found: Map<string, { host: string; source: string }>) {
  ctx.log('rapiddns', `Querying RapidDNS for ${ctx.target}`, 'info')
  const data = await httpsGet(ctx, `https://rapiddns.io/subdomain/${ctx.target}?full=1&down=1`, 15000)
  if (!data) return
  const matches = data.match(/<td>([a-z0-9._-]+\.[a-z]{2,})<\/td>/gi) || []
  for (const m of matches) {
    const host = m.replace(/<\/?td>/gi, '').toLowerCase()
    if (host.endsWith(ctx.target) && !found.has(host)) {
      found.set(host, { host, source: 'rapiddns' })
    }
  }
}

async function subdomainsFromCertSh(ctx: ScanContext, found: Map<string, { host: string; source: string }>) {
  const data = await httpsGet(ctx, `https://crt.sh/?q=%.${ctx.target}&output=json`, 15000)
  if (!data) return
  try {
    const entries = JSON.parse(data) as Array<{ name_value: string }>
    for (const e of entries) {
      for (const d of e.name_value.split('\n')) {
        const host = d.trim().replace(/^\*\./, '').toLowerCase()
        if (host.endsWith(ctx.target) && host !== ctx.target && !host.includes(' ') && !found.has(host)) {
          found.set(host, { host, source: 'crt.sh' })
        }
      }
    }
  } catch { /* parse error */ }
}

async function subdomainsFromApis(ctx: ScanContext, found: Map<string, { host: string; source: string }>) {
  await Promise.all([
    subdomainsFromHackerTarget(ctx, found),
    subdomainsFromCertSh(ctx, found),
    subdomainsFromAlienVault(ctx, found),
    subdomainsFromRapidDns(ctx, found),
  ])
}

async function subdomainsFromBrute(ctx: ScanContext, found: Map<string, { host: string; source: string }>) {
  ctx.log('bruteforce', `DNS brute-force with ${COMMON_SUBDOMAINS.length} entries`, 'info')
  const deadline = Date.now() + 45_000 // hard 45-second cap
  const batchSize = 30
  for (let i = 0; i < COMMON_SUBDOMAINS.length && !ctx.isCancel() && Date.now() < deadline; i += batchSize) {
    const batch = COMMON_SUBDOMAINS.slice(i, i + batchSize)
    await Promise.all(batch.map(async sub => {
      const host = `${sub}.${ctx.target}`
      if (found.has(host)) return
      try {
        await dns.resolve4(host)
        if (!found.has(host)) {
          found.set(host, { host, source: 'brute-force' })
          ctx.log('bruteforce', `Found: ${host}`, 'success')
        }
      } catch { /* not found */ }
    }))
  }
}

async function runShuffleDns(ctx: ScanContext, found: Map<string, { host: string; source: string }>) {
  const resolvers = ['1.1.1.1', '8.8.8.8', '9.9.9.9', '208.67.222.222', '8.8.4.4', '1.0.0.1']
  const resolversFile = pathMod.join(ctx.outputDir, 'resolvers.txt')
  const wordlistFile = pathMod.join(ctx.outputDir, 'shuffledns_words.txt')
  fs.writeFileSync(resolversFile, resolvers.join('\n'))
  fs.writeFileSync(wordlistFile, COMMON_SUBDOMAINS.join('\n'))
  ctx.log('shuffledns', `Mass DNS brute-force with ${COMMON_SUBDOMAINS.length} words`, 'info')
  await runBinary(ctx, 'shuffledns', [
    '-d', ctx.target, '-w', wordlistFile, '-r', resolversFile, '-silent', '-mode', 'bruteforce',
  ], line => {
    const h = line.trim().toLowerCase()
    if (h && h.endsWith(ctx.target) && !found.has(h)) {
      found.set(h, { host: h, source: 'shuffledns' })
      ctx.log('shuffledns', `Found: ${h}`, 'success')
    }
  }, 20_000)
}

async function runAlterx(ctx: ScanContext, found: Map<string, { host: string; source: string }>) {
  const subsFile = pathMod.join(ctx.outputDir, 'found_subs.txt')
  fs.writeFileSync(subsFile, Array.from(found.keys()).join('\n'))
  ctx.log('alterx', `Generating permutations from ${found.size} subdomains`, 'info')
  const alterxResults: string[] = []
  await runBinary(ctx, 'alterx', ['-l', subsFile, '-silent', '-enrich'], line => {
    const h = line.trim().toLowerCase()
    if (h && h.endsWith(ctx.target) && !found.has(h)) alterxResults.push(h)
  }, 15_000)
  // Verify alterx permutations via DNS — cap to top 20 to stay within budget
  const batchSize = 30
  for (let i = 0; i < Math.min(alterxResults.length, 20) && !ctx.isCancel(); i += batchSize) {
    const batch = alterxResults.slice(i, i + batchSize)
    await Promise.all(batch.map(async h => {
      try {
        await dns.resolve4(h)
        if (!found.has(h)) {
          found.set(h, { host: h, source: 'alterx' })
          ctx.log('alterx', `Verified: ${h}`, 'success')
        }
      } catch { /* not resolvable */ }
    }))
  }
  ctx.log('alterx', `Alterx discovered ${alterxResults.length} permutations (after DNS verify)`, 'success')
}

function quickProbeHost(ctx: ScanContext, host: string): Promise<{ status: number; title?: string; cdn?: string } | null> {
  return new Promise(resolve => {
    const tryScheme = (_scheme: string) => new Promise<{ status: number; title?: string; cdn?: string } | null>(res => {
      try {
        const req = https.request(
          { hostname: host, path: '/', method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 ReconMaster/1.0', 'Host': host }, timeout: 3000, rejectUnauthorized: false },
          (r) => {
            let body = ''
            let settled = false
            const done = (v: { status: number; title?: string; cdn?: string } | null) => { if (!settled) { settled = true; res(v) } }
            r.on('data', (d: Buffer) => { if (body.length < 8000) body += d.toString() })
            r.on('end', () => {
              const title = body.match(/<title[^>]*>([^<]{0,120})<\/title>/i)?.[1]?.trim()
              const server = String(r.headers['server'] || '')
              const cdn = r.headers['cf-ray'] ? 'Cloudflare'
                : r.headers['x-amz-cf-id'] ? 'CloudFront'
                : r.headers['x-vercel-id'] ? 'Vercel'
                : server.includes('Netlify') ? 'Netlify'
                : undefined
              done({ status: r.statusCode || 0, title, cdn })
            })
            r.on('error', () => done(null))
            r.on('close', () => {
              const title = body.match(/<title[^>]*>([^<]{0,120})<\/title>/i)?.[1]?.trim()
              done(body ? { status: r.statusCode || 0, title } : null)
            })
          }
        )
        req.on('error', () => res(null))
        req.on('timeout', () => { req.destroy(); res(null) })
        req.end()
      } catch { res(null) }
    })

    tryScheme('https').then(r => {
      if (r) return resolve(r)
      return tryScheme('http').then(resolve)
    })
  })
}

export async function runSubdomains(ctx: ScanContext) {
  if (ctx.isCancel()) return []
  ctx.phaseStart('subdomains')

  const found = new Map<string, { host: string; source: string }>()

  await Promise.all([
    hasBinary(ctx, 'subfinder')
      ? runBinary(ctx, 'subfinder', [
          '-d', ctx.target, '-silent', '-all', '-recursive',
          '-timeout', '15', '-t', '100', '-max-time', '18',
        ], line => {
          const h = line.trim().toLowerCase()
          if (h && h.endsWith(ctx.target) && !found.has(h)) found.set(h, { host: h, source: 'subfinder' })
        }, 20_000)
      : Promise.resolve(),
    hasBinary(ctx, 'amass')
      ? (() => {
          const outFile = pathMod.join(ctx.outputDir, 'amass_out.txt')
          return runBinaryFile(
            ctx, 'amass',
            ['enum', '-passive', '-d', ctx.target, '-timeout', '1', '-silent', '-o', outFile],
            20_000,
            { AMASS_HOME: ctx.outputDir },
          ).then(() => {
            try {
              for (const line of fs.readFileSync(outFile, 'utf-8').split('\n')) {
                const h = line.trim().toLowerCase()
                if (h && h.includes(ctx.target) && !found.has(h))
                  found.set(h, { host: h, source: 'amass' })
              }
            } catch { /* no output file */ }
          })
        })()
      : Promise.resolve(),
    hasBinary(ctx, 'assetfinder')
      ? runBinary(ctx, 'assetfinder', ['--subs-only', ctx.target], line => {
          const h = line.trim().toLowerCase()
          if (h && h.endsWith(ctx.target) && !found.has(h)) found.set(h, { host: h, source: 'assetfinder' })
        }, 15_000)
      : Promise.resolve(),
    // puredns removed — no Windows binary release
    hasBinary(ctx, 'shuffledns')
      ? runShuffleDns(ctx, found)
      : Promise.resolve(),
    hasBinary(ctx, 'findomain')
      ? runBinary(ctx, 'findomain', ['-t', ctx.target, '-u', pathMod.join(ctx.outputDir, 'findomain.txt'), '--threads', '8', '--quiet'], () => {}, 15_000).then(() => {
          try {
            const lines = fs.readFileSync(pathMod.join(ctx.outputDir, 'findomain.txt'), 'utf-8').split('\n')
            for (const line of lines) {
              const h = line.trim().toLowerCase()
              if (h && h.endsWith(ctx.target) && !found.has(h)) found.set(h, { host: h, source: 'findomain' })
            }
          } catch { /* ok */ }
        })
      : Promise.resolve(),
    // chaos-client removed — no Windows binary release
    subdomainsFromApis(ctx, found),
  ])

  // After initial collection, run alterx to generate permutations
  if (hasBinary(ctx, 'alterx') && found.size > 0) {
    await runAlterx(ctx, found)
  }

  // dnsx: bulk DNS resolver — verify all collected subdomains and pull A/CNAME records
  if (hasBinary(ctx, 'dnsx') && found.size > 0) {
    const dnsxFile = pathMod.join(ctx.outputDir, 'all_subs_dnsx.txt')
    fs.writeFileSync(dnsxFile, Array.from(found.keys()).join('\n'))
    ctx.log('dnsx', `Bulk DNS verification of ${found.size} subdomains`, 'info')
    await runBinary(ctx, 'dnsx', [
      '-l', dnsxFile, '-silent', '-a', '-cname', '-resp', '-rcode', 'noerror',
      '-t', '100', '-rl', '500',
    ], line => {
      const m = line.match(/^([a-z0-9._-]+)\s+\[/)
      if (m) {
        const sub = m[1].trim().toLowerCase()
        if (sub && sub.endsWith(ctx.target) && !found.has(sub)) {
          found.set(sub, { host: sub, source: 'dnsx' })
          ctx.log('dnsx', `Discovered: ${sub}`, 'success')
        }
      }
    }, 20_000)
  }

  ctx.log('subdomains', `Enriching ${found.size} subdomains (DNS + HTTP probe)...`, 'info')

  const results = await Promise.all(
    Array.from(found.values()).slice(0, 30).map(async sub => {
      let ip: string | undefined
      let status: number | undefined
      let title: string | undefined
      let cdn: string | undefined

      try {
        const ips = await dns.resolve4(sub.host)
        ip = ips[0]
      } catch { /* unresolvable */ }

      // Quick HTTP probe for live status + title
      const probed = await quickProbeHost(ctx, sub.host)
      if (probed) { status = probed.status; title = probed.title; cdn = probed.cdn }

      return { ...sub, ip, status, title, cdn }
    })
  )

  ctx.log('subdomains', `Discovered ${results.length} subdomains`, 'success')
  ctx.phaseEnd('subdomains', results)
  return results
}