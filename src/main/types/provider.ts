export interface ProviderEntry {
  id: string
  providerId: string
  apiKey: string
  baseUrl?: string
  model: string
  label: string
  connectedAt?: string
}

export interface ProviderState {
  providers: ProviderEntry[]
  activeId: string | null
}
