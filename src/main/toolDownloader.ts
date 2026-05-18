import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

export interface DownloadDef {
  name: string
  exe: string
  repo?: string
  directUrl?: string
  assetPattern?: RegExp
  format: 'zip' | 'tgz' | 'exe'
  archiveExe?: string
}

export const DOWNLOAD_DEFS: DownloadDef[] = [
  // ── ProjectDiscovery suite ────────────────────────────────────────────────────
  { name: 'subfinder',         repo: 'projectdiscovery/subfinder',      exe: 'subfinder.exe',         assetPattern: /subfinder_[\d.]+_windows_amd64\.zip$/i,          format: 'zip' },
  { name: 'httpx',             repo: 'projectdiscovery/httpx',          exe: 'httpx.exe',             assetPattern: /httpx_[\d.]+_windows_amd64\.zip$/i,              format: 'zip' },
  { name: 'naabu',             repo: 'projectdiscovery/naabu',          exe: 'naabu.exe',             assetPattern: /naabu_[\d.]+_windows_amd64\.zip$/i,              format: 'zip' },
  { name: 'dnsx',              repo: 'projectdiscovery/dnsx',           exe: 'dnsx.exe',              assetPattern: /dnsx_[\d.]+_windows_amd64\.zip$/i,               format: 'zip' },
  { name: 'tlsx',              repo: 'projectdiscovery/tlsx',           exe: 'tlsx.exe',              assetPattern: /tlsx_[\d.]+_windows_amd64\.zip$/i,               format: 'zip' },
  { name: 'katana',            repo: 'projectdiscovery/katana',         exe: 'katana.exe',            assetPattern: /katana_[\d.]+_windows_amd64\.zip$/i,             format: 'zip' },
  { name: 'nuclei',            repo: 'projectdiscovery/nuclei',         exe: 'nuclei.exe',            assetPattern: /nuclei_[\d.]+_windows_amd64\.zip$/i,             format: 'zip' },
  { name: 'alterx',            repo: 'projectdiscovery/alterx',         exe: 'alterx.exe',            assetPattern: /alterx_[\d.]+_windows_amd64\.zip$/i,             format: 'zip' },
  { name: 'shuffledns',        repo: 'projectdiscovery/shuffledns',     exe: 'shuffledns.exe',        assetPattern: /shuffledns_[\d.]+_windows_amd64\.zip$/i,         format: 'zip' },
  { name: 'cdncheck',          repo: 'projectdiscovery/cdncheck',       exe: 'cdncheck.exe',          assetPattern: /cdncheck_[\d.]+_windows_amd64\.zip$/i,           format: 'zip' },
  { name: 'asnmap',            repo: 'projectdiscovery/asnmap',         exe: 'asnmap.exe',            assetPattern: /asnmap_[\d.]+_windows_amd64\.zip$/i,             format: 'zip' },
  { name: 'mapcidr',           repo: 'projectdiscovery/mapcidr',        exe: 'mapcidr.exe',           assetPattern: /mapcidr_[\d.]+_windows_amd64\.zip$/i,            format: 'zip' },
  { name: 'interactsh-client', repo: 'projectdiscovery/interactsh',     exe: 'interactsh-client.exe', assetPattern: /interactsh-client_[\d.]+_windows_amd64\.zip$/i,  format: 'zip' },
  { name: 'notify',            repo: 'projectdiscovery/notify',         exe: 'notify.exe',            assetPattern: /notify_[\d.]+_windows_amd64\.zip$/i,             format: 'zip' },
  { name: 'uncover',           repo: 'projectdiscovery/uncover',        exe: 'uncover.exe',           assetPattern: /uncover_[\d.]+_windows_amd64\.zip$/i,            format: 'zip' },
  { name: 'cvemap',            repo: 'projectdiscovery/cvemap',         exe: 'cvemap.exe',            assetPattern: /cvemap_[\d.]+_windows_amd64\.zip$/i,             format: 'zip' },
  { name: 'proxify',           repo: 'projectdiscovery/proxify',        exe: 'proxify.exe',           assetPattern: /proxify_[\d.]+_windows_amd64\.zip$/i,            format: 'zip' },

  // ── Subdomain & DNS ───────────────────────────────────────────────────────────
  // amass release uses .tar.gz (not .zip) for Windows
  { name: 'amass',             repo: 'owasp-amass/amass',               exe: 'amass.exe',             assetPattern: /amass_[\d.]+_windows_amd64\.tar\.gz$/i,          format: 'tgz' },
  { name: 'findomain',         repo: 'Findomain/findomain',             exe: 'findomain.exe',         assetPattern: /findomain-windows\.exe\.zip$/i,                  format: 'zip' },
  { name: 'assetfinder',       repo: 'tomnomnom/assetfinder',           exe: 'assetfinder.exe',       assetPattern: /assetfinder-windows-amd64.*\.zip$/i,             format: 'zip' },

  // ── Port & Network ────────────────────────────────────────────────────────────
  { name: 'nmap',              directUrl: 'https://nmap.org/dist/nmap-7.95-win32.zip', exe: 'nmap.exe', format: 'zip' },
  // rustscan uses x86_64-windows-rustscan.exe.zip naming
  { name: 'rustscan',          repo: 'RustScan/RustScan',               exe: 'rustscan.exe',          assetPattern: /x86_64-windows-rustscan\.exe\.zip$/i,            format: 'zip' },
  { name: 'smap',              repo: 's0md3v/smap',                     exe: 'smap.exe',              assetPattern: /smap_[\d.][^_]*_windows_amd64\.zip$/i,           format: 'zip' },

  // ── HTTP Probing ──────────────────────────────────────────────────────────────
  { name: 'ffuf',              repo: 'ffuf/ffuf',                       exe: 'ffuf.exe',              assetPattern: /ffuf_[\d.]+_windows_amd64\.zip$/i,               format: 'zip' },
  { name: 'httprobe',          repo: 'tomnomnom/httprobe',              exe: 'httprobe.exe',          assetPattern: /httprobe-windows-amd64.*\.zip$/i,                format: 'zip' },
  // webanalyze uses Windows_x86_64 (capital W, no version in name)
  { name: 'webanalyze',        repo: 'rverton/webanalyze',              exe: 'webanalyze.exe',        assetPattern: /webanalyze_Windows_x86_64\.zip$/i,               format: 'zip' },
  { name: 'unfurl',            repo: 'tomnomnom/unfurl',                exe: 'unfurl.exe',            assetPattern: /unfurl-windows-amd64.*\.zip$/i,                  format: 'zip' },

  // ── Directory & Vuln Fuzzing ──────────────────────────────────────────────────
  // feroxbuster uses x86_64-windows-feroxbuster.exe.zip naming
  { name: 'feroxbuster',       repo: 'epi052/feroxbuster',              exe: 'feroxbuster.exe',       assetPattern: /x86_64-windows-feroxbuster\.exe\.zip$/i,         format: 'zip' },
  { name: 'gobuster',          repo: 'OJ/gobuster',                     exe: 'gobuster.exe',          assetPattern: /gobuster_Windows_x86_64\.zip$/i,                 format: 'zip' },
  // nomore403 ships as a direct .exe (no zip wrapper)
  { name: 'nomore403',         repo: 'devploit/nomore403',              exe: 'nomore403.exe',         assetPattern: /nomore403_windows_amd64\.exe$/i,                 format: 'exe' },
  // x8 has a well-known typo "windown" in the release asset name
  { name: 'x8',                repo: 'Sh1Yo/x8',                        exe: 'x8.exe',                assetPattern: /x86-windown-x8\.zip$/i,                          format: 'zip' },
  { name: 'crlfuzz',           repo: 'dwisiswant0/crlfuzz',             exe: 'crlfuzz.exe',           assetPattern: /crlfuzz_[\d.]+_windows_amd64\.zip$/i,            format: 'zip' },

  // ── Crawling & URL Discovery ──────────────────────────────────────────────────
  { name: 'gau',               repo: 'lc/gau',                          exe: 'gau.exe',               assetPattern: /gau_[\d.]+_windows_amd64\.zip$/i,                format: 'zip' },
  // gospider uses v-prefixed version with x86_64 arch
  { name: 'gospider',          repo: 'jaeles-project/gospider',         exe: 'gospider.exe',          assetPattern: /gospider_v[\d.]+_windows_x86_64\.zip$/i,         format: 'zip' },
  { name: 'cariddi',           repo: 'edoardottt/cariddi',              exe: 'cariddi.exe',           assetPattern: /cariddi_[\d.]+_windows_amd64\.zip$/i,            format: 'zip' },
  { name: 'subjs',             repo: 'lc/subjs',                        exe: 'subjs.exe',             assetPattern: /subjs_[\d.]+_windows_amd64\.zip$/i,              format: 'zip' },
  { name: 'xcrawl3r',          repo: 'hueristiq/xcrawl3r',              exe: 'xcrawl3r.exe',          assetPattern: /xcrawl3r_[\d.]+_windows_amd64\.zip$/i,           format: 'zip' },
  // urlhunter uses Windows_x86_64 (capital W, no version in name)
  { name: 'urlhunter',         repo: 'utkusen/urlhunter',               exe: 'urlhunter.exe',         assetPattern: /urlhunter_Windows_x86_64\.zip$/i,                format: 'zip' },
  { name: 'qsreplace',         repo: 'tomnomnom/qsreplace',             exe: 'qsreplace.exe',         assetPattern: /qsreplace-windows-amd64.*\.zip$/i,               format: 'zip' },

  // ── XSS & Injection ──────────────────────────────────────────────────────────
  { name: 'dalfox',            repo: 'hahwul/dalfox',                   exe: 'dalfox.exe',            assetPattern: /dalfox-windows-amd64\.zip$/i,                    format: 'zip' },

  // ── Vulnerability Scanning ────────────────────────────────────────────────────
  // trufflehog ships as .tar.gz for Windows
  { name: 'trufflehog',        repo: 'trufflesecurity/trufflehog',      exe: 'trufflehog.exe',        assetPattern: /trufflehog_[\d.]+_windows_amd64\.tar\.gz$/i,     format: 'tgz' },
  // osv-scanner ships as a direct .exe
  { name: 'osv-scanner',       repo: 'google/osv-scanner',              exe: 'osv-scanner.exe',       assetPattern: /osv-scanner_windows_amd64\.exe$/i,               format: 'exe' },

  // ── Screenshots & Visual ─────────────────────────────────────────────────────
  // gowitness ships as a direct .exe (no archive)
  { name: 'gowitness',         repo: 'sensepost/gowitness',             exe: 'gowitness.exe',         assetPattern: /gowitness-[\d.]+-windows-amd64\.exe$/i,          format: 'exe' },

  // ── SSRF & Open Redirect ─────────────────────────────────────────────────────
  { name: 'surf',              repo: 'assetnote/surf',                  exe: 'surf.exe',              assetPattern: /surf_[\d.]+_windows_amd64\.zip$/i,               format: 'zip' },

  // ── Nuclei Templates ─────────────────────────────────────────────────────────
  { name: 'cent',              repo: 'xm1k3/cent',                      exe: 'cent.exe',              assetPattern: /cent_[\d.]+_windows_amd64\.zip$/i,               format: 'zip' },

  // ── OOB Interaction ──────────────────────────────────────────────────────────
  { name: 'hetty',             repo: 'dstotijn/hetty',                  exe: 'hetty.exe',             assetPattern: /hetty_[\d.]+_Windows_x86_64\.zip$/i,             format: 'zip' },
]

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let hops = 0
    function go(u: string) {
      if (++hops > 10) return reject(new Error('Too many redirects'))
      const mod = u.startsWith('https') ? https : http
      const headers: Record<string, string> = { 'User-Agent': 'ReconMaster/1.0', Accept: 'application/json' }
      if (process.env.GITHUB_TOKEN) headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`
      mod.get(u, { headers }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).href)
        }
        let data = ''
        res.on('data', (c: Buffer) => { data += c.toString() })
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode} from ${u}`))
          try { resolve(JSON.parse(data)) } catch { reject(new Error('Invalid JSON')) }
        })
      }).on('error', reject)
    }
    go(url)
  })
}

