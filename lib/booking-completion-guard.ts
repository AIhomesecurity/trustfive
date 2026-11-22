/** Browser-side confirmation gate only. PostgreSQL completion RPC remains
 * the authority on the booking participant and status transitions. */
export function canConfirmCompletedBooking(
 bookingId: string|null,
 booking: {id:string;customer_id:string;status:string}|undefined,
 currentUserId:string
):boolean{
 return Boolean(bookingId&&booking&&currentUserId&&
  booking.id===bookingId&&booking.customer_id===currentUserId&&
  booking.status==='awaiting_customer');
}

/** A single, unambiguous, authorised booking must back the final action.
 * Fail closed if a stale/duplicated response contains conflicting rows. The
 * database RPC remains the final authority for completion transitions. */
export function canConfirmCompletedBookingFromRecords(
 bookingId: string | null,
 bookings: readonly {id:string;customer_id:string;status:string}[],
 currentUserId: string,
): boolean {
 if (!bookingId || !currentUserId) return false;
 const matches = bookings.filter(booking => booking.id === bookingId);
 return matches.length === 1 &&
  canConfirmCompletedBooking(bookingId, matches[0], currentUserId);
}
