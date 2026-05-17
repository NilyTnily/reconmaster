import https from 'https'
import http from 'http'
import pathMod from 'path'
import fs from 'fs'
import { ScanContext, runBinary, runBinaryStdin, hasBinary } from './context'

function calcSecurityScore(headers: Record<string, string>): number {
  let score = 100
  if (!headers['strict-transport-security']) score -= 20
  if (!headers['content-security-policy']) score -= 20
  if (!headers['x-frame-options'] && !headers['content-security-policy']?.includes('frame-ancestors')) score -= 15
  if (!headers['x-content-type-options']) score -= 10
  if (!headers['referrer-policy']) score -= 10
  if (!headers['permissions-policy'] && !headers['feature-policy']) score -= 10
  if (headers['server'] && headers['server'].match(/\d+\.\d+/)) score -= 10
  if (headers['x-powered-by']) score -= 5
  return Math.max(0, score)
}

function detectTech(body: string, headers: Record<string, string>): string[] {
  const tech: string[] = []
  const server = (headers['server'] || '').toLowerCase()
  const powered = (headers['x-powered-by'] || '').toLowerCase()
  const bodyL = body.toLowerCase()

  if (server.includes('nginx')) tech.push('Nginx')
  if (server.includes('apache')) tech.push('Apache')
  if (server.includes('iis')) tech.push('IIS')
  if (server.includes('cloudflare')) tech.push('Cloudflare')
  if (server.includes('caddy')) tech.push('Caddy')
  if (server.includes('lighttpd')) tech.push('LightTPD')
  if (powered.includes('php')) tech.push('PHP')
  if (powered.includes('asp.net')) tech.push('ASP.NET')
  if (powered.includes('express')) tech.push('Express.js')
  if (powered.includes('next.js')) tech.push('Next.js')
  if (headers['x-generator']?.toLowerCase().includes('wordpress')) tech.push('WordPress')
  if (bodyL.includes('wp-content') || bodyL.includes('wp-includes')) tech.push('WordPress')
  if (bodyL.includes('joomla')) tech.push('Joomla')
  if (bodyL.includes('drupal')) tech.push('Drupal')
  if (bodyL.includes('__next') || bodyL.includes('_next/static')) tech.push('Next.js')
  if (bodyL.includes('nuxt') || bodyL.includes('__nuxt')) tech.push('Nuxt.js')
  if (bodyL.includes('react') && (bodyL.includes('__react') || bodyL.includes('data-reactroot'))) tech.push('React')
  if (bodyL.includes('ng-version') || bodyL.includes('angular')) tech.push('Angular')
  if (bodyL.includes('vue.js') || bodyL.includes('__vue__')) tech.push('Vue.js')
  if (bodyL.includes('jquery')) tech.push('jQuery')
  if (bodyL.includes('bootstrap')) tech.push('Bootstrap')
  if (headers['x-shopify-stage'] || bodyL.includes('shopify.com')) tech.push('Shopify')
  if (headers['cf-ray']) tech.push('Cloudflare')
  if (headers['x-amz-cf-id'] || headers['x-amz-request-id']) tech.push('AWS')
  if (headers['x-vercel-id']) tech.push('Vercel')
  if (headers['x-netlify-id'] || server.includes('netlify')) tech.push('Netlify')
  if (headers['x-wp-total']) tech.push('WordPress REST API')
  if (bodyL.includes('laravel')) tech.push('Laravel')
  if (bodyL.includes('django')) tech.push('Django')
  if (bodyL.includes('rails') || bodyL.includes('ruby on rails')) tech.push('Ruby on Rails')
  return [...new Set(tech)]
}

function detectWaf(headers: Record<string, string>): string | undefined {
  const server = headers['server'] || ''
  if (server.toLowerCase().includes('cloudflare') || headers['cf-ray']) return 'Cloudflare'
  if (server.toLowerCase().includes('akamai') || headers['x-akamai-transformed']) return 'Akamai'
  if (headers['x-sucuri-id'] || headers['x-sucuri-cache']) return 'Sucuri'
  if (headers['server']?.includes('AwsWaf') || headers['x-amzn-requestid']) return 'AWS WAF'
  if (headers['x-powered-by']?.includes('Incapsula') || headers['x-iinfo']) return 'Imperva'
  if (headers['x-fw-hash']) return 'Fastly'
  if (server.includes('F5 BIG-IP')) return 'F5 BIG-IP'
  if (headers['server']?.includes('FortiWeb')) return 'FortiWeb'
  if (headers['x-protected-by']) return headers['x-protected-by']
  return undefined
}


