import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// B2B collaboration requests — tradespeople seeking subcontractors.
// NO customer data on these rows (TrustFive privacy boundary).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const tradeNeeded = searchParams.get('tradeNeeded')
  const requests = await db.collabRequest.findMany({
    where: { ...(status ? { status } : {}), ...(tradeNeeded ? { tradeNeeded: { contains: tradeNeeded } } : {}) },
    include: { author: { select: { id: true, name: true, avatarUrl: true, accountType: true } }, district: { select: { id: true, name: true, region: true } }, interests: { include: { tradeUser: { select: { id: true, name: true, avatarUrl: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ requests })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { authorId, tradeNeeded, districtId, districtName, startDate, endDate, scope, budgetMin, budgetMax } = body
  if (!authorId || !tradeNeeded) return NextResponse.json({ error: 'authorId and tradeNeeded are required' }, { status: 400 })
  const request = await db.collabRequest.create({ data: { authorId, tradeNeeded, districtId: districtId ?? null, districtName: districtName ?? null, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, scope, budgetMin: budgetMin ? Number(budgetMin) : null, budgetMax: budgetMax ? Number(budgetMax) : null, status: 'OPEN' } })
  return NextResponse.json({ request })
}