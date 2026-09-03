import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  const { lead_id } = await request.json()

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', lead_id)
    .single()

  const { data: agents } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('active', true)

  if (!lead || !agents || agents.length === 0) {
    return NextResponse.json({ error: 'Lead or agents not found' }, { status: 404 })
  }

  const agentList = agents.map((a, i) =>
    `${i + 1}. Name: ${a.name}, Specialty: ${a.specialty}, Language: ${a.language}, Current clients: ${a.current_clients || 0}, Capacity: ${a.capacity}`
  ).join('\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are a real estate team manager. Pick the best agent for this client.

Client profile:
- Name: ${lead.first_name} ${lead.last_name}
- Type: ${lead.title || 'Unknown'}
- Location: ${lead.location || 'Unknown'}
- Classification: ${lead.tags?.join(', ') || 'Unknown'}
- Notes: ${lead.notes || 'None'}

Available agents:
${agentList}

Rules:
- Match client type to agent specialty (investor → commercial, rental → rental properties, luxury → luxury residential)
- Never assign to an agent at full capacity
- If two agents are equal, pick the one with fewer current clients
- Return ONLY a JSON object with: agent_name (string), reason (one sentence)
- No markdown, no explanation, raw JSON only`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const result = JSON.parse(text)

  const matchedAgent = agents.find(a => a.name === result.agent_name)

  if (matchedAgent) {
    await supabaseAdmin
      .from('leads')
      .update({ assigned_agent: matchedAgent.name })
      .eq('id', lead_id)
  }

  return NextResponse.json({
    agent: result.agent_name,
    reason: result.reason,
    success: true
  })
}