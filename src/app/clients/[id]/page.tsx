'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, MapPin, Building, User, Tag, Star,
  Mail, MessageSquare, Clock, CheckCircle, Loader2, Zap, Bot, Calendar, X,
} from 'lucide-react'

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

const STATUS_OPTIONS = ['New', 'Contacted', 'Meeting', 'Negotiating', 'Closed']

const STATUS_STYLES: Record<string, string> = {
  New:          'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  Contacted:    'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
  Meeting:      'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30',
  Negotiating:  'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
  Closed:       'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
}

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
        <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0">
          {seq.step}
        </span>
        {isEmail
          ? <Mail size={13} className="text-blue-400 shrink-0" />
          : <MessageSquare size={13} className="text-green-400 shrink-0" />}
        <span className="text-sm text-white flex-1 truncate font-medium">
          {isEmail ? (seq.subject ?? 'Email') : `SMS — Day ${seq.step === 1 ? 0 : [2,5,10,21][seq.step - 2] ?? seq.step}`}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
          <Clock size={11} />
          {scheduledDate}
        </span>
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

  const [matchState, setMatchState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [matchReason, setMatchReason] = useState<string | null>(null)

  const [followUpState, setFollowUpState] = useState<'idle' | 'saving' | 'generating' | 'done' | 'error'>('idle')
  const [followUpError, setFollowUpError] = useState<string | null>(null)
  const [sequences, setSequences] = useState<SequenceStep[]>([])

  // Booking modal
  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingDate, setBookingDate] = useState('')
  const [bookingSlots, setBookingSlots] = useState<string[]>([])
  const [bookingSlot, setBookingSlot] = useState('')
  const [bookingType, setBookingType] = useState('consultation')
  const [bookingAgentId, setBookingAgentId] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState<{ date: string; time: string } | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])

  const fetchLead = useCallback(async (): Promise<Lead | null> => {
    try {
      const res = await fetch(`/api/leads/${id}`)
      if (!res.ok) throw new Error('Lead not found')
      const data: Lead = await res.json()
      setLead(data)
      setNotes(data.notes ?? '')
      setStatus(data.status ?? '')
      setClassification(data.classification ?? '')
      setAssignedAgent(data.assigned_agent ?? '')
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      return null
    } finally {
      setLoading(false)
    }
  }, [id])

  const checkAutoAssign = useCallback(async (currentLead: Lead | null) => {
    if (!currentLead) return
    if (currentLead.assigned_agent) return
    const res = await fetch('/api/settings')
    const data = await res.json()
    if (data.auto_assign === 'true') {
      const matchRes = await fetch('/api/match-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: currentLead.id }),
      })
      const result = await matchRes.json()
      if (result.success) {
        setAssignedAgent(result.agent)
        setMatchReason(result.reason)
        setMatchState('done')
      }
    }
  }, [])

  useEffect(() => {
    fetchLead().then((data) => checkAutoAssign(data))
  }, [fetchLead, checkAutoAssign])

  useEffect(() => {
    if (!bookingOpen) return
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [bookingOpen])

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

  async function handleAutoAssign() {
    if (!lead) return
    setMatchState('loading')
    try {
      const res = await fetch('/api/match-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Matching failed')
      setAssignedAgent(data.agent)
      setMatchReason(data.reason)
      setMatchState('done')
    } catch {
      setMatchState('error')
    }
  }

  async function handleFollowUp() {
    if (!lead) return
    setFollowUpState('saving')
    setFollowUpError(null)
    try {
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, status, classification, assigned_agent: assignedAgent }),
      })
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

  async function fetchSlots(agentId: string, date: string) {
    if (!agentId || !date) return
    setSlotsLoading(true)
    setBookingSlot('')
    try {
      const res = await fetch(`/api/bookings/availability?agent_id=${agentId}&date=${date}`)
      const data = await res.json()
      setBookingSlots(data.slots ?? [])
    } finally {
      setSlotsLoading(false)
    }
  }

  async function handleDateChange(date: string) {
    setBookingDate(date)
    if (bookingAgentId) await fetchSlots(bookingAgentId, date)
  }

  async function handleBookingSubmit() {
    if (!bookingAgentId || !bookingDate || !bookingSlot) return
    setBookingLoading(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: id,
          agent_id: bookingAgentId,
          date: bookingDate,
          start_time: bookingSlot,
          meeting_type: bookingType,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Booking failed')
      }
      setBookingSuccess({ date: bookingDate, time: bookingSlot })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Booking failed')
    } finally {
      setBookingLoading(false)
    }
  }

  function formatSlot(slot: string) {
    const [h, m] = slot.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
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

  const isGenerating = followUpState === 'saving' || followUpState === 'generating'

  return (
    <div className="p-8 max-w-4xl">
      <button
        onClick={() => router.push('/clients')}
        className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Clients
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {lead.first_name} {lead.last_name}
          </h1>
          {lead.title && <p className="text-gray-400 text-sm mt-1">{lead.title}</p>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setBookingOpen(true); setBookingSuccess(null) }}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-all"
          >
            <Calendar size={14} />
            Book Meeting
          </button>

          {!lead.assigned_agent && (
            <button
              onClick={handleAutoAssign}
              disabled={matchState === 'loading'}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                matchState === 'done'
                  ? 'bg-green-600/20 text-green-400 ring-1 ring-green-500/30'
                  : matchState === 'loading'
                  ? 'bg-gray-600/20 text-gray-400 cursor-wait'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              <Bot size={14} />
              {matchState === 'loading' ? 'Matching…' : matchState === 'done' ? 'Agent Assigned' : 'Auto-Assign Agent'}
            </button>
          )}

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
              <><Loader2 size={14} className="animate-spin" />{followUpState === 'saving' ? 'Saving…' : 'Generating…'}</>
            ) : followUpState === 'done' ? (
              <><CheckCircle size={14} />Sequence Created</>
            ) : (
              <><Zap size={14} />Mark for Follow-Up</>
            )}
          </button>

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

      {followUpState === 'error' && followUpError && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {followUpError}
        </div>
      )}

      {matchReason && matchState === 'done' && (
        <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-green-400 text-sm">
          Agent assigned: <strong>{assignedAgent}</strong> — {matchReason}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
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
                    }`}>
                      {lead.score}/10
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

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

      {/* Book Meeting Modal */}
      {bookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setBookingOpen(false); setBookingSuccess(null) }}
          />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-blue-400" />
                <h2 className="text-base font-semibold text-white">Book a Meeting</h2>
              </div>
              <button
                onClick={() => { setBookingOpen(false); setBookingSuccess(null) }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {bookingSuccess ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={24} className="text-green-400" />
                </div>
                <p className="text-white font-medium mb-1">Meeting Booked!</p>
                <p className="text-gray-400 text-sm">
                  {new Date(bookingSuccess.date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric',
                  })}
                </p>
                <p className="text-blue-400 text-sm font-medium mt-0.5">
                  {(() => {
                    const [h, m] = bookingSuccess.time.split(':').map(Number)
                    return String(h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM')
                  })()}
                </p>
                <button
                  onClick={() => { setBookingOpen(false); setBookingSuccess(null) }}
                  className="mt-5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Agent</label>
                  <select
                    value={bookingAgentId}
                    onChange={async (e) => {
                      setBookingAgentId(e.target.value)
                      if (bookingDate) await fetchSlots(e.target.value, bookingDate)
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">— Select agent —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">
                    Time Slot
                    {slotsLoading && <Loader2 size={11} className="inline ml-1.5 animate-spin" />}
                  </label>
                  {bookingSlots.length === 0 && bookingDate && bookingAgentId && !slotsLoading ? (
                    <p className="text-xs text-gray-500 py-2">No available slots for this date.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                      {bookingSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setBookingSlot(slot)}
                          className={`text-xs py-1.5 px-2 rounded-md border transition-colors ${
                            bookingSlot === slot
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-blue-500/50 hover:text-white'
                          }`}
                        >
                          {formatSlot(slot)}
                        </button>
                      ))}
                    </div>
                  )}
                  {(!bookingDate || !bookingAgentId) && (
                    <p className="text-xs text-gray-600 mt-1">Select an agent and date to see available slots.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Meeting Type</label>
                  <select
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="consultation">Consultation</option>
                    <option value="showing">Property Showing</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="closing">Closing</option>
                    <option value="follow-up">Follow-Up</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleBookingSubmit}
                    disabled={bookingLoading || !bookingAgentId || !bookingDate || !bookingSlot}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {bookingLoading ? (
                      <><Loader2 size={14} className="animate-spin" />Booking…</>
                    ) : (
                      <><Calendar size={14} />Confirm Booking</>
                    )}
                  </button>
                  <button
                    onClick={() => setBookingOpen(false)}
                    className="px-4 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
