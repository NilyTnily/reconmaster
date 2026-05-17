import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export class StorageManager {
  private dataDir: string
  private scansFile: string

  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'reconmaster')
    this.scansFile = path.join(this.dataDir, 'scans.json')
    fs.mkdirSync(this.dataDir, { recursive: true })
  }

  async loadScans(): Promise<Record<string, unknown>[]> {
    if (!fs.existsSync(this.scansFile)) return []
    try {
      const data = fs.readFileSync(this.scansFile, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  async saveScan(scan: Record<string, unknown>): Promise<void> {
    const scans = await this.loadScans()
    const idx = scans.findIndex(s => s.id === scan.id)
    if (idx >= 0) {
      scans[idx] = scan
    } else {
      scans.unshift(scan)
    }
    fs.writeFileSync(this.scansFile, JSON.stringify(scans, null, 2), 'utf-8')
  }

  async deleteScan(scanId: string): Promise<void> {
    const scans = await this.loadScans()
    const filtered = scans.filter(s => s.id !== scanId)
    fs.writeFileSync(this.scansFile, JSON.stringify(filtered, null, 2), 'utf-8')
  }
}
