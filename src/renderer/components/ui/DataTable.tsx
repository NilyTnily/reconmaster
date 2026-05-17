import React, { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface Column<T> {
  key: string
  label: string
  width?: number
  render?: (row: T) => React.ReactNode
  sortable?: boolean
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  pageSize?: number
}

export default function DataTable<T>({ columns, data, emptyMessage = 'No data', pageSize = 100 }: Props<T>) {
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey]
        const bv = (b as Record<string, unknown>)[sortKey]
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  const totalPages = Math.ceil(sorted.length / pageSize)
  const slice = sorted.slice(page * pageSize, (page + 1) * pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(0)
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="text-left px-3 py-2.5 text-xs font-semibold select-none"
                  style={{
                    color: 'var(--text-secondary)',
                    width: col.width,
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && sortKey === col.key && (
                      sortDir === 'asc'
                        ? <ChevronUp size={12} style={{ color: 'var(--accent)' }} />
                        : <ChevronDown size={12} style={{ color: 'var(--accent)' }} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => {
              const rowKey = columns.map(c => String((row as Record<string, unknown>)[c.key] ?? '')).join('\x00')
              return (
                <tr
                  key={rowKey}
                  className="transition-colors hover:bg-white/[0.03]"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className="px-3 py-2"
                      style={{ maxWidth: col.width ? undefined : 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded text-xs disabled:opacity-30"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded text-xs disabled:opacity-30"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
