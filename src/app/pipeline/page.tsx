'use client'

import { useEffect, useState, useRef } from 'react'

const COLUMNS = ['New', 'Contacted', 'Meeting', 'Negotiating', 'Closed'] as const
type Status = typeof COLUMNS[number]

const COLUMN_STYLES: Record<Status, { header: string; dot: string; count: string }> = {
  New: { header: 'text-blue-400', dot: 'bg-blue-400', count: 'bg-blue-500/20 text-blue-400' },
  Contacted: { header: 'text-yellow-400', dot: 'bg-yellow-400', count: 'bg-yellow-500/20 text-yellow-400' },
  Meeting: { header: 'text-purple-400', dot: 'bg-purple-400', count: 'bg-purple-500/20 text-purple-400' },
  Negotiating: { header: 'text-orange-400', dot: 'bg-orange-400', count: 'bg-orange-500/20 text-orange-400' },
  Closed: { header: 'text-green-400', dot: 'bg-green-400', count: 'bg-green-500/20 text-green-400' },
}

interface Lead {
  id: string
  first_name: string
  last_name: string
  company?: string
  location?: string
  score?: number
  status?: string
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)
  const dragFrom = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/leads')
      .then((r) => r.json())
      .then((data) => {
        setLeads(Array.isArray(data) ? data : [])
      })
      .catch(() => setError('Failed to load pipeline'))
      .finally(() => setLoading(false))
  }, [])

  function byStatus(status: Status) {
    return leads.filter((l) => l.status === status)
  }

  function handleDragStart(id: string, from: string) {
    dragId.current = id
    dragFrom.current = from
  }

  function handleDrop(toStatus: Status) {
    const id = dragId.current
    if (!id || dragFrom.current === toStatus) return

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: toStatus } : l))
    )

    // Persist
    fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: toStatus }),
    }).catch(() => {
      // Roll back on error
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: dragFrom.current ?? l.status } : l))
      )
    })

    dragId.current = null
    dragFrom.current = null
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="text-gray-500 text-sm">Loading pipeline…</div>
      </div>
    )
  }

  return (
    <div className="p-8 h-full">
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-white">Pipeline</h1>
        <p className="text-gray-500 text-sm mt-0.5">Drag cards to move clients through stages</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
        {COLUMNS.map((col) => {
          const cards = byStatus(col)
          const styles = COLUMN_STYLES[col]
          return (
            <div
              key={col}
              className="flex-shrink-0 w-64 flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                  <span className={`text-sm font-semibold ${styles.header}`}>{col}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.count}`}>
                  {cards.length}
                </span>
              </div>

              {/* Drop zone */}
              <div className="flex-1 bg-gray-900/60 border border-gray-800 rounded-xl p-2 space-y-2 min-h-32">
                {cards.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => handleDragStart(lead.id, col)}
                    className="bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-gray-600 transition-colors select-none"
                  >
                    <p className="text-white text-sm font-medium leading-snug">
                      {lead.first_name} {lead.last_name}
                    </p>
                    {lead.company && (
                      <p className="text-gray-500 text-xs mt-0.5 truncate">{lead.company}</p>
                    )}
                    {lead.location && (
                      <p className="text-gray-600 text-xs mt-0.5 truncate">{lead.location}</p>
                    )}
                    {lead.score != null && (
                      <div className="mt-2 flex items-center gap-1">
                        <span className={`text-xs font-semibold ${
                          lead.score >= 7 ? 'text-green-400' : lead.score >= 4 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          ★ {lead.score}/10
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {cards.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-gray-700 text-xs">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
