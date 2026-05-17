import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { logger } from '../lib/logger'

// Drop-in replacement for ipcMain.handle that catches all unhandled exceptions,
// logs them, and returns { success: false, error } instead of crashing the IPC call.
export function handle(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(event, ...args)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`ipc:${channel} — ${msg}`)
      return { success: false, error: msg }
    }
  })
}
