import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  New: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  Contacted: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
  Meeting: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30',
  Negotiating: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
  Closed: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-600">—</span>
  const color =
    score >= 8
      ? 'text-green-400'
      : score >= 5
      ? 'text-yellow-400'
      : 'text-red-400'
  return <span className={`font-semibold tabular-nums ${color}`}>{score}<span className="text-gray-600 font-normal">/10</span></span>
}

export default async function ClientsPage() {
  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, first_name, last_name, company, status, location, score, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold text-white">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {leads?.length ?? 0} total contacts
          </p>
        </div>
        <Link
          href="/import"
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors font-medium"
        >
          + Import CSV
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
          {error.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/50">
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Company</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Location</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {leads && leads.length > 0 ? (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-800/40 transition-colors group">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${lead.id}`}
                      className="text-white group-hover:text-blue-400 transition-colors font-medium"
                    >
                      {lead.first_name} {lead.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{lead.company ?? '—'}</td>
                  <td className="px-4 py-3">
                    {lead.status ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_STYLES[lead.status] ?? 'bg-gray-700/50 text-gray-400'
                        }`}
                      >
                        {lead.status}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{lead.location ?? '—'}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={lead.score} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <p className="text-gray-500 mb-2">No clients yet</p>
                  <Link
                    href="/import"
                    className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    Import a CSV to get started →
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
