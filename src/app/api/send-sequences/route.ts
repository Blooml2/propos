import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import twilio from 'twilio'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Clients (instantiated lazily so missing env vars fail at call time, not boot) ──

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

function getTwilio() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}) {
  const from = process.env.RESEND_FROM_EMAIL ?? 'ErickOS <onboarding@resend.dev>'
  const resend = getResend()

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap;line-height:1.7;max-width:600px">${escapeHtml(body)}</pre>`,
    text: body,
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
}

async function sendSms({ to, body }: { to: string; body: string }) {
  const client = getTwilio()

  await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
  })
}

// ─── Handler ──────────────────────────────────────────────────────────────────
// Called by n8n daily on a schedule.
// Supports both GET and POST so n8n's Schedule Trigger works with either method.
// Recommend adding a secret header check in production:
//   if (request.headers.get('x-api-key') !== process.env.SEND_SECRET) return 401

export async function POST() {
  return runSend()
}

export async function GET() {
  return runSend()
}

async function runSend() {
  const now = new Date().toISOString()

  // 1. Fetch all sequences due today (pending + scheduled_at ≤ now)
  //    Join the leads table to get contact info
  const { data: sequences, error: fetchError } = await supabaseAdmin
    .from('sequences')
    .select(`
      id,
      lead_id,
      step,
      channel,
      subject,
      body,
      scheduled_at,
      leads (
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!sequences || sequences.length === 0) {
    return NextResponse.json({ sent: 0, errors: [], message: 'No sequences due right now' })
  }

  // 2. Send each sequence and track results
  const sent: { id: string; channel: string; step: number }[] = []
  const errors: string[] = []

  for (const seq of sequences) {
    const lead = Array.isArray(seq.leads) ? seq.leads[0] : seq.leads

    try {
      if (!lead) {
        throw new Error(`No lead record found for sequence ${seq.id}`)
      }

      if (seq.channel === 'email') {
        if (!lead.email) {
          throw new Error(`Lead has no email address (sequence ${seq.id}, lead ${seq.lead_id})`)
        }
        await sendEmail({
          to: lead.email,
          subject: seq.subject ?? `A note from your agent, ${lead.first_name}`,
          body: seq.body,
        })
      } else if (seq.channel === 'sms') {
        if (!lead.phone) {
          throw new Error(`Lead has no phone number (sequence ${seq.id}, lead ${seq.lead_id})`)
        }
        await sendSms({ to: lead.phone, body: seq.body })
      } else {
        throw new Error(`Unknown channel "${seq.channel}" on sequence ${seq.id}`)
      }

      // 3a. Mark as sent
      await supabaseAdmin
        .from('sequences')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', seq.id)

      sent.push({ id: seq.id, channel: seq.channel, step: seq.step })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(msg)

      // 3b. Mark as failed so it doesn't retry endlessly
      await supabaseAdmin
        .from('sequences')
        .update({ status: 'failed' })
        .eq('id', seq.id)
    }
  }

  return NextResponse.json({
    sent: sent.length,
    failed: errors.length,
    errors: errors.length > 0 ? errors : undefined,
    details: sent,
  })
}
