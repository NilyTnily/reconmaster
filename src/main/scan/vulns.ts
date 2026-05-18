import https from 'https'
import http from 'http'
import pathMod from 'path'
import fs from 'fs'
import { ScanContext, runBinary, runBinaryStdin, httpsGet, hasBinary } from './context'

function headRequest(url: string): Promise<{ status: number; size?: number } | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url)
      const mod = parsed.protocol === 'https:' ? https : http
      const req = mod.request(
        { hostname: parsed.hostname, path: parsed.pathname, method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0 ReconMaster/1.0' }, timeout: 4000, rejectUnauthorized: false },
        (res) => {
          resolve({ status: res.statusCode || 0, size: parseInt(res.headers['content-length'] || '0') || undefined })
        }
      )
      req.on('error', () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
      req.end()
    } catch { resolve(null) }
  })
}

function analyzeHeaderVulns(
  httpResults: { url: string; status: number; headers?: Record<string, string>; server?: string; waf?: string }[],
  results: { id: string; name: string; severity: string; host: string; description?: string; tags?: string[]; matched?: string; remediation?: string; cvss?: number }[]
) {
  for (const r of httpResults) {
    if (!r.headers) continue
    const h = r.headers
    const host = r.url

    if (!h['x-frame-options'] && !h['content-security-policy']?.includes('frame-ancestors')) {
      results.push({ id: 'missing-x-frame-options', name: 'Missing X-Frame-Options', severity: 'medium', cvss: 6.1, host, description: 'Page can be embedded in iframes — enables clickjacking attacks', tags: ['headers', 'clickjacking'], remediation: 'Add header: X-Frame-Options: SAMEORIGIN (or use CSP frame-ancestors directive)' })
    }
    if (!h['strict-transport-security']) {
      results.push({ id: 'missing-hsts', name: 'Missing HSTS Header', severity: 'medium', cvss: 6.5, host, description: 'HTTP Strict Transport Security not set — MITM downgrade attack possible', tags: ['headers', 'ssl'], remediation: 'Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload' })
    }
    if (!h['x-content-type-options']) {
      results.push({ id: 'missing-xcto', name: 'Missing X-Content-Type-Options', severity: 'low', cvss: 4.3, host, description: 'MIME sniffing not disabled — browser may misinterpret content types', tags: ['headers'], remediation: 'Add header: X-Content-Type-Options: nosniff' })
    }
    if (!h['content-security-policy']) {
      results.push({ id: 'missing-csp', name: 'Missing Content-Security-Policy', severity: 'medium', cvss: 6.1, host, description: 'No CSP header — XSS attacks can execute arbitrary scripts', tags: ['headers', 'xss'], remediation: "Start with: Content-Security-Policy: default-src 'self' and refine from there" })
    }
    if (!h['referrer-policy']) {
      results.push({ id: 'missing-referrer', name: 'Missing Referrer-Policy', severity: 'low', cvss: 3.5, host, description: 'Referrer header sent to third parties — may leak sensitive URL parameters', tags: ['headers', 'privacy'], remediation: 'Add header: Referrer-Policy: strict-origin-when-cross-origin' })
    }
    if (r.server && r.server.match(/\d+\.\d+/)) {
      results.push({ id: 'server-version', name: 'Server Version Disclosure', severity: 'low', cvss: 5.3, host, description: `Server header reveals version: ${r.server} — aids attacker reconnaissance`, tags: ['info-disclosure'], remediation: 'Configure server to omit version: nginx (server_tokens off), Apache (ServerTokens Prod)' })
    }
    if (h['access-control-allow-origin'] === '*') {
      results.push({ id: 'cors-wildcard', name: 'CORS Wildcard (*)', severity: 'medium', cvss: 6.5, host, description: 'Access-Control-Allow-Origin: * allows any origin to read responses', tags: ['cors', 'misconfiguration'], remediation: "Replace * with specific allowed origins. Never combine wildcard CORS with credentials." })
    }
    if (h['x-powered-by']) {
      results.push({ id: 'x-powered-by', name: 'X-Powered-By Header Disclosure', severity: 'info', cvss: 2.0, host, description: `X-Powered-By: ${h['x-powered-by']} — reveals technology stack`, tags: ['info-disclosure'], remediation: 'Remove X-Powered-By header in your framework/server configuration.' })
    }
  }
}

