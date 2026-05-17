import https from 'https'
import http from 'http'
import { logger } from '../lib/logger'

// ── Core types ────────────────────────────────────────────────────────────────

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface AgentMsg {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolResults?: { id: string; content: string }[]
}

export interface ProviderDef {
  id: string
  name: string
  defaultBaseUrl: string
  authType: 'bearer' | 'x-api-key' | 'query' | 'none'
  adapterType: 'openai' | 'claude' | 'gemini'
  needsBaseUrl: boolean
  staticModels: string[]
  modelsEndpoint?: string
}

export interface ProviderAdapter {
  /** Stream a response, calling onChunk for each text delta. Returns full text + any tool calls. */
  streamWithTools(
    msgs: AgentMsg[],
    tools: ToolDef[],
    model: string,
    apiKey: string,
    baseUrl: string | undefined,
    onChunk: (text: string) => void,
    onCancel: (cancel: () => void) => void,
  ): Promise<{ text: string; toolCalls: ToolCall[] }>

  fetchModels(apiKey: string, baseUrl?: string): Promise<string[]>
}

// ── Provider registry ─────────────────────────────────────────────────────────

export const PROVIDERS: ProviderDef[] = [
  { id: 'claude',       name: 'Claude (Anthropic)',    defaultBaseUrl: 'https://api.anthropic.com',              authType: 'x-api-key', adapterType: 'claude', needsBaseUrl: false,
    staticModels: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'], modelsEndpoint: '/v1/models' },
  { id: 'openai',       name: 'ChatGPT (OpenAI)',       defaultBaseUrl: 'https://api.openai.com',                 authType: 'bearer',    adapterType: 'openai', needsBaseUrl: false,
    staticModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1'], modelsEndpoint: '/v1/models' },
  { id: 'grok',         name: 'Grok (xAI)',             defaultBaseUrl: 'https://api.x.ai',                       authType: 'bearer',    adapterType: 'openai', needsBaseUrl: false,
    staticModels: ['grok-3', 'grok-3-mini', 'grok-2-1212'] },
  { id: 'deepseek',     name: 'DeepSeek',               defaultBaseUrl: 'https://api.deepseek.com',               authType: 'bearer',    adapterType: 'openai', needsBaseUrl: false,
    staticModels: ['deepseek-chat', 'deepseek-reasoner'], modelsEndpoint: '/v1/models' },
  { id: 'openrouter',   name: 'OpenRouter',             defaultBaseUrl: 'https://openrouter.ai/api',              authType: 'bearer',    adapterType: 'openai', needsBaseUrl: false,
    staticModels: [], modelsEndpoint: '/v1/models' },
  { id: 'groq',         name: 'Groq',                   defaultBaseUrl: 'https://api.groq.com/openai',            authType: 'bearer',    adapterType: 'openai', needsBaseUrl: false,
    staticModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'], modelsEndpoint: '/v1/models' },
  { id: 'mistral',      name: 'Mistral',                defaultBaseUrl: 'https://api.mistral.ai',                 authType: 'bearer',    adapterType: 'openai', needsBaseUrl: false,
    staticModels: ['mistral-large-latest', 'mistral-medium-latest', 'codestral-latest'], modelsEndpoint: '/v1/models' },
  { id: 'together',     name: 'Together AI',            defaultBaseUrl: 'https://api.together.xyz',               authType: 'bearer',    adapterType: 'openai', needsBaseUrl: false,
    staticModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'], modelsEndpoint: '/v1/models' },
  { id: 'perplexity',   name: 'Perplexity',             defaultBaseUrl: 'https://api.perplexity.ai',              authType: 'bearer',    adapterType: 'openai', needsBaseUrl: false,
    staticModels: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online'] },
  { id: 'gemini',       name: 'Gemini (Google)',         defaultBaseUrl: 'https://generativelanguage.googleapis.com', authType: 'query',  adapterType: 'gemini', needsBaseUrl: false,
    staticModels: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro'], modelsEndpoint: '/v1beta/models' },
  { id: 'ollama',       name: 'Ollama (Local)',          defaultBaseUrl: 'http://localhost:11434',                 authType: 'none',      adapterType: 'openai', needsBaseUrl: true,
    staticModels: [], modelsEndpoint: '/api/tags' },
  { id: 'lmstudio',     name: 'LM Studio (Local)',       defaultBaseUrl: 'http://localhost:1234',                  authType: 'none',      adapterType: 'openai', needsBaseUrl: true,
    staticModels: [], modelsEndpoint: '/v1/models' },
  { id: 'custom',       name: 'Custom (OpenAI-compat)',  defaultBaseUrl: '',                                       authType: 'bearer',    adapterType: 'openai', needsBaseUrl: true,
    staticModels: [], modelsEndpoint: '/v1/models' },
]

// ── HTTP helpers ──────────────────────────────────────────────────────────────

export function httpRequest(
  rawUrl: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(rawUrl)
    const lib = url.protocol === 'https:' ? https : http
    const opts: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    }
    if (body) (opts.headers as Record<string, string>)['Content-Length'] = String(Buffer.byteLength(body))
    const req = lib.request(opts, (res) => {
      let data = ''
      res.on('data', (c: Buffer) => { data += c.toString() })
      res.on('end', () => resolve({ status: res.statusCode || 0, data }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

export function httpStream(
  rawUrl: string,
  headers: Record<string, string>,
  body: string,
  onLine: (line: string) => void,
  onEnd: () => void,
  onError: (e: string) => void,
): () => void {
  let aborted = false
  const url = new URL(rawUrl)
  const lib = url.protocol === 'https:' ? https : http
  const opts: https.RequestOptions = {
    hostname: url.hostname,
    port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)), ...headers },
  }
  const req = lib.request(opts, (res) => {
    let buf = ''
    res.on('data', (chunk: Buffer) => {
      if (aborted) return
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) onLine(line)
    })
    res.on('end', () => { if (!aborted) onEnd() })
    res.on('error', (e: Error) => { if (!aborted) onError(e.message) })
  })
  req.on('error', (e: Error) => { if (!aborted) onError(e.message) })
  req.write(body)
  req.end()
  return () => { aborted = true; req.destroy() }
}

// ── OpenAI-compatible adapter ─────────────────────────────────────────────────

export class OpenAIAdapter implements ProviderAdapter {
  private buildMsgs(msgs: AgentMsg[]) {
    const out: unknown[] = []
    for (const m of msgs) {
      if (m.role === 'tool' && m.toolResults) {
        for (const tr of m.toolResults)
          out.push({ role: 'tool', tool_call_id: tr.id, content: tr.content })
      } else if (m.toolCalls?.length) {
        out.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id, type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        })
      } else {
        out.push({ role: m.role, content: m.content })
      }
    }
    return out
  }

  private buildTools(tools: ToolDef[]) {
    return tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }))
  }

  streamWithTools(
    msgs: AgentMsg[], tools: ToolDef[], model: string, apiKey: string, baseUrl: string | undefined,
    onChunk: (text: string) => void, onCancel: (cancel: () => void) => void,
  ): Promise<{ text: string; toolCalls: ToolCall[] }> {
    const base = baseUrl || 'https://api.openai.com'
    const body = JSON.stringify({
      model,
      messages: this.buildMsgs(msgs),
      ...(tools.length ? { tools: this.buildTools(tools), tool_choice: 'auto' } : {}),
      stream: true,
      max_tokens: 8192,
    })
    const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}

    return new Promise((resolve, reject) => {
      let text = ''
      const tcBufs: Record<number, { id: string; name: string; argsBuf: string }> = {}

      const cancel = httpStream(`${base}/v1/chat/completions`, headers, body,
        (line) => {
          if (!line.startsWith('data: ')) return
          const d = line.slice(6).trim()
          if (d === '[DONE]') return
          try {
            const json = JSON.parse(d)
            const delta = json.choices?.[0]?.delta
            if (!delta) return
            if (delta.content) { text += delta.content; onChunk(delta.content) }
            for (const tc of (delta.tool_calls || [])) {
              if (!tcBufs[tc.index]) tcBufs[tc.index] = { id: '', name: '', argsBuf: '' }
              const buf = tcBufs[tc.index]
              if (tc.id) buf.id = tc.id
              if (tc.function?.name) buf.name += tc.function.name
              if (tc.function?.arguments) buf.argsBuf += tc.function.arguments
            }
          } catch (e) { logger.warn(`SSE parse error: ${String(e)}`) }
        },
        () => {
          const toolCalls: ToolCall[] = Object.values(tcBufs).map(buf => ({
            id: buf.id || `tc_${Date.now()}`,
            name: buf.name,
            args: (() => { try { return JSON.parse(buf.argsBuf || '{}') } catch { return {} } })(),
          }))
          resolve({ text, toolCalls })
        },
        (err) => reject(new Error(err)),
      )
      onCancel(cancel)
    })
  }

  async fetchModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    const base = baseUrl || 'https://api.openai.com'
    try {
      if (base.includes('11434')) {
        const r = await httpRequest(`${base}/api/tags`, 'GET', {})
        return ((JSON.parse(r.data) as { models?: { name: string }[] }).models || []).map(m => m.name)
      }
      const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      const r = await httpRequest(`${base}/v1/models`, 'GET', headers)
      return ((JSON.parse(r.data) as { data?: { id: string }[] }).data || [])
        .map(m => m.id)
        .filter((id: string) => !['embed', 'tts', 'whisper', 'dall', 'moderation'].some(x => id.includes(x)))
        .sort()
    } catch { return [] }
  }
}

