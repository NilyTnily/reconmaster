import { ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { IpcScanEvent, ScanPhase } from '../renderer/types'
import { ScanContext } from './scan/context'
import { runDns } from './scan/dns'
import { runSubdomains } from './scan/subdomains'
import { runPorts } from './scan/ports'
import { runHttpProbe } from './scan/http'
import { runSsl } from './scan/ssl'
import { runDirEnum } from './scan/dirEnum'
import { runVulns } from './scan/vulns'
import { runOsint } from './scan/osint'
import { runCrawl } from './scan/crawl'
import { runXss } from './scan/xss'
import { runIdor } from './scan/idor'

type EventCallback = (event: IpcScanEvent) => void

export class ScanOrchestrator {
  private scanId: string
  private target: string
  private options: Record<string, boolean>
  private resourcePath: string
  private emit: EventCallback
  private processes: ChildProcess[] = []
  private cancelled = false
  private binDir: string
  private outputDir: string

  constructor(
    scanId: string,
    target: string,
    options: Record<string, boolean>,
    resourcePath: string,
    emit: EventCallback,
  ) {
    this.scanId = scanId
    this.target = target.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase().trim()
    this.options = options
    this.resourcePath = resourcePath
    this.emit = emit
    this.binDir = path.join(resourcePath, 'binaries')
    this.outputDir = path.join(resourcePath, 'output', scanId)
    fs.mkdirSync(this.outputDir, { recursive: true })
  }

  cancel() {
    this.cancelled = true
    for (const proc of this.processes) {
      try { proc.kill('SIGTERM') } catch { /* ignore */ }
    }
  }

  private log(tool: string, message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') {
    this.emit({
      scanId: this.scanId,
      type: 'log',
      data: { timestamp: new Date().toISOString(), tool, message, level },
    })
  }

  private phaseStart(phase: ScanPhase) {
    this.emit({ scanId: this.scanId, phase, type: 'phase-start', data: { startedAt: new Date().toISOString() } })
  }

  private phaseEnd(phase: ScanPhase, results: unknown) {
    this.emit({ scanId: this.scanId, phase, type: 'phase-end', data: { completedAt: new Date().toISOString(), results } })
  }

  private hasBinary(name: string): boolean {
    return fs.existsSync(path.join(this.binDir, `${name}.exe`))
  }

  async start() {
    const ctx: ScanContext = {
      scanId: this.scanId,
      target: this.target,
      options: this.options,
      binDir: this.binDir,
      outputDir: this.outputDir,
      processes: this.processes,
      isCancel: () => this.cancelled,
      log: this.log.bind(this),
      phaseStart: this.phaseStart.bind(this),
      phaseEnd: this.phaseEnd.bind(this),
      emit: this.emit,
    }

    this.log('orchestrator', `Starting scan for ${this.target}`, 'info')

    const safe = <T>(p: Promise<T>, fallback: T, phase: string, timeoutMs: number): Promise<T> => {
      const timer = new Promise<T>(r => setTimeout(() => {
        this.log('orchestrator', `Phase ${phase} timed out after ${Math.round(timeoutMs / 1000)}s — moving on`, 'warn')
        r(fallback)
      }, timeoutMs))
      return Promise.race([p, timer]).catch(err => {
        this.log('orchestrator', `Phase ${phase} failed: ${String(err)}`, 'error')
        return fallback
      })
    }

    const dnsResults = ctx.options.dns !== false ? await safe(runDns(ctx), [], 'dns', 20_000) : []
    const subdomains = ctx.options.subdomains !== false ? await safe(runSubdomains(ctx), [], 'subdomains', 55_000) : []

    const allHosts = [ctx.target, ...subdomains.map(s => s.host)]
    const uniqueHosts = [...new Set(allHosts)].slice(0, 15)

    const [ports, httpResults, sslResults] = await Promise.all([
      ctx.options.ports !== false ? safe(runPorts(ctx, uniqueHosts), [], 'ports', 40_000) : Promise.resolve([]),
      ctx.options.http !== false ? safe(runHttpProbe(ctx, uniqueHosts), [], 'http', 30_000) : Promise.resolve([]),
      ctx.options.ssl !== false ? safe(runSsl(ctx, uniqueHosts.slice(0, 10)), [], 'ssl', 20_000) : Promise.resolve([]),
    ])

    const liveUrls = httpResults.filter(h => h.status > 0 && h.status < 500).map(h => h.url)

    const [dirs, vulns, osint, jsEndpoints] = await Promise.all([
      ctx.options.dirs !== false ? safe(runDirEnum(ctx, liveUrls.slice(0, 2)), [], 'dirs', 45_000) : Promise.resolve([]),
      ctx.options.vulns !== false ? safe(runVulns(ctx, liveUrls, httpResults, sslResults), [], 'vulns', 50_000) : Promise.resolve([]),
      ctx.options.osint !== false ? safe(runOsint(ctx), [], 'osint', 18_000) : Promise.resolve([]),
      ctx.options.crawl !== false ? safe(runCrawl(ctx, liveUrls.slice(0, 3)), [], 'crawl', 40_000) : Promise.resolve([]),
    ])

    const [xssResults, idorResults] = await Promise.all([
      ctx.options.xss !== false ? safe(runXss(ctx, liveUrls, jsEndpoints), [], 'xss', 25_000) : Promise.resolve([]),
      ctx.options.idor !== false ? safe(runIdor(ctx, liveUrls, jsEndpoints, httpResults), [], 'idor', 20_000) : Promise.resolve([]),
    ])

    this.emit({
      scanId: this.scanId,
      type: 'scan-complete',
      data: { dns: dnsResults, subdomains, ports, http: httpResults, ssl: sslResults, dirs, vulnerabilities: vulns, osint, jsEndpoints, xssResults, idorResults },
    })
  }
}
