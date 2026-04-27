'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, MapPin, Building, User, Tag, Star,
  Mail, MessageSquare, Clock, CheckCircle, Loader2, Zap,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface SequenceStep {
  id: string
  step: number
  day: number
  channel: 'email' | 'sms'
  subject: string | null
  body: string
  status: string
  scheduled_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['New', 'Contacted', 'Meeting', 'Negotiating', 'Closed']

const STATUS_STYLES: Record<string, string> = {
  New:          'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  Contacted:    'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
  Meeting:      'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30',
  Negotiating:  'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
  Closed:       'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SequenceCard({ seq }: { seq: SequenceStep }) {
  const [expanded, setExpanded] = useState(seq.step === 1)

  const scheduledDate = new Date(seq.scheduled_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const isEmail = seq.channel === 'email'

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800/40 hover:bg-gray-800/70 transition-colors text-left"
      >
        {/* Step badge */}
        <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0">
          {seq.step}
        </span>

        {/* Channel icon */}
        {isEmail
          ? <Mail size={13} className="text-blue-400 shrink-0" />
          : <MessageSquare size={13} className="text-green-400 shrink-0" />}

        {/* Label */}
        <span className="text-sm text-white flex-1 truncate font-medium">
          {isEmail ? (seq.subject ?? 'Email') : `SMS — Day ${seq.step === 1 ? 0 : [2,5,10,21][seq.step - 2] ?? seq.step}`}
        </span>

        {/* Date */}
        <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
          <Clock size={11} />
          {scheduledDate}
        </span>

        {/* Expand toggle */}
        <span className="text-gray-600 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 py-3 bg-gray-900/40 border-t border-gray-800">
          {isEmail && seq.subject && (
            <p className="text-xs text-gray-500 mb-1">
              Subject: <span className="text-gray-300">{seq.subject}</span>
            </p>
          )}
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{seq.body}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  // Profile state
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Editable fields
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  const [classification, setClassification] = useState('')
  const [assignedAgent, setAssignedAgent] = useState('')

  // Save state
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Follow-up state
  const [followUpState, setFollowUpState] = useState<'idle' | 'saving' | 'generating' | 'done' | 'error'>('idle')
  const [followUpError, setFollowUpError] = useState<string | null>(null)
  const [sequences, setSequences] = useState<SequenceStep[]>([])

  // ── Load lead ──
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

  useEffect(() => { fetchLead() }, [fetchLead])

  // ── Save profile ──
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

  // ── Follow-up ──
  async function handleFollowUp() {
    if (!lead) return
    setFollowUpState('saving')
    setFollowUpError(null)

    try {
      // 1. Auto-save any unsaved notes/fields first so Claude sees the latest data
      setFollowUpState('saving')
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, status, classification, assigned_agent: assignedAgent }),
      })

      // 2. Generate + save the sequence
      setFollowUpState('generating')
      const res = await fetch('/api/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')

      setSequences(data.sequences ?? [])
      setFollowUpState('done')
    } catch (err) {
      setFollowUpError(err instanceof Error ? err.message : 'Something went wrong')
      setFollowUpState('error')
    }
  }

  // ── Render states ──
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

  const isGenerating = followUpState === 'saving' || followUpState === 'generating'

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
          {lead.title && <p className="text-gray-400 text-sm mt-1">{lead.title}</p>}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Mark for Follow-Up */}
          <button
            onClick={handleFollowUp}
            disabled={isGenerating || followUpState === 'done'}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              followUpState === 'done'
                ? 'bg-green-600/20 text-green-400 ring-1 ring-green-500/30 cursor-default'
                : isGenerating
                ? 'bg-purple-600/20 text-purple-400 ring-1 ring-purple-500/30 cursor-wait'
                : followUpState === 'error'
                ? 'bg-red-600/20 text-red-400 ring-1 ring-red-500/30 hover:bg-red-600/30'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {followUpState === 'saving' ? 'Saving…' : 'Generating…'}
              </>
            ) : followUpState === 'done' ? (
              <>
                <CheckCircle size={14} />
                Sequence Created
              </>
            ) : (
              <>
                <Zap size={14} />
                Mark for Follow-Up
              </>
            )}
          </button>

          {/* Save */}
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
      </div>

      {/* Follow-up error banner */}
      {followUpState === 'error' && followUpError && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {followUpError}
        </div>
      )}

      {/* Profile grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Info + Pipeline */}
        <div className="col-span-1 space-y-5">
          {/* Info card */}
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
                    }`}>
                      {lead.score}/10
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pipeline card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Pipeline</h2>
            <div className="space-y-4">
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this client — meetings, preferences, follow-ups…"
              className="w-full h-64 bg-gray-800/50 border border-gray-700 rounded-md px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none leading-relaxed"
            />
            <p className="text-xs text-gray-600 mt-2">
              Notes are included in the AI follow-up prompt — the more detail, the better the sequence.
            </p>
          </div>
        </div>
      </div>

      {/* ── Follow-Up Sequence Preview ── */}
      {sequences.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={15} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Generated Follow-Up Sequence</h2>
            <span className="text-xs text-gray-500 ml-1">
              · {sequences.length} messages scheduled · pending send
            </span>
          </div>

          <div className="space-y-2">
            {sequences.map((seq) => (
              <SequenceCard key={seq.id} seq={seq} />
            ))}
          </div>

          <p className="text-xs text-gray-600 mt-3">
            Messages are saved to Supabase with <code className="bg-gray-800 px-1 rounded text-gray-500">status = pending</code>.
            Your n8n workflow will send them on the scheduled dates.
          </p>
        </div>
      )}
    </div>
  )
}
