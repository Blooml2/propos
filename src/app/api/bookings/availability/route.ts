import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const agent_id = searchParams.get('agent_id')
  const date = searchParams.get('date') // YYYY-MM-DD

  if (!agent_id || !date) {
    return NextResponse.json({ error: 'agent_id and date are required' }, { status: 400 })
  }

  // day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayOfWeek = new Date(date + 'T12:00:00').getDay()

  // Fetch agent's working hours for that day
  const { data: avail, error: availError } = await supabaseAdmin
    .from('availability')
    .select('start_time, end_time')
    .eq('agent_id', agent_id)
    .eq('day_of_week', dayOfWeek)
    .single()

  if (availError || !avail) {
    return NextResponse.json({ slots: [] }) // agent not available that day
  }

  // Fetch existing bookings for that agent on that date
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('start_time, end_time')
    .eq('agent_id', agent_id)
    .eq('date', date)
    .neq('status', 'cancelled')

  // Build booked intervals in minutes
  const bookedSlots = new Set<number>()
  if (bookings) {
    for (const b of bookings) {
      const start = timeToMinutes(b.start_time.slice(0, 5))
      const end = timeToMinutes(b.end_time.slice(0, 5))
      for (let t = start; t < end; t += 30) {
        bookedSlots.add(t)
      }
    }
  }

  // Generate all 30-min slots between start and end
  const startMin = timeToMinutes(avail.start_time.slice(0, 5))
  const endMin = timeToMinutes(avail.end_time.slice(0, 5))
  const slots: string[] = []

  for (let t = startMin; t + 30 <= endMin; t += 30) {
    if (!bookedSlots.has(t)) {
      slots.push(minutesToTime(t))
    }
  }

  return NextResponse.json({ slots })
}