// ── Claude adapter ────────────────────────────────────────────────────────────

export class ClaudeAdapter implements ProviderAdapter {
  private buildMsgs(msgs: AgentMsg[]) {
    const out: unknown[] = []
    for (const m of msgs) {
      if (m.role === 'system') continue
      if (m.role === 'tool' && m.toolResults) {
        out.push({
          role: 'user',
          content: m.toolResults.map(tr => ({ type: 'tool_result', tool_use_id: tr.id, content: tr.content })),
        })
      } else if (m.toolCalls?.length) {
        const content: unknown[] = []
        if (m.content) content.push({ type: 'text', text: m.content })
        for (const tc of m.toolCalls)
          content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args })
        out.push({ role: 'assistant', content })
      } else {
        out.push({ role: m.role, content: m.content })
      }
    }
    return out
  }

  private getSystem(msgs: AgentMsg[]) {
    return msgs.find(m => m.role === 'system')?.content || ''
  }

  streamWithTools(
    msgs: AgentMsg[], tools: ToolDef[], model: string, apiKey: string, baseUrl: string | undefined,
    onChunk: (text: string) => void, onCancel: (cancel: () => void) => void,
  ): Promise<{ text: string; toolCalls: ToolCall[] }> {
    const base = baseUrl || 'https://api.anthropic.com'
    const systemText = this.getSystem(msgs)
    const body = JSON.stringify({
      model, max_tokens: 8192, stream: true,
      ...(systemText ? { system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }] } : {}),
      messages: this.buildMsgs(msgs),
      ...(tools.length ? { tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}),
    })

    return new Promise((resolve, reject) => {
      let text = ''
      const toolCalls: ToolCall[] = []
      let currentTool: { id: string; name: string; argsBuf: string } | null = null

      const cancel = httpStream(
        `${base}/v1/messages`,
        { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'prompt-caching-2024-07-31' },
        body,
        (line) => {
          if (!line.startsWith('data: ')) return
          try {
            const d = JSON.parse(line.slice(6))
            if (d.type === 'content_block_start') {
              if (d.content_block?.type === 'tool_use') {
                currentTool = { id: d.content_block.id, name: d.content_block.name, argsBuf: '' }
              }
            } else if (d.type === 'content_block_delta') {
              if (d.delta?.type === 'text_delta' && d.delta.text) {
                text += d.delta.text
                onChunk(d.delta.text)
              } else if (d.delta?.type === 'input_json_delta' && currentTool) {
                currentTool.argsBuf += d.delta.partial_json || ''
              }
            } else if (d.type === 'content_block_stop') {
              if (currentTool) {
                toolCalls.push({
                  id: currentTool.id,
                  name: currentTool.name,
                  args: (() => { try { return JSON.parse(currentTool!.argsBuf || '{}') } catch { return {} } })(),
                })
                currentTool = null
              }
            }
          } catch { /* ignore */ }
        },
        () => resolve({ text, toolCalls }),
        (err) => reject(new Error(err)),
      )
      onCancel(cancel)
    })
  }

  async fetchModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    const base = baseUrl || 'https://api.anthropic.com'
    try {
      const r = await httpRequest(`${base}/v1/models`, 'GET', { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' })
      return ((JSON.parse(r.data) as { data?: { id: string }[] }).data || []).map(m => m.id).sort().reverse()
    } catch { return ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] }
  }
}

