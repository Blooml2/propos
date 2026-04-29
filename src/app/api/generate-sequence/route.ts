import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  const lead = await request.json()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are a senior real estate sales assistant writing follow-up messages for a brokerage.

Write a 5-step follow-up sequence for this lead. Each step must sound human, warm, and specific to their situation. Never sound like a template.

Lead info:
- Name: ${lead.first_name} ${lead.last_name}
- Company: ${lead.company}
- Title: ${lead.title}
- Location: ${lead.location}

Return ONLY a JSON array with exactly 5 objects. Each object must have:
- step (number 1-5)
- day (0, 2, 5, 10, 21)
- channel (email or sms)
- subject (email subject line, null for sms)
- body (the message content)

Channels in order: email, sms, email, sms, email.
Keep SMS under 160 characters. Emails under 150 words.
No placeholders like [NAME] — use the actual lead data.
Return raw JSON only, no markdown, no explanation.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const sequence = JSON.parse(text)

  return NextResponse.json({ sequence })
}