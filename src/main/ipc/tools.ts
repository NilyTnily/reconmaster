import { handle } from './handle'
import fs from 'fs'
import path from 'path'
import { downloadOneTool, DOWNLOAD_DEFS } from '../toolDownloader'
import { encryptSecret, decryptSecret } from '../lib/secureStorage'
import type { IpcDeps } from './types'

export const TOOL_DEFS = [
  { name: 'subfinder', exe: 'subfinder.exe', desc: 'Subdomain discovery' },
  { name: 'httpx', exe: 'httpx.exe', desc: 'HTTP probing & tech detection' },
  { name: 'naabu', exe: 'naabu.exe', desc: 'Fast port scanner' },
  { name: 'dnsx', exe: 'dnsx.exe', desc: 'DNS resolver & brute-forcer' },
  { name: 'tlsx', exe: 'tlsx.exe', desc: 'TLS/SSL analysis' },
  { name: 'katana', exe: 'katana.exe', desc: 'Web crawler & JS analysis' },
  { name: 'nuclei', exe: 'nuclei.exe', desc: 'Vulnerability scanner (CVEs, misconfigs)' },
  { name: 'ffuf', exe: 'ffuf.exe', desc: 'Directory & file fuzzer' },
  { name: 'amass', exe: 'amass.exe', desc: 'Advanced subdomain enumeration' },
  { name: 'gobuster', exe: 'gobuster.exe', desc: 'Directory/file brute-forcer' },
  { name: 'gowitness', exe: 'gowitness.exe', desc: 'Web screenshot capture' },
  { name: 'assetfinder', exe: 'assetfinder.exe', desc: 'Lightweight subdomain discovery' },
  { name: 'nmap', exe: 'nmap.exe', desc: 'Network mapper & service detection' },
  { name: 'dalfox', exe: 'dalfox.exe', desc: 'XSS scanner & parameter analysis' },
  { name: 'alterx', exe: 'alterx.exe', desc: 'Subdomain permutation & alteration' },
  { name: 'shuffledns', exe: 'shuffledns.exe', desc: 'Mass DNS resolver & brute-forcer' },
  { name: 'cdncheck', exe: 'cdncheck.exe', desc: 'CDN/cloud infrastructure detection' },
  { name: 'asnmap', exe: 'asnmap.exe', desc: 'ASN to IP range mapping' },
  { name: 'mapcidr', exe: 'mapcidr.exe', desc: 'CIDR manipulation & IP range operations' },
  { name: 'interactsh-client', exe: 'interactsh-client.exe', desc: 'Out-of-band interaction server (OOB testing)' },
  { name: 'gau', exe: 'gau.exe', desc: 'Fetch known URLs from web archives (AlienVault, Wayback, Common Crawl)' },
  // waybackurls removed — no Windows binary; gau covers Wayback URL extraction
  { name: 'gospider', exe: 'gospider.exe', desc: 'Fast web spider with JS parsing' },
  { name: 'feroxbuster', exe: 'feroxbuster.exe', desc: 'Recursive directory & file brute-forcer' },
  { name: 'crlfuzz', exe: 'crlfuzz.exe', desc: 'CRLF injection vulnerability scanner' },
  // hakrawler removed — no binary releases; katana + gospider cover web crawling
  { name: 'puredns', exe: 'puredns.exe', desc: 'Mass DNS resolver and subdomain brute-forcer with wildcard filtering' },
  { name: 'findomain', exe: 'findomain.exe', desc: 'Fast multi-source subdomain discovery (crt.sh, Virustotal, Sublist3r sources)' },
  { name: 'subzy', exe: 'subzy.exe', desc: 'Subdomain takeover vulnerability checker' },
  { name: 'gotator', exe: 'gotator.exe', desc: 'Subdomain permutation and alteration generator' },
  { name: 'chaos-client', exe: 'chaos-client.exe', desc: 'ProjectDiscovery chaos public dataset — millions of known subdomains' },
  { name: 'rustscan', exe: 'rustscan.exe', desc: 'Ultra-fast port scanner (scans all 65535 ports in seconds)' },
  { name: 'uncover', exe: 'uncover.exe', desc: 'Search-engine host discovery via Shodan, Censys, FOFA, Hunter' },
  { name: 'smap', exe: 'smap.exe', desc: 'Passive port scanner using Shodan Internet data (no direct probing)' },
  { name: 'cloudlist', exe: 'cloudlist.exe', desc: 'Cloud asset enumeration across AWS, GCP, Azure and more' },
  // zgrab2 removed — zmap does not provide pre-built Windows binaries
  { name: 'webanalyze', exe: 'webanalyze.exe', desc: 'Wappalyzer-based technology fingerprinting with full rule set' },
  { name: 'httprobe', exe: 'httprobe.exe', desc: 'Probe a list of domains for live HTTP/HTTPS servers' },
  // gf removed — no pre-built Windows binaries; install via: go install github.com/tomnomnom/gf@latest
  { name: 'unfurl', exe: 'unfurl.exe', desc: 'Parse and analyse URLs — extract domains, paths, keys, values' },
  { name: 'proxify', exe: 'proxify.exe', desc: 'HTTP request/response proxy with on-the-fly traffic capture and matching' },
  { name: 'jsluice', exe: 'jsluice.exe', desc: 'Extract URLs, endpoints, and secrets from JavaScript files' },
  { name: 'subjs', exe: 'subjs.exe', desc: 'Collect JavaScript file URLs from a list of live hosts' },
  { name: 'cariddi', exe: 'cariddi.exe', desc: 'Deep web crawler with built-in secret and endpoint detection' },
  { name: 'urlhunter', exe: 'urlhunter.exe', desc: 'Mine known URLs from Common Crawl index without downloading archives' },
  { name: 'xcrawl3r', exe: 'xcrawl3r.exe', desc: 'Configurable recursive web crawler with scope control and JS parsing' },
  { name: 'x8', exe: 'x8.exe', desc: 'Hidden HTTP parameter discovery via smart fuzzing and diff analysis' },
  { name: 'nomore403', exe: 'nomore403.exe', desc: '403 Forbidden bypass using header manipulation and path encoding tricks' },
  { name: 'shortscan', exe: 'shortscan.exe', desc: 'IIS short filename (8.3) vulnerability scanner' },
  { name: 'jwt-hack', exe: 'jwt-hack.exe', desc: 'JWT analysis, cracking, and attack tool (alg:none, key confusion, brute)' },
  { name: 'qsreplace', exe: 'qsreplace.exe', desc: 'Replace URL query string values — useful for mass payload injection' },
  { name: 'cvemap', exe: 'cvemap.exe', desc: 'CVE database search — find CVEs by product, vendor, severity, CVSS' },
  { name: 'trufflehog', exe: 'trufflehog.exe', desc: 'Deep secret scanning for credentials, API keys, and tokens in files/repos' },
  // ppmap removed — JavaScript/Node.js tool, no pre-built Windows binaries
  { name: 'osv-scanner', exe: 'osv-scanner.exe', desc: 'Open Source Vulnerability scanner using the OSV database' },
  { name: 'jaeles', exe: 'jaeles.exe', desc: 'Signature-based web application scanner with active/passive rules' },
  { name: 'notify', exe: 'notify.exe', desc: 'Push scan findings via Slack, Discord, Telegram, email, and more' },
  { name: 'hetty', exe: 'hetty.exe', desc: 'HTTP toolkit with intercept proxy, replay, and search for security research' },
  { name: 'cent', exe: 'cent.exe', desc: 'Community nuclei template manager — pull and organize thousands of templates' },
  { name: 'mantra', exe: 'mantra.exe', desc: 'Find secrets and API keys hidden inside HTTP responses and JavaScript' },
  { name: 'surf', exe: 'surf.exe', desc: 'SSRF parameter discovery via JavaScript analysis and endpoint crawling' },
]

