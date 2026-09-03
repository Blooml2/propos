import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const STEP_DAYS = [0, 2, 5, 10, 21]
const STEP_CHANNELS = ['email', 'sms', 'email', 'sms', 'email']

interface SequenceStep {
  step: number
  day: number
  channel: string
  subject: string | null
  body: string
}

function buildPrompt(lead: Record<string, string | number | null>, agentName: string): string {
  const lines = [
    `You are ${agentName}, a real estate agent. Write a 5-step follow-up sequence to send to a client.`,
    `Every message must sound like a real human wrote it — warm, direct, and specific to this person's situation. No templates, no generic phrasing.`,
    ``,
    `Client profile:`,
    `- Name: ${lead.first_name} ${lead.last_name}`,
  ]

  if (lead.company)        lines.push(`- Company: ${lead.company}`)
  if (lead.title)          lines.push(`- Title / Role: ${lead.title}`)
  if (lead.location)       lines.push(`- Location: ${lead.location}`)
  if (lead.classification) lines.push(`- Client type: ${lead.classification}`)
  if (lead.score != null)  lines.push(`- Lead score: ${lead.score}/10`)
  if (lead.notes && String(lead.notes).trim()) {
    lines.push(`- Notes from previous interactions:`)
    lines.push(`  ${String(lead.notes).trim()}`)
  }

  lines.push(``)
  lines.push(`Writing rules:`)
  lines.push(`- Sign every message as ${agentName}`)
  lines.push(`- Address ${lead.first_name} by first name`)
  lines.push(`- Pull specific details from the notes and profile into each message`)
  lines.push(`- SMS messages must be ≤ 160 characters (including the signature)`)
  lines.push(`- Emails must be ≤ 150 words`)
  lines.push(`- Never write placeholder tokens like [NAME], [PROPERTY], [DATE]`)
  lines.push(`- Tone: professional but human — like a text from someone who knows them`)
  lines.push(``)
  lines.push(`Return ONLY a raw JSON array of exactly 5 objects. No markdown, no explanation.`)
  lines.push(`Each object must have these exact keys:`)
  lines.push(`  step    — integer 1–5`)
  lines.push(`  day     — integer: 0, 2, 5, 10, 21`)
  lines.push(`  channel — "email" or "sms" (order: email, sms, email, sms, email)`)
  lines.push(`  subject — email subject string, or null for sms`)
  lines.push(`  body    — the full message text`)

  return lines.join('\n')
}

export async function POST(request: Request) {
  try {
    const { lead_id } = await request.json()

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })
    }

    // 1. Fetch full lead profile
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const agentName = lead.assigned_agent?.trim() || 'your agent'

    // 2. Generate sequence via Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: buildPrompt(lead, agentName) }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Strip markdown code fences if Claude wraps it anyway
    const cleaned = raw
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim()

    let sequence: SequenceStep[]
    try {
      sequence = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'Claude returned unparseable JSON', raw },
        { status: 500 }
      )
    }

    // 3. Build rows with scheduled_at dates
    const baseDate = new Date()
    const rows = sequence.map((step, i) => {
      const scheduled = new Date(baseDate)
      const dayOffset = step.day ?? STEP_DAYS[i] ?? 0
      scheduled.setDate(scheduled.getDate() + dayOffset)

      return {
        lead_id,
        step: step.step ?? i + 1,
        channel: step.channel ?? STEP_CHANNELS[i],
        subject: step.subject ?? null,
        body: step.body,
        status: 'pending',
        scheduled_at: scheduled.toISOString(),
        opened: false,
        replied: false,
      }
    })

    // 4. Save to sequences table
    const { data: saved, error: saveError } = await supabaseAdmin
      .from('sequences')
      .insert(rows)
      .select()

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, sequences: saved })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
