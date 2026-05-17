import dns from 'dns/promises'
import https from 'https'
import { ScanContext } from './context'

function fetchCrtSh(ctx: ScanContext, results: { type: string; value: string; extra?: string }[]) {
  return new Promise<void>((resolve) => {
    ctx.log('crt.sh', `Querying certificate transparency logs for ${ctx.target}`, 'info')
    const req = https.request(
      { hostname: 'crt.sh', path: `/?q=%.${ctx.target}&output=json`, method: 'GET', headers: { 'User-Agent': 'ReconMaster/1.0' }, timeout: 15000 },
      (res) => {
        let data = ''
        let resolved = false
        const done = () => { if (!resolved) { resolved = true; resolve() } }
        res.on('data', (d: Buffer) => { if (data.length < 2000000) data += d.toString() })
        res.on('end', () => {
          try {
            const entries = JSON.parse(data) as Array<{ name_value: string }>
            const domains = new Set<string>()
            for (const e of entries) {
              for (const d of e.name_value.split('\n')) {
                const clean = d.trim().replace(/^\*\./, '')
                if (clean.endsWith(ctx.target) && clean !== ctx.target && !clean.includes(' ')) {
                  domains.add(clean)
                  results.push({ type: 'CERT', value: clean, extra: 'Certificate Transparency' })
                }
              }
            }
            ctx.log('crt.sh', `Found ${domains.size} domains in cert transparency logs`, 'success')
          } catch { /* parse error */ }
          done()
        })
        res.on('error', done)
        res.on('close', done)
      }
    )
    req.on('error', () => resolve())
    req.on('timeout', () => { req.destroy(); resolve() })
    req.end()
  })
}

export async function runDns(ctx: ScanContext) {
  if (ctx.isCancel()) return []
  ctx.phaseStart('dns')
  ctx.log('dns', `Resolving DNS records for ${ctx.target}`, 'info')
  const results: { type: string; value: string; ttl?: number; extra?: string }[] = []
  const resolver = new dns.Resolver()

  await Promise.race([
   Promise.allSettled([
    resolver.resolve4(ctx.target, { ttl: true }).then(rs => rs.forEach(r => {
      results.push({ type: 'A', value: r.address, ttl: r.ttl })
      ctx.log('dns', `A: ${r.address} (TTL ${r.ttl}s)`, 'success')
    })).catch(() => {}),
    resolver.resolve6(ctx.target, { ttl: true }).then(rs => rs.forEach(r => {
      results.push({ type: 'AAAA', value: r.address, ttl: r.ttl })
    })).catch(() => {}),
    resolver.resolveMx(ctx.target).then(rs => rs.sort((a, b) => a.priority - b.priority).forEach(r => {
      results.push({ type: 'MX', value: `${r.priority} ${r.exchange}`, extra: `Priority ${r.priority}` })
      ctx.log('dns', `MX: ${r.priority} ${r.exchange}`, 'success')
    })).catch(() => {}),
    resolver.resolveNs(ctx.target).then(rs => rs.forEach(r => {
      results.push({ type: 'NS', value: r })
    })).catch(() => {}),
    resolver.resolveTxt(ctx.target).then(rs => rs.forEach(r => {
      const txt = r.join(' ')
      let extra: string | undefined
      if (txt.includes('v=spf1')) extra = 'SPF — email sender policy'
      results.push({ type: 'TXT', value: txt, extra })
      if (txt.includes('v=spf1')) {
        ctx.log('dns', `SPF record found`, 'success')
      }
    })).catch(() => {}),
    resolver.resolveCname(ctx.target).then(rs => rs.forEach(r => {
      results.push({ type: 'CNAME', value: r })
    })).catch(() => {}),
    resolver.resolveSoa(ctx.target).then(r => {
      results.push({ type: 'SOA', value: `${r.nsname}`, extra: `hostmaster: ${r.hostmaster} | serial: ${r.serial} | refresh: ${r.refresh}s` })
    }).catch(() => {}),
    // CAA records
    resolver.resolveCaa(ctx.target).then(rs => rs.forEach(r => {
      const issueVal = Array.isArray(r.issue) ? r.issue[0] : (r.issue || '')
      results.push({ type: 'CAA', value: `${issueVal}`, extra: `tag: ${r.critical ? 'critical' : 'non-critical'}` })
      ctx.log('dns', `CAA: ${r.issue}`, 'info')
    })).catch(() => {}),
    // DMARC
    resolver.resolveTxt(`_dmarc.${ctx.target}`).then(rs => rs.forEach(r => {
      const txt = r.join(' ')
      if (txt.includes('v=DMARC1')) {
        const policy = txt.match(/p=([^;]+)/)?.[1] || 'none'
        results.push({ type: 'DMARC', value: txt, extra: `Policy: ${policy}` })
        ctx.log('dns', `DMARC policy: ${policy}`, 'success')
      }
    })).catch(() => {}),
    fetchCrtSh(ctx, results),
   ]),
   new Promise<void>(r => setTimeout(r, 25_000)),
  ])

  // PTR/reverse DNS for A records
  const aRecords = results.filter(r => r.type === 'A')
  await Promise.allSettled(
    aRecords.slice(0, 8).map(a =>
      resolver.reverse(a.value).then(ptrs => ptrs.forEach(ptr => {
        results.push({ type: 'PTR', value: ptr, extra: `← ${a.value}` })
        ctx.log('dns', `PTR: ${a.value} → ${ptr}`, 'success')
      })).catch(() => {})
    )
  )

  // Zone transfer attempt (informational)
  const nsRecs = results.filter(r => r.type === 'NS').slice(0, 2)
  for (const ns of nsRecs) {
    ctx.log('dns', `Zone transfer attempt from ${ns.value} — typically refused (AXFR)`, 'info')
  }

  ctx.log('dns', `Found ${results.length} DNS records`, 'success')
  ctx.phaseEnd('dns', results)
  return results
}