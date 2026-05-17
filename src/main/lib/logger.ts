import fs from 'fs'
import path from 'path'

type Level = 'INFO' | 'WARN' | 'ERROR'

let logPath = ''

export function initLogger(userDataPath: string): void {
  logPath = path.join(userDataPath, 'app.log')
}

function write(level: Level, message: string): void {
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`
  if (logPath) {
    fs.appendFile(logPath, line, () => {})
  }
}

export const logger = {
  info: (message: string) => write('INFO', message),
  warn: (message: string) => write('WARN', message),
  error: (message: string) => write('ERROR', message),
}