// ── Gemini adapter ────────────────────────────────────────────────────────────

export class GeminiAdapter implements ProviderAdapter {
  private buildContents(msgs: AgentMsg[]) {
    const out: unknown[] = []
    for (const m of msgs) {
      if (m.role === 'system') continue
      if (m.role === 'tool' && m.toolResults) {
        out.push({
          role: 'user',
          parts: m.toolResults.map(tr => ({ functionResponse: { name: tr.id, response: { result: tr.content } } })),
        })
      } else if (m.toolCalls?.length) {
        out.push({
          role: 'model',
          parts: m.toolCalls.map(tc => ({ functionCall: { name: tc.name, args: tc.args } })),
        })
      } else {
        out.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })
      }
    }
    return out
  }

  streamWithTools(
    msgs: AgentMsg[], tools: ToolDef[], model: string, apiKey: string, _baseUrl: string | undefined,
    onChunk: (text: string) => void, onCancel: (cancel: () => void) => void,
  ): Promise<{ text: string; toolCalls: ToolCall[] }> {
    const systemMsg = msgs.find(m => m.role === 'system')?.content
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`
    const body = JSON.stringify({
      ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg }] } } : {}),
      contents: this.buildContents(msgs),
      ...(tools.length ? {
        tools: [{ function_declarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
        tool_config: { function_calling_config: { mode: 'AUTO' } },
      } : {}),
      generationConfig: { maxOutputTokens: 8192 },
    })

    return new Promise((resolve, reject) => {
      let text = ''
      const toolCalls: ToolCall[] = []
      let tcIdx = 0

      const cancel = httpStream(url, {}, body,
        (line) => {
          if (!line.startsWith('data: ')) return
          try {
            const parts = JSON.parse(line.slice(6)).candidates?.[0]?.content?.parts || []
            for (const p of parts) {
              if (p.text) { text += p.text; onChunk(p.text) }
              if (p.functionCall) {
                toolCalls.push({ id: `gemini_${tcIdx++}`, name: p.functionCall.name, args: p.functionCall.args || {} })
              }
            }
          } catch { /* ignore */ }
        },
        () => resolve({ text, toolCalls }),
        (err) => reject(new Error(err)),
      )
      onCancel(cancel)
    })
  }

  async fetchModels(apiKey: string): Promise<string[]> {
    try {
      const r = await httpRequest(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, 'GET', {})
      return ((JSON.parse(r.data) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }).models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''))
        .sort()
    } catch { return ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro'] }
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

const _openai = new OpenAIAdapter()
const _claude = new ClaudeAdapter()
const _gemini = new GeminiAdapter()

export function getAdapter(providerId: string): ProviderAdapter {
  const def = PROVIDERS.find(p => p.id === providerId)
  if (!def) return _openai
  if (def.adapterType === 'claude') return _claude
  if (def.adapterType === 'gemini') return _gemini
  return _openai
}

export function getProviderDef(id: string): ProviderDef | undefined {
  return PROVIDERS.find(p => p.id === id)
}
