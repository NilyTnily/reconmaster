import { ScanResult } from '../types'

export function generateMarkdownReport(scan: ScanResult): string {
  const lines: string[] = []
  const ts = new Date(scan.createdAt).toLocaleString()
  const SEV_EMOJI: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', info: '🔵' }

  lines.push(`# ReconMaster Scan Report: ${scan.target}`)
  lines.push(``)
  lines.push(`**Target:** \`${scan.target}\`  `)
  lines.push(`**Scan Name:** ${scan.name}  `)
  lines.push(`**Status:** ${scan.status}  `)
  lines.push(`**Started:** ${ts}  `)
  lines.push(`**Generated:** ${new Date().toLocaleString()}`)
  lines.push(``)

  // Summary
  lines.push(`## Summary`)
  lines.push(``)
  lines.push(`| Metric | Count |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Subdomains | ${scan.summary.subdomains} |`)
  lines.push(`| Open Ports | ${scan.summary.openPorts} |`)
  lines.push(`| Vulnerabilities | ${scan.summary.vulnerabilities} |`)
  lines.push(`| Critical | ${scan.summary.criticalVulns} |`)
  lines.push(`| High | ${scan.summary.highVulns} |`)
  lines.push(`| Emails / OSINT | ${scan.summary.emails} |`)
  lines.push(`| Technologies | ${scan.summary.technologies.join(', ') || 'None'} |`)
  lines.push(``)

  // DNS
  if (scan.dns.length > 0) {
    lines.push(`## DNS Records (${scan.dns.length})`)
    lines.push(``)
    lines.push(`| Type | Value | TTL |`)
    lines.push(`|------|-------|-----|`)
    for (const r of scan.dns) {
      lines.push(`| \`${r.type}\` | ${r.value} | ${r.ttl ?? '—'} |`)
    }
    lines.push(``)
  }

  // Subdomains
  if (scan.subdomains.length > 0) {
    lines.push(`## Subdomains (${scan.subdomains.length})`)
    lines.push(``)
    lines.push(`| Host | IP | Source |`)
    lines.push(`|------|----|--------|`)
    for (const s of scan.subdomains) {
      lines.push(`| \`${s.host}\` | ${s.ip || '—'} | ${s.source} |`)
    }
    lines.push(``)
  }

  // Ports
  if (scan.ports.length > 0) {
    lines.push(`## Open Ports (${scan.ports.filter(p => p.state === 'open').length})`)
    lines.push(``)
    lines.push(`| Host | Port | Protocol | Service | Version |`)
    lines.push(`|------|------|----------|---------|---------|`)
    for (const p of scan.ports.filter(p => p.state === 'open')) {
      lines.push(`| \`${p.host}\` | **${p.port}** | ${p.protocol} | ${p.service || '—'} | ${p.version || '—'} |`)
    }
    lines.push(``)
  }

  // HTTP
  if (scan.http.length > 0) {
    lines.push(`## Web Hosts (${scan.http.length})`)
    lines.push(``)
    lines.push(`| Status | URL | Title | Server | Technologies |`)
    lines.push(`|--------|-----|-------|--------|--------------|`)
    for (const h of scan.http) {
      const tech = (h.tech || []).join(', ')
      lines.push(`| **${h.status}** | \`${h.url}\` | ${h.title || '—'} | ${h.server || '—'} | ${tech || '—'} |`)
    }
    lines.push(``)
  }

  // SSL
  if (scan.ssl.length > 0) {
    lines.push(`## SSL/TLS (${scan.ssl.length})`)
    lines.push(``)
    lines.push(`| Host | Port | Expires | Issuer | Protocols | Issues |`)
    lines.push(`|------|------|---------|--------|-----------|--------|`)
    for (const s of scan.ssl) {
      const issues = (s.issues || []).join('; ') || '✅ None'
      lines.push(`| \`${s.host}\` | ${s.port} | ${s.expiry || '—'} | ${s.issuer || '—'} | ${(s.protocols || []).join(', ') || '—'} | ${issues} |`)
    }
    lines.push(``)
  }

  // Directories
  if (scan.dirs.length > 0) {
    lines.push(`## Directories & Files (${scan.dirs.length})`)
    lines.push(``)
    lines.push(`| Status | URL | Size |`)
    lines.push(`|--------|-----|------|`)
    for (const d of scan.dirs) {
      lines.push(`| **${d.status}** | \`${d.url}\` | ${d.size ? `${d.size}B` : '—'} |`)
    }
    lines.push(``)
  }

  // Vulnerabilities
  if (scan.vulnerabilities.length > 0) {
    lines.push(`## Vulnerabilities (${scan.vulnerabilities.length})`)
    lines.push(``)
    for (const sev of ['critical', 'high', 'medium', 'low', 'info']) {
      const vulns = scan.vulnerabilities.filter(v => v.severity === sev)
      if (vulns.length === 0) continue
      lines.push(`### ${SEV_EMOJI[sev] || ''} ${sev.charAt(0).toUpperCase() + sev.slice(1)} (${vulns.length})`)
      lines.push(``)
      lines.push(`| ID | Name | Host | Description |`)
      lines.push(`|----|------|------|-------------|`)
      for (const v of vulns) {
        lines.push(`| \`${v.id}\` | **${v.name}** | \`${v.host}\` | ${v.description || '—'} |`)
      }
      lines.push(``)
    }
  }

  // OSINT
  if (scan.osint.length > 0) {
    lines.push(`## OSINT Results (${scan.osint.length})`)
    lines.push(``)
    lines.push(`| Type | Value | Source |`)
    lines.push(`|------|-------|--------|`)
    for (const o of scan.osint) {
      const val = o.value.length > 100 ? o.value.slice(0, 100) + '…' : o.value
      lines.push(`| ${o.type} | ${val} | ${o.source} |`)
    }
    lines.push(``)
  }

  // JS Endpoints
  if (scan.jsEndpoints.length > 0) {
    lines.push(`## JS / Endpoints (${scan.jsEndpoints.length})`)
    lines.push(``)
    lines.push(`| Type | Severity | URL | Match |`)
    lines.push(`|------|----------|-----|-------|`)
    for (const e of scan.jsEndpoints) {
      lines.push(`| ${e.type} | ${e.severity || '—'} | \`${e.url}\` | ${e.match || '—'} |`)
    }
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(`*Generated by ReconMaster*`)

  return lines.join('\n')
}
