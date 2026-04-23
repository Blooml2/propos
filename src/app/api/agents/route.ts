import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  // Fetch agents
  const { data: agents, error: agentsError } = await supabaseAdmin
    .from('agents')
    .select('*')
    .order('name', { ascending: true })

  if (agentsError) {
    return NextResponse.json({ error: agentsError.message }, { status: 500 })
  }

  // Compute client counts per agent
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('assigned_agent')

  const countMap: Record<string, number> = {}
  if (leads) {
    for (const lead of leads) {
      if (lead.assigned_agent) {
        countMap[lead.assigned_agent] = (countMap[lead.assigned_agent] ?? 0) + 1
      }
    }
  }

  const enriched = (agents ?? []).map((agent) => ({
    ...agent,
    client_count: countMap[agent.name] ?? countMap[agent.id] ?? 0,
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { data, error } = await supabaseAdmin
    .from('agents')
    .insert(body)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
