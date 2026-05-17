import net from 'net'
import { ScanContext, httpsGet } from './context'

function runWhois(ctx: ScanContext, results: { type: string; value: string; source: string; extra?: string }[]): Promise<void> {
  return new Promise(resolve => {
    ctx.log('whois', `WHOIS lookup for ${ctx.target}`, 'info')
    const sock = new net.Socket()
    let data = ''
    sock.connect(43, 'whois.iana.org', () => sock.write(`${ctx.target}\r\n`))
    sock.on('data', (chunk: Buffer) => { data += chunk.toString() })
    sock.on('close', () => {
      // Emails
      const emails = [...new Set(data.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [])]
      for (const email of emails) {
        results.push({ type: 'email', value: email, source: 'whois' })
        ctx.log('whois', `Email: ${email}`, 'success')
      }

      // Nameservers
      const nameservers = data.match(/Name Server:\s*(.+)/gi)?.map(l => l.replace(/Name Server:\s*/i, '').trim().toLowerCase()) || []
      if (nameservers.length) {
        results.push({ type: 'whois', value: `Nameservers: ${nameservers.join(', ')}`, source: 'whois', extra: 'nameservers' })
      }

      // Structured WHOIS fields
      const extract = (re: RegExp) => data.match(re)?.[1]?.trim()

      const registrar = extract(/Registrar:\s*(.+)/i)
      if (registrar) results.push({ type: 'whois', value: `Registrar: ${registrar}`, source: 'whois', extra: 'registrar' })

      const registrant = extract(/Registrant Organization:\s*(.+)/i)
      if (registrant) results.push({ type: 'person', value: `Registrant Org: ${registrant}`, source: 'whois' })

      const registrantEmail = extract(/Registrant Email:\s*(.+)/i)
      if (registrantEmail && !emails.includes(registrantEmail.toLowerCase())) {
        results.push({ type: 'email', value: registrantEmail, source: 'whois-registrant' })
      }

      const created = extract(/Creation Date:\s*(.+)/i)
      if (created) results.push({ type: 'whois', value: `Created: ${created.split('T')[0]}`, source: 'whois', extra: 'created' })

      const expiry = extract(/Registry Expiry Date:\s*(.+)/i)
      if (expiry) {
        const daysLeft = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
        results.push({ type: 'whois', value: `Expires: ${expiry.split('T')[0]} (${daysLeft}d)`, source: 'whois', extra: 'expiry' })
      }

      const updated = extract(/Updated Date:\s*(.+)/i)
      if (updated) results.push({ type: 'whois', value: `Updated: ${updated.split('T')[0]}`, source: 'whois', extra: 'updated' })

      const status = data.match(/Domain Status:\s*(.+)/gi)?.map(l => l.replace(/Domain Status:\s*/i, '').trim()) || []
      if (status.length) results.push({ type: 'whois', value: `Status: ${status[0]}`, source: 'whois', extra: 'status' })

      const dnssec = extract(/DNSSEC:\s*(.+)/i)
      if (dnssec) results.push({ type: 'whois', value: `DNSSEC: ${dnssec}`, source: 'whois', extra: 'dnssec' })

      ctx.log('whois', `WHOIS complete`, 'success')
      resolve()
    })
    sock.on('error', () => resolve())
    sock.setTimeout(8000, () => { sock.destroy(); resolve() })
  })
}

async function runRobotsTxt(ctx: ScanContext, results: { type: string; value: string; source: string; extra?: string }[]) {
  for (const scheme of ['https', 'http']) {
    const url = `${scheme}://${ctx.target}/robots.txt`
    const data = await httpsGet(ctx, url, 5000)
    if (data && (data.includes('User-agent') || data.includes('Disallow'))) {
      const disallowed = data.match(/Disallow:\s*(.+)/g)?.map(l => l.replace('Disallow:', '').trim()).filter(p => p && p !== '/') || []
      const allowed = data.match(/Allow:\s*(.+)/g)?.map(l => l.replace('Allow:', '').trim()).filter(p => p) || []
      const sitemaps = data.match(/Sitemap:\s*(.+)/g)?.map(l => l.replace('Sitemap:', '').trim()) || []

      for (const p of disallowed) {
        results.push({ type: 'domain', value: `${scheme}://${ctx.target}${p}`, source: 'robots.txt', extra: 'disallowed' })
      }
      for (const p of allowed) {
        results.push({ type: 'domain', value: `${scheme}://${ctx.target}${p}`, source: 'robots.txt', extra: 'allowed' })
      }
      for (const s of sitemaps) {
        results.push({ type: 'domain', value: s, source: 'robots.txt', extra: 'sitemap' })
      }
      ctx.log('osint', `robots.txt: ${disallowed.length} disallowed, ${sitemaps.length} sitemaps`, 'success')
      break
    }
  }
}

async function runEmailHarvest(ctx: ScanContext, results: { type: string; value: string; source: string; extra?: string }[]) {
  // Fetch main page and look for email patterns
  for (const scheme of ['https', 'http']) {
    const data = await httpsGet(ctx, `${scheme}://${ctx.target}`, 8000)
    if (!data) continue
    const emails = [...new Set(data.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [])]
      .filter(e => !e.includes('@example') && !e.includes('@test') && e.includes('@'))
    for (const email of emails) {
      if (!results.find(r => r.type === 'email' && r.value === email)) {
        results.push({ type: 'email', value: email, source: 'web-harvest' })
        ctx.log('osint', `Email found on homepage: ${email}`, 'success')
      }
    }
    // Check contact/about pages
    for (const page of ['/contact', '/about', '/team']) {
      const pageData = await httpsGet(ctx, `${scheme}://${ctx.target}${page}`, 5000)
      if (!pageData) continue
      const pageEmails = [...new Set(pageData.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [])]
        .filter(e => !e.includes('@example'))
      for (const email of pageEmails) {
        if (!results.find(r => r.type === 'email' && r.value === email)) {
          results.push({ type: 'email', value: email, source: `web-harvest${page}` })
        }
      }
    }
    break
  }
}

export async function runOsint(ctx: ScanContext) {
  if (ctx.isCancel()) return []
  ctx.phaseStart('osint')
  const results: { type: string; value: string; source: string; extra?: string }[] = []

  await Promise.all([
    runWhois(ctx, results),
    runRobotsTxt(ctx, results),
    runEmailHarvest(ctx, results),
  ])

  ctx.log('osint', `Found ${results.length} OSINT results`, 'success')
  ctx.phaseEnd('osint', results)
  return results
}