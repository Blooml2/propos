import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function GET() {
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are PropOS, an AI system for real estate brokerages.
        Score this lead from 1-10 and explain why in one sentence.
        Lead: John Martinez, Broker/Owner at Sunrise Realty, Miami FL, 15 agents.`,
      },
    ],
  })

  return NextResponse.json({
    response: message.content[0].type === 'text' ? message.content[0].text : '',
  })
}