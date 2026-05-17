import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface Props {
  getText: () => string
  label?: string
}

export default function CopyButton({ getText, label }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = getText()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{
        background: copied ? 'rgba(34,197,94,0.1)' : 'var(--bg-card)',
        color: copied ? 'var(--success)' : 'var(--text-secondary)',
        border: '1px solid',
        borderColor: copied ? 'rgba(34,197,94,0.3)' : 'var(--border)',
      }}
      title="Copy all to clipboard"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {label || (copied ? 'Copied!' : 'Copy All')}
    </button>
  )
}
