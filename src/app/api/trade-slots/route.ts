import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// THE FIVE-SLOT RULE: max 5 approved providers per trade per district.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const trade = searchParams.get('trade')
  const districtId = searchParams.get('districtId')

  const slots = await db.tradeSlot.findMany({
    where: { ...(trade ? { tradeName: trade } : {}), ...(districtId ? { districtId } : {}) },
    include: {
      district: { select: { id: true, name: true, region: true } },
      approvals: { where: { status: 'APPROVED' }, include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
    orderBy: { tradeName: 'asc' },
  })

  const result = slots.map((s) => ({
    id: s.id, tradeName: s.tradeName, district: s.district, maxSlots: s.maxSlots, filledSlots: s.filledSlots,
    availableSlots: s.maxSlots - s.filledSlots, approvedProviders: s.approvals.map((a) => ({ ...a.user, rank: a.rank })),
  }))
  return NextResponse.json({ slots: result })
}