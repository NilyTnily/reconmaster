import { BrowserWindow } from 'electron'
import { generateFieldValue } from './dataGenerator'
import { FormInfo, FormFillResult } from './agentTools'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
]

function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] }
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }
function jitter(base: number, range = 0.4) { return base + (Math.random() * base * range - base * range / 2) }

const STEALTH_JS = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  window.chrome = { runtime: {} };
  delete window.callPhantom; delete window._phantom;
`

// ── Multi-tab state ───────────────────────────────────────────────────────────

const tabs = new Map<string, BrowserWindow>()
let activeTabId: string | null = null
let tabCounter = 0

function createTab(id: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280, height: 800,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, javascript: true, webSecurity: true },
  })
  win.webContents.setUserAgent(randomUA())
  win.webContents.on('dom-ready', () => {
    win.webContents.executeJavaScript(STEALTH_JS).catch(() => {})
  })
  win.on('closed', () => {
    tabs.delete(id)
    if (activeTabId === id) activeTabId = tabs.size > 0 ? tabs.keys().next().value as string : null
  })
  tabs.set(id, win)
  return win
}

function ensureWindow(): BrowserWindow {
  if (activeTabId) {
    const win = tabs.get(activeTabId)
    if (win && !win.isDestroyed()) return win
  }
  const id = `tab_${++tabCounter}`
  const win = createTab(id)
  activeTabId = id
  return win
}

// ── Navigation ────────────────────────────────────────────────────────────────

export async function browserNavigate(url: string, waitMs = 1200): Promise<{ title: string; url: string }> {
  const win = ensureWindow()
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 12000)
    win.webContents.once('did-finish-load', () => { clearTimeout(timeout); resolve() })
    win.webContents.once('did-fail-load', () => { clearTimeout(timeout); resolve() })
    win.loadURL(url).catch(() => resolve())
  })
  await delay(jitter(waitMs))
  return { title: win.webContents.getTitle(), url: win.webContents.getURL() }
}

export async function browserReadDom(): Promise<{ text: string; links: string[]; forms: FormInfo[] }> {
  const win = ensureWindow()
  return win.webContents.executeJavaScript(`
    (() => {
      const text = (document.body?.innerText || '').slice(0, 60000)
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => a.href).filter(h => h.startsWith('http')).slice(0, 80)
      const forms = Array.from(document.querySelectorAll('form')).map(form => ({
        action: form.action || window.location.href,
        method: form.method || 'GET',
        fields: Array.from(form.querySelectorAll('input, select, textarea'))
          .filter(el => el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button')
          .map(el => ({
            name: el.name || el.id || '',
            type: el.type || el.tagName.toLowerCase(),
            label: (() => {
              const id = el.id
              if (id) { const l = document.querySelector('label[for="' + id + '"]'); if (l) return l.textContent.trim() }
              const prev = el.previousElementSibling
              if (prev && prev.tagName === 'LABEL') return prev.textContent.trim()
              return el.placeholder || el.name || ''
            })(),
            required: el.required || false,
          }))
      }))
      return { text, links, forms }
    })()
  `)
}

export async function browserScreenshot(): Promise<string> {
  const win = ensureWindow()
  const image = await win.webContents.capturePage()
  return image.toDataURL()
}

export async function browserClick(selector: string, byText: boolean): Promise<void> {
  const win = ensureWindow()
  await delay(jitter(300, 0.5))
  if (byText) {
    await win.webContents.executeJavaScript(`
      (() => {
        const els = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"]'))
        const el = els.find(e => e.textContent.trim().toLowerCase().includes(${JSON.stringify(selector.toLowerCase())}))
        if (el) { el.click(); return true }
        return false
      })()
    `)
  } else {
    await win.webContents.executeJavaScript(`
      (() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) { el.click(); return true } return false })()
    `)
  }
  await delay(jitter(500))
}

export async function browserFill(selector: string, value: string, clearFirst = true): Promise<void> {
  const win = ensureWindow()
  await delay(jitter(200))
  await win.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return false
      el.focus()
      if (${clearFirst}) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })) }
      el.value = ${JSON.stringify(value)}
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()
  `)
  await delay(jitter(150))
}

export async function browserFillForm(formSelector?: string): Promise<FormFillResult> {
  const win = ensureWindow()
  const dom = await browserReadDom()
  const form = dom.forms[0]
  if (!form) return { fieldsFilledCount: 0, values: {} }

  const values: Record<string, string> = {}
  for (const field of form.fields) {
    if (!field.name && !field.label) continue
    const value = generateFieldValue(field.label || field.name, field.type)
    const selector = formSelector ? `${formSelector} [name="${field.name}"]` : `[name="${field.name}"]`
    try {
      if (field.type === 'select') {
        await win.webContents.executeJavaScript(`
          (() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || !el.options.length) return; el.selectedIndex = Math.min(1, el.options.length - 1); el.dispatchEvent(new Event('change', { bubbles: true })) })()
        `)
      } else if (field.type === 'checkbox') {
        await win.webContents.executeJavaScript(`
          (() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })) } })()
        `)
      } else {
        await browserFill(selector, value)
        values[field.name] = value
      }
      await delay(jitter(120))
    } catch { /* field may not exist */ }
  }
  return { fieldsFilledCount: Object.keys(values).length, values }
}

export async function browserExecuteJs(code: string): Promise<unknown> {
  const win = ensureWindow()
  const wrapped = code.trimStart().startsWith('return ') ? `(() => { ${code} })()` : `(() => { return ${code} })()`
  return win.webContents.executeJavaScript(wrapped)
}

// ── Tab management ────────────────────────────────────────────────────────────

export async function browserNewTab(url?: string): Promise<{ tabId: string; url: string; title: string }> {
  const id = `tab_${++tabCounter}`
  createTab(id)
  activeTabId = id
  if (url) {
    const result = await browserNavigate(url)
    return { tabId: id, ...result }
  }
  return { tabId: id, url: '', title: 'New Tab' }
}

export function browserSwitchTab(tabId: string): { url: string; title: string } {
  const win = tabs.get(tabId)
  if (!win || win.isDestroyed()) throw new Error(`Tab ${tabId} not found`)
  activeTabId = tabId
  return { url: win.webContents.getURL(), title: win.webContents.getTitle() }
}

export function browserCloseTab(tabId: string): void {
  const win = tabs.get(tabId)
  if (win && !win.isDestroyed()) win.destroy()
  tabs.delete(tabId)
  if (activeTabId === tabId) {
    activeTabId = tabs.size > 0 ? tabs.keys().next().value as string : null
  }
}

export function getOpenTabs(): { id: string; url: string; title: string }[] {
  return Array.from(tabs.entries())
    .filter(([, win]) => !win.isDestroyed())
    .map(([id, win]) => ({ id, url: win.webContents.getURL(), title: win.webContents.getTitle() }))
}

// ── Window visibility / lifecycle ─────────────────────────────────────────────

export function browserShow(visible: boolean) {
  if (!activeTabId) return
  const win = tabs.get(activeTabId)
  if (!win || win.isDestroyed()) return
  if (visible) win.show(); else win.hide()
}

export function browserClose() {
  for (const win of tabs.values()) {
    if (!win.isDestroyed()) win.destroy()
  }
  tabs.clear()
  activeTabId = null
}

export function getBrowserUrl(): string {
  if (!activeTabId) return ''
  const win = tabs.get(activeTabId)
  if (!win || win.isDestroyed()) return ''
  return win.webContents.getURL()
}
