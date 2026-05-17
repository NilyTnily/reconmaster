#!/usr/bin/env node
/**
 * Downloads all reconnaissance tool binaries for Windows x64
 * using the GitHub Releases API to find the correct asset names.
 * Binaries go into resources/binaries/ and are bundled by electron-builder.
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const BINARIES_DIR = path.join(__dirname, '../resources/binaries')
fs.mkdirSync(BINARIES_DIR, { recursive: true })

// Tools: { name, repo?, directUrl?, exe, desc, assetPattern?, format: 'zip'|'tgz'|'exe' }
// If directUrl is set, repo/assetPattern are skipped and directUrl is fetched directly.
const TOOLS = [
  // ProjectDiscovery tools — filename format: toolname_VERSION_windows_amd64.zip
  {
    name: 'subfinder',
    repo: 'projectdiscovery/subfinder',
    exe: 'subfinder.exe',
    desc: 'Subdomain discovery',
    assetPattern: /subfinder_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'httpx',
    repo: 'projectdiscovery/httpx',
    exe: 'httpx.exe',
    desc: 'HTTP probing',
    assetPattern: /httpx_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'naabu',
    repo: 'projectdiscovery/naabu',
    exe: 'naabu.exe',
    desc: 'Fast port scanner',
    assetPattern: /naabu_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'dnsx',
    repo: 'projectdiscovery/dnsx',
    exe: 'dnsx.exe',
    desc: 'DNS resolver',
    assetPattern: /dnsx_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'tlsx',
    repo: 'projectdiscovery/tlsx',
    exe: 'tlsx.exe',
    desc: 'TLS/SSL analysis',
    assetPattern: /tlsx_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'katana',
    repo: 'projectdiscovery/katana',
    exe: 'katana.exe',
    desc: 'Web crawler',
    assetPattern: /katana_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'nuclei',
    repo: 'projectdiscovery/nuclei',
    exe: 'nuclei.exe',
    desc: 'Vulnerability scanner',
    assetPattern: /nuclei_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'ffuf',
    repo: 'ffuf/ffuf',
    exe: 'ffuf.exe',
    desc: 'Directory fuzzer',
    assetPattern: /ffuf_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    // amass uses .tar.gz not .zip
    name: 'amass',
    repo: 'owasp-amass/amass',
    exe: 'amass.exe',
    desc: 'Advanced subdomain enumeration',
    assetPattern: /amass_windows_amd64\.tar\.gz$/i,
    format: 'tgz',
  },
  {
    name: 'gobuster',
    repo: 'OJ/gobuster',
    exe: 'gobuster.exe',
    desc: 'Directory/file brute-forcer',
    assetPattern: /gobuster_windows_(amd64|x86_64)\.zip$/i,
    format: 'zip',
  },
  {
    // gowitness ships as a direct .exe (no zip)
    name: 'gowitness',
    repo: 'sensepost/gowitness',
    exe: 'gowitness.exe',
    desc: 'Web screenshot capture',
    assetPattern: /gowitness-[\d.]+-windows-amd64\.exe$/i,
    format: 'exe',
  },
  {
    name: 'assetfinder',
    repo: 'tomnomnom/assetfinder',
    exe: 'assetfinder.exe',
    desc: 'Subdomain discovery (lightweight)',
    assetPattern: /assetfinder[_-].*windows[_-]amd64.*\.zip$/i,
    format: 'zip',
  },
  {
    // nmap win32.zip (portable) — latest zip release is 7.92; newer versions are installer-only
    name: 'nmap',
    exe: 'nmap.exe',
    desc: 'Network mapper (port scan + service detection)',
    directUrl: 'https://nmap.org/dist/nmap-7.92-win32.zip',
    format: 'zip',
  },
  {
    name: 'dalfox',
    repo: 'hahwul/dalfox',
    exe: 'dalfox.exe',
    archiveExe: 'dalfox-windows-amd64.exe',
    desc: 'XSS scanner & parameter analysis',
    assetPattern: /dalfox-windows-amd64\.zip$/i,
    format: 'zip',
  },
  // ── Enhancement pack ─────────────────────────────────────────────────────────
  {
    name: 'alterx',
    repo: 'projectdiscovery/alterx',
    exe: 'alterx.exe',
    desc: 'Subdomain permutation & alteration generator',
    assetPattern: /alterx_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'shuffledns',
    repo: 'projectdiscovery/shuffledns',
    exe: 'shuffledns.exe',
    desc: 'Mass DNS resolver & subdomain brute-forcer',
    assetPattern: /shuffledns_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'uncover',
    repo: 'projectdiscovery/uncover',
    exe: 'uncover.exe',
    desc: 'Internet exposure search (Shodan/Censys/FOFA)',
    assetPattern: /uncover_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'cdncheck',
    repo: 'projectdiscovery/cdncheck',
    exe: 'cdncheck.exe',
    desc: 'CDN/WAF/Cloud provider IP detection',
    assetPattern: /cdncheck_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'asnmap',
    repo: 'projectdiscovery/asnmap',
    exe: 'asnmap.exe',
    desc: 'ASN-to-IP-range mapping for target org',
    assetPattern: /asnmap_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'mapcidr',
    repo: 'projectdiscovery/mapcidr',
    exe: 'mapcidr.exe',
    desc: 'CIDR range expansion & IP manipulation',
    assetPattern: /mapcidr_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'interactsh-client',
    repo: 'projectdiscovery/interactsh',
    exe: 'interactsh-client.exe',
    desc: 'OOB interaction client for blind vuln detection',
    assetPattern: /interactsh-client_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  {
    name: 'gau',
    repo: 'lc/gau',
    exe: 'gau.exe',
    desc: 'GetAllURLs — Wayback/OTX/CommonCrawl/URLScan',
    assetPattern: /gau_[\d.]+_windows_amd64\.zip$/i,
    format: 'zip',
  },
  // waybackurls: tomnomnom/waybackurls has no Windows binary releases — gau covers Wayback URLs
  // hakrawler: hakluke/hakrawler has no binary releases — katana + gospider cover JS crawling
  {
    name: 'gospider',
    repo: 'jaeles-project/gospider',
    exe: 'gospider.exe',
    desc: 'Fast web spider with JS link extraction',
    assetPattern: /gospider[_-]v?[\d.]+[_-]windows[_-](?:amd64|64bit).*\.zip$/i,
    format: 'zip',
  },
  {
    name: 'feroxbuster',
    repo: 'epi052/feroxbuster',
    exe: 'feroxbuster.exe',
    desc: 'Recursive directory & content discovery',
    assetPattern: /feroxbuster[_-]v?[\d.]+[_-]x86_64[_-]pc[_-]windows[_-]msvc\.zip$/i,
    format: 'zip',
  },
  // kiterunner: assetnote/kiterunner releases Linux binaries only — no Windows build available
  {
    name: 'crlfuzz',
    repo: 'dwisiswant0/crlfuzz',
    exe: 'crlfuzz.exe',
    desc: 'CRLF injection & response splitting scanner',
    assetPattern: /crlfuzz[_-][\d.]+[_-]windows[_-]amd64.*\.zip$/i,
    format: 'zip',
  },
  // kxss: Emoe-sec/kxss repo does not exist; tomnomnom/kxss has no binary releases — dalfox covers XSS scanning
]

function get(url) {
  return new Promise((resolve, reject) => {
    let count = 0
    function request(u) {
      if (count++ > 15) return reject(new Error('Too many redirects'))
      const mod = u.startsWith('https') ? https : http
      mod.get(u, {
        headers: {
          'User-Agent': 'ReconMaster-Setup/1.0',
          'Accept': 'application/vnd.github.v3+json',
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, u).href
          // consume body to avoid memory leak
          res.resume()
          return request(next)
        }
        let data = ''
        res.on('data', d => data += d.toString())
        res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }))
      }).on('error', reject)
    }
    request(url)
  })
}

function getStream(url) {
  return new Promise((resolve, reject) => {
    let count = 0
    function request(u) {
      if (count++ > 15) return reject(new Error('Too many redirects'))
      const mod = u.startsWith('https') ? https : http
      mod.get(u, { headers: { 'User-Agent': 'ReconMaster-Setup/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, u).href
          res.resume()
          return request(next)
        }
        if (res.statusCode >= 400) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode}`))
        }
        resolve(res)
      }).on('error', reject)
    }
    request(url)
  })
}

async function getLatestAssetUrl(repo, assetPattern) {
  // Try /releases/latest first; fall back to /releases (all releases) for repos with no "latest"
  for (const endpoint of ['releases/latest', 'releases']) {
    const apiUrl = `https://api.github.com/repos/${repo}/${endpoint}`
    const result = await get(apiUrl)
    if (result.status >= 400) continue
    let releases
    try {
      releases = JSON.parse(result.body)
    } catch {
      continue
    }
    // /releases/latest returns an object; /releases returns an array
    const releaseList = Array.isArray(releases) ? releases : [releases]
    for (const release of releaseList) {
      const assets = release.assets || []
      const asset = assets.find(a => assetPattern.test(a.name))
      if (asset) return { url: asset.browser_download_url, name: asset.name, version: release.tag_name }
    }
  }
  throw new Error(`No matching asset for pattern ${assetPattern} in ${repo}`)
}

async function downloadFile(url, dest) {
  const res = await getStream(url)
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    let downloaded = 0
    const total = parseInt(res.headers['content-length'] || '0')
    res.on('data', (chunk) => {
      downloaded += chunk.length
      if (total > 0) {
        const pct = Math.round(downloaded / total * 100)
        const mb = (downloaded / 1024 / 1024).toFixed(1)
        process.stdout.write(`\r    ${pct}% (${mb}/${(total/1024/1024).toFixed(1)}MB)   `)
      } else {
        process.stdout.write(`\r    ${(downloaded/1024/1024).toFixed(1)}MB downloaded...`)
      }
    })
    res.pipe(file)
    file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve() })
    file.on('error', reject)
    res.on('error', reject)
  })
}

function extractZip(zipPath, destDir) {
  try {
    execSync(
      `powershell -Command "Expand-Archive -Force '${zipPath}' '${destDir}'"`,
      { stdio: 'pipe', timeout: 120000 }
    )
    return true
  } catch {
    try {
      const sz = path.join(__dirname, '../node_modules/7zip-bin/win/x64/7za.exe')
      if (fs.existsSync(sz)) {
        execSync(`"${sz}" x "${zipPath}" -o"${destDir}" -y`, { stdio: 'pipe', timeout: 120000 })
        return true
      }
    } catch { /* ignore */ }
    return false
  }
}

