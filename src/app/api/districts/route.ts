import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// List districts — town/outward-postcode level only (no full postcodes).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const districts = await db.district.findMany({
    where: q ? { name: { contains: q } } : undefined,
    include: { tradeSlots: { select: { tradeName: true, filledSlots: true, maxSlots: true } } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ districts })
}