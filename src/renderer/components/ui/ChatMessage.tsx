import React, { useState } from 'react'
import {
  Terminal, Globe, Check, X, ChevronDown, ChevronUp,
  Code2, MousePointer, FileText, Zap, Brain,
  Database, Download, ShieldAlert, TestTube, Map, Wrench,
} from 'lucide-react'
import { ChatMessage as ChatMsg, ToolCallCard, ToolTier } from '../../types'

const TOOL_ICONS: Record<string, React.ElementType> = {
  analyze_and_plan: Map,
  fetch_url: Download,
  read_scan: FileText,
  save_memory: Database,
  read_memory: Database,
  browser_navigate: Globe,
  browser_click: MousePointer,
  browser_fill: Code2,
  browser_fill_form: Code2,
  browser_execute_js: Code2,
  browser_audit_page: ShieldAlert,
  test_endpoint: TestTube,
  run_nuclei: Zap,
  propose_chain: Brain,
  run_command: Terminal,
  run_in_terminal: Terminal,
  get_weapons: ShieldAlert,
  set_weapon_status: ShieldAlert,
  get_attacker_config: Database,
  set_attacker_config: Database,
  list_installed_tools: Wrench,
  start_scan: Zap,
  cancel_scan: X,
  export_report: Download,
  read_file: FileText,
  save_file: FileText,
}

const TIER_COLORS: Record<ToolTier, string> = {
  silent: '#6b7280',
  show: '#3b82f6',
  approve: '#eab308',
  confirm: '#ef4444',
}

const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
}

// ── Chain card ────────────────────────────────────────────────────────────────