function extractNsis(nsisPath, destDir) {
  // 7zip can extract NSIS installers directly
  const sz = path.join(__dirname, '../node_modules/7zip-bin/win/x64/7za.exe')
  if (fs.existsSync(sz)) {
    try {
      execSync(`"${sz}" x "${nsisPath}" -o"${destDir}" -y`, { stdio: 'pipe', timeout: 120000 })
      return true
    } catch { return false }
  }
  return false
}

function findExe(dir, exeName) {
  try {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f)
      const stat = fs.statSync(fp)
      if (stat.isDirectory()) {
        const r = findExe(fp, exeName)
        if (r) return r
      } else if (f.toLowerCase() === exeName.toLowerCase()) {
        return fp
      }
    }
  } catch { /* ignore */ }
  return null
}

function extractTgz(tgzPath, destDir) {
  const sz = path.join(__dirname, '../node_modules/7zip-bin/win/x64/7za.exe')
  if (fs.existsSync(sz)) {
    // Two-pass: .tar.gz → .tar, then .tar → files
    const tarPath = tgzPath.replace(/\.gz$/, '')
    try {
      execSync(`"${sz}" e "${tgzPath}" -o"${path.dirname(tgzPath)}" -y`, { stdio: 'pipe', timeout: 60000 })
      execSync(`"${sz}" x "${tarPath}" -o"${destDir}" -y`, { stdio: 'pipe', timeout: 120000 })
      try { fs.unlinkSync(tarPath) } catch { /* ignore */ }
      return true
    } catch { return false }
  }
  // Fallback: PowerShell + .NET (slower but no deps)
  try {
    execSync(
      `powershell -Command "& { Add-Type -AssemblyName System.IO.Compression.FileSystem; $bytes=[System.IO.File]::ReadAllBytes('${tgzPath}'); $ms=New-Object System.IO.MemoryStream(,$bytes); $gz=New-Object System.IO.Compression.GZipStream($ms,[System.IO.Compression.CompressionMode]::Decompress); $tar='${tgzPath.replace(/\.gz$/, '')}'; $out=[System.IO.File]::Create($tar); $gz.CopyTo($out); $out.Close(); $gz.Close() }"`,
      { stdio: 'pipe', timeout: 60000 }
    )
    const tarPath = tgzPath.replace(/\.gz$/, '')
    execSync(
      `powershell -Command "& { $shell=New-Object -ComObject Shell.Application; $items=$shell.NameSpace('${tarPath}').Items(); $shell.NameSpace('${destDir}').CopyHere($items, 20) }"`,
      { stdio: 'pipe', timeout: 120000 }
    )
    try { fs.unlinkSync(tarPath) } catch { /* ignore */ }
    return true
  } catch { return false }
}

