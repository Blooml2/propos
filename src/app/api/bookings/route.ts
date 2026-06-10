import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(`
      *,
      lead:leads(first_name, last_name, company),
      agent:agents(name)
    `)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { lead_id, agent_id, date, start_time, meeting_type } = body

  if (!lead_id || !agent_id || !date || !start_time) {
    return NextResponse.json({ error: 'lead_id, agent_id, date, and start_time are required' }, { status: 400 })
  }

  const end_time = addMinutes(start_time, 30)

  // Check slot is still available
  const { data: conflict } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('agent_id', agent_id)
    .eq('date', date)
    .eq('start_time', start_time + ':00')
    .neq('status', 'cancelled')
    .maybeSingle()

  if (conflict) {
    return NextResponse.json({ error: 'This slot was just booked. Please choose another time.' }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .insert({
      lead_id,
      agent_id,
      date,
      start_time: start_time + ':00',
      end_time: end_time + ':00',
      meeting_type: meeting_type ?? 'consultation',
      status: 'confirmed',
    })
    .select(`
      *,
      lead:leads(first_name, last_name),
      agent:agents(name)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
