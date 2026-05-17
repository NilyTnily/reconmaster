import https from 'https'
import http from 'http'
import { ScanContext, httpsGet } from './context'

function getRequestLight(url: string): Promise<{ status: number; size?: number; contentType?: string } | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url)
      const mod = parsed.protocol === 'https:' ? https : http
      const req = mod.request(
        { hostname: parsed.hostname, path: parsed.pathname, method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0 ReconMaster/1.0' }, timeout: 4000, rejectUnauthorized: false },
        (res) => {
          const contentType = res.headers['content-type']?.split(';')[0].trim()
          resolve({ status: res.statusCode || 0, size: parseInt(res.headers['content-length'] || '0') || undefined, contentType })
        }
      )
      req.on('error', () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
      req.end()
    } catch { resolve(null) }
  })
}

export async function runIdor(ctx: ScanContext, liveUrls: string[], jsEndpoints: { url: string; type: string }[], httpResults: { url: string; status: number }[]): Promise<{ url: string; parameter: string; type: string; originalValue: string; testedValue: string; evidence: string; severity: string; statusDiff?: string; remediation?: string }[]> {
  if (ctx.isCancel() || liveUrls.length === 0) return []
  ctx.phaseStart('idor')
  const results: { url: string; parameter: string; type: string; originalValue: string; testedValue: string; evidence: string; severity: string; statusDiff?: string; remediation?: string }[] = []

  const allUrls = [...new Set([
    ...liveUrls,
    ...jsEndpoints.filter(e => e.url.startsWith('http')).map(e => e.url),
    ...httpResults.map(h => h.url),
  ])]

  // 1. Numeric ID parameter testing
  for (const url of allUrls.slice(0, 60)) {
    if (ctx.isCancel()) break
    try {
      const parsed = new URL(url)
      for (const [key, value] of parsed.searchParams) {
        if (/^\d+$/.test(value) && parseInt(value) > 0) {
          const id = parseInt(value)
          const testIds = [1, 2, id - 1, id + 1].filter(n => n > 0 && n !== id)
          for (const testId of testIds.slice(0, 2)) {
            const testUrl = url.replace(`${key}=${value}`, `${key}=${testId}`)
            const [orig, test] = await Promise.all([
              getRequestLight(url),
              getRequestLight(testUrl),
            ])
            if (orig && test && test.status === 200 && orig.status === 200) {
              if (test.size && orig.size && Math.abs(test.size - orig.size) > 200) {
                results.push({
                  url: testUrl,
                  parameter: key,
                  type: 'numeric',
                  originalValue: value,
                  testedValue: String(testId),
                  evidence: `Parameter "${key}" returns different response sizes for IDs ${value} and ${testId} — possible data leakage`,
                  severity: 'high',
                  statusDiff: `${orig.status}/${orig.size || '?'}B → ${test.status}/${test.size || '?'}B`,
                  remediation: 'Implement server-side authorization checks. Never rely on client-provided IDs alone. Use indirect object references (tokens/hashes) instead of sequential integers.',
                })
                break
              }
            }
          }
        }
      }
    } catch { /* invalid url */ }
  }

  // 2. API path numeric ID testing
  const apiPathRe = /\/(api|v\d+|rest|users|accounts|orders|items|products|records|files|documents)\/(\d+)/i
  for (const url of allUrls.slice(0, 80)) {
    if (ctx.isCancel()) break
    const mMatch = url.match(apiPathRe)
    if (!mMatch) continue
    const id = parseInt(mMatch[2])
    for (const testId of [1, 2, id + 1].filter(n => n !== id && n > 0).slice(0, 2)) {
      const testUrl = url.replace(`/${mMatch[2]}`, `/${testId}`)
      const [orig, test] = await Promise.all([
        getRequestLight(url),
        getRequestLight(testUrl),
      ])
      if (orig && test && test.status === 200 && orig.status === 200 && test.size && orig.size && Math.abs(test.size - orig.size) > 100) {
        if (!results.find(r => r.url === testUrl && r.type === 'numeric')) {
          results.push({
            url: testUrl,
            parameter: 'path ID',
            type: 'numeric',
            originalValue: String(id),
            testedValue: String(testId),
            evidence: `REST API endpoint accessible for ID ${testId} with different content (possible unauthorized access)`,
            severity: 'high',
            statusDiff: `${orig.status}/${orig.size}B → ${test.status}/${test.size}B`,
            remediation: 'Validate object ownership server-side before returning data. Use UUIDs instead of sequential IDs.',
          })
        }
        break
      }
    }
  }

  // 3. File parameter path traversal
  const fileParamRe = /[?&](file|filename|path|doc|document|attachment|download|resource|src|source)=([^&]+)/i
  for (const url of allUrls.slice(0, 50)) {
    if (ctx.isCancel()) break
    const fpMatch = url.match(fileParamRe)
    if (!fpMatch) continue
    const paramName = fpMatch[1]
    const traversalPayloads = ['../../../etc/passwd', '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts', '../../../../etc/shadow']
    for (const payload of traversalPayloads) {
      const testUrl = url.replace(`${paramName}=${fpMatch[2]}`, `${paramName}=${encodeURIComponent(payload)}`)
      const response = await httpsGet(ctx, testUrl, 5000)
      if (response && (response.includes('root:') || response.includes('[drivers]') || response.includes('localhost'))) {
        results.push({
          url: testUrl,
          parameter: paramName,
          type: 'path-traversal',
          originalValue: fpMatch[2],
          testedValue: payload,
          evidence: 'Path traversal successful — server file contents returned',
          severity: 'critical',
          remediation: 'Validate file paths against a whitelist. Use canonical path resolution. Never pass user input directly to file system operations.',
        })
        break
      }
    }
  }

  // 4. UUID-style parameter testing
  const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  for (const url of allUrls.slice(0, 40)) {
    if (ctx.isCancel()) break
    if (!uuidRe.test(url)) continue
    const testUUIDs = ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']
    for (const testUuid of testUUIDs) {
      const testUrl = url.replace(uuidRe, testUuid)
      if (testUrl === url) continue
      const [orig, test] = await Promise.all([
        getRequestLight(url),
        getRequestLight(testUrl),
      ])
      if (orig && test && test.status === 200 && orig.status !== 404) {
        results.push({
          url: testUrl,
          parameter: 'UUID',
          type: 'uuid',
          originalValue: url.match(uuidRe)?.[0] || '',
          testedValue: testUuid,
          evidence: `Predictable UUID pattern accessible — sequential UUID returned 200`,
          severity: 'medium',
          statusDiff: `${orig.status} → ${test.status}`,
          remediation: 'Use cryptographically random UUIDs (UUID v4). Validate ownership for every object access.',
        })
        break
      }
    }
  }

  const seen = new Set<string>()
  const deduped = results.filter(r => {
    const k = `${r.url}:${r.parameter}:${r.type}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  ctx.log('idor', `Found ${deduped.length} potential IDOR issues`, deduped.length > 0 ? 'warn' : 'success')
  ctx.phaseEnd('idor', deduped)
  return deduped
}