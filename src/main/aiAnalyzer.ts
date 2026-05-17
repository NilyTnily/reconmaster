import { httpStream } from './providers/index'

export interface ScanBrief {
  target: string
  ports: string
  tech: string
  vulns: string
  dns: string
  ssl: string
  xss: string
  idor: string
  secrets: string
  emails: string
  subdomains: string
  exposedFiles: string
  existingWeapons: string
}

type AnyRecord = Record<string, unknown>

export function buildScanBrief(scan: Record<string, unknown>): string {
  const ports = ((scan.ports as AnyRecord[]) || [])
    .filter(p => p.state === 'open')
    .map(p => `${p.host}:${p.port}/${p.service || 'unknown'}${p.version ? ' ' + String(p.version) : ''}`)
    .join(', ') || 'none'

  const allTech = new Set<string>()
  for (const h of (scan.http as AnyRecord[]) || []) {
    for (const t of (h.tech as string[]) || []) allTech.add(t)
  }
  const tech = Array.from(allTech).join(', ') || 'unknown'

  const vulns = ((scan.vulnerabilities as AnyRecord[]) || [])
    .map(v => `[${v.severity}] ${v.name} @ ${v.host}`)
    .join('\n') || 'none'

  const dnsRecords = (scan.dns as AnyRecord[]) || []
  const dns = dnsRecords.map(r => `${r.type}: ${r.value}`).join(', ')
  const hasSPF = dnsRecords.some(r => r.type === 'TXT' && typeof r.value === 'string' && r.value.includes('v=spf1'))
  const hasDMARC = dnsRecords.some(r => r.type === 'DMARC')
  const dnsInfo = `SPF: ${hasSPF ? 'yes' : 'NO'}, DMARC: ${hasDMARC ? 'yes' : 'NO'}, records: ${dns.slice(0, 300)}`

  const ssl = ((scan.ssl as AnyRecord[]) || [])
    .map(s => `${s.host}: ${(s.protocols as string[] | undefined)?.join('/') || '?'}, issues: ${((s.issues as string[]) || []).join('; ') || 'none'}`)
    .join('; ') || 'none'

  const xss = ((scan.xssResults as AnyRecord[]) || [])
    .map(x => `${x.type} XSS in ${x.parameter} @ ${x.url}`)
    .join('; ') || 'none'

  const idor = ((scan.idorResults as AnyRecord[]) || [])
    .map(r => `${r.type} IDOR: ${r.parameter} @ ${r.url}`)
    .join('; ') || 'none'

  const secrets = ((scan.jsEndpoints as AnyRecord[]) || [])
    .filter(e => e.type === 'secret')
    .map(e => `${e.masked || e.match} in ${e.url}`)
    .join('; ') || 'none'

  const emails = ((scan.osint as AnyRecord[]) || [])
    .filter(o => o.type === 'email')
    .map(o => o.value)
    .join(', ') || 'none'

  const subdomains = ((scan.subdomains as AnyRecord[]) || [])
    .slice(0, 20)
    .map(s => `${s.host}(${s.status || '?'})`)
    .join(', ') || 'none'

  const exposedFiles = ((scan.vulnerabilities as AnyRecord[]) || [])
    .filter(v => ['exposure', 'config', 'credential', 'git', 'backup'].some(t => ((v.tags as string[]) || []).includes(t)))
    .map(v => `${v.name} @ ${v.host}`)
    .join('; ') || 'none'

  return `TARGET: ${scan.target}
OPEN PORTS: ${ports}
TECH STACK: ${tech}
VULNERABILITIES:
${vulns}
DNS: ${dnsInfo}
SSL: ${ssl}
XSS: ${xss}
IDOR: ${idor}
JS SECRETS: ${secrets}
OSINT EMAILS: ${emails}
SUBDOMAINS (sample): ${subdomains}
EXPOSED FILES/CONFIGS: ${exposedFiles}`
}

// Static analyst persona — cached on Claude to save tokens on repeat calls
const ANALYST_SYSTEM = `You are an elite offensive security analyst reviewing automated recon scan results. Analyze these findings and produce a structured attack report.

Respond in exactly this format with these 6 sections. Be specific to the actual findings — no generic advice.

## ⛓️ ATTACK CHAINS
Identify 2-4 multi-step kill chains connecting the findings above. Each chain must reference specific hosts/ports/vulnerabilities found. Format:
**Chain [N]: [Title] — [CRITICAL/HIGH/MEDIUM]**
Step 1 → Step 2 → Step 3 (etc.)
Impact: [what attacker achieves]

## 🎯 VERSION CVEs
For each detected version/software, list matching CVEs with working PoC commands targeting this specific host. Only include CVEs with public exploits. Format:
**[Software Version]** → CVE-XXXX-XXXXX (CVSS X.X)
\`\`\`
[exact exploit command for this target]
\`\`\`

## 💉 CUSTOM PAYLOADS
Generate payloads tailored to the exact tech stack detected. Not generic — specific to what was found. Include: SSTI payloads if template engines detected, JWT cracking if JWT found, WAF-specific bypass encodings, deserialization gadget chains for detected frameworks.

## 🔗 NON-OBVIOUS CHAINS
Attack paths that require reasoning across multiple findings that a rule-based system would miss. Think: credential reuse, timing attacks, trust relationships, chained auth bypasses.

## 💼 BUSINESS IMPACT
For the top 3 critical findings: what does successful exploitation mean in business terms? Data breach scope, compliance violations (GDPR/PCI-DSS/HIPAA), service disruption, reputational damage. Keep it concise and boardroom-ready.

## 📄 PENTEST REPORT DRAFT
Write a professional executive summary (3-4 sentences) and findings section (top 5 issues with Description, Evidence, Impact, Remediation). Use formal pentest report language. Reference actual hostnames and findings from the scan data.`

export function buildPrompt(brief: string): string {
  return `SCAN DATA:\n${brief}`
}

export function streamAnalysis(
  apiKey: string,
  model: string,
  prompt: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): () => void {
  const body = JSON.stringify({
    model,
    max_tokens: 8192,
    stream: true,
    system: [{ type: 'text', text: ANALYST_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt }],
  })

  return httpStream(
    'https://api.anthropic.com/v1/messages',
    {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body,
    (line) => {
      if (!line.startsWith('data: ')) return
      try {
        const parsed = JSON.parse(line.slice(6)) as Record<string, unknown>
        if (parsed.type === 'content_block_delta') {
          const delta = parsed.delta as Record<string, unknown> | undefined
          if (delta?.type === 'text_delta') onChunk(delta.text as string)
        }
      } catch { /* ignore malformed lines */ }
    },
    onDone,
    onError,
  )
}