function analyzeSslVulns(
  sslResults: { host: string; port: number; expiry?: string; protocols?: string[]; issues?: string[] }[],
  results: { id: string; name: string; severity: string; host: string; description?: string; tags?: string[]; matched?: string; remediation?: string; cvss?: number }[]
) {
  for (const r of sslResults) {
    const host = `${r.host}:${r.port}`
    for (const issue of (r.issues || [])) {
      const isExpired = issue.includes('EXPIRED') || issue.includes('Self-signed')
      results.push({
        id: 'ssl-issue',
        name: `SSL/TLS Issue: ${issue.split('(')[0].trim()}`,
        severity: isExpired ? 'high' : 'medium',
        cvss: isExpired ? 7.5 : 5.9,
        host,
        description: issue,
        tags: ['ssl', 'certificate'],
        remediation: issue.includes('EXPIRED') ? 'Renew the SSL certificate immediately using Let\'s Encrypt or your CA.'
          : issue.includes('Self-signed') ? 'Replace self-signed certificate with one from a trusted CA (e.g., Let\'s Encrypt).'
          : issue.includes('Weak') ? 'Disable TLS 1.0 and 1.1 in your web server config. Only allow TLS 1.2 and 1.3.'
          : 'Review SSL/TLS configuration using SSL Labs (ssllabs.com/ssltest/).',
      })
    }
  }
}

