import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  const { leads } = await request.json()

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: 'No leads provided' }, { status: 400 })
  }

  // Upsert in batches of 100 to avoid payload limits
  const batchSize = 100
  let inserted = 0
  const errors: string[] = []

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize)
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert(batch)
      .select('id')

    if (error) {
      errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`)
    } else {
      inserted += data?.length ?? 0
    }
  }

  if (errors.length > 0 && inserted === 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
  }

  return NextResponse.json({ inserted, errors: errors.length > 0 ? errors : undefined })
}
