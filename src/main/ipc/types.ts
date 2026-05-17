import { BrowserWindow } from 'electron'
import { StorageManager } from '../storage'
import { ScanOrchestrator } from '../orchestrator'

export interface IpcDeps {
  getWindow: () => BrowserWindow | null
  getUserData: () => string
  storage: StorageManager
  orchestrators: Map<string, ScanOrchestrator>
}