export async function builtinVulnChecks(ctx: ScanContext, url: string, results: { id: string; name: string; severity: string; host: string; description?: string; tags?: string[]; matched?: string; remediation?: string; cvss?: number }[]) {
  const sensitiveChecks = [
    // Credentials & secrets
    { path: '/.env', id: 'env-exposed', name: 'Exposed .env File', severity: 'critical', cvss: 9.8, desc: 'Environment file exposed — may contain credentials and API keys', remediation: 'Move .env out of web root or add deny rules in web server config. Never commit .env to version control.', tags: ['exposure', 'credential'] },
    { path: '/.env.local', id: 'env-local', name: 'Exposed .env.local', severity: 'critical', cvss: 9.8, desc: 'Local environment file exposed with credentials', remediation: 'Block access to .env* files in your web server configuration.', tags: ['exposure', 'credential'] },
    { path: '/.env.production', id: 'env-prod', name: 'Exposed .env.production', severity: 'critical', cvss: 9.8, desc: 'Production environment file exposed', remediation: 'Deny all access to .env* files and remove from web root immediately.', tags: ['exposure', 'credential'] },
    { path: '/.env.backup', id: 'env-backup', name: 'Exposed .env Backup', severity: 'critical', cvss: 9.5, desc: 'Backup environment file with potential credentials', remediation: 'Remove backup files from web root. Use proper secrets management.', tags: ['exposure', 'credential'] },
    { path: '/config/database.yml', id: 'db-config', name: 'Database Config Exposed', severity: 'critical', cvss: 9.8, desc: 'Rails database configuration with credentials exposed', remediation: 'Move config outside web root and restrict file permissions to app user only.', tags: ['exposure', 'credential'] },
    // Source control
    { path: '/.git/HEAD', id: 'git-exposed', name: 'Git Repository Exposed', severity: 'high', cvss: 7.5, desc: 'Git repository exposed — source code accessible via /.git/', remediation: 'Block access to .git/ directory in web server config. Add "deny from all" or equivalent.', tags: ['exposure', 'git'] },
    { path: '/.git/config', id: 'git-config', name: 'Git Config Exposed', severity: 'high', cvss: 7.5, desc: 'Git config may contain remote URLs and credentials', remediation: 'Block all .git/* access in nginx/Apache config. Consider removing .git from production servers.', tags: ['exposure', 'git'] },
    { path: '/.svn/entries', id: 'svn-exposed', name: 'SVN Repository Exposed', severity: 'high', cvss: 7.5, desc: 'SVN repository metadata accessible', remediation: 'Block access to .svn/ directory in web server configuration.', tags: ['exposure', 'svn'] },
    // PHP
    { path: '/phpinfo.php', id: 'phpinfo', name: 'PHP Info Page', severity: 'medium', cvss: 5.3, desc: 'PHP configuration reveals server internals including installed modules and paths', remediation: 'Remove phpinfo.php from production servers immediately.', tags: ['exposure', 'php'] },
    { path: '/info.php', id: 'info-php', name: 'PHP Info (info.php)', severity: 'medium', cvss: 5.3, desc: 'PHP info page is accessible', remediation: 'Delete info.php and similar test files from production.', tags: ['exposure', 'php'] },
    // Server status
    { path: '/server-status', id: 'apache-status', name: 'Apache server-status', severity: 'medium', cvss: 5.3, desc: 'Apache status reveals active requests, clients, and timing data', remediation: 'Restrict /server-status to localhost: Allow from 127.0.0.1 in Apache config.', tags: ['exposure', 'apache'] },
    { path: '/server-info', id: 'apache-info', name: 'Apache server-info', severity: 'medium', cvss: 5.3, desc: 'Apache server-info reveals module configuration', remediation: 'Restrict /server-info to localhost only.', tags: ['exposure', 'apache'] },
    { path: '/nginx_status', id: 'nginx-status', name: 'Nginx Status Page', severity: 'medium', cvss: 5.3, desc: 'Nginx status page reveals active connections and request stats', remediation: 'Restrict stub_status to 127.0.0.1 in nginx config.', tags: ['exposure', 'nginx'] },
    // Admin panels
    { path: '/admin', id: 'admin-panel', name: 'Admin Panel Accessible', severity: 'medium', cvss: 6.5, desc: 'Administrative panel is publicly accessible', remediation: 'Restrict admin interfaces by IP allowlist or require VPN access.', tags: ['admin'] },
    { path: '/wp-admin/', id: 'wp-admin', name: 'WordPress Admin', severity: 'medium', cvss: 6.5, desc: 'WordPress admin panel is accessible', remediation: 'Add IP restriction to /wp-admin/ or use a security plugin to hide the login page.', tags: ['cms', 'wordpress'] },
    { path: '/wp-config.php', id: 'wp-config', name: 'WordPress Config Exposed', severity: 'critical', cvss: 9.8, desc: 'WordPress configuration file with database credentials exposed', remediation: 'Move wp-config.php above web root or add server-level deny rules.', tags: ['exposure', 'wordpress', 'credential'] },
    { path: '/phpmyadmin/', id: 'phpmyadmin', name: 'phpMyAdmin Exposed', severity: 'high', cvss: 8.8, desc: 'phpMyAdmin database management interface is publicly accessible', remediation: 'Restrict phpMyAdmin access by IP, use .htaccess authentication, or move to non-standard path.', tags: ['admin', 'database'] },
    // Spring Boot actuator
    { path: '/actuator', id: 'spring-actuator', name: 'Spring Actuator Root', severity: 'high', cvss: 8.2, desc: 'Spring Boot actuator root — exposes sensitive management endpoints', remediation: 'Set management.endpoints.web.exposure.include to only safe endpoints. Require authentication for actuator.', tags: ['exposure', 'spring'] },
    { path: '/actuator/env', id: 'spring-env', name: 'Spring Actuator /env', severity: 'critical', cvss: 9.8, desc: 'Exposes all environment variables and configuration properties', remediation: 'Disable the env endpoint or require authentication: management.endpoint.env.enabled=false', tags: ['exposure', 'spring', 'credential'] },
    { path: '/actuator/health', id: 'spring-health', name: 'Spring Actuator /health', severity: 'low', cvss: 3.5, desc: 'Application health information', remediation: 'Restrict health endpoint details: management.endpoint.health.show-details=when_authorized', tags: ['exposure', 'spring'] },
    { path: '/heapdump', id: 'heapdump', name: 'Heap Dump Exposed', severity: 'critical', cvss: 9.8, desc: 'JVM heap dump may contain credentials, tokens, and sensitive runtime data', remediation: 'Disable heapdump endpoint: management.endpoint.heapdump.enabled=false', tags: ['exposure', 'java'] },
    // Config files
    { path: '/config.json', id: 'config-json', name: 'config.json Exposed', severity: 'high', cvss: 7.5, desc: 'Application configuration file publicly accessible', remediation: 'Move configuration files outside the web root.', tags: ['exposure', 'config'] },
    { path: '/web.config', id: 'webconfig', name: 'Web.config Exposed', severity: 'high', cvss: 7.5, desc: 'IIS web.config may contain connection strings and credentials', remediation: 'IIS should block web.config by default — ensure this restriction is not disabled.', tags: ['exposure', 'iis'] },
    { path: '/.htaccess', id: 'htaccess', name: 'Exposed .htaccess', severity: 'medium', cvss: 5.3, desc: '.htaccess file is readable — may reveal rewrite rules and security settings', remediation: 'Apache should block .htaccess by default. Ensure FilesMatch "^\\.ht" blocks access.', tags: ['exposure', 'apache'] },
    // Dependency files
    { path: '/package.json', id: 'package-json', name: 'package.json Exposed', severity: 'medium', cvss: 5.3, desc: 'Node.js package manifest reveals dependency versions', remediation: 'Exclude package.json from web root or add explicit deny rule.', tags: ['exposure', 'nodejs'] },
    { path: '/composer.json', id: 'composer-json', name: 'composer.json Exposed', severity: 'medium', cvss: 5.3, desc: 'PHP composer manifest reveals dependency versions', remediation: 'Exclude composer.json from web root.', tags: ['exposure', 'php'] },
    // Backups
    { path: '/backup.zip', id: 'backup-zip', name: 'Backup Archive Exposed', severity: 'high', cvss: 8.6, desc: 'Backup archive publicly accessible — may contain entire codebase', remediation: 'Store backups outside the web root or in a protected storage bucket.', tags: ['exposure', 'backup'] },
    { path: '/database.sql', id: 'db-dump', name: 'Database SQL Dump', severity: 'critical', cvss: 9.8, desc: 'SQL database dump is publicly downloadable', remediation: 'Remove database dumps from the server or store in non-web-accessible location.', tags: ['exposure', 'database'] },
    { path: '/dump.sql', id: 'db-dump-2', name: 'Database Dump (dump.sql)', severity: 'critical', cvss: 9.8, desc: 'Database dump file accessible', remediation: 'Remove dump files immediately and store future dumps in protected locations.', tags: ['exposure', 'database'] },
    // Debug
    { path: '/debug', id: 'debug-page', name: 'Debug Endpoint', severity: 'medium', cvss: 6.5, desc: 'Debug endpoint is publicly accessible', remediation: 'Disable debug mode in production. Remove or restrict debug endpoints.', tags: ['exposure', 'debug'] },
    { path: '/console', id: 'rails-console', name: 'Interactive Console', severity: 'high', cvss: 9.0, desc: 'Interactive console may allow remote code execution', remediation: 'Disable the web console in production environments (config.web_console.enabled = false).', tags: ['exposure', 'rce'] },
    { path: '/Dockerfile', id: 'dockerfile', name: 'Dockerfile Exposed', severity: 'medium', cvss: 5.3, desc: 'Docker build file reveals infrastructure and base images', remediation: 'Exclude Dockerfile from web-accessible directories.', tags: ['exposure', 'docker'] },
    { path: '/docker-compose.yml', id: 'docker-compose', name: 'Docker Compose Exposed', severity: 'high', cvss: 7.5, desc: 'Docker compose file may contain service credentials and ports', remediation: 'Remove docker-compose.yml from web root.', tags: ['exposure', 'docker', 'credential'] },
    // Info files
    { path: '/robots.txt', id: 'robots-txt', name: 'robots.txt', severity: 'info', cvss: 0, desc: 'robots.txt may reveal hidden paths and admin areas', remediation: 'Review robots.txt to ensure it does not expose sensitive paths.', tags: ['info'] },
    { path: '/.well-known/security.txt', id: 'security-txt', name: 'security.txt', severity: 'info', cvss: 0, desc: 'Security disclosure contact info — good practice', remediation: 'Ensure security.txt contains up-to-date contact information.', tags: ['info'] },
    // Cloud metadata
    { path: '/latest/meta-data/', id: 'aws-metadata', name: 'AWS EC2 Metadata (SSRF)', severity: 'critical', cvss: 10.0, desc: 'AWS instance metadata endpoint — if exposed indicates SSRF vulnerability', remediation: 'This should only be accessible from EC2 instance itself. Investigate for SSRF vulnerability. Use IMDSv2.', tags: ['exposure', 'cloud', 'ssrf', 'aws'] },
    // Swagger/API docs
    { path: '/swagger-ui.html', id: 'swagger', name: 'Swagger UI Exposed', severity: 'medium', cvss: 5.3, desc: 'API documentation with all endpoints exposed publicly', remediation: 'Restrict Swagger UI to development environments or require authentication.', tags: ['exposure', 'api'] },
    { path: '/api-docs', id: 'api-docs', name: 'API Docs Exposed', severity: 'medium', cvss: 5.3, desc: 'API documentation exposed', remediation: 'Add authentication to API documentation in production.', tags: ['exposure', 'api'] },
    { path: '/graphql', id: 'graphql', name: 'GraphQL Endpoint', severity: 'medium', cvss: 5.3, desc: 'GraphQL endpoint — check for introspection enabled', remediation: 'Disable introspection in production: set introspection: false in schema options.', tags: ['exposure', 'api', 'graphql'] },
  ]

  await Promise.all(sensitiveChecks.map(async check => {
    if (ctx.isCancel()) return
    const checkUrl = `${url}${check.path}`
    const r = await headRequest(checkUrl)
    if (r && r.status === 200) {
      results.push({ id: check.id, name: check.name, severity: check.severity, host: checkUrl, description: check.desc, tags: check.tags, matched: checkUrl, remediation: check.remediation, cvss: check.cvss })
      ctx.log('vulns', `[${check.severity.toUpperCase()}] ${check.name} at ${checkUrl}`, check.severity === 'critical' || check.severity === 'high' ? 'warn' : 'info')
    }
  }))
}

