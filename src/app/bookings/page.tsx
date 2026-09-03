import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Booking {
  id: string
  date: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'cancelled' | 'completed'
  meeting_type: string
  lead_id: string
  lead: { first_name: string; last_name: string; company?: string } | null
  agent: { name: string } | null
}

const STATUS_STYLES: Record<string, string> = {
  confirmed:  'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  completed:  'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
  cancelled:  'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default async function BookingsPage() {
  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select(`
      id, date, start_time, end_time, status, meeting_type,
      lead:leads(first_name, last_name, company),
      agent:agents(name)
    `)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  const upcoming = (bookings as unknown as Booking[] ?? []).filter(
    (b) => b.date >= new Date().toISOString().slice(0, 10) && b.status !== 'cancelled'
  )
  const past = (bookings as unknown as Booking[] ?? []).filter(
    (b) => b.date < new Date().toISOString().slice(0, 10) || b.status === 'cancelled'
  )

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold text-white">Bookings</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
          {error.message}
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 mb-2">No bookings yet</p>
          <p className="text-gray-600 text-sm">Open a client profile and click <span className="text-gray-400">Book Meeting</span> to schedule.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Upcoming</h2>
          <BookingTable bookings={upcoming} />
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Past & Cancelled</h2>
          <BookingTable bookings={past} faded />
        </section>
      )}
    </div>
  )
}

function BookingTable({ bookings, faded = false }: { bookings: Booking[]; faded?: boolean }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl overflow-hidden ${faded ? 'opacity-60' : ''}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/50">
            <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Client</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Agent</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Date</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Time</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Type</th>
            <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {bookings.map((b) => (
            <tr key={b.id} className="hover:bg-gray-800/40 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/clients/${b.lead_id}`} className="text-white hover:text-blue-400 transition-colors font-medium">
                  {b.lead ? `${b.lead.first_name} ${b.lead.last_name}` : '—'}
                </Link>
                {b.lead?.company && (
                  <p className="text-xs text-gray-500 mt-0.5">{b.lead.company}</p>
                )}
              </td>
              <td className="px-4 py-3 text-gray-400">{b.agent?.name ?? '—'}</td>
              <td className="px-4 py-3 text-gray-300">{formatDate(b.date)}</td>
              <td className="px-4 py-3 text-gray-300 tabular-nums">
                {formatTime(b.start_time)} – {formatTime(b.end_time)}
              </td>
              <td className="px-4 py-3 text-gray-400 capitalize">{b.meeting_type}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                  STATUS_STYLES[b.status] ?? 'bg-gray-700/50 text-gray-400'
                }`}>
                  {b.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
