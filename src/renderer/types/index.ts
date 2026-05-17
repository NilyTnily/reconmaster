export type ScanStatus = 'idle' | 'running' | 'completed' | 'error' | 'cancelled'

export type ScanPhase =
  | 'dns'
  | 'subdomains'
  | 'ports'
  | 'http'
  | 'fingerprint'
  | 'dirs'
  | 'ssl'
  | 'vulns'
  | 'osint'
  | 'crawl'
  | 'xss'
  | 'idor'

export interface DnsRecord {
  type: string
  value: string
  ttl?: number
  extra?: string
}

export interface Subdomain {
  host: string
  ip?: string
  source: string
  status?: number
  title?: string
  tech?: string[]
  asn?: string
  cdn?: string
}

export interface PortResult {
  host: string
  port: number
  protocol: string
  state: string
  service?: string
  version?: string
  banner?: string
  risk?: 'critical' | 'high' | 'medium' | 'low' | 'info'
}

export interface HttpResult {
  url: string
  status: number
  title?: string
  tech?: string[]
  redirects?: string[]
  contentLength?: number
  server?: string
  waf?: string
  headers?: Record<string, string>
  cookies?: string[]
  securityScore?: number
}

export interface DirResult {
  url: string
  status: number
  size?: number
  type?: string
  redirect?: string
  contentType?: string
  interesting?: boolean
}

export interface SslResult {
  host: string
  port: number
  grade?: string
  expiry?: string
  validFrom?: string
  issuer?: string
  subject?: string
  serial?: string
  protocols?: string[]
  ciphers?: string[]
  issues?: string[]
  daysLeft?: number
}

export interface Vulnerability {
  id: string
  name: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  host: string
  description?: string
  reference?: string
  tags?: string[]
  matched?: string
  remediation?: string
  cvss?: number
}

export interface OsintResult {
  type: 'email' | 'person' | 'ip' | 'domain' | 'linkedin' | 'other' | 'whois'
  value: string
  source: string
  extra?: string
}

export interface JsEndpoint {
  url: string
  source: string
  type: 'endpoint' | 'secret' | 'link' | 'parameter'
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info'
  match?: string
  masked?: string
}

export interface ScanSummary {
  subdomains: number
  openPorts: number
  vulnerabilities: number
  emails: number
  technologies: string[]
  criticalVulns: number
  highVulns: number
}

export interface LogLine {
  timestamp: string
  tool: string
  message: string
  level: 'info' | 'warn' | 'error' | 'success'
}

export interface ScanPhaseStatus {
  phase: ScanPhase
  status: ScanStatus
  progress?: number
  startedAt?: string
  completedAt?: string
  toolOutput?: string
}

export interface ScanResult {
  id: string
  target: string
  name: string
  status: ScanStatus
  createdAt: string
  updatedAt: string
  phases: Partial<Record<ScanPhase, ScanPhaseStatus>>
  summary: ScanSummary
  dns: DnsRecord[]
  subdomains: Subdomain[]
  ports: PortResult[]
  http: HttpResult[]
  dirs: DirResult[]
  ssl: SslResult[]
  vulnerabilities: Vulnerability[]
  osint: OsintResult[]
  jsEndpoints: JsEndpoint[]
  logs: LogLine[]
  xssResults: XssResult[]
  idorResults: IdorResult[]
  weaponStatuses?: Record<string, WeaponStatus>
  weaponNotes?: Record<string, string>
  exploitResults?: Record<string, { confirmed: boolean; evidence: string; log?: string }>
  aiAnalysis?: AiAnalysis
}

export interface XssResult {
  url: string
  parameter: string
  payload: string
  type: 'reflected' | 'dom' | 'stored' | 'header'
  severity: 'critical' | 'high' | 'medium' | 'low'
  evidence?: string
  remediation?: string
  tool?: string
}

export interface IdorResult {
  url: string
  parameter: string
  type: 'numeric' | 'uuid' | 'filename' | 'path-traversal'
  originalValue: string
  testedValue: string
  evidence: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  statusDiff?: string
  remediation?: string
}

export type WeaponStatus = 'untested' | 'testing' | 'confirmed' | 'not-vulnerable' | 'reported'

export interface WeaponizationItem {
  id: string
  vulnName: string
  host: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  adjustedSeverity?: 'critical' | 'high' | 'medium' | 'low' | 'info'
  adjustedReason?: string
  category:
    | 'rce' | 'sqli' | 'xss' | 'ssrf' | 'lfi' | 'idor' | 'crlf'
    | 'open-redirect' | 'takeover' | 'network' | 'credential-harvest'
    | 'auth-bypass' | 'brute-force' | 'post-exploit'
    | 'api-abuse' | 'waf-bypass' | 'ssti' | 'xxe' | 'deserialize'
    | 'jwt' | 'oauth' | 'prototype-pollution' | 'supply-chain'
    | 'cloud' | 'business-logic'
  tool: string
  command?: string
  description: string
  warning?: string
  cve?: string
  evidence?: string
  parameter?: string
  chainIds?: string[]
}

export interface AttackerConfig {
  lhost: string
  lport: string
  c2domain: string
  interactshUrl: string
  sessionCookie: string
  customHeaders: string
}

export interface AiSection {
  title: string
  icon: string
  content: string
}

export interface AiAnalysis {
  sections: AiSection[]
  generatedAt: string
  model: string
}

export interface AttackChain {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium'
  steps: { weaponId: string; label: string; action: string }[]
  impact: string
}

// ── AI Agent types ────────────────────────────────────────────────────────────

export interface AiProviderConfig {
  id: string
  providerId: string
  label: string
  apiKey?: string
  baseUrl?: string
  model: string
  connectedAt: string
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

export type ToolTier = 'silent' | 'show' | 'approve' | 'confirm'

export interface ToolCallCard {
  id: string
  name: string
  label: string
  args: Record<string, unknown>
  result?: string
  screenshotB64?: string
  status: 'running' | 'waiting-approval' | 'approved' | 'denied' | 'done' | 'error'
  tier: ToolTier
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCallCard[]
  timestamp: string
  streaming?: boolean
}

export interface BrowserSession {
  active: boolean
  url: string
  screenshotB64?: string
}

export interface ToolStatus {
  name: string
  exe: string
  desc: string
  installed: boolean
  enabled: boolean
  sizeMB?: number
  downloadUrl?: string
}

export interface IpcScanEvent {
  scanId: string
  phase?: ScanPhase
  type: 'log' | 'result' | 'phase-start' | 'phase-end' | 'scan-complete' | 'scan-error'
  data: unknown
}
