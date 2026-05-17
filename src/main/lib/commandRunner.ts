import { spawn } from 'child_process'

// Splits a raw command string into [exe, ...args] without invoking a shell.
// Handles double and single quoted tokens. Shell operators (;, &&, |, >) are
// treated as plain characters — injection via them is impossible.
function parseCmd(raw: string): [string, string[]] {
  const tokens: string[] = []
  let current = ''
  let inDouble = false
  let inSingle = false

  for (const ch of raw) {
    if (inDouble) {
      if (ch === '"') inDouble = false
      else current += ch
    } else if (inSingle) {
      if (ch === "'") inSingle = false
      else current += ch
    } else if (ch === '"') {
      inDouble = true
    } else if (ch === "'") {
      inSingle = true
    } else if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      if (current.length > 0) { tokens.push(current); current = '' }
    } else {
      current += ch
    }
  }
  if (current.length > 0) tokens.push(current)

  const [exe = '', ...args] = tokens
  return [exe, args]
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

/** Runs a command with shell:false — shell injection via operators (;, &&, |) is impossible. */
export function runCommand(cmd: string, timeoutMs = 30000): Promise<CommandResult> {
  return new Promise((resolve) => {
    const [exe, args] = parseCmd(cmd)
    if (!exe) return resolve({ stdout: '', stderr: 'Empty command', exitCode: 1 })

    let stdout = ''
    let stderr = ''

    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn(exe, args, { windowsHide: true, shell: false })
    } catch (err) {
      return resolve({ stdout: '', stderr: String(err), exitCode: 1 })
    }

    const timer = setTimeout(() => { proc.kill('SIGTERM'); resolve({ stdout, stderr: stderr + '\n[timeout]', exitCode: 124 }) }, timeoutMs)

    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: code ?? 0 }) })
    proc.on('error', (err) => { clearTimeout(timer); resolve({ stdout, stderr: stderr + String(err), exitCode: 1 }) })
  })
}

/** Streams a command's output line-by-line; uses shell:false — injection-safe. */
export function spawnStreaming(cmd: string, onData: (text: string) => void, timeoutMs = 60000): Promise<number> {
  return new Promise((resolve) => {
    const [exe, args] = parseCmd(cmd)
    if (!exe) { onData('[error] Empty command\n'); return resolve(1) }

    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn(exe, args, { windowsHide: true, shell: false })
    } catch (err) {
      onData(`[error] ${String(err)}\n`)
      return resolve(1)
    }

    const timer = setTimeout(() => { proc.kill('SIGTERM'); resolve(124) }, timeoutMs)
    proc.stdout?.on('data', (d: Buffer) => onData(d.toString()))
    proc.stderr?.on('data', (d: Buffer) => onData(d.toString()))
    proc.on('close', (code) => { clearTimeout(timer); resolve(code ?? 0) })
    proc.on('error', (err) => { clearTimeout(timer); onData(`[error] ${err.message}\n`); resolve(1) })
  })
}
