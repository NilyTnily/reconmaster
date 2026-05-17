import https from 'https'
import http from 'http'
import pathMod from 'path'
import fs from 'fs'
import { ScanContext, runBinary, runBinaryStdin, httpsGet, hasBinary } from './context'

function fetchWithHeader(url: string, headerName: string, headerValue: string): Promise<string> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url)
      const mod = parsed.protocol === 'https:' ? https : http
      const req = mod.request(
        {
          hostname: parsed.hostname,
          path: parsed.pathname,
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0', [headerName]: headerValue },
          timeout: 5000,
          rejectUnauthorized: false,
        },
        (res) => {
          let body = ''
          let settled = false
          const done = (v: string) => { if (!settled) { settled = true; resolve(v) } }
          res.on('data', (d: Buffer) => { if (body.length < 50000) body += d.toString() })
          res.on('end', () => done(body))
          res.on('error', () => done(''))
          res.on('close', () => done(body))
        }
      )
      req.on('error', () => resolve(''))
      req.on('timeout', () => { req.destroy(); resolve('') })
      req.end()
    } catch { resolve('') }
  })
}

export async function runXss(ctx: ScanContext, liveUrls: string[], jsEndpoints: { url: string; type: string }[]): Promise<{ url: string; parameter: string; payload: string; type: string; severity: string; evidence?: string; remediation?: string; tool?: string }[]> {
  if (ctx.isCancel() || liveUrls.length === 0) return []
  ctx.phaseStart('xss')
  const results: { url: string; parameter: string; payload: string; type: string; severity: string; evidence?: string; remediation?: string; tool?: string }[] = []

  const XSS_PAYLOADS = [
    { p: '"><script>alert(1)</script>', detect: '<script>alert(1)</script>' },
    { p: "'><script>alert(1)</script>", detect: '<script>alert(1)</script>' },
    { p: '<img src=x onerror=alert(1)>', detect: 'onerror=alert(1)' },
    { p: '<svg onload=alert(1)>', detect: 'onload=alert(1)' },
    { p: '"><img src=x onerror=alert(1)>', detect: 'onerror=alert(1)' },
    { p: "';alert(1)//", detect: "';alert(1)" },
    { p: '<details open ontoggle=alert(1)>', detect: 'ontoggle=alert(1)' },
    { p: '"><iframe src=javascript:alert(1)>', detect: 'javascript:alert(1)' },
    { p: '${alert(1)}', detect: '${alert(1)}' },
    { p: '{{7*7}}', detect: '49' },
  ]

  const COMMON_PARAMS = ['q', 'search', 's', 'query', 'id', 'name', 'user', 'page', 'url', 'redirect',
    'next', 'return', 'callback', 'ref', 'from', 'to', 'message', 'text', 'comment', 'title',
    'description', 'content', 'input', 'data', 'value', 'term', 'keyword', 'file', 'path', 'action']

  if (hasBinary(ctx, 'dalfox')) {
    const urlsWithParams = [
      ...liveUrls.filter(u => u.includes('?')),
      ...jsEndpoints.filter(e => e.type === 'parameter' || (e.url && e.url.includes('?'))).map(e => e.url),
    ].slice(0, 30)

    const syntheticUrls = liveUrls.slice(0, 5).flatMap(u =>
      COMMON_PARAMS.slice(0, 5).map(p => `${u}?${p}=test`)
    )
    const allTargets = [...new Set([...urlsWithParams, ...syntheticUrls])].slice(0, 50)

    if (allTargets.length > 0) {
      const urlsFile = pathMod.join(ctx.outputDir, 'xss_urls.txt')
      fs.writeFileSync(urlsFile, allTargets.join('\n'))
      await runBinary(ctx, 'dalfox', [
        'file', urlsFile,
        '--silence', '--no-color',
        '--format', 'json',
        '--timeout', '10',
        '--delay', '50',
        '--waf-evasion',
        '--remote-payloads', 'portswigger,payloadbox',
        '-o', pathMod.join(ctx.outputDir, 'dalfox.txt'),
      ], line => {
        try {
          const obj = JSON.parse(line)
          if (obj.type === 'G' || obj.data?.type === 'G' || line.includes('[POC]')) {
            results.push({
              url: obj.data?.url || obj.url || '',
              parameter: obj.data?.param || '',
              payload: obj.data?.payload || '',
              type: 'reflected',
              severity: 'high',
              evidence: line.slice(0, 200),
              remediation: 'Encode all output. Use Content-Security-Policy. Validate input server-side.',
              tool: 'dalfox',
            })
          }
        } catch { /* text line */ }
      })
      try {
        const outFile = pathMod.join(ctx.outputDir, 'dalfox.txt')
        if (fs.existsSync(outFile)) {
          const lines = fs.readFileSync(outFile, 'utf-8').split('\n')
          for (const line of lines) {
            if (line.includes('[POC]') || line.includes('PoC')) {
              const urlMatch = line.match(/https?:\/\/[^\s]+/)
              if (urlMatch && !results.find(r => r.url === urlMatch[0])) {
                results.push({
                  url: urlMatch[0],
                  parameter: 'unknown',
                  payload: line.includes('payload:') ? line.split('payload:')[1]?.trim().slice(0, 100) : '',
                  type: 'reflected',
                  severity: 'high',
                  evidence: line.slice(0, 300),
                  remediation: 'Encode all output using context-appropriate encoding.',
                  tool: 'dalfox',
                })
              }
            }
          }
        }
      } catch { /* ignore */ }
    }
  }

  // Node.js reflection testing
  const testUrls = liveUrls.slice(0, 10)
  for (const baseUrl of testUrls) {
    if (ctx.isCancel()) break
    for (const param of COMMON_PARAMS.slice(0, 10)) {
      if (ctx.isCancel()) break
      for (const { p, detect } of XSS_PAYLOADS.slice(0, 5)) {
        try {
          const testUrl = `${baseUrl}?${param}=${encodeURIComponent(p)}`
          const response = await httpsGet(ctx, testUrl, 5000)
          if (response && response.includes(detect) && !response.includes('&lt;')) {
            const alreadyFound = results.find(r => r.url.startsWith(baseUrl) && r.parameter === param)
            if (!alreadyFound) {
              results.push({
                url: testUrl,
                parameter: param,
                payload: p,
                type: 'reflected',
                severity: 'high',
                evidence: 'Raw payload reflected in response body without encoding',
                remediation: 'HTML-encode all user-controlled output. Set Content-Security-Policy header. Use a templating engine with auto-escaping.',
              })
            }
            break
          }
        } catch { /* ignore */ }
      }
    }
  }

  // DOM XSS detection from JS files
  const jsFiles = jsEndpoints.filter(e => e.url.endsWith('.js') && e.url.startsWith('http')).slice(0, 20)
  const DOM_SINKS = [
    { re: /innerHTML\s*=/g, name: 'innerHTML sink', severity: 'high' as const },
    { re: /outerHTML\s*=/g, name: 'outerHTML sink', severity: 'high' as const },
    { re: /document\.write\s*\(/g, name: 'document.write sink', severity: 'high' as const },
    { re: /eval\s*\(/g, name: 'eval() sink', severity: 'critical' as const },
    { re: /location\.href\s*=\s*[^"'][^;]+/g, name: 'location.href assignment', severity: 'medium' as const },
    { re: /\$\([^)]+\)\.html\s*\(/g, name: 'jQuery .html() sink', severity: 'high' as const },
    { re: /window\.location\s*=\s*[^"'][^;]+/g, name: 'window.location assignment', severity: 'medium' as const },
  ]

  for (const jsFile of jsFiles) {
    if (ctx.isCancel()) break
    const content = await httpsGet(ctx, jsFile.url, 6000)
    if (!content) continue
    for (const sink of DOM_SINKS) {
      sink.re.lastIndex = 0
      const matches = content.match(sink.re)
      if (matches && matches.length > 0) {
        const influenced = /location\.(search|hash|href)/.test(content) || /URLSearchParams/.test(content)
        if (influenced && !results.find(r => r.url === jsFile.url && r.parameter.includes(sink.name))) {
          results.push({
            url: jsFile.url,
            parameter: sink.name,
            payload: matches[0].slice(0, 80),
            type: 'dom',
            severity: sink.severity,
            evidence: `DOM sink '${sink.name}' found in JS file with URL parameter influence`,
            remediation: 'Avoid using dangerous DOM APIs with user-controlled data. Use textContent instead of innerHTML. Sanitize with DOMPurify.',
          })
        }
        break
      }
    }
  }

  // Header injection testing
  const HEADER_PAYLOADS = [
    { header: 'User-Agent', payload: '"><script>alert(1)</script>' },
    { header: 'Referer', payload: 'https://evil.com"><script>alert(1)</script>' },
    { header: 'X-Forwarded-For', payload: '"><script>alert(1)</script>' },
  ]
  for (const baseUrl of liveUrls.slice(0, 3)) {
    for (const { header, payload } of HEADER_PAYLOADS) {
      const response = await fetchWithHeader(baseUrl, header, payload)
      if (response && response.includes('<script>alert(1)</script>') && !response.includes('&lt;')) {
        results.push({
          url: baseUrl,
          parameter: header,
          payload,
          type: 'header',
          severity: 'medium',
          evidence: `XSS payload reflected via ${header} header`,
          remediation: `Do not reflect HTTP headers in responses without encoding. Validate and sanitize all header values.`,
        })
      }
    }
  }

  const seen = new Set<string>()
  const deduped = results.filter(r => {
    const key = `${r.url}:${r.parameter}:${r.type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // jwt-hack: detect and attack JWT tokens found in responses/parameters
  if (hasBinary(ctx, 'jwt-hack')) {
    const jwtUrls = liveUrls.filter(u => u.includes('token=') || u.includes('jwt=') || u.includes('auth=') || u.includes('Bearer')).slice(0, 10)
    if (jwtUrls.length > 0) {
      ctx.log('jwt-hack', `JWT analysis on ${jwtUrls.length} endpoints`, 'info')
      for (const url of jwtUrls) {
        if (ctx.isCancel()) break
        await runBinary(ctx, 'jwt-hack', ['decode', '--url', url], line => {
          if (line.includes('alg') || line.includes('none') || line.includes('HS256')) {
            ctx.log('jwt-hack', `[JWT] ${line.trim()}`, 'info')
          }
          if (line.toLowerCase().includes('none') || line.toLowerCase().includes('vulnerable')) {
            deduped.push({ url, parameter: 'jwt', payload: 'alg:none', type: 'jwt', severity: 'high', evidence: line.trim(), remediation: 'Validate JWT algorithm server-side. Reject alg:none tokens. Use asymmetric keys (RS256).', tool: 'jwt-hack' })
          }
        })
      }
    }
  }

  // ppmap: prototype pollution vulnerability detection
  if (hasBinary(ctx, 'ppmap') && liveUrls.length > 0) {
    ctx.log('ppmap', `Prototype pollution scan on ${Math.min(liveUrls.length, 10)} URLs`, 'info')
    for (const url of liveUrls.slice(0, 10)) {
      if (ctx.isCancel()) break
      await runBinary(ctx, 'ppmap', ['-u', url], line => {
        if (line.includes('VULNERABLE') || line.includes('[+]') || line.toLowerCase().includes('pollution')) {
          deduped.push({
            url,
            parameter: '__proto__',
            payload: '{"__proto__":{"polluted":true}}',
            type: 'dom',
            severity: 'high',
            evidence: line.trim(),
            remediation: 'Sanitize object merge operations. Use Object.create(null) for safe maps. Apply prototype pollution sanitizer library.',
            tool: 'ppmap',
          })
          ctx.log('ppmap', `[PROTO-POLLUTION] ${url}`, 'warn')
        }
      })
    }
  }

  // qsreplace: inject payloads into all URL parameters for mass reflection check
  if (hasBinary(ctx, 'qsreplace') && liveUrls.filter(u => u.includes('?')).length > 0) {
    const paramUrls = liveUrls.filter(u => u.includes('?')).slice(0, 30).join('\n')
    const QS_PAYLOADS = ['"><svg onload=alert(1)>', "';alert(1)//", '${alert(1)}']
    for (const payload of QS_PAYLOADS) {
      if (ctx.isCancel()) break
      const payloadUrls: string[] = []
      await runBinaryStdin(ctx, 'qsreplace', [payload], paramUrls, line => {
        if (line.startsWith('http')) payloadUrls.push(line.trim())
      })
      for (const testUrl of payloadUrls.slice(0, 20)) {
        if (ctx.isCancel()) break
        try {
          const response = await httpsGet(ctx, testUrl, 5000)
          if (response && response.includes(payload.slice(0, 10)) && !response.includes('&lt;')) {
            if (!deduped.find(r => r.url === testUrl)) {
              deduped.push({ url: testUrl, parameter: 'multiple', payload, type: 'reflected', severity: 'high', evidence: 'Payload reflected via qsreplace mass injection', remediation: 'HTML-encode all output. Implement strict CSP.', tool: 'qsreplace' })
              ctx.log('qsreplace', `[XSS] ${testUrl}`, 'warn')
            }
          }
        } catch { /* ignore */ }
      }
    }
  }

  ctx.log('xss', `Found ${deduped.length} XSS vulnerabilities`, deduped.length > 0 ? 'warn' : 'success')
  ctx.phaseEnd('xss', deduped)
  return deduped
}