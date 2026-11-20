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
