import https from 'https'
import http, { IncomingMessage } from 'http'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { BrowserWindow } from 'electron'

export interface ToolInfo {
  name: string
  exe: string
  url: string
  description: string
  size?: string
  installed: boolean
}

const TOOLS: Omit<ToolInfo, 'installed'>[] = [
  { name: 'subfinder', exe: 'subfinder.exe', url: 'https://github.com/projectdiscovery/subfinder/releases/latest/download/subfinder_windows_amd64.zip', description: 'Subdomain discovery', size: '~8MB' },
  { name: 'httpx', exe: 'httpx.exe', url: 'https://github.com/projectdiscovery/httpx/releases/latest/download/httpx_windows_amd64.zip', description: 'HTTP probing with tech detection', size: '~12MB' },
  { name: 'naabu', exe: 'naabu.exe', url: 'https://github.com/projectdiscovery/naabu/releases/latest/download/naabu_windows_amd64.zip', description: 'Fast port scanner', size: '~8MB' },
  { name: 'dnsx', exe: 'dnsx.exe', url: 'https://github.com/projectdiscovery/dnsx/releases/latest/download/dnsx_windows_amd64.zip', description: 'DNS resolver & brute-forcer', size: '~7MB' },
  { name: 'tlsx', exe: 'tlsx.exe', url: 'https://github.com/projectdiscovery/tlsx/releases/latest/download/tlsx_windows_amd64.zip', description: 'TLS/SSL analysis', size: '~7MB' },
  { name: 'katana', exe: 'katana.exe', url: 'https://github.com/projectdiscovery/katana/releases/latest/download/katana_windows_amd64.zip', description: 'Web crawler & JS analysis', size: '~14MB' },
  { name: 'nuclei', exe: 'nuclei.exe', url: 'https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_windows_amd64.zip', description: 'Vulnerability scanner (templates separate)', size: '~18MB' },
  { name: 'ffuf', exe: 'ffuf.exe', url: 'https://github.com/ffuf/ffuf/releases/latest/download/ffuf_windows_amd64.zip', description: 'Directory & file fuzzer', size: '~8MB' },
  { name: 'amass', exe: 'amass.exe', url: 'https://github.com/owasp-amass/amass/releases/latest/download/amass_windows_amd64.zip', description: 'Advanced subdomain enumeration', size: '~25MB' },
]

export function getToolStatus(binDir: string): ToolInfo[] {
  return TOOLS.map(t => ({
    ...t,
    installed: fs.existsSync(path.join(binDir, t.exe)),
  }))
}

async function followRedirects(url: string, maxHops = 10): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    let count = 0
    function req(u: string) {
      if (count++ > maxHops) return reject(new Error('Too many redirects'))
      const mod = u.startsWith('https') ? https : http
      const request = mod.get(u, { headers: { 'User-Agent': 'ReconMaster/1.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.headers.location) {
          return req(res.headers.location)
        }
        resolve(res)
      })
      request.on('error', reject)
      request.setTimeout(30000, () => { request.destroy(); reject(new Error('timeout')) })
    }
    req(url)
  })
}

export async function downloadTool(
  toolName: string,
  binDir: string,
  win: BrowserWindow | null,
  onProgress: (pct: number, msg: string) => void,
): Promise<boolean> {
  const tool = TOOLS.find(t => t.name === toolName)
  if (!tool) return false

  const exePath = path.join(binDir, tool.exe)
  if (fs.existsSync(exePath)) return true

  const tmpZip = path.join(binDir, `_tmp_${toolName}.zip`)
  const tmpDir = path.join(binDir, `_tmp_${toolName}_extracted`)

  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    onProgress(0, `Connecting to GitHub for ${toolName}...`)

    const res = await followRedirects(tool.url)
    const total = parseInt(res.headers['content-length'] || '0')
    let downloaded = 0

    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(tmpZip)
      res.on('data', (chunk: Buffer) => {
        downloaded += chunk.length
        const pct = total > 0 ? Math.round(downloaded / total * 100) : -1
        onProgress(pct, `Downloading ${toolName}... ${Math.round(downloaded / 1024 / 1024 * 10) / 10}MB`)
      })
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
      file.on('error', reject)
      res.on('error', reject)
    })

    onProgress(90, `Extracting ${toolName}...`)

    // Extract using PowerShell (built into Windows 10+)
    try {
      execSync(`powershell -Command "Expand-Archive -Force '${tmpZip}' '${tmpDir}'"`, { stdio: 'pipe' })
    } catch {
      // Try 7zip bundled with electron-builder
      const sevenZip = path.join(process.resourcesPath || '', '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
      if (fs.existsSync(sevenZip)) {
        execSync(`"${sevenZip}" x "${tmpZip}" -o"${tmpDir}" -y`, { stdio: 'pipe' })
      } else {
        throw new Error('Cannot extract zip — no extraction tool available')
      }
    }

    // Find the exe
    const exeName = tool.exe.toLowerCase()
    function findExe(dir: string): string | null {
      for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f)
        const stat = fs.statSync(fp)
        if (stat.isDirectory()) {
          const r = findExe(fp)
          if (r) return r
        } else if (f.toLowerCase() === exeName) {
          return fp
        }
      }
      return null
    }

    const found = findExe(tmpDir)
    if (!found) throw new Error(`${tool.exe} not found in extracted archive`)

    fs.copyFileSync(found, exePath)
    onProgress(100, `${toolName} installed successfully`)
    return true

  } catch (err) {
    onProgress(-1, `Failed to install ${toolName}: ${(err as Error).message}`)
    return false
  } finally {
    try { fs.unlinkSync(tmpZip) } catch { /* ignore */ }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}