async function downloadTool(tool) {
  const exePath = path.join(BINARIES_DIR, tool.exe)
  if (fs.existsSync(exePath)) {
    const mb = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1)
    console.log(`  ✓ ${tool.name} already installed (${mb}MB)`)
    return true
  }

  // Find the correct download URL
  let downloadUrl, assetName, version
  if (tool.directUrl) {
    downloadUrl = tool.directUrl
    assetName = path.basename(tool.directUrl)
    version = 'latest'
    console.log(`⬇  ${tool.name} (direct) — ${assetName}`)
  } else {
    try {
      const info = await getLatestAssetUrl(tool.repo, tool.assetPattern)
      downloadUrl = info.url
      assetName = info.name
      version = info.version
      console.log(`⬇  ${tool.name} ${version} — ${assetName}`)
    } catch (err) {
      console.error(`  ✗ ${tool.name}: Cannot find release asset — ${err.message}`)
      return false
    }
  }

  const ext = tool.format === 'tgz' ? '.tar.gz' : tool.format === 'exe' ? '.exe' : tool.format === 'nsis' ? '.exe' : '.zip'
  const tmpFile = path.join(BINARIES_DIR, `_tmp_${tool.name}${ext}`)
  const tmpDir = path.join(BINARIES_DIR, `_tmp_${tool.name}_extracted`)

  try {
    await downloadFile(downloadUrl, tmpFile)

    // Direct exe — no extraction needed
    if (tool.format === 'exe') {
      fs.copyFileSync(tmpFile, exePath)
      const mb = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1)
      console.log(`  ✅ ${tool.name} installed (${mb}MB)`)
      return true
    }

    fs.mkdirSync(tmpDir, { recursive: true })

    let ok = false
    if (tool.format === 'tgz') {
      ok = extractTgz(tmpFile, tmpDir)
    } else if (tool.format === 'nsis') {
      ok = extractNsis(tmpFile, tmpDir)
    } else {
      ok = extractZip(tmpFile, tmpDir)
    }

    if (!ok) {
      console.error(`  ✗ ${tool.name}: extraction failed`)
      return false
    }

    const found = findExe(tmpDir, tool.archiveExe || tool.exe)
    if (!found) {
      const all = []
      function listAll(d, depth = 0) {
        if (depth > 4) return
        try {
          for (const f of fs.readdirSync(d)) {
            all.push('    '.repeat(depth) + f)
            const fp = path.join(d, f)
            if (fs.statSync(fp).isDirectory()) listAll(fp, depth + 1)
          }
        } catch { /* ignore */ }
      }
      listAll(tmpDir)
      console.error(`  ✗ ${tool.name}: ${tool.exe} not found. Archive contained:\n${all.slice(0, 15).join('\n')}`)
      return false
    }

    fs.copyFileSync(found, exePath)
    const mb = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1)
    console.log(`  ✅ ${tool.name} installed (${mb}MB)`)
    return true
  } catch (err) {
    console.error(`  ✗ ${tool.name}: ${err.message}`)
    return false
  } finally {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch { /* ignore */ }
    try { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

async function main() {
  console.log('\nReconMaster — Bundling Go Binaries')
  console.log('='.repeat(50))
  console.log(`Output: ${BINARIES_DIR}\n`)

  let success = 0
  let failed = 0
  const failedTools = []

  for (const tool of TOOLS) {
    const ok = await downloadTool(tool)
    if (ok) success++
    else { failed++; failedTools.push(tool.name) }
  }

  const totalMB = TOOLS.reduce((sum, t) => {
    const p = path.join(BINARIES_DIR, t.exe)
    return sum + (fs.existsSync(p) ? fs.statSync(p).size / 1024 / 1024 : 0)
  }, 0)

  console.log('\n' + '='.repeat(50))
  console.log(`Result: ${success} installed (${totalMB.toFixed(0)}MB), ${failed} unavailable`)

  if (failedTools.length > 0) {
    console.log(`\nUnavailable tools (Node.js fallbacks active): ${failedTools.join(', ')}`)
  }

  if (success > 0) {
    console.log('\nBinaries are now in resources/binaries/ and will be bundled by electron-builder.')
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
