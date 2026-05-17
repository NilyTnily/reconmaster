import { register as registerScan } from './scan'
import { register as registerAgent } from './agent'
import { register as registerExploit } from './exploit'
import { register as registerBrowser } from './browser'
import { register as registerTerminal } from './terminal'
import { register as registerAttacker } from './attacker'
import { register as registerTools } from './tools'
import type { IpcDeps } from './types'

export function registerAllHandlers(deps: IpcDeps): void {
  registerScan(deps)
  registerAgent(deps)
  registerExploit(deps)
  registerBrowser(deps)
  registerTerminal(deps)
  registerAttacker(deps)
  registerTools(deps)
}
