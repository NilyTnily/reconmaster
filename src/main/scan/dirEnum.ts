import https from 'https'
import http from 'http'
import pathMod from 'path'
import fs from 'fs'
import { ScanContext, runBinary, hasBinary } from './context'
import { COMMON_DIRS } from '../wordlists'

function isInteresting(url: string): boolean {
  const u = url.toLowerCase()
  return /\.(env|git|svn|sql|bak|backup|config|cfg|conf|key|pem|p12|pfx|sh|bash|log|passwd|shadow|htpasswd)$/.test(u)
    || /\/(admin|phpmyadmin|wp-admin|cpanel|webmail|actuator|debug|console|dashboard|swagger|api-docs|graphiql|graphql)/.test(u)
    || u.includes('.git/') || u.includes('.svn/') || u.includes('backup') || u.includes('dump')
}

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

export async function dirEnumNode(ctx: ScanContext, baseUrl: string, results: { url: string; status: number; size?: number; type?: string; contentType?: string; interesting?: boolean }[]) {
  const batchSize = 30
  for (let i = 0; i < COMMON_DIRS.length && !ctx.isCancel(); i += batchSize) {
    const batch = COMMON_DIRS.slice(i, i + batchSize)
    await Promise.all(batch.map(async dir => {
      const url = `${baseUrl}/${dir}`
      const result = await getRequestLight(url)
      if (result && result.status !== 404 && result.status !== 0) {
        const interesting = isInteresting(url)
        results.push({ url, status: result.status, size: result.size, contentType: result.contentType, interesting })
        const level = interesting ? 'warn' : result.status < 400 ? 'success' : 'info'
        if (result.status < 400) ctx.log('dirs', `${result.status} ${url}${interesting ? ' ⚠' : ''}`, level)
      }
    }))
  }
}

