import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      first_name,
      last_name,
      email,
      phone,
      intent,
      budget,
      property_type,
      location,
      timeline,
    } = body

    if (!first_name || !last_name) {
      return NextResponse.json(
        { error: 'first_name and last_name are required' },
        { status: 400 }
      )
    }

    // Build tags from non-empty qualifier fields
    const tags = [intent, budget, property_type, timeline].filter(
      (v): v is string => typeof v === 'string' && v.trim() !== ''
    )

    // Build notes string
    const notes = [
      budget       ? `Budget: ${budget}.`        : null,
      property_type ? `Property type: ${property_type}.` : null,
      timeline     ? `Timeline: ${timeline}.`    : null,
    ]
      .filter(Boolean)
      .join(' ')

    // Insert the lead
    const { data: lead, error: insertError } = await supabaseAdmin
      .from('leads')
      .insert({
        first_name,
        last_name,
        email:    email    || null,
        phone:    phone    || null,
        location: location || null,
        title:    intent   || null,
        source:   'chatbot',
        status:   'new',
        tags:     tags.length > 0 ? tags : null,
        notes:    notes   || null,
      })
      .select('id')
      .single()

    if (insertError || !lead) {
      console.error('[chatbot-lead] insert error:', insertError)
      return NextResponse.json(
        { error: insertError?.message ?? 'Failed to save lead' },
        { status: 500 }
      )
    }

    // Fire-and-forget: auto-assign best agent (non-blocking)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        ?? (request.headers.get('origin') ?? 'http://localhost:3000')

      await fetch(`${baseUrl}/api/match-agent`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ lead_id: lead.id }),
      })
    } catch (matchErr) {
      // Non-fatal — lead was saved; agent matching failed silently
      console.warn('[chatbot-lead] match-agent failed:', matchErr)
    }

    return NextResponse.json({ success: true, lead_id: lead.id }, { status: 201 })
  } catch (err) {
    console.error('[chatbot-lead] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
