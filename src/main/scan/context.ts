import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { IpcScanEvent, ScanPhase } from '../../renderer/types'

export interface ScanContext {
  scanId: string
  target: string
  options: Record<string, boolean>
  binDir: string
  outputDir: string
  processes: ChildProcess[]
  isCancel: () => boolean
  log: (tool: string, msg: string, level?: 'info' | 'warn' | 'error' | 'success') => void
  phaseStart: (phase: ScanPhase) => void
  phaseEnd: (phase: ScanPhase, results: unknown) => void
  emit: (event: IpcScanEvent) => void
}

export function hasBinary(ctx: ScanContext, name: string): boolean {
  return fs.existsSync(path.join(ctx.binDir, `${name}.exe`))
}

function spawnHidden(binPath: string, args: string[], cwd: string): ReturnType<typeof spawn> {
  // windowsHide sets CREATE_NO_WINDOW on the binary itself.
  // With all stdio as pipes the Go runtime detects no terminal and won't call AllocConsole.
  return spawn(binPath, args, {
    cwd,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

export function runBinary(ctx: ScanContext, name: string, args: string[], onLine: (line: string) => void, timeoutMs = 120_000): Promise<void> {
  return new Promise((resolve) => {
    if (ctx.isCancel()) return resolve()
    const binPath = path.join(ctx.binDir, `${name}.exe`)
    ctx.log(name, `Running: ${name} ${args.join(' ')}`, 'info')
    const proc = spawnHidden(binPath, args, ctx.outputDir)
    ctx.processes.push(proc)

    const timer = setTimeout(() => {
      ctx.log(name, `Timed out after ${Math.round(timeoutMs / 1000)}s — killing`, 'warn')
      try { proc.kill() } catch { /* ignore */ }
    }, timeoutMs)

    let buf = ''
    const handleData = (chunk: Buffer) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim()) { onLine(line.trim()); ctx.log(name, line.trim(), 'info') }
      }
    }
    proc.stdout?.on('data', handleData)
    proc.stderr?.on('data', handleData)
    proc.on('close', () => { clearTimeout(timer); resolve() })
    proc.on('error', () => { clearTimeout(timer); resolve() })
  })
}

// Runs a binary completely hidden via a PowerShell -WindowStyle Hidden wrapper.
// Used for tools that write output to a file (-o flag) rather than stdout.
// PowerShell wrapper guarantees no console window even for Go binaries that spawn
// sub-processes or resist CREATE_NO_WINDOW; taskkill /T ensures the whole tree dies.
export function runBinaryFile(
  ctx: ScanContext,
  name: string,
  args: string[],
  timeoutMs = 120_000,
  extraEnv?: Record<string, string>,
): Promise<void> {
  return new Promise((resolve) => {
    if (ctx.isCancel()) return resolve()
    const binPath = path.join(ctx.binDir, `${name}.exe`)
    ctx.log(name, `Running: ${name} ${args.join(' ')}`, 'info')
    const env = extraEnv ? { ...process.env, ...extraEnv } : undefined

    // Single-quote every token for PowerShell; escape internal single-quotes
    const ps = (s: string) => `'${s.replace(/'/g, "''")}'`
    const cmdStr = [binPath, ...args].map(ps).join(' ')
    const proc = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
      '-Command', `& ${cmdStr}`,
    ], {
      cwd: ctx.outputDir,
      windowsHide: true,
      stdio: 'ignore',
      ...(env && { env }),
    })

    // Push a proxy whose kill() tears down the full process tree (PS + binary)
    const killTree = () => {
      if (proc.pid) {
        try { execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore', windowsHide: true }) } catch { /* ignore */ }
      }
    }
    ctx.processes.push({ kill: killTree } as unknown as ChildProcess)

    const timer = setTimeout(() => {
      ctx.log(name, `Timed out after ${Math.round(timeoutMs / 1000)}s — killing`, 'warn')
      killTree()
    }, timeoutMs)
    proc.on('close', () => { clearTimeout(timer); resolve() })
    proc.on('error', () => { clearTimeout(timer); resolve() })
  })
}

export function runBinaryStdin(ctx: ScanContext, name: string, args: string[], stdin: string, onLine: (line: string) => void, timeoutMs = 120_000): Promise<void> {
  return new Promise((resolve) => {
    if (ctx.isCancel() || !stdin) return resolve()
    const binPath = path.join(ctx.binDir, `${name}.exe`)
    ctx.log(name, `Running: ${name} ${args.join(' ')}`, 'info')
    const proc = spawnHidden(binPath, args, ctx.outputDir)
    ctx.processes.push(proc)

    const timer = setTimeout(() => {
      ctx.log(name, `Timed out after ${Math.round(timeoutMs / 1000)}s — killing`, 'warn')
      try { proc.kill() } catch { /* ignore */ }
    }, timeoutMs)

    let buf = ''
    const handleData = (chunk: Buffer) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim()) { onLine(line.trim()); ctx.log(name, line.trim(), 'info') }
      }
    }
    proc.stdout?.on('data', handleData)
    proc.stderr?.on('data', handleData)
    proc.on('close', () => { clearTimeout(timer); resolve() })
    proc.on('error', () => { clearTimeout(timer); resolve() })
    if (proc.stdin) { proc.stdin.write(stdin + '\n'); proc.stdin.end() }
  })
}

export function httpsGet(ctx: ScanContext, url: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url)
      const mod = parsed.protocol === 'https:' ? https : http
      const req = mod.request(
        { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 ReconMaster/1.0' }, timeout: timeoutMs, rejectUnauthorized: false },
        (res) => {
          // Follow redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            resolve(httpsGet(ctx, res.headers.location as string, timeoutMs))
            return
          }
          let data = ''
          let settled = false
          const done = (v: string) => { if (!settled) { settled = true; resolve(v) } }
          res.on('data', (d: Buffer) => { if (data.length < 500000) data += d.toString() })
          res.on('end', () => done(data))
          res.on('error', () => done(''))
          res.on('close', () => done(data))
        }
      )
      req.on('error', () => resolve(''))
      req.on('timeout', () => { req.destroy(); resolve('') })
      req.end()
    } catch { resolve('') }
  })
}
