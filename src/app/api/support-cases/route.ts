import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Booking support / dispute resolution cases.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const role = searchParams.get('role')
  if (!userId) return NextResponse.json({ cases: [] })
  const where = role === 'customer' ? { customerId: userId } : role === 'trade' ? { tradespersonId: userId } : { OR: [{ customerId: userId }, { tradespersonId: userId }] }
  const cases = await db.supportCase.findMany({ where, include: { customer: { select: { id: true, name: true, avatarUrl: true } }, tradesperson: { select: { id: true, name: true, avatarUrl: true } } }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ cases })
}

export async function POST(req: Request) {
  const { customerId, tradespersonId, bookingId, subject, description, priority } = await req.json()
  if (!customerId || !subject || !description) return NextResponse.json({ error: 'customerId, subject and description are required' }, { status: 400 })
  const supportCase = await db.supportCase.create({ data: { customerId, tradespersonId: tradespersonId ?? null, bookingId: bookingId ?? null, subject, description, priority: priority ?? 'NORMAL', status: 'OPEN' } })
  return NextResponse.json({ supportCase })
}