// Deprecated stub — the actual endpoint is at /api/generate-sequence
import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json(
    { error: 'This endpoint has moved. Use POST /api/generate-sequence instead.' },
    { status: 410 }
  )
}

export function POST() {
  return NextResponse.json(
    { error: 'This endpoint has moved. Use POST /api/generate-sequence instead.' },
    { status: 410 }
  )
}
