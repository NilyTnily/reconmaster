import { handle } from './handle'
import { spawn, ChildProcess } from 'child_process'
import type { IpcDeps } from './types'

const terminalProcs = new Map<string, ChildProcess>()

export function cleanupTerminals(): void {
  for (const proc of terminalProcs.values()) {
    try { proc.kill('SIGTERM') } catch { /* ignore */ }
  }
  terminalProcs.clear()
}

export function register(deps: IpcDeps): void {
  const { getWindow } = deps

  handle('terminal:run', async (_, rawArgs: unknown) => {
    const { tabId, command } = rawArgs as { tabId: string; command: string }
    terminalProcs.get(tabId)?.kill('SIGTERM')
    terminalProcs.delete(tabId)

    const isWin = process.platform === 'win32'
    let exe: string
    let args: string[]
    if (isWin) {
      // Encode as UTF-16LE Base64 so PowerShell runs the literal command without
      // re-interpreting operators injected via the command string itself.
      const encoded = Buffer.from(command, 'utf16le').toString('base64')
      exe = 'powershell.exe'
      args = ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded]
    } else {
      exe = '/bin/bash'
      args = ['-c', command]
    }

    let proc: ChildProcess
    try {
      proc = spawn(exe, args, { windowsHide: true, shell: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      getWindow()?.webContents.send('terminal:output', { tabId, text: `[error] ${msg}\n` })
      getWindow()?.webContents.send('terminal:done', { tabId, code: 1 })
      return { success: false }
    }

    terminalProcs.set(tabId, proc)
    const send = (t: string) => getWindow()?.webContents.send('terminal:output', { tabId, text: t })
    proc.stdout?.on('data', (d: Buffer) => send(d.toString()))
    proc.stderr?.on('data', (d: Buffer) => send(d.toString()))
    proc.on('close', code => {
      terminalProcs.delete(tabId)
      getWindow()?.webContents.send('terminal:done', { tabId, code })
    })
    proc.on('error', err => {
      send(`[error] ${err.message}\n`)
      getWindow()?.webContents.send('terminal:done', { tabId, code: 1 })
    })
    return { success: true }
  })

  handle('terminal:kill', async (_, rawArgs: unknown) => {
    const { tabId } = rawArgs as { tabId: string }
    terminalProcs.get(tabId)?.kill('SIGTERM')
    terminalProcs.delete(tabId)
    return { success: true }
  })
}