export async function runVulns(ctx: ScanContext, 
  liveUrls: string[],
  httpResults: { url: string; status: number; headers?: Record<string, string>; server?: string; waf?: string }[],
  sslResults: { host: string; port: number; expiry?: string; protocols?: string[]; issues?: string[] }[],
) {
  if (ctx.isCancel()) return []
  ctx.phaseStart('vulns')
  const results: { id: string; name: string; severity: string; host: string; description?: string; tags?: string[]; matched?: string; remediation?: string; cvss?: number }[] = []

  if (hasBinary(ctx, 'nuclei')) {
    const urlsFile = pathMod.join(ctx.outputDir, 'nuclei_urls.txt')
    fs.writeFileSync(urlsFile, liveUrls.slice(0, 5).join('\n'))
    await runBinary(ctx, 'nuclei', [
      '-l', urlsFile,
      '-j', '-silent', '-duc',
      '-severity', 'critical,high,medium',
      '-automatic-scan',
      '-tags', 'cve,exposed,misconfig,injection,sqli,xss,ssrf,lfi,rce,default-login',
      '-rl', '150', '-bs', '25', '-c', '50',
      '-timeout', '5', '-retries', '1',
      '-stats',
    ], line => {
      try {
        const obj = JSON.parse(line)
        results.push({
          id: obj['template-id'] || 'unknown',
          name: obj.info?.name || 'Unknown',
          severity: obj.info?.severity || 'info',
          host: obj.matched_at || obj.host || '',
          description: obj.info?.description,
          tags: obj.info?.tags,
          matched: obj.matched_at,
          remediation: obj.info?.remediation || `Fix ${obj.info?.name}. See: ${obj.info?.reference?.[0] || ''}`,
          cvss: obj.info?.classification?.cvss_metrics?.cvss_score,
        })
      } catch { /* not json */ }
    }, 35_000)
  } else {
    ctx.log('vulns', `Running built-in security checks on ${liveUrls.length} URLs`, 'info')
    await Promise.all(liveUrls.slice(0, 10).map(url => builtinVulnChecks(ctx, url, results)))
    analyzeHeaderVulns(httpResults, results)
    analyzeSslVulns(sslResults, results)
  }

  // crlfuzz: CRLF injection scanner
  if (hasBinary(ctx, 'crlfuzz') && liveUrls.length > 0) {
    ctx.log('crlfuzz', `CRLF injection scan on ${Math.min(liveUrls.length, 5)} URLs`, 'info')
    for (const url of liveUrls.slice(0, 5)) {
      if (ctx.isCancel()) break
      await runBinary(ctx, 'crlfuzz', ['-u', url, '-s'], line => {
        if (line.includes('VULN') || line.includes('[!]') || line.includes('Found')) {
          const urlMatch = line.match(/https?:\/\/\S+/)
          results.push({
            id: 'crlfuzz-crlf',
            name: 'CRLF Injection',
            severity: 'medium',
            host: urlMatch ? urlMatch[0] : url,
            description: 'CRLF injection detected — attacker can inject arbitrary HTTP headers or split HTTP responses',
            tags: ['crlf', 'injection', 'headers'],
            matched: line.slice(0, 200),
            remediation: 'Sanitize all user-controlled input before using in HTTP headers. Reject \\r and \\n characters.',
            cvss: 6.1,
          })
          ctx.log('crlfuzz', `[CRLF] ${url}`, 'warn')
        }
      }, 15_000)
    }
  }

  if (hasBinary(ctx, 'cvemap') && httpResults.length > 0) {
    const allTechs = [...new Set(httpResults.flatMap(r => (r as { tech?: string[] }).tech || []))]
    for (const tech of allTechs.slice(0, 5)) {
      if (ctx.isCancel()) break
      await runBinary(ctx, 'cvemap', ['-p', tech, '-severity', 'critical,high', '-json', '-limit', '5'], line => {
        try {
          const obj = JSON.parse(line)
          const cves: Array<{ cve_id?: string; cve_description?: string; cvss_score?: number }> = Array.isArray(obj) ? obj : [obj]
          for (const cve of cves) {
            if (cve.cve_id) {
              results.push({
                id: cve.cve_id,
                name: `${cve.cve_id} — ${tech}`,
                severity: (cve.cvss_score || 0) >= 9 ? 'critical' : 'high',
                host: httpResults[0]?.url || ctx.target,
                description: cve.cve_description,
                tags: ['cve', tech.toLowerCase()],
                cvss: cve.cvss_score,
                remediation: `Update ${tech} to the latest patched version. Check vendor advisory for ${cve.cve_id}.`,
              })
              ctx.log('cvemap', `${cve.cve_id} (${tech}) CVSS:${cve.cvss_score}`, 'warn')
            }
          }
        } catch { /* not json */ }
      }, 10_000)
    }
  }

  // trufflehog: scan output directory for leaked secrets in crawled files
  if (hasBinary(ctx, 'trufflehog') && liveUrls.length > 0) {
    ctx.log('trufflehog', 'Scanning output directory for leaked secrets', 'info')
    await runBinary(ctx, 'trufflehog', ['filesystem', '--directory', ctx.outputDir, '--json', '--no-update'], line => {
      try {
        const obj = JSON.parse(line)
        if (obj.SourceMetadata || obj.Raw) {
          const detectorName = obj.DetectorName || 'Secret'
          const raw = obj.Raw || obj.RawV2 || ''
          const masked = raw.length > 8 ? raw.slice(0, 4) + '****' + raw.slice(-4) : '****'
          results.push({
            id: `trufflehog-${detectorName.toLowerCase().replace(/\s/g, '-')}`,
            name: `Leaked Secret: ${detectorName}`,
            severity: 'critical',
            host: obj.SourceMetadata?.Data?.Filesystem?.file || ctx.target,
            description: `${detectorName} credential found in scan output — value: ${masked}`,
            tags: ['secret', 'credential', 'trufflehog'],
            cvss: 9.8,
            remediation: 'Rotate this credential immediately. Remove from all source files and use a secrets manager.',
          })
          ctx.log('trufflehog', `[LEAKED] ${detectorName}: ${masked}`, 'warn')
        }
      } catch { /* not json */ }
    }, 20_000)
  }

  // surf: SSRF parameter discovery — tests URL parameters for server-side request forgery
  if (hasBinary(ctx, 'surf') && liveUrls.length > 0) {
    const urlsWithParams = liveUrls.filter(u => u.includes('?')).slice(0, 5)
    if (urlsWithParams.length > 0) {
      ctx.log('surf', `SSRF parameter testing on ${urlsWithParams.length} URLs with parameters`, 'info')
      await runBinaryStdin(ctx, 'surf', ['-silent'], urlsWithParams.join('\n'), line => {
        if (line.trim()) {
          const urlMatch = line.match(/https?:\/\/\S+/)
          results.push({
            id: 'surf-ssrf',
            name: 'Potential SSRF Parameter',
            severity: 'high',
            host: urlMatch?.[0] || liveUrls[0],
            description: `surf detected a potential SSRF-vulnerable parameter: ${line.slice(0, 200)}`,
            tags: ['ssrf', 'parameter'],
            matched: line.slice(0, 200),
            remediation: 'Validate and whitelist all server-side URL parameters. Block outbound requests to internal IP ranges (RFC1918). Use IMDSv2 on AWS.',
            cvss: 8.6,
          })
          ctx.log('surf', `[SSRF] ${line.trim()}`, 'warn')
        }
      }, 60_000)
    }
  }

  // osv-scanner: dependency vulnerability scan on publicly exposed manifest/lock files
  if (hasBinary(ctx, 'osv-scanner') && liveUrls.length > 0) {
    ctx.log('osv-scanner', 'Fetching dependency manifests from live URLs', 'info')
    const manifestPaths = ['/package-lock.json', '/requirements.txt']
    let foundManifest = false
    for (const url of liveUrls.slice(0, 5)) {
      if (ctx.isCancel()) break
      let origin: string | null = null
      try { origin = new URL(url).origin } catch { continue }
      for (const mp of manifestPaths) {
        if (ctx.isCancel()) break
        const manifestContent = await httpsGet(ctx, `${origin}${mp}`, 8000)
        if (!manifestContent || manifestContent.length < 20) continue
        const localPath = pathMod.join(ctx.outputDir, `osv_manifest_${mp.replace(/\//g, '_').replace(/^_/, '')}`)
        fs.writeFileSync(localPath, manifestContent)
        ctx.log('osv-scanner', `Scanning exposed manifest: ${origin}${mp}`, 'info')
        foundManifest = true
        const osvLines: string[] = []
        await runBinary(ctx, 'osv-scanner', ['--format', 'json', '--lockfile', localPath], line => { osvLines.push(line) }, 30_000)
        try {
          const osvOutput = JSON.parse(osvLines.join('')) as { results?: Array<{ packages?: Array<{ package?: { name?: string; version?: string; ecosystem?: string }; vulnerabilities?: Array<{ id?: string; summary?: string; database_specific?: { severity?: string } }> }> }> }
          for (const result of (osvOutput.results || [])) {
            for (const pkg of (result.packages || [])) {
              for (const v of (pkg.vulnerabilities || [])) {
                if (!v.id) continue
                results.push({
                  id: v.id,
                  name: `${v.id} in ${pkg.package?.name}@${pkg.package?.version}`,
                  severity: (v.database_specific?.severity || 'medium').toLowerCase(),
                  host: `${origin}${mp}`,
                  description: v.summary,
                  tags: ['dependency', 'osv', pkg.package?.ecosystem?.toLowerCase()].filter((t): t is string => Boolean(t)),
                  remediation: `Update ${pkg.package?.name} to a patched version. See https://osv.dev/${v.id}`,
                })
                ctx.log('osv-scanner', `${v.id} in ${pkg.package?.name}`, 'warn')
              }
            }
          }
        } catch { /* not json or empty */ }
      }
    }
    if (!foundManifest) ctx.log('osv-scanner', 'No publicly accessible dependency manifests found', 'info')
  }

  // Deduplicate by id+host
  const seen = new Set<string>()
  const deduped = results.filter(r => {
    const key = `${r.id}::${r.host}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  ctx.log('vulns', `Found ${deduped.length} issues`, deduped.filter(r => r.severity === 'critical' || r.severity === 'high').length > 0 ? 'warn' : 'success')
  ctx.phaseEnd('vulns', deduped)
  return deduped
}