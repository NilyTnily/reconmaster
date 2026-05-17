import fs from 'fs'
import { decryptSecret } from './lib/secureStorage'
import { logger } from './lib/logger'
import { getAdapter, AgentMsg } from './providers/index'
import { getToolDefs, executeTool, getToolMeta, AgentContext, ToolTier } from './agentTools'
import type { ScanData } from './types/scan'

export interface AgentCallbacks {
  onChunk: (text: string) => void
  onToolCall: (id: string, name: string, label: string, args: Record<string, unknown>, tier: ToolTier) => void
  onToolResult: (id: string, result: string) => void
  onApprovalRequired: (id: string, name: string, label: string, args: Record<string, unknown>, tier: ToolTier) => void
  onBrowserUpdate: (url: string, screenshotB64?: string) => void
  onDone: () => void
  onError: (err: string) => void
}

export interface LoopConfig {
  providerId: string
  model: string
  apiKey: string
  baseUrl?: string
  maxIterations?: number
  autonomousMode?: boolean
}

// Pending approvals: toolCallId → resolve(approved)
const pendingApprovals = new Map<string, (approved: boolean) => void>()

// Auto-approve tool names after a propose_chain approval (count-based to handle repeated tools)
const chainAutoApproveTools = new Map<string, number>()

export function resolveApproval(toolCallId: string, approved: boolean) {
  const r = pendingApprovals.get(toolCallId)
  if (r) { r(approved); pendingApprovals.delete(toolCallId) }
}

function loadMemory(memoryPath: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(memoryPath, 'utf-8')
    try { return JSON.parse(decryptSecret(raw)) } catch { /* legacy plain JSON */ }
    return JSON.parse(raw)
  } catch { return {} }
}

