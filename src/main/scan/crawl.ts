import pathMod from 'path'
import fs from 'fs'
import { ScanContext, runBinary, runBinaryStdin, httpsGet, hasBinary } from './context'

async function analyzeJsFile(ctx: ScanContext, jsUrl: string, sourcePage: string, results: { url: string; source: string; type: string; severity?: string; match?: string; masked?: string }[]) {
  const content = await httpsGet(ctx, jsUrl, 8000)
  if (!content) return

  const secretPatterns = [
    { re: /(?:api[_-]?key|apikey)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/gi, name: 'API Key', severity: 'high' as const },
    { re: /(?:secret[_-]?key|secretkey)\s*[:=]\s*["']([^"']{16,})["']/gi, name: 'Secret Key', severity: 'high' as const },
    { re: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"']{8,})["']/gi, name: 'Password', severity: 'high' as const },
    { re: /(?:access[_-]?token|accesstoken)\s*[:=]\s*["']([A-Za-z0-9_\-./]{20,})["']/gi, name: 'Access Token', severity: 'high' as const },
    { re: /AKIA[0-9A-Z]{16}/g, name: 'AWS Access Key ID', severity: 'critical' as const },
    { re: /(?:aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*["']([A-Za-z0-9/+=]{40})["']/gi, name: 'AWS Secret Key', severity: 'critical' as const },
    { re: /ghp_[A-Za-z0-9]{36}/g, name: 'GitHub Personal Token', severity: 'critical' as const },
    { re: /github_pat_[A-Za-z0-9_]{82}/g, name: 'GitHub Fine-Grained Token', severity: 'critical' as const },
    { re: /gho_[A-Za-z0-9]{36}/g, name: 'GitHub OAuth Token', severity: 'critical' as const },
    { re: /sk_live_[A-Za-z0-9]{24,}/g, name: 'Stripe Live Key', severity: 'critical' as const },
    { re: /pk_live_[A-Za-z0-9]{24,}/g, name: 'Stripe Public Key', severity: 'medium' as const },
    { re: /AIza[A-Za-z0-9_\-]{35}/g, name: 'Google API Key', severity: 'high' as const },
    { re: /Bearer\s+[A-Za-z0-9\-_=.]{20,}/gi, name: 'Bearer Token', severity: 'high' as const },
    { re: /(?:mongodb|mysql|postgres|postgresql|redis|mssql):\/\/[^\s"'<>]+/gi, name: 'Database Connection URL', severity: 'critical' as const },
    { re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, name: 'Private Key', severity: 'critical' as const },
    { re: /eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, name: 'JWT Token', severity: 'medium' as const },
    { re: /(?:twilio|sendgrid|mailgun)[._-]?(?:api[._-]?key|secret)\s*[:=]\s*["']([^"']{20,})["']/gi, name: 'Email Service Key', severity: 'high' as const },
    { re: /(?:private[_-]?key|privatekey)\s*[:=]\s*["']([A-Za-z0-9/+=]{32,})["']/gi, name: 'Private Key Value', severity: 'critical' as const },
  ]

  for (const pattern of secretPatterns) {
    let match
    pattern.re.lastIndex = 0
    while ((match = pattern.re.exec(content)) !== null) {
      const fullMatch = match[0]
      const value = match[1] || fullMatch
      // Mask the secret
      const masked = value.length > 8
        ? value.slice(0, 4) + '****' + value.slice(-4)
        : '****'
      results.push({
        url: jsUrl,
        source: sourcePage,
        type: 'secret',
        severity: pattern.severity,
        match: `${pattern.name}: ${fullMatch.slice(0, 60)}`,
        masked: `${pattern.name}: ${masked}`,
      })
      ctx.log('crawl', `[SECRET] ${pattern.name} found in ${jsUrl}`, 'warn')
      break // one per pattern per file
    }
  }

  // Extract API endpoints from JS
  const endpointRe = /["'](\/(?:api|v\d+|graphql|rest|endpoint|query|mutation|auth|oauth|token|user|admin|dashboard)[^"'<>{}\s]{0,100})["']/gi
  let m
  while ((m = endpointRe.exec(content)) !== null) {
    try {
      const ep = m[1]
      const origin = new URL(sourcePage).origin
      const fullUrl = `${origin}${ep}`
      if (!results.find(r => r.url === fullUrl)) {
        results.push({ url: fullUrl, source: jsUrl, type: 'endpoint' })
      }
    } catch { /* ignore */ }
  }
}

async function crawlPage(ctx: ScanContext, url: string, results: { url: string; source: string; type: string; severity?: string; match?: string; masked?: string }[]) {
  const data = await httpsGet(ctx, url, 10000)
  if (!data) return

  // Extract links
  const hrefs = data.match(/href=["']([^"'#>]+)["']/gi) || []
  for (const href of hrefs) {
    const link = href.match(/href=["']([^"'#>]+)["']/i)?.[1]
    if (link && (link.startsWith('http') || link.startsWith('/'))) {
      try {
        const fullUrl = link.startsWith('http') ? link : `${new URL(url).origin}${link}`
        if (!results.find(r => r.url === fullUrl)) {
          results.push({ url: fullUrl, source: url, type: 'link' })
        }
      } catch { /* invalid url */ }
    }
  }

  // Extract forms and input fields for parameter discovery
  const forms = data.match(/<form[^>]*action=["']([^"']+)["'][^>]*>/gi) || []
  for (const form of forms) {
    const action = form.match(/action=["']([^"']+)["']/i)?.[1]
    if (action) {
      try {
        const fullUrl = action.startsWith('http') ? action : `${new URL(url).origin}${action}`
        if (!results.find(r => r.url === fullUrl)) {
          results.push({ url: fullUrl, source: url, type: 'parameter', match: 'Form action' })
        }
      } catch { /* ignore */ }
    }
  }

  // Extract JS file URLs
  const scripts = data.match(/src=["']([^"']+\.js[^"']*)["']/gi) || []
  for (const script of scripts) {
    const jsUrl = script.match(/src=["']([^"']+\.js[^"']*)["']/i)?.[1]
    if (jsUrl) {
      try {
        const fullUrl = jsUrl.startsWith('http') ? jsUrl : `${new URL(url).origin}${jsUrl}`
        if (!results.find(r => r.url === fullUrl)) {
          results.push({ url: fullUrl, source: url, type: 'endpoint' })
        }
        await analyzeJsFile(ctx, fullUrl, url, results)
      } catch { /* invalid url */ }
    }
  }

  // API endpoints in page HTML
  const apiPaths = data.match(/["'](\/(?:api|v\d+|graphql|rest|endpoint|query|auth|oauth|token)[^"'<>{}\s]{0,100})["']/g) || []
  for (const api of apiPaths) {
    const apiPath = api.replace(/["']/g, '')
    try {
      const fullUrl = `${new URL(url).origin}${apiPath}`
      if (!results.find(r => r.url === fullUrl)) {
        results.push({ url: fullUrl, source: url, type: 'endpoint' })
      }
    } catch { /* ignore */ }
  }
}

async function crawlNodeFallback(ctx: ScanContext, liveUrls: string[], results: { url: string; source: string; type: string; severity?: string; match?: string; masked?: string }[]) {
  ctx.log('crawl', `Crawling ${liveUrls.length} URLs for links and JS endpoints`, 'info')
  for (const url of liveUrls.slice(0, 5)) {
    if (ctx.isCancel()) break
    await crawlPage(ctx, url, results)
  }
}

export async function runCrawl(ctx: ScanContext, liveUrls: string[]) {
  if (ctx.isCancel() || liveUrls.length === 0) return []
  ctx.phaseStart('crawl')
  const results: { url: string; source: string; type: string; severity?: string; match?: string; masked?: string }[] = []

  const urlsFile = pathMod.join(ctx.outputDir, 'live_urls.txt')
  fs.writeFileSync(urlsFile, liveUrls.join('\n'))

  await Promise.all([
    // katana: deep JS-aware crawler
    hasBinary(ctx, 'katana')
      ? runBinary(ctx, 'katana', ['-list', urlsFile, '-silent', '-jc', '-jsl', '-d', '3', '-c', '20', '-timeout', '10', '-rl', '150', '-aff'], line => {
          if (line.startsWith('http')) results.push({ url: line, source: 'katana', type: 'link' })
        }, 180_000)
      : crawlNodeFallback(ctx, liveUrls, results),

    // gau: fetch all known URLs from archives
    hasBinary(ctx, 'gau')
      ? runBinary(ctx, 'gau', ['--blacklist', 'png,jpg,gif,svg,ico,woff,woff2,ttf,eot,css,mp4,zip', ctx.target], line => {
          if (line.startsWith('http')) results.push({ url: line.trim(), source: 'gau', type: 'link' })
        }, 120_000)
      : Promise.resolve(),

    // waybackurls: Wayback Machine historical URLs
    hasBinary(ctx, 'waybackurls')
      ? runBinaryStdin(ctx, 'waybackurls', [], ctx.target, line => {
          if (line.startsWith('http')) results.push({ url: line.trim(), source: 'waybackurls', type: 'link' })
        })
      : Promise.resolve(),

    // hakrawler: fast endpoint crawler
    hasBinary(ctx, 'hakrawler')
      ? runBinaryStdin(ctx, 'hakrawler', ['-d', '2', '-h', 'User-Agent: Mozilla/5.0', '-plain'], liveUrls[0] || '', line => {
          if (line.startsWith('http')) results.push({ url: line.trim(), source: 'hakrawler', type: 'link' })
        })
      : Promise.resolve(),

    // gospider: spider with JS parsing
    hasBinary(ctx, 'gospider') && liveUrls.length > 0
      ? runBinary(ctx, 'gospider', ['-s', liveUrls[0], '-c', '5', '-d', '1', '--quiet', '--no-redirect'], line => {
          const m = line.match(/\[url\]\s*-\s*\[(\d+)\]\s*-\s*(https?:\/\/\S+)/)
          if (m) results.push({ url: m[2], source: 'gospider', type: 'link' })
        }, 120_000)
      : Promise.resolve(),

    // subjs: collect all JavaScript file URLs from live hosts
    hasBinary(ctx, 'subjs')
      ? runBinary(ctx, 'subjs', ['-i', urlsFile, '-c', '20'], line => {
          const u = line.trim()
          if (u.startsWith('http') && u.includes('.js')) results.push({ url: u, source: 'subjs', type: 'endpoint' })
        })
      : Promise.resolve(),

    // cariddi: deep crawler with built-in secret & endpoint detection
    hasBinary(ctx, 'cariddi') && liveUrls.length > 0
      ? runBinary(ctx, 'cariddi', ['-u', liveUrls[0], '-s', '-e', '-d', '2', '-t', '10'], line => {
          if (line.startsWith('http')) results.push({ url: line.trim(), source: 'cariddi', type: 'link' })
          else if (line.includes('SECRET') || line.includes('API') || line.includes('KEY')) {
            ctx.log('cariddi', `[SECRET] ${line.trim()}`, 'warn')
          }
        })
      : Promise.resolve(),

    // xcrawl3r: configurable recursive crawler
    hasBinary(ctx, 'xcrawl3r') && liveUrls.length > 0
      ? runBinary(ctx, 'xcrawl3r', ['-u', liveUrls[0], '--depth', '2', '--silent'], line => {
          if (line.startsWith('http')) results.push({ url: line.trim(), source: 'xcrawl3r', type: 'link' })
        })
      : Promise.resolve(),

    // urlhunter: mine URLs from Common Crawl archives (no API key required)
    hasBinary(ctx, 'urlhunter')
      ? (() => {
          const urlhunterOut = pathMod.join(ctx.outputDir, 'urlhunter.txt')
          ctx.log('urlhunter', `Mining Common Crawl archives for ${ctx.target}`, 'info')
          return runBinary(ctx, 'urlhunter', ['-target', ctx.target, '-date', 'latest', '-output', urlhunterOut], () => {}, 120_000).then(() => {
            try {
              for (const line of fs.readFileSync(urlhunterOut, 'utf-8').split('\n')) {
                const u = line.trim()
                if (u.startsWith('http') && !results.find(r => r.url === u)) {
                  results.push({ url: u, source: 'urlhunter', type: 'link' })
                }
              }
            } catch { /* no output file */ }
          })
        })()
      : Promise.resolve(),

    // mantra: scan HTTP responses for exposed API keys and secrets
    hasBinary(ctx, 'mantra') && liveUrls.length > 0
      ? runBinaryStdin(ctx, 'mantra', [], liveUrls.slice(0, 20).join('\n'), line => {
          if (line && (line.includes('[+]') || line.toLowerCase().includes('found') || line.includes('KEY') || line.includes('SECRET'))) {
            ctx.log('mantra', `[SECRET] ${line.trim()}`, 'warn')
            results.push({ url: liveUrls[0], source: 'mantra', type: 'secret', severity: 'high', match: line.trim().slice(0, 200) })
          }
        }, 60_000)
      : Promise.resolve(),
  ])

  // Deduplicate URLs
  const seen = new Set<string>()
  const deduped = results.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  // jsluice: extract URLs, secrets, and endpoints from discovered JS files
  if (hasBinary(ctx, 'jsluice')) {
    const jsFiles = deduped.filter(r => r.url.endsWith('.js') && r.url.startsWith('http')).slice(0, 30)
    if (jsFiles.length > 0) {
      ctx.log('jsluice', `Analysing ${jsFiles.length} JavaScript files for secrets and endpoints`, 'info')
      const jsUrlsFile = pathMod.join(ctx.outputDir, 'js_files.txt')
      fs.writeFileSync(jsUrlsFile, jsFiles.map(r => r.url).join('\n'))
      await runBinary(ctx, 'jsluice', ['urls', '-i', jsUrlsFile], line => {
        try {
          const obj = JSON.parse(line)
          const u = obj.url || obj.value
          if (u && u.startsWith('http') && !deduped.find(r => r.url === u)) {
            deduped.push({ url: u, source: 'jsluice', type: 'endpoint' })
          }
        } catch {
          if (line.startsWith('http')) deduped.push({ url: line.trim(), source: 'jsluice', type: 'endpoint' })
        }
      })
      await runBinary(ctx, 'jsluice', ['secrets', '-i', jsUrlsFile], line => {
        try {
          const obj = JSON.parse(line)
          const name = obj.kind || obj.type || 'Secret'
          const val = obj.value || obj.match || ''
          const masked = val.length > 8 ? val.slice(0, 4) + '****' + val.slice(-4) : '****'
          ctx.log('jsluice', `[SECRET:${name}] ${masked}`, 'warn')
        } catch { /* not json */ }
      })
    }
  }

  ctx.log('crawl', `Found ${deduped.length} endpoints/links`, 'success')
  ctx.phaseEnd('crawl', deduped)
  return deduped
}