import fs from 'fs'
import path from 'path'

let logPath = ''

export function initAuditLog(userDataPath: string) {
  logPath = path.join(userDataPath, 'audit.log')
}

export function auditLog(type: string, details: Record<string, unknown>) {
  if (!logPath) return
  const entry = `[${new Date().toISOString()}] [${type}] ${JSON.stringify(details)}\n`
  fs.appendFile(logPath, entry, (err) => {
    if (err) process.stderr.write(`[auditLog] write failed: ${err.message}\n`)
  })
}
