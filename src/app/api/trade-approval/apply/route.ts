import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// A tradesperson applies for marketplace approval in a trade + district.
// If fewer than 5 approved providers exist, status = APPROVED (rank 1-5).
// If 5 are already approved, status = WAITLISTED (rank 6+).
export async function POST(req: Request) {
  const { userId, tradeName, districtId } = await req.json()
  if (!userId || !tradeName || !districtId) return NextResponse.json({ error: 'userId, tradeName and districtId are required' }, { status: 400 })

  const existing = await db.tradeApproval.findUnique({ where: { userId_tradeName_districtId: { userId, tradeName, districtId } } })
  if (existing) return NextResponse.json({ approval: existing, message: 'Already applied' })

  let slot = await db.tradeSlot.findUnique({ where: { tradeName_districtId: { tradeName, districtId } } })
  if (!slot) slot = await db.tradeSlot.create({ data: { tradeName, districtId, maxSlots: 5, filledSlots: 0 } })

  const isApproved = slot.filledSlots < slot.maxSlots
  const rank = slot.filledSlots + 1
  const status = isApproved ? 'APPROVED' : 'WAITLISTED'

  const approval = await db.tradeApproval.create({ data: { userId, tradeName, districtId, tradeSlotId: slot.id, status, rank, approvedAt: isApproved ? new Date() : null } })
  if (isApproved) await db.tradeSlot.update({ where: { id: slot.id }, data: { filledSlots: slot.filledSlots + 1 } })

  return NextResponse.json({
    approval,
    message: isApproved ? `Approved! You are provider #${rank} of ${slot.maxSlots} for ${tradeName} in this district.` : `Waitlisted — all ${slot.maxSlots} slots are filled. You are position #${rank} on the waiting list.`,
  })
}