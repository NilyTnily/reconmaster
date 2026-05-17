import { dialog, shell } from 'electron'
import fs from 'fs'
import { ScanOrchestrator } from '../orchestrator'
import { assertExternalScope } from '../lib/scopeValidator'
import { auditLog } from '../lib/auditLog'
import { loadAgentSettings } from './shared'
import { validate, ScanStartSchema } from './validate'
import { handle } from './handle'
import type { IpcDeps } from './types'

export function register(deps: IpcDeps): void {
  const { getWindow, getUserData, storage, orchestrators } = deps

  handle('scan:start', async (_, scanId: unknown, target: unknown, options: unknown) => {
    const v = validate(ScanStartSchema, { scanId, target, options }, 'scan:start')
    if (!v.ok) return { success: false, error: v.error }

    try {
      const settings = loadAgentSettings(getUserData())
      assertExternalScope(v.data.target, settings.scopeAllowlist ?? [])
    } catch (err) {
      return { success: false, error: String(err) }
    }

    const { scanId: sid, target: tgt, options: opts } = v.data

    auditLog('SCAN_START', { scanId: sid, target: tgt, options: opts })

    const orchestrator = new ScanOrchestrator(sid, tgt, opts, getUserData(), (event) => {
      getWindow()?.webContents.send('scan:event', event)
    })

    orchestrators.set(sid, orchestrator)
    orchestrator.start()
      .then(() => orchestrators.delete(sid))
      .catch((err) => {
        orchestrators.delete(sid)
        getWindow()?.webContents.send('scan:event', { scanId: sid, type: 'scan-error', data: { error: String(err) } })
      })
    return { success: true }
  })

  handle('scan:cancel', async (_, rawScanId: unknown) => {
    const scanId = rawScanId as string
    const orch = orchestrators.get(scanId)
    if (orch) {
      orch.cancel()
      orchestrators.delete(scanId)
    }
    return { success: true }
  })

  handle('scan:save', async (_, scan: unknown) => {
    await storage.saveScan(scan as Record<string, unknown>)
    return { success: true }
  })

  handle('scan:load', async () => storage.loadScans())

  handle('scan:delete', async (_, rawScanId: unknown) => {
    const scanId = rawScanId as string
    await storage.deleteScan(scanId)
    return { success: true }
  })

  handle('export:data', async (_, data: unknown, rawFormat: unknown, rawFilename: unknown) => {
    const format = rawFormat as 'csv' | 'json'
    const filename = rawFilename as string
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: format === 'csv'
        ? [{ name: 'CSV', extensions: ['csv'] }]
        : [{ name: 'JSON', extensions: ['json'] }],
    })

    if (!filePath) return { success: false }

    let content: string
    if (format === 'json') {
      content = JSON.stringify(data, null, 2)
    } else {
      const rows = data as Record<string, unknown>[]
      if (!rows.length) return { success: false }
      const headers = Object.keys(rows[0])
      const csvRows = [
        headers.join(','),
        ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
      ]
      content = csvRows.join('\n')
    }

    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true, filePath }
  })

  handle('export:markdown', async (_, rawContent: unknown, rawFilename: unknown) => {
    const content = rawContent as string
    const filename = rawFilename as string
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (!filePath) return { success: false }
    fs.writeFileSync(filePath, content, 'utf-8')
    await shell.openPath(filePath)
    return { success: true, filePath }
  })
}