function fetchUrl(url: string, timeoutMs = 8000): Promise<{ url: string; status: number; title?: string; tech?: string[]; server?: string; contentLength?: number; waf?: string; headers?: Record<string, string>; cookies?: string[]; securityScore?: number } | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url)
      const mod = parsed.protocol === 'https:' ? https : http
      const req = mod.request(
        { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0', 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' }, timeout: timeoutMs, rejectUnauthorized: false },
        (res) => {
          let body = ''
          let settled = false
          const done = () => {
            if (settled) return
            settled = true
            const headers: Record<string, string> = {}
            for (const [k, v] of Object.entries(res.headers)) {
              if (typeof v === 'string') headers[k.toLowerCase()] = v
              else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(', ')
            }
            const rawCookies = res.headers['set-cookie'] || []
            const cookies = (Array.isArray(rawCookies) ? rawCookies : [rawCookies]).map(c => {
              const name = c.split('=')[0]?.trim() || '?'
              const flags: string[] = []
              if (/httponly/i.test(c)) flags.push('HttpOnly')
              if (/secure/i.test(c)) flags.push('Secure')
              const same = c.match(/samesite=([^;]+)/i)?.[1]?.trim()
              if (same) flags.push(`SameSite=${same}`)
              return `${name}${flags.length ? ` [${flags.join(', ')}]` : ' [no flags]'}`
            })
            resolve({
              url,
              status: res.statusCode || 0,
              title: body.match(/<title[^>]*>([^<]{0,200})<\/title>/i)?.[1]?.trim(),
              tech: detectTech(body, headers),
              server: headers['server'],
              contentLength: parseInt(headers['content-length'] || '0') || body.length,
              waf: detectWaf(headers),
              headers,
              cookies: cookies.length ? cookies : undefined,
              securityScore: calcSecurityScore(headers),
            })
          }
          res.on('data', (d: Buffer) => { if (body.length < 50000) body += d.toString() })
          res.on('end', done)
          res.on('error', () => { if (!settled) { settled = true; resolve(null) } })
          res.on('close', done)
        }
      )
      req.on('error', () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
      req.end()
    } catch { resolve(null) }
  })
}

async function probeHost(ctx: ScanContext, host: string, results: { url: string; status: number; title?: string; tech?: string[]; server?: string; contentLength?: number; waf?: string; headers?: Record<string, string>; cookies?: string[]; securityScore?: number }[]) {
  for (const scheme of ['https', 'http'] as const) {
    if (ctx.isCancel()) return
    const url = `${scheme}://${host}`
    const result = await fetchUrl(url)
    if (result) {
      results.push(result)
      ctx.log('http', `${url} [${result.status}]${result.title ? ` — ${result.title}` : ''}`, result.status < 400 ? 'success' : 'info')
      return
    }
  }
}