function buildSystemPrompt(scanData: ScanData | null, memory: Record<string, string>): string {
  let scanContext = 'No active scan loaded.'
  if (scanData) {
    const s = scanData
    const critHigh = (s.vulnerabilities || []).filter(v => ['critical', 'high'].includes(v.severity))
    const vulns = critHigh.slice(0, 15).map(v => `[${v.severity.toUpperCase()}] ${v.name} @ ${v.host}`).join('\n')
    const ports = (s.ports || []).filter(p => p.state === 'open').slice(0, 25).map(p => `${p.host}:${p.port}/${p.service || '?'}`).join(', ')
    const subs = (s.subdomains || []).slice(0, 12).map(x => x.host).join(', ')
    const secrets = (s.jsEndpoints || []).filter(e => e.type === 'secret').slice(0, 5).map(e => `${e.masked} in ${e.url}`).join(' | ')
    const emails = (s.osint || []).filter(o => o.type === 'email').slice(0, 8).map(o => o.value).join(', ')
    scanContext = `Target: ${s.target}
Open ports: ${ports || 'none'}
Subdomains: ${subs || 'none'}
Critical/High vulns (${critHigh.length} total):\n${vulns || 'none'}
JS Secrets: ${secrets || 'none'}
OSINT Emails: ${emails || 'none'}
Summary: ${JSON.stringify(s.summary || {})}`
  }

  const memBlock = Object.keys(memory).length > 0
    ? `\nPERSISTED MEMORY (from previous sessions):\n${JSON.stringify(memory, null, 2)}\n`
    : ''

  return `You are an elite offensive security AI agent inside ReconMaster. You have full scan data access, browser control, and exploitation tools.

CURRENT SCAN:
${scanContext}
${memBlock}
━━━ OPERATING PROCEDURE ━━━
1. ALWAYS start every task with analyze_and_plan — it reads all scan data and gives you a prioritized attack plan
2. Work through the plan in order: CRITICAL → HIGH → MEDIUM
3. browser_navigate automatically returns the full page (text + forms + links) — no separate read step needed
4. Use propose_chain before executing 3+ sequential actions — keeps the user informed
5. save_memory for every credential, token, or confirmed vulnerability you discover
6. Use run_in_terminal (not run_command) for exploit commands, long-running tools, and anything the user should see live. Use run_command only for quick silent checks.

━━━ INTELLIGENCE RULES ━━━
• Login page found → use browser_navigate (get DOM) → browser_audit_page (find CSRF/auth structure) → browser_fill_form with discovered OSINT emails + common passwords
• JWT in JS secrets → browser_navigate to the URL → browser_execute_js: "return atob('PAYLOAD'.split('.')[1])" → check alg field → if HS256/none, test algorithm confusion
• Admin panel in dirs → navigate there, check if accessible without auth, run browser_audit_page to find all vectors
• CVE for specific version → fetch_url from exploit-db or nvd.nist.gov to get exact PoC → adapt command → run_command
• Parameter in URL → test_endpoint to automatically probe for XSS, SQLi, SSTI, LFI, open redirect
• Open Redis (6379) → run_command: redis-cli -h HOST ping → if PONG, dump with keys '*'
• Open MongoDB (27017) → run_command: mongo HOST --eval "db.adminCommand({listDatabases:1})"
• Open FTP (21) → run_command: curl ftp://HOST/ --user anonymous:anonymous
• Exposed .env/.git/.config → fetch_url to read the file content directly
• Hidden inputs with user_id/role/price → test_endpoint or browser_execute_js to manipulate values (IDOR)
• Missing CSRF token on POST form → document the exact endpoint and parameters for the report

━━━ ALWAYS ━━━
• Reference exact hostnames, ports, parameters, and CVE IDs from the actual scan data
• Report findings with specific evidence — never generic statements
• After any successful exploitation → save_memory immediately
• If no scan is active → say so, do not guess`
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function compressHistory(msgs: AgentMsg[], maxTokens: number): AgentMsg[] {
  const total = msgs.reduce((sum, m) => sum + estimateTokens(m.content), 0)
  if (total <= maxTokens) return msgs

  const HEAD = 2  // keep first 2 messages (initial task framing)
  const TAIL = 15 // keep last 15 messages (recent context)

  if (msgs.length <= HEAD + TAIL) return msgs

  const head = msgs.slice(0, HEAD)
  const tail = msgs.slice(-TAIL)
  const dropped = msgs.length - HEAD - TAIL
  const droppedTokens = msgs.slice(HEAD, -TAIL).reduce((sum, m) => sum + estimateTokens(m.content), 0)

  const summary: AgentMsg = {
    role: 'user',
    content: `[Context compressed: ${dropped} messages (~${Math.round(droppedTokens / 1000)}k tokens) omitted. Initial task and recent ${TAIL} messages preserved.]`,
  }
  return [...head, summary, ...tail]
}

let cancelStream: (() => void) | null = null
let loopAborted = false
let loopRunning = false

export function cancelAgentLoop() {
  loopAborted = true
  cancelStream?.()
  cancelStream = null
  chainAutoApproveTools.clear()
  for (const [id, resolve] of pendingApprovals) {
    resolve(false)
    pendingApprovals.delete(id)
  }
}

export async function runAgentLoop(
  history: AgentMsg[],
  scanData: ScanData | null,
  config: LoopConfig,
  ctx: AgentContext,
  callbacks: AgentCallbacks,
) {
  if (loopRunning) {
    callbacks.onError('Another agent loop is already running. Cancel the current loop before starting a new one.')
    return
  }
  loopRunning = true
  loopAborted = false
  chainAutoApproveTools.clear()

  try {
  const { providerId, model, apiKey, baseUrl, maxIterations = 15 } = config
  const adapter = getAdapter(providerId)

  // Load persisted memory and inject into system prompt
  const memory = ctx.memoryPath ? loadMemory(ctx.memoryPath) : {}
  const systemMsg: AgentMsg = { role: 'system', content: buildSystemPrompt(scanData, memory) }
  const msgs: AgentMsg[] = [systemMsg, ...compressHistory(history.filter(m => m.role !== 'system'), 60000)]

  const tools = getToolDefs()
  let iterations = 0

  while (iterations < maxIterations && !loopAborted) {
    iterations++

    // Stream response — text arrives in real-time via onChunk
    let streamResult: { text: string; toolCalls: { id: string; name: string; args: Record<string, unknown> }[] }
    try {
      streamResult = await adapter.streamWithTools(
        msgs, tools, model, apiKey, baseUrl,
        (chunk) => { if (!loopAborted) callbacks.onChunk(chunk) },
        (cancel) => { cancelStream = cancel },
      )
    } catch (err) {
      if (!loopAborted) callbacks.onError(String(err))
      return
    }

    if (loopAborted) return
    cancelStream = null

    const { text, toolCalls } = streamResult

    // Record assistant turn
    const assistantMsg: AgentMsg = {
      role: 'assistant',
      content: text,
      toolCalls: toolCalls.length ? toolCalls : undefined,
    }
    msgs.push(assistantMsg)

    // No tool calls → text was already streamed, we're done
    if (!toolCalls.length) break

    // Execute each tool call
    const toolResultMsgs: { id: string; content: string }[] = []

    for (const tc of toolCalls) {
      if (loopAborted) return

      const meta = getToolMeta(tc.name)
      const tier = meta?.tier || 'show'
      const label = meta?.label || tc.name

      callbacks.onToolCall(tc.id, tc.name, label, tc.args, tier)

      // Approval gate — approve/confirm ALWAYS wait for the user regardless of autonomousMode.
      // autonomousMode only skips 'silent' and 'show' tiers (which never enter this block).
      const needsApproval = tier === 'approve' || tier === 'confirm'
      const chainCount = chainAutoApproveTools.get(tc.name) || 0
      const chainPreApproved = needsApproval && tc.name !== 'propose_chain' && chainCount > 0

      if (needsApproval && !chainPreApproved) {
        const approved = await new Promise<boolean>((resolve) => {
          pendingApprovals.set(tc.id, resolve)
          callbacks.onApprovalRequired(tc.id, tc.name, label, tc.args, tier)
        })

        if (loopAborted) return

        if (!approved) {
          toolResultMsgs.push({ id: tc.id, content: 'User declined this action.' })
          callbacks.onToolResult(tc.id, 'Declined by user.')
          continue
        }
      } else if (chainPreApproved) {
        if (chainCount <= 1) chainAutoApproveTools.delete(tc.name)
        else chainAutoApproveTools.set(tc.name, chainCount - 1)
      }

      // Execute
      let result: string

      try {
        result = await executeTool(tc, ctx)

        // Update browser sidebar after navigation — capture screenshot too
        if (tc.name === 'browser_navigate') {
          const urlMatch = result.match(/^URL: (.+)$/m)
          if (urlMatch) {
            const url = urlMatch[1].trim()
            let screenshotB64 = ''
            try { screenshotB64 = await ctx.browserScreenshot() } catch { /* screenshot not critical */ }
            callbacks.onBrowserUpdate(url, screenshotB64)
          }
        }

        // After propose_chain is approved, auto-approve all named step tools (count occurrences)
        if (tc.name === 'propose_chain') {
          const steps = (tc.args.steps as { tool?: string }[]) || []
          for (const step of steps) {
            if (step.tool) {
              const name = step.tool as string
              chainAutoApproveTools.set(name, (chainAutoApproveTools.get(name) || 0) + 1)
            }
          }
        }

      } catch (err) {
        result = `Tool error: ${String(err)}`
        logger.error(`Tool ${tc.name} threw: ${String(err)}`)
      }

      callbacks.onToolResult(tc.id, result)
      toolResultMsgs.push({ id: tc.id, content: result.slice(0, 8000) })
    }

    msgs.push({ role: 'tool', content: '', toolResults: toolResultMsgs })
  }

  if (iterations >= maxIterations && !loopAborted) {
    callbacks.onChunk('\n\n[Reached maximum iterations. Task may be incomplete.]')
  }

  callbacks.onDone()
  } finally {
    loopRunning = false
  }
}
