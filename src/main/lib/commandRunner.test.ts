import { describe, it, expect } from 'vitest'
import { runCommand, spawnStreaming } from './commandRunner'

describe('runCommand', () => {
  it('runs a simple command and captures stdout', async () => {
    const result = await runCommand('node -e "process.stdout.write(\'hello\')"')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('hello')
  })

  it('captures stderr separately', async () => {
    const result = await runCommand('node -e "process.stderr.write(\'err\')"')
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('err')
  })

  it('returns non-zero exit code on failure', async () => {
    const result = await runCommand('node -e "process.exit(2)"')
    expect(result.exitCode).toBe(2)
  })

  it('returns exit code 1 for empty command', async () => {
    const result = await runCommand('')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('Empty command')
  })

  it('returns exit code 1 for unknown executable', async () => {
    const result = await runCommand('__nonexistent_exe_12345__')
    expect(result.exitCode).toBe(1)
  })

  it('handles quoted arguments as single tokens', async () => {
    const result = await runCommand('node -e "process.stdout.write(\'one two\')"')
    expect(result.stdout).toBe('one two')
  })

  it('times out and returns exit code 124', async () => {
    const result = await runCommand('node -e "setTimeout(()=>{},9999)"', 50)
    expect(result.exitCode).toBe(124)
    expect(result.stderr).toContain('[timeout]')
  }, 5000)

  it('treats shell injection characters as plain tokens — no shell expansion', async () => {
    // If shell were true, "&&" would chain two commands. With shell:false it's
    // just a bad argument and the process fails to spawn / exits non-zero.
    const result = await runCommand('echo hello && echo injected')
    // "echo" on Windows/unix with extra args just echoes them literally or fails
    // The key assertion: no second "injected" output on its own line
    expect(result.stdout).not.toMatch(/^injected$/m)
  })
})

describe('spawnStreaming', () => {
  it('streams stdout chunks and resolves with exit code', async () => {
    const chunks: string[] = []
    const code = await spawnStreaming('node -e "process.stdout.write(\'x\')"', c => chunks.push(c))
    expect(code).toBe(0)
    expect(chunks.join('')).toBe('x')
  })

  it('returns 1 for empty command and emits error chunk', async () => {
    const chunks: string[] = []
    const code = await spawnStreaming('', c => chunks.push(c))
    expect(code).toBe(1)
    expect(chunks.join('')).toContain('[error]')
  })

  it('times out and resolves with 124', async () => {
    const code = await spawnStreaming('node -e "setTimeout(()=>{},9999)"', () => {}, 50)
    expect(code).toBe(124)
  }, 5000)
})
