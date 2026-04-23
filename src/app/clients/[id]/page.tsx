'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, MapPin, Building, User, Tag, Star } from 'lucide-react'

const STATUS_OPTIONS = ['New', 'Contacted', 'Meeting', 'Negotiating', 'Closed']

const STATUS_STYLES: Record<string, string> = {
  New: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  Contacted: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
  Meeting: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30',
  Negotiating: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
  Closed: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
}

interface Lead {
  id: string
  first_name: string
  last_name: string
  company?: string
  title?: string
  location?: string
  status?: string
  score?: number
  notes?: string
  assigned_agent?: string
  classification?: string
  created_at?: string
}

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  const [classification, setClassification] = useState('')
  const [assignedAgent, setAssignedAgent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${id}`)
      if (!res.ok) throw new Error('Lead not found')
      const data: Lead = await res.json()
      setLead(data)
      setNotes(data.notes ?? '')
      setStatus(data.status ?? '')
      setClassification(data.classification ?? '')
      setAssignedAgent(data.assigned_agent ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchLead()
  }, [fetchLead])

  async function handleSave() {
    if (!lead) return
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, status, classification, assigned_agent: assignedAgent }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated: Lead = await res.json()
      setLead(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="text-gray-500 text-sm">Loading…</div>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="p-8">
        <p className="text-red-400 text-sm mb-4">{error ?? 'Client not found'}</p>
        <Link href="/clients" className="text-blue-400 hover:text-blue-300 text-sm">← Back to Clients</Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => router.push('/clients')}
        className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Clients
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {lead.first_name} {lead.last_name}
          </h1>
          {lead.title && (
            <p className="text-gray-400 text-sm mt-1">{lead.title}</p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            saved
              ? 'bg-green-600/20 text-green-400 ring-1 ring-green-500/30'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Save size={14} />
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Info Card */}
        <div className="col-span-1 space-y-5">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Info</h2>
            <div className="space-y-3">
              {lead.company && (
                <div className="flex items-start gap-2.5">
                  <Building size={14} className="text-gray-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Company</p>
                    <p className="text-sm text-white">{lead.company}</p>
                  </div>
                </div>
              )}
              {lead.location && (
                <div className="flex items-start gap-2.5">
                  <MapPin size={14} className="text-gray-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Location</p>
                    <p className="text-sm text-white">{lead.location}</p>
                  </div>
                </div>
              )}
              {lead.score != null && (
                <div className="flex items-start gap-2.5">
                  <Star size={14} className="text-gray-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Score</p>
                    <p className={`text-sm font-semibold ${
                      lead.score >= 7 ? 'text-green-400' : lead.score >= 4 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{lead.score}/10</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Editable Fields */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Pipeline</h2>
            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">— Select —</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {status && (
                  <span className={`inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? ''}`}>
                    {status}
                  </span>
                )}
              </div>

              {/* Assigned Agent */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  <User size={11} className="inline mr-1" />Assigned Agent
                </label>
                <input
                  type="text"
                  value={assignedAgent}
                  onChange={(e) => setAssignedAgent(e.target.value)}
                  placeholder="Agent name…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {/* Classification */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  <Tag size={11} className="inline mr-1" />Classification
                </label>
                <input
                  type="text"
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                  placeholder="e.g. Investor, Buyer, Referral…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                {classification && (
                  <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30">
                    {classification}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Notes */}
        <div className="col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-full">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this client — meetings, preferences, follow-ups…"
              className="w-full h-64 bg-gray-800/50 border border-gray-700 rounded-md px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none leading-relaxed"
            />
            <p className="text-xs text-gray-600 mt-2">Press &ldquo;Save Changes&rdquo; to persist</p>
          </div>
        </div>
      </div>
    </div>
  )
}
