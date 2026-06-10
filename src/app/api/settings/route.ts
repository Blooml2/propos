import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('*')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const settings: Record<string, string> = {}
  data?.forEach((row) => { settings[row.key] = row.value })

  return NextResponse.json(settings)
}

export async function PATCH(request: Request) {
  const body = await request.json()

  for (const [key, value] of Object.entries(body)) {
    await supabaseAdmin
      .from('settings')
      .update({ value: String(value), updated_at: new Date().toISOString() })
      .eq('key', key)
  }

  return NextResponse.json({ success: true })
}