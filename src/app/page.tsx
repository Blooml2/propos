import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  New:         'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  Contacted:   'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
  Meeting:     'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30',
  Negotiating: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
  Closed:      'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">{label}</p>
      <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [leadsRes, agentsRes, bookingsRes, recentRes, weekRes] = await Promise.all([
    supabaseAdmin.from('leads').select('id, status', { count: 'exact' }),
    supabaseAdmin.from('agents').select('id', { count: 'exact' }).eq('active', true),
    supabaseAdmin
      .from('bookings')
      .select('id, date, start_time, meeting_type, lead:leads(first_name, last_name), agent:agents(name)')
      .eq('status', 'confirmed')
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(5),
    supabaseAdmin
      .from('leads')
      .select('id, first_name, last_name, company, status, score, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('leads')
      .select('id', { count: 'exact' })
      .gte('created_at', weekAgo),
  ])

  const leads = leadsRes.data ?? []
  const totalLeads = leadsRes.count ?? 0
  const activeAgents = agentsRes.count ?? 0
  const newThisWeek = weekRes.count ?? 0

  const statusCounts: Record<string, number> = {}
  for (const l of leads) {
    if (l.status) statusCounts[l.status] = (statusCounts[l.status] ?? 0) + 1
  }

  const recentLeads = recentRes.data ?? []
  const upcomingBookings = (bookingsRes.data ?? []) as unknown as {
    id: string; date: string; start_time: string; meeting_type: string;
    lead: { first_name: string; last_name: string } | null;
    agent: { name: string } | null;
  }[]

  function formatDate(d: string) {
    const date = new Date(d + 'T12:00:00')
    const diffDays = Math.round((date.getTime() - Date.now()) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function formatTime(t: string) {
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Leads" value={totalLeads} sub={`+${newThisWeek} this week`} />
        <StatCard label="Active Agents" value={activeAgents} />
        <StatCard label="Upcoming Meetings" value={upcomingBookings.length} sub="confirmed" />
        <StatCard label="In Negotiation" value={statusCounts['Negotiating'] ?? 0} sub="active deals" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Leads */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Leads</h2>
            <Link href="/clients" className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
              View all →
            </Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-800">
              {recentLeads.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-gray-600 text-sm">
                    No leads yet.{' '}
                    <Link href="/import" className="text-blue-400 hover:text-blue-300">Import a CSV →</Link>
                  </td>
                </tr>
              ) : recentLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/clients/${lead.id}`} className="text-white hover:text-blue-400 transition-colors font-medium">
                      {lead.first_name} {lead.last_name}
                    </Link>
                    {lead.company && <p className="text-xs text-gray-500 mt-0.5">{lead.company}</p>}
                  </td>
                  <td className="px-3 py-3">
                    {lead.status ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[lead.status] ?? 'bg-gray-700/50 text-gray-400'}`}>
                        {lead.status}
                      </span>
                    ) : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {lead.score != null ? (
                      <span className={`text-xs font-semibold ${lead.score >= 7 ? 'text-green-400' : lead.score >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {lead.score}/10
                      </span>
                    ) : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Pipeline breakdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Pipeline</h2>
              <Link href="/pipeline" className="text-blue-400 hover:text-blue-300 text-xs transition-colors">View →</Link>
            </div>
            <div className="space-y-2">
              {['New','Contacted','Meeting','Negotiating','Closed'].map((s) => (
                <div key={s} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{s}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[s] ?? 'bg-gray-700/50 text-gray-400'}`}>
                    {statusCounts[s] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming bookings */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Upcoming Meetings</h2>
              <Link href="/bookings" className="text-blue-400 hover:text-blue-300 text-xs transition-colors">View →</Link>
            </div>
            {upcomingBookings.length === 0 ? (
              <p className="text-gray-600 text-xs">No upcoming meetings.</p>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((b) => (
                  <div key={b.id} className="border-l-2 border-blue-500/40 pl-3">
                    <p className="text-white text-xs font-medium">
                      {b.lead ? `${b.lead.first_name} ${b.lead.last_name}` : '—'}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {formatDate(b.date)} · {formatTime(b.start_time)}
                    </p>
                    {b.agent && <p className="text-gray-600 text-xs">{b.agent.name}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
