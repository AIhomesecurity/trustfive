import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Express interest in a B2B collaboration request.
export async function POST(req: Request) {
  const { collabRequestId, tradeUserId, note } = await req.json()
  if (!collabRequestId || !tradeUserId) return NextResponse.json({ error: 'collabRequestId and tradeUserId are required' }, { status: 400 })
  const existing = await db.collabInterest.findUnique({ where: { collabRequestId_tradeUserId: { collabRequestId, tradeUserId } } })
  if (existing) return NextResponse.json({ interest: existing, message: 'Already expressed interest' })
  const interest = await db.collabInterest.create({ data: { collabRequestId, tradeUserId, note, status: 'EXPRESSED' } })
  await db.collabRequest.update({ where: { id: collabRequestId }, data: { status: 'INTERESTED' } })
  return NextResponse.json({ interest })
}