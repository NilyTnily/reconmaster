import { create } from 'zustand'
import { AiProviderConfig, ProviderDef, ChatMessage, ToolCallCard, BrowserSession } from '../types'

interface AiState {
  // Provider
  providerDefs: ProviderDef[]
  savedProviders: AiProviderConfig[]
  activeProviderId: string | null
  availableModels: string[]
  fetchingModels: boolean

  // Chat — keyed by scanId (or 'global')
  chatHistories: Record<string, ChatMessage[]>
  activeChatId: string | null
  isStreaming: boolean
  streamingMsgId: string | null

  // Browser session
  browser: BrowserSession

  // Connection modal
  connectionModalOpen: boolean

  // Agent control
  autonomousMode: boolean
  maxIterations: number

  // Actions
  setProviderDefs: (defs: ProviderDef[]) => void
  setSavedProviders: (providers: AiProviderConfig[], activeId: string | null) => void
  setAvailableModels: (models: string[]) => void
  setFetchingModels: (v: boolean) => void
  setActiveProvider: (id: string | null) => void
  setConnectionModalOpen: (open: boolean) => void
  setAutonomousMode: (v: boolean) => void
  setMaxIterations: (v: number) => void

  addUserMessage: (chatId: string, content: string) => string
  startAssistantMessage: (chatId: string) => string
  appendChunk: (chatId: string, msgId: string, text: string) => void
  finalizeMessage: (chatId: string, msgId: string) => void
  addToolCall: (chatId: string, msgId: string, tc: ToolCallCard) => void
  updateToolCall: (chatId: string, msgId: string, tcId: string, update: Partial<ToolCallCard>) => void
  setStreaming: (v: boolean, msgId?: string) => void
  setBrowserSession: (b: Partial<BrowserSession>) => void
  setActiveChatId: (id: string) => void
  clearChat: (chatId: string) => void

  setChatHistory: (chatId: string, messages: ChatMessage[]) => void
  getHistory: (chatId: string) => ChatMessage[]
}

function genId() {
  return Math.random().toString(36).slice(2, 11)
}

// Batch rapid SSE chunk updates into a single setState per ~16ms frame
const _chunkBuf = new Map<string, string>()  // `chatId\x00msgId` → accumulated text
let _chunkFlushId: ReturnType<typeof setTimeout> | null = null

export const useAiStore = create<AiState>((set, get) => ({
  providerDefs: [],
  savedProviders: [],
  activeProviderId: null,
  availableModels: [],
  fetchingModels: false,
  chatHistories: {},
  activeChatId: null,
  isStreaming: false,
  streamingMsgId: null,
  browser: { active: false, url: '' },
  connectionModalOpen: false,
  autonomousMode: false,
  maxIterations: 15,

  setProviderDefs: (defs) => set({ providerDefs: defs }),
  setSavedProviders: (providers, activeId) => set({ savedProviders: providers, activeProviderId: activeId }),
  setAvailableModels: (models) => set({ availableModels: models }),
  setFetchingModels: (v) => set({ fetchingModels: v }),
  setActiveProvider: (id) => set({ activeProviderId: id }),
  setConnectionModalOpen: (open) => set({ connectionModalOpen: open }),
  setAutonomousMode: (v) => set({ autonomousMode: v }),
  setMaxIterations: (v) => set({ maxIterations: v }),

  addUserMessage: (chatId, content) => {
    const id = genId()
    set(s => ({
      chatHistories: {
        ...s.chatHistories,
        [chatId]: [...(s.chatHistories[chatId] || []), {
          id, role: 'user', content, timestamp: new Date().toISOString(),
        }],
      },
    }))
    return id
  },

  startAssistantMessage: (chatId) => {
    const id = genId()
    set(s => ({
      chatHistories: {
        ...s.chatHistories,
        [chatId]: [...(s.chatHistories[chatId] || []), {
          id, role: 'assistant', content: '', timestamp: new Date().toISOString(), streaming: true, toolCalls: [],
        }],
      },
    }))
    return id
  },

  appendChunk: (chatId, msgId, text) => {
    const key = `${chatId}\x00${msgId}`
    _chunkBuf.set(key, (_chunkBuf.get(key) ?? '') + text)
    if (_chunkFlushId === null) {
      _chunkFlushId = setTimeout(() => {
        _chunkFlushId = null
        const pending = new Map(_chunkBuf)
        _chunkBuf.clear()
        set(s => {
          let histories = s.chatHistories
          for (const [k, accumulated] of pending) {
            const sep = k.indexOf('\x00')
            const cId = k.slice(0, sep)
            const mId = k.slice(sep + 1)
            const hist = histories[cId] || []
            histories = { ...histories, [cId]: hist.map(m => m.id === mId ? { ...m, content: m.content + accumulated } : m) }
          }
          return { chatHistories: histories }
        })
      }, 16)
    }
  },

  finalizeMessage: (chatId, msgId) => {
    if (_chunkFlushId !== null) {
      clearTimeout(_chunkFlushId)
      _chunkFlushId = null
    }
    const pending = new Map(_chunkBuf)
    _chunkBuf.clear()
    set(s => {
      let histories = s.chatHistories
      for (const [k, accumulated] of pending) {
        const sep = k.indexOf('\x00')
        const cId = k.slice(0, sep)
        const mId = k.slice(sep + 1)
        const hist = histories[cId] || []
        histories = { ...histories, [cId]: hist.map(m => m.id === mId ? { ...m, content: m.content + accumulated } : m) }
      }
      return {
        chatHistories: {
          ...histories,
          [chatId]: (histories[chatId] || []).map(m => m.id === msgId ? { ...m, streaming: false } : m),
        },
      }
    })
  },

  addToolCall: (chatId, msgId, tc) => {
    set(s => ({
      chatHistories: {
        ...s.chatHistories,
        [chatId]: (s.chatHistories[chatId] || []).map(m =>
          m.id === msgId ? { ...m, toolCalls: [...(m.toolCalls || []), tc] } : m
        ),
      },
    }))
  },

  updateToolCall: (chatId, msgId, tcId, update) => {
    set(s => ({
      chatHistories: {
        ...s.chatHistories,
        [chatId]: (s.chatHistories[chatId] || []).map(m =>
          m.id === msgId
            ? { ...m, toolCalls: (m.toolCalls || []).map(tc => tc.id === tcId ? { ...tc, ...update } : tc) }
            : m
        ),
      },
    }))
  },

  setStreaming: (v, msgId) => set({ isStreaming: v, streamingMsgId: msgId || null }),

  setBrowserSession: (b) => set(s => ({ browser: { ...s.browser, ...b } })),

  setActiveChatId: (id) => set({ activeChatId: id }),

  clearChat: (chatId) => set(s => ({ chatHistories: { ...s.chatHistories, [chatId]: [] } })),

  setChatHistory: (chatId, messages) => set(s => ({ chatHistories: { ...s.chatHistories, [chatId]: messages } })),

  getHistory: (chatId) => get().chatHistories[chatId] || [],
}))

export function getActiveProvider(store: AiState): AiProviderConfig | null {
  return store.savedProviders.find(p => p.id === store.activeProviderId) || null
}