export async function runDirEnum(ctx: ScanContext, liveUrls: string[]) {
  if (ctx.isCancel() || liveUrls.length === 0) return []
  ctx.phaseStart('dirs')
  const results: { url: string; status: number; size?: number; type?: string; contentType?: string; interesting?: boolean }[] = []

  const wordlistPath = pathMod.join(ctx.outputDir, 'wordlist.txt')
  fs.writeFileSync(wordlistPath, COMMON_DIRS.join('\n'))

  if (hasBinary(ctx, 'feroxbuster')) {
    for (const url of liveUrls.slice(0, 3)) {
      if (ctx.isCancel()) break
      ctx.log('feroxbuster', `Recursive scan: ${url}`, 'info')
      await runBinary(ctx, 'feroxbuster', [
        '--url', url, '--wordlist', wordlistPath, '--quiet', '--no-state',
        '--status-codes', '200,201,204,301,302,307,401,403',
        '--extensions', 'php,asp,aspx,jsp,bak,old,conf,json,txt,xml,env,log,sql,zip,tar',
        '--threads', '50', '--depth', '3', '--rate-limit', '200',
        '--timeout', '10', '--redirects', '--auto-tune',
        '--output', pathMod.join(ctx.outputDir, 'ferox.txt'),
      ], line => {
        const m = line.match(/(\d{3})\s+\d+l\s+\d+w\s+\d+c\s+(https?:\/\/\S+)/)
        if (m) results.push({ url: m[2], status: parseInt(m[1]), interesting: isInteresting(m[2]) })
      })
    }
  } else if (hasBinary(ctx, 'ffuf') || hasBinary(ctx, 'gobuster')) {
    for (const url of liveUrls.slice(0, 3)) {
      if (ctx.isCancel()) break
      if (hasBinary(ctx, 'ffuf')) {
        const ffufOut = pathMod.join(ctx.outputDir, `ffuf_${results.length}.json`)
        await runBinary(ctx, 'ffuf', [
          '-u', `${url}/FUZZ`, '-w', wordlistPath,
          '-mc', '200,201,204,301,302,307,401,403',
          '-e', '.php,.asp,.aspx,.jsp,.bak,.old,.conf,.json,.txt,.xml,.env,.log,.sql,.zip',
          '-t', '50', '-rate', '200', '-timeout', '10',
          '-of', 'json', '-o', ffufOut,
          '-s', '-recursion', '-recursion-depth', '2',
        ], () => {}, 300_000)
        try {
          const raw = JSON.parse(fs.readFileSync(ffufOut, 'utf-8'))
          for (const r of (raw.results || [])) {
            results.push({ url: r.url, status: r.status, size: r.length, interesting: isInteresting(r.url) })
          }
        } catch { /* no results file */ }
      } else {
        await runBinary(ctx, 'gobuster', ['dir', '-u', url, '-w', wordlistPath, '-s', '200,204,301,302,307,401,403', '-x', 'php,asp,aspx,bak,conf,json,txt,xml,log', '-t', '40', '--timeout', '10s', '-q', '--no-error'], line => {
          const m = line.match(/^(\/\S+)\s+\(Status:\s*(\d+)\)/)
          if (m) results.push({ url: `${url}${m[1]}`, status: parseInt(m[2]), interesting: isInteresting(m[1]) })
        }, 300_000)
      }
    }
  } else {
    ctx.log('dirs', `Probing ${liveUrls.length} URLs × ${COMMON_DIRS.length} paths`, 'info')
    for (const baseUrl of liveUrls.slice(0, 3)) {
      if (ctx.isCancel()) break
      await dirEnumNode(ctx, baseUrl, results)
    }
  }



  // nomore403: bypass 403 Forbidden responses using header/encoding tricks
  if (hasBinary(ctx, 'nomore403') && results.length > 0) {
    const forbidden = results.filter(r => r.status === 403).slice(0, 15)
    if (forbidden.length > 0) {
      ctx.log('nomore403', `Attempting 403 bypass on ${forbidden.length} blocked paths`, 'info')
      for (const r of forbidden) {
        if (ctx.isCancel()) break
        await runBinary(ctx, 'nomore403', ['-u', r.url], line => {
          if (line.includes('200') || line.includes('bypassed') || line.includes('Bypassed')) {
            ctx.log('nomore403', `[BYPASS] ${r.url} — ${line.trim()}`, 'warn')
            results.push({ ...r, status: 200, type: '403-bypass' })
          }
        })
      }
    }
  }

  // shortscan: IIS short filename (8.3) vulnerability discovery
  if (hasBinary(ctx, 'shortscan') && liveUrls.length > 0) {
    ctx.log('shortscan', `IIS 8.3 short filename scan on ${Math.min(liveUrls.length, 5)} URLs`, 'info')
    for (const url of liveUrls.slice(0, 5)) {
      if (ctx.isCancel()) break
      await runBinary(ctx, 'shortscan', [url, '--patience', '1'], line => {
        if (line.includes('~1') || line.includes('FOUND') || line.includes('shortname')) {
          ctx.log('shortscan', `[IIS 8.3] ${line.trim()}`, 'warn')
          results.push({ url, status: 200, type: 'ifs-shortname', interesting: true })
        }
      })
    }
  }

  // x8: hidden parameter discovery via smart fuzzing
  if (hasBinary(ctx, 'x8') && liveUrls.length > 0) {
    const x8Wordlist = pathMod.join(ctx.outputDir, 'x8_params.txt')
    const X8_PARAMS = [
      'id','user','username','name','email','token','key','api_key','apikey','auth','session',
      'redirect','url','next','return','returnUrl','callback','ref','source','from','to','page',
      'limit','offset','sort','order','filter','search','query','q','s','term','keyword',
      'action','type','mode','format','lang','locale','country','region','currency',
      'file','path','dir','folder','document','resource','src','dest','target',
      'debug','test','admin','config','data','payload','input','output','content',
      'hash','sign','signature','secret','password','passwd','pwd','code','otp',
      'access_token','refresh_token','bearer','csrf','nonce','state','scope',
    ]
    fs.writeFileSync(x8Wordlist, X8_PARAMS.join('\n'))
    ctx.log('x8', `Hidden parameter discovery on ${Math.min(liveUrls.length, 5)} URLs (${X8_PARAMS.length} params)`, 'info')
    for (const url of liveUrls.slice(0, 5)) {
      if (ctx.isCancel()) break
      await runBinary(ctx, 'x8', [
        '-u', `${url}?PLACEHOLDER=1`,
        '-w', x8Wordlist,
        '--output-format', 'json',
        '--disable-colors',
        '-t', '5',
        '--remove-noisy',
      ], line => {
        try {
          const obj = JSON.parse(line)
          const params: string[] = obj.found_params || obj.params || []
          for (const p of params) ctx.log('x8', `[HIDDEN PARAM] ${url}?${p}`, 'warn')
        } catch { /* text line */ }
      })
    }
  }

  ctx.log('dirs', `Found ${results.length} paths`, 'success')
  ctx.phaseEnd('dirs', results)
  return results
}