import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface Agent {
  id: string
  name: string
  specialty?: string
  language?: string
  email?: string
  phone?: string
  created_at?: string
}

async function getAgentsWithCounts() {
  const [agentsRes, leadsRes] = await Promise.all([
    supabaseAdmin.from('agents').select('*').order('name', { ascending: true }),
    supabaseAdmin.from('leads').select('assigned_agent'),
  ])

  const agents: Agent[] = agentsRes.data ?? []
  const leads = leadsRes.data ?? []

  const countMap: Record<string, number> = {}
  for (const lead of leads) {
    if (lead.assigned_agent) {
      countMap[lead.assigned_agent] = (countMap[lead.assigned_agent] ?? 0) + 1
    }
  }

  return {
    agents,
    countMap,
    error: agentsRes.error,
  }
}

function InitialAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Deterministic color based on name
  const colors = [
    'bg-blue-600',
    'bg-purple-600',
    'bg-pink-600',
    'bg-indigo-600',
    'bg-teal-600',
    'bg-orange-600',
  ]
  const color = colors[name.charCodeAt(0) % colors.length]

  return (
    <div
      className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-sm font-semibold shrink-0`}
    >
      {initials}
    </div>
  )
}

export default async function AgentsPage() {
  const { agents, countMap, error } = await getAgentsWithCounts()

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-white">Agents</h1>
        <p className="text-gray-500 text-sm mt-0.5">{agents.length} agents on your team</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
          {error.message.includes('does not exist')
            ? 'The "agents" table doesn\'t exist in Supabase yet. Create it with columns: name, specialty, language, email, phone.'
            : error.message}
        </div>
      )}

      {agents.length === 0 && !error ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 mb-2">No agents found</p>
          <p className="text-gray-600 text-sm">
            Add agents to your Supabase <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-400">agents</code> table to see them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const clientCount = countMap[agent.name] ?? countMap[agent.id] ?? 0
            return (
              <div
                key={agent.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <InitialAvatar name={agent.name} />
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm truncate">{agent.name}</p>
                    {agent.email && (
                      <p className="text-gray-500 text-xs truncate">{agent.email}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {agent.specialty && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs">Specialty</span>
                      <span className="text-gray-300 text-xs font-medium bg-gray-800 px-2 py-0.5 rounded">
                        {agent.specialty}
                      </span>
                    </div>
                  )}
                  {agent.language && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs">Language</span>
                      <span className="text-gray-300 text-xs">{agent.language}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-800 mt-3">
                    <span className="text-gray-500 text-xs">Clients</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      clientCount > 0
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-gray-800 text-gray-600'
                    }`}>
                      {clientCount}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
