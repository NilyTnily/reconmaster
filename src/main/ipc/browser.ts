import { handle } from './handle'
import { browserClose } from '../browserAgent'
import type { IpcDeps } from './types'

export function register(_deps: IpcDeps): void {
  handle('browser:close', async () => { browserClose(); return { success: true } })
}
