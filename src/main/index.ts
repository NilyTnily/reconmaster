import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { StorageManager } from './storage'
import { ScanOrchestrator } from './orchestrator'
import { initAuditLog, auditLog } from './lib/auditLog'
import { initLogger } from './lib/logger'
import { decryptSecret } from './lib/secureStorage'
import { registerAllHandlers } from './ipc/router'
import { cleanupTerminals } from './ipc/terminal'
import type { IpcDeps } from './ipc/types'

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null
const orchestrators = new Map<string, ScanOrchestrator>()
const storage = new StorageManager()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../../resources/icon.ico'),
    titleBarStyle: 'hidden',
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  initAuditLog(app.getPath('userData'))
  initLogger(app.getPath('userData'))
  auditLog('APP_START', { version: app.getVersion() })
  // Load saved GitHub token so tool downloads aren't rate-limited
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'github-config.json'), 'utf-8'))
    if (cfg.token) process.env.GITHUB_TOKEN = decryptSecret(cfg.token)
  } catch { /* no token saved yet */ }
  createWindow()

  const deps: IpcDeps = {
    getWindow: () => mainWindow,
    getUserData: () => app.getPath('userData'),
    storage,
    orchestrators,
  }
  registerAllHandlers(deps)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  for (const orch of orchestrators.values()) {
    try { orch.cancel() } catch { /* ignore */ }
  }
  orchestrators.clear()
  cleanupTerminals()
  auditLog('APP_QUIT', {})
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())

ipcMain.handle('app:resourcePath', () => app.getPath('userData'))