export async function runHttpProbe(ctx: ScanContext, hosts: string[]) {
  if (ctx.isCancel() || hosts.length === 0) return []
  ctx.phaseStart('http')
  const results: { url: string; status: number; title?: string; tech?: string[]; server?: string; contentLength?: number; waf?: string; headers?: Record<string, string>; cookies?: string[]; securityScore?: number }[] = []

  if (hasBinary(ctx, 'httpx')) {
    const hostsFile = pathMod.join(ctx.outputDir, 'hosts.txt')
    fs.writeFileSync(hostsFile, hosts.join('\n'))
    await runBinary(ctx, 'httpx', ['-l', hostsFile, '-status-code', '-title', '-tech-detect', '-server', '-content-length', '-web-server', '-follow-redirects', '-json', '-silent', '-rate-limit', '150', '-timeout', '10', '-threads', '50', '-random-agent'], line => {
      try {
        const obj = JSON.parse(line)
        const headers: Record<string, string> = {}
        if (obj.headers) for (const [k, v] of Object.entries(obj.headers)) headers[k.toLowerCase()] = String(v)
        const rawTech = obj.technologies ?? obj.tech ?? []
        const result = {
          url: obj.url || `https://${obj.input}`,
          status: obj.status_code || 0,
          title: obj.title,
          tech: Array.isArray(rawTech) ? rawTech : Object.keys(rawTech),
          server: obj.webserver,
          contentLength: obj.content_length,
          headers,
          securityScore: calcSecurityScore(headers),
        }
        results.push(result)
      } catch { /* not json */ }
    }, 180_000)
  } else {
    const scanHosts = hosts.slice(0, 30)
    ctx.log('http', `Probing ${scanHosts.length} hosts`, 'info')
    await Promise.all(scanHosts.map(host => probeHost(ctx, host, results)))
  }

  // webanalyze: Wappalyzer-based tech fingerprinting
  if (hasBinary(ctx, 'webanalyze') && results.length > 0) {
    ctx.log('webanalyze', `Tech fingerprinting ${Math.min(results.length, 20)} URLs`, 'info')
    for (const r of results.slice(0, 20)) {
      if (ctx.isCancel()) break
      await runBinary(ctx, 'webanalyze', ['-host', r.url, '-output', 'json'], line => {
        try {
          const obj = JSON.parse(line)
          if (obj.matches) {
            const techs = (obj.matches as Array<{ app?: string; name?: string }>).map(m => m.app || m.name || '').filter(Boolean)
            if (techs.length > 0) {
              r.tech = [...new Set([...(r.tech || []), ...techs])]
              ctx.log('webanalyze', `${r.url}: ${techs.join(', ')}`, 'info')
            }
          }
        } catch { /* not json */ }
      })
    }
  }

  // httprobe: probe any hosts not yet confirmed live
  if (hasBinary(ctx, 'httprobe') && hosts.length > results.length) {
    const unchecked = hosts.filter(h => !results.find(r => r.url.includes(h))).slice(0, 50)
    if (unchecked.length > 0) {
      ctx.log('httprobe', `Probing ${unchecked.length} additional hosts`, 'info')
      await runBinaryStdin(ctx, 'httprobe', ['-c', '20'], unchecked.join('\n'), line => {
        if (line.startsWith('http') && !results.find(r => r.url === line.trim())) {
          results.push({ url: line.trim(), status: 200 })
          ctx.log('httprobe', line.trim(), 'success')
        }
      })
    }
  }

  // gf: grep interesting parameter patterns from discovered URLs
  if (hasBinary(ctx, 'gf') && results.length > 0) {
    const urlsForGf = results.map(r => r.url).join('\n')
    const gfPatterns = ['xss', 'ssrf', 'redirect', 'sqli', 'ssti', 'lfi', 'rce']
    for (const pattern of gfPatterns) {
      if (ctx.isCancel()) break
      await runBinaryStdin(ctx, 'gf', [pattern], urlsForGf, line => {
        if (line.startsWith('http')) ctx.log('gf', `[${pattern.toUpperCase()}] ${line.trim()}`, 'warn')
      })
    }
  }

  // unfurl: extract and analyse URL structure for parameter discovery
  if (hasBinary(ctx, 'unfurl') && results.length > 0) {
    const urlsForUnfurl = results.filter(r => r.url.includes('?')).map(r => r.url).join('\n')
    if (urlsForUnfurl.length > 0) {
      ctx.log('unfurl', 'Extracting URL parameters and keys', 'info')
      const keys = new Set<string>()
      await runBinaryStdin(ctx, 'unfurl', ['--unique', 'keys'], urlsForUnfurl, line => {
        if (line.trim()) keys.add(line.trim())
      })
      if (keys.size > 0) ctx.log('unfurl', `Found ${keys.size} unique parameter names`, 'success')
    }
  }

  // gowitness: screenshot live web services for visual inventory
  if (hasBinary(ctx, 'gowitness') && results.length > 0) {
    const screenshotDir = pathMod.join(ctx.outputDir, 'screenshots')
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true })
    const gowitUrlsFile = pathMod.join(ctx.outputDir, 'gowitness_urls.txt')
    fs.writeFileSync(gowitUrlsFile, results.slice(0, 30).map(r => r.url).join('\n'))
    ctx.log('gowitness', `Screenshotting ${Math.min(results.length, 30)} live URLs`, 'info')
    await runBinary(ctx, 'gowitness', ['file', '-f', gowitUrlsFile, '--screenshot-path', screenshotDir, '--timeout', '10', '--threads', '5'], () => {}, 120_000)
    ctx.log('gowitness', `Screenshots saved to ${screenshotDir}`, 'success')
  }

  ctx.log('http', `${results.length} live hosts found`, 'success')
  ctx.phaseEnd('http', results)
  return results
}