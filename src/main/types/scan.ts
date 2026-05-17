export interface Vulnerability {
  name: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  host: string
  id?: string
  tags?: string[]
  matched?: string
}

export interface Port {
  host: string
  port: number
  state: 'open' | 'closed' | 'filtered'
  service?: string
}

export interface Subdomain {
  host: string
  ips?: string[]
}

export interface HttpPage {
  url: string
  status: number
  title?: string
  technologies?: string[]
}

export interface SslInfo {
  host: string
  issues?: string[]
  daysLeft?: number
}

export interface JsEndpoint {
  url: string
  type: string
  masked?: string
  severity?: string
}

export interface OsintEntry {
  type: string
  value: string
}

export interface DirEntry {
  url: string
  status: number
}

export interface ScanData {
  target: string
  summary?: Record<string, unknown>
  vulnerabilities?: Vulnerability[]
  ports?: Port[]
  subdomains?: Subdomain[]
  http?: HttpPage[]
  ssl?: SslInfo[]
  dirs?: DirEntry[]
  jsEndpoints?: JsEndpoint[]
  osint?: OsintEntry[]
  attackerConfig?: Record<string, string>
  weaponList?: unknown[]
  [key: string]: unknown
}