function ChainCard({ tc, onApprove, onDeny }: {
  tc: ToolCallCard
  onApprove?: (id: string) => void
  onDeny?: (id: string) => void
}) {
  const steps: { tool: string; description: string }[] = (tc.args.steps as { tool: string; description: string }[]) || []
  const title = tc.args.title as string || 'Attack Chain'
  const isDone = tc.status === 'done'
  const isDenied = tc.status === 'denied'
  const isWaiting = tc.status === 'waiting-approval'

  return (
    <div className="rounded-lg overflow-hidden text-xs" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(234,179,8,0.25)' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Brain size={12} style={{ color: '#eab308' }} />
        <span className="font-semibold" style={{ color: '#eab308' }}>{title}</span>
        <span className="ml-auto text-xs" style={{ color: isDone ? '#22c55e' : isDenied ? '#6b7280' : '#eab308' }}>
          {isDone ? '✓ chain approved' : isDenied ? '✗ denied' : isWaiting ? `${steps.length} steps — review` : '⟳ proposing'}
        </span>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="shrink-0 w-4 text-right" style={{ color: 'var(--text-secondary)' }}>{i + 1}.</span>
            <span className="font-mono shrink-0" style={{ color: '#a78bfa', fontSize: 10 }}>{step.tool}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{step.description}</span>
          </div>
        ))}
      </div>

      {isWaiting && onApprove && onDeny && (
        <div className="flex gap-2 px-3 pb-2.5">
          <button
            onClick={() => onApprove(tc.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold"
            style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.35)' }}
          >
            <Check size={10} /> Run Chain ({steps.length} steps auto-approved)
          </button>
          <button
            onClick={() => onDeny(tc.id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <X size={10} /> Deny
          </button>
        </div>
      )}
    </div>
  )
}

// ── Nuclei result table ───────────────────────────────────────────────────────

function NucleiResultTable({ result }: { result: string }) {
  const [expanded, setExpanded] = useState(false)
  try {
    const { count, findings } = JSON.parse(result) as {
      count: number
      findings: { id: string; name: string; severity: string; host: string; matched: string }[]
    }
    if (!findings?.length) return <div style={{ color: 'var(--text-secondary)', padding: '4px 12px 8px' }}>No findings.</div>
    const shown = expanded ? findings : findings.slice(0, 8)
    return (
      <div>
        <div className="px-3 pb-1 pt-1 text-xs font-medium" style={{ color: '#22c55e' }}>
          {count} finding{count !== 1 ? 's' : ''}
        </div>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Severity', 'Name', 'Host', 'Matched'].map(h => (
                  <th key={h} className="px-3 py-1 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((f, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td className="px-3 py-1">
                    <span className="px-1.5 py-0.5 rounded font-mono" style={{ background: `${SEV_COLORS[f.severity] || '#6b7280'}20`, color: SEV_COLORS[f.severity] || '#6b7280' }}>
                      {f.severity}
                    </span>
                  </td>
                  <td className="px-3 py-1 font-mono" style={{ color: 'var(--text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</td>
                  <td className="px-3 py-1" style={{ color: 'var(--text-secondary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.host}</td>
                  <td className="px-3 py-1 font-mono" style={{ color: 'var(--text-secondary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.matched}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {findings.length > 8 && (
          <button onClick={() => setExpanded(e => !e)} className="px-3 py-1.5 w-full text-left flex items-center gap-1"
            style={{ color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 10 }}>
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? 'Show less' : `Show ${findings.length - 8} more`}
          </button>
        )}
      </div>
    )
  } catch { return null }
}

// ── Generic tool card ─────────────────────────────────────────────────────────

function ToolCard({ tc, onApprove, onDeny }: {
  tc: ToolCallCard
  onApprove?: (id: string) => void
  onDeny?: (id: string) => void
}) {
  const [argsOpen, setArgsOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)

  if (tc.name === 'propose_chain') return <ChainCard tc={tc} onApprove={onApprove} onDeny={onDeny} />

  const Icon = TOOL_ICONS[tc.name] || Terminal
  const statusColor =
    tc.status === 'done' ? '#22c55e' :
    tc.status === 'error' ? '#ef4444' :
    tc.status === 'denied' ? '#6b7280' :
    tc.status === 'waiting-approval' ? '#eab308' :
    (tc.status === 'running' || tc.status === 'approved') ? '#3b82f6' : '#6b7280'

  const isNuclei = tc.name === 'run_nuclei'

  return (
    <div className="rounded-lg overflow-hidden text-xs" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${statusColor}30` }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon size={12} style={{ color: TIER_COLORS[tc.tier], flexShrink: 0 }} />
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{tc.label}</span>
        <span className="text-xs font-mono ml-auto" style={{ color: statusColor }}>
          {(tc.status === 'running' || tc.status === 'approved') ? '⟳ running' :
           tc.status === 'waiting-approval' ? '⏸ waiting' :
           tc.status === 'done' ? '✓ done' :
           tc.status === 'denied' ? '✗ denied' :
           tc.status === 'error' ? '✗ error' : ''}
        </span>
        {Object.keys(tc.args).length > 0 && (
          <button onClick={() => setArgsOpen(o => !o)} style={{ color: 'var(--text-secondary)' }}>
            {argsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>

      {/* Args */}
      {argsOpen && (
        <div className="px-3 pb-2 font-mono" style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
          {Object.entries(tc.args).map(([k, v]) => (
            <div key={k}><span style={{ color: '#a78bfa' }}>{k}:</span> {String(v).slice(0, 200)}</div>
          ))}
        </div>
      )}

      {/* Approval buttons */}
      {tc.status === 'waiting-approval' && onApprove && onDeny && (
        <div className="flex gap-2 px-3 pb-2">
          <button onClick={() => onApprove(tc.id)} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
            <Check size={10} /> Allow
          </button>
          <button onClick={() => onDeny(tc.id)} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
            <X size={10} /> Deny
          </button>
          {tc.tier === 'confirm' && (
            <span className="ml-auto text-xs self-center" style={{ color: '#ef4444' }}>⚠ Command execution</span>
          )}
        </div>
      )}

      {/* Nuclei table or generic result */}
      {tc.result && tc.status === 'done' && (
        isNuclei ? (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <NucleiResultTable result={tc.result} />
          </div>
        ) : (
          <div>
            <button onClick={() => setResultOpen(o => !o)} className="flex items-center gap-1 px-3 py-1.5 w-full text-left"
              style={{ color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 10 }}>
              {resultOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              Result ({tc.result.length} chars)
            </button>
            {resultOpen && (
              <div className="px-3 pb-2 font-mono whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontSize: 10, maxHeight: 200, overflowY: 'auto' }}>
                {tc.result.slice(0, 2000)}
                {tc.result.length > 2000 && <span style={{ color: '#6b7280' }}>…truncated</span>}
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}

// ── Message view ──────────────────────────────────────────────────────────────

interface Props {
  msg: ChatMsg
  onApprove?: (toolCallId: string) => void
  onDeny?: (toolCallId: string) => void
}

export default function ChatMessageView({ msg, onApprove, onDeny }: Props) {
  const isUser = msg.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div style={{ maxWidth: '90%', minWidth: 40 }}>
        {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {msg.toolCalls.map(tc => (
              <ToolCard key={tc.id} tc={tc} onApprove={onApprove} onDeny={onDeny} />
            ))}
          </div>
        )}

        {(msg.content || msg.streaming) && (
          <div
            className="px-3 py-2.5 rounded-xl text-xs whitespace-pre-wrap break-words"
            style={isUser ? {
              background: 'rgba(0,212,255,0.12)',
              border: '1px solid rgba(0,212,255,0.25)',
              color: 'var(--text-primary)',
              borderRadius: '12px 12px 4px 12px',
            } : {
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              borderRadius: '4px 12px 12px 12px',
            }}
          >
            {msg.content}
            {msg.streaming && !msg.content && (
              <span style={{ color: 'var(--text-secondary)' }}>Thinking…</span>
            )}
            {msg.streaming && (
              <span className="inline-block w-1.5 h-3 ml-0.5 animate-pulse" style={{ background: 'var(--accent)', verticalAlign: 'middle' }} />
            )}
          </div>
        )}

        <div className="mt-0.5 px-1 text-right" style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
          {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