export function register(deps: IpcDeps): void {
  const { getWindow, getUserData } = deps

  handle('tools:list', async () => {
    const binDir = path.join(getUserData(), 'binaries')
    const configPath = path.join(getUserData(), 'tool-config.json')
    let disabledTools: string[] = []
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      disabledTools = cfg.disabled || []
    } catch { /* no config yet */ }

    return TOOL_DEFS.map(t => {
      const exePath = path.join(binDir, t.exe)
      const exists = fs.existsSync(exePath)
      const sizeMB = exists ? Math.round(fs.statSync(exePath).size / 1024 / 1024 * 10) / 10 : undefined
      return { ...t, installed: exists, enabled: !disabledTools.includes(t.name), sizeMB }
    })
  })

  handle('tools:toggle', async (_, rawToolName: unknown, rawEnabled: unknown) => {
    const toolName = rawToolName as string
    const enabled = rawEnabled as boolean
    const configPath = path.join(getUserData(), 'tool-config.json')
    let cfg: { disabled: string[] } = { disabled: [] }
    try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8')) } catch { /* ok */ }
    if (enabled) {
      cfg.disabled = cfg.disabled.filter((n: string) => n !== toolName)
    } else {
      if (!cfg.disabled.includes(toolName)) cfg.disabled.push(toolName)
    }
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2))
    return { success: true }
  })

  handle('tools:delete', async (_, rawToolName: unknown) => {
    const toolName = rawToolName as string
    const binDir = path.join(getUserData(), 'binaries')
    const def = DOWNLOAD_DEFS.find(d => d.name === toolName)
    if (!def) return { success: false, error: 'Unknown tool' }
    const exePath = path.join(binDir, def.exe)
    try {
      if (fs.existsSync(exePath)) fs.unlinkSync(exePath)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  handle('tools:update', async (_, rawToolName: unknown) => {
    const toolName = rawToolName as string
    const binDir = path.join(getUserData(), 'binaries')
    return downloadOneTool(
      toolName,
      binDir,
      (msg) => getWindow()?.webContents.send('tools:progress', { tool: toolName, msg }),
    )
  })

  const githubConfigPath = () => path.join(getUserData(), 'github-config.json')

  handle('tools:getGithubToken', async () => {
    try {
      const cfg = JSON.parse(fs.readFileSync(githubConfigPath(), 'utf-8'))
      return { token: cfg.token ? decryptSecret(cfg.token) : '' }
    } catch {
      return { token: '' }
    }
  })

  handle('tools:setGithubToken', async (_, rawToken: unknown) => {
    const token = String(rawToken ?? '').trim()
    fs.writeFileSync(githubConfigPath(), JSON.stringify(
      { token: token ? encryptSecret(token) : '' }, null, 2
    ))
    if (token) {
      process.env.GITHUB_TOKEN = token
    } else {
      delete process.env.GITHUB_TOKEN
    }
    return { success: true }
  })
}
