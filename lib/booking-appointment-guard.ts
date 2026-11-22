/** Browser-side fail-closed appointment selection. The PostgreSQL RPCs remain
 * authoritative for participant permissions, status and time conflicts. */
export type SchedulableBooking = {
 id:string; customer_id:string; professional_id:string; status:string
};
export function canManageBookingAppointment(
 bookingId:string,
 rows:readonly SchedulableBooking[],
 userId:string,
):boolean {
 if(!bookingId||!userId)return false;
 const matches=rows.filter(row=>row.id===bookingId);
 return matches.length===1 &&
  (matches[0].status==='booked'||matches[0].status==='awaiting_customer') &&
  (matches[0].customer_id===userId||matches[0].professional_id===userId);
}