// Retry with delay on 403/429 (GitHub rate limit). Waits 3 s per attempt.
async function fetchJsonRetry(url: string, attempts = 3): Promise<unknown> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson(url)
    } catch (err) {
      const msg = String(err)
      if ((msg.includes('403') || msg.includes('429')) && i < attempts - 1) {
        await new Promise(r => setTimeout(r, 3000 * (i + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error('unreachable')
}

function downloadStream(url: string, dest: string, onProgress: (pct: number, mb: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let hops = 0
    function go(u: string) {
      if (++hops > 10) return reject(new Error('Too many redirects'))
      const mod = u.startsWith('https') ? https : http
      mod.get(u, { headers: { 'User-Agent': 'ReconMaster/1.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).href)
        }
        if (res.statusCode && res.statusCode >= 400) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode}`))
        }
        const total = parseInt(res.headers['content-length'] || '0')
        let downloaded = 0
        const file = fs.createWriteStream(dest)
        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          const mb = (downloaded / 1024 / 1024).toFixed(1)
          onProgress(total > 0 ? Math.round(downloaded / total * 100) : -1, mb)
        })
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
        file.on('error', reject)
        res.on('error', reject)
      }).on('error', reject)
    }
    go(url)
  })
}

// ── GitHub release lookup ─────────────────────────────────────────────────────

// Broad fallback: any windows x64 binary when the specific pattern finds nothing
const WIN_FALLBACK = /(?:windows|win).*(?:amd64|x86_64).*\.(?:zip|exe|tgz|tar\.gz)$|(?:amd64|x86_64).*(?:windows|win).*\.(?:zip|exe|tgz|tar\.gz)$/i

async function getAssetUrl(repo: string, pattern: RegExp): Promise<string> {
  let fallbackUrl: string | null = null

  for (const endpoint of [`https://api.github.com/repos/${repo}/releases/latest`, `https://api.github.com/repos/${repo}/releases`]) {
    try {
      const data = await fetchJsonRetry(endpoint) as Record<string, unknown> | Record<string, unknown>[]
      const releases: Record<string, unknown>[] = Array.isArray(data) ? data : [data]
      for (const rel of releases) {
        const assets = (rel.assets as { name: string; browser_download_url: string }[]) || []
        const asset = assets.find(a => pattern.test(a.name))
        if (asset) return asset.browser_download_url
        if (!fallbackUrl) {
          const fb = assets.find(a => WIN_FALLBACK.test(a.name))
          if (fb) fallbackUrl = fb.browser_download_url
        }
      }
    } catch { /* try next */ }
  }

  if (fallbackUrl) return fallbackUrl
  throw new Error(`No release asset matched ${pattern} in ${repo}`)
}

// ── Extraction ────────────────────────────────────────────────────────────────

function extractZip(zipPath: string, destDir: string): boolean {
  try {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Force '${zipPath}' '${destDir}'"`,
      { stdio: 'pipe', timeout: 120000, windowsHide: true }
    )
    return true
  } catch { return false }
}

function extractTgz(tgzPath: string, destDir: string): boolean {
  try {
    // Windows 10+ tar supports .tar.gz
    execSync(`tar -xzf "${tgzPath}" -C "${destDir}"`, { stdio: 'pipe', timeout: 120000, windowsHide: true })
    return true
  } catch {
    // Fallback: PowerShell GZip + tar
    try {
      const tarPath = tgzPath.replace(/\.gz$/, '')
      execSync(
        `powershell -NoProfile -Command "& { $src=[System.IO.File]::OpenRead('${tgzPath}'); $gz=New-Object System.IO.Compression.GzipStream($src,[System.IO.Compression.CompressionMode]::Decompress); $dst=[System.IO.File]::Create('${tarPath}'); $gz.CopyTo($dst); $dst.Close(); $gz.Close() }"`,
        { stdio: 'pipe', timeout: 60000, windowsHide: true }
      )
      execSync(`tar -xf "${tarPath}" -C "${destDir}"`, { stdio: 'pipe', timeout: 120000, windowsHide: true })
      try { fs.unlinkSync(tarPath) } catch { /* ignore */ }
      return true
    } catch { return false }
  }
}

function findExeInDir(dir: string, exeName: string): string | null {
  try {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (fs.statSync(full).isDirectory()) {
        const found = findExeInDir(full, exeName)
        if (found) return found
      } else if (entry.toLowerCase() === exeName.toLowerCase()) {
        return full
      }
    }
  } catch { /* ignore */ }
  return null
}

function findAllExesInDir(dir: string): string[] {
  const results: string[] = []
  try {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (fs.statSync(full).isDirectory()) {
        results.push(...findAllExesInDir(full))
      } else if (entry.toLowerCase().endsWith('.exe')) {
        results.push(full)
      }
    }
  } catch { /* ignore */ }
  return results
}

// ── Main download function ────────────────────────────────────────────────────

export async function downloadOneTool(
  toolName: string,
  binDir: string,
  onStatus: (msg: string) => void,
): Promise<{ success: boolean; error?: string }> {
  const def = DOWNLOAD_DEFS.find(d => d.name === toolName)
  if (!def) return { success: false, error: `Unknown tool: ${toolName}` }

  fs.mkdirSync(binDir, { recursive: true })
  const exePath = path.join(binDir, def.exe)

  // Resolve download URL
  let downloadUrl: string
  try {
    if (def.directUrl) {
      downloadUrl = def.directUrl
      onStatus(`Resolving ${toolName}...`)
    } else {
      onStatus(`Checking ${toolName} latest release...`)
      downloadUrl = await getAssetUrl(def.repo!, def.assetPattern!)
    }
  } catch (err) {
    const msg = String(err)
    const rateLimited = msg.includes('403') || msg.includes('429') || msg.includes('rate limit')
    return {
      success: false,
      error: rateLimited
        ? 'GitHub API rate limited (60 req/hr). Set GITHUB_TOKEN env var or wait ~1 hour.'
        : `Cannot find release: ${msg}`,
    }
  }

  // Detect actual archive format from the resolved URL (overrides def.format)
  const urlLower = downloadUrl.toLowerCase()
  const resolvedFormat: 'zip' | 'tgz' | 'exe' =
    (urlLower.endsWith('.tar.gz') || urlLower.endsWith('.tgz')) ? 'tgz' :
    urlLower.endsWith('.exe') ? 'exe' : 'zip'

  const ext = resolvedFormat === 'tgz' ? '.tar.gz' : resolvedFormat === 'exe' ? '.exe' : '.zip'
  const tmpFile = path.join(binDir, `_dl_${toolName}${ext}`)
  const tmpDir = path.join(binDir, `_ex_${toolName}`)

  try {
    // Download
    onStatus(`Downloading ${toolName}...`)
    await downloadStream(downloadUrl, tmpFile, (pct, mb) => {
      onStatus(pct >= 0 ? `Downloading ${toolName}... ${pct}% (${mb}MB)` : `Downloading ${toolName}... ${mb}MB`)
    })

    // Direct exe — just copy
    if (resolvedFormat === 'exe') {
      if (fs.existsSync(exePath)) fs.unlinkSync(exePath)
      fs.copyFileSync(tmpFile, exePath)
      const sizeMB = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1)
      onStatus(`✓ ${toolName} installed (${sizeMB}MB)`)
      return { success: true }
    }

    // Extract
    onStatus(`Extracting ${toolName}...`)
    fs.mkdirSync(tmpDir, { recursive: true })

    const ok = resolvedFormat === 'tgz' ? extractTgz(tmpFile, tmpDir) : extractZip(tmpFile, tmpDir)
    if (!ok) return { success: false, error: 'Extraction failed' }

    // Find exe inside extracted dir — try archiveExe, then exe, then any single .exe in the archive
    const targetExe = def.archiveExe || def.exe
    let found = findExeInDir(tmpDir, targetExe)
    if (!found && def.archiveExe) found = findExeInDir(tmpDir, def.exe)
    if (!found) {
      // last resort: grab the only .exe present
      const allExes = findAllExesInDir(tmpDir)
      found = allExes.length === 1 ? allExes[0] : null
    }
    if (!found) return { success: false, error: `${targetExe} not found in archive` }

    if (fs.existsSync(exePath)) fs.unlinkSync(exePath)
    fs.copyFileSync(found, exePath)

    const sizeMB = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1)
    onStatus(`✓ ${toolName} installed (${sizeMB}MB)`)
    return { success: true }

  } catch (err) {
    return { success: false, error: String(err) }
  } finally {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch { /* ignore */ }
    try { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}
