/** Link only with the opaque record identifiers returned by authorised queries.
 * Query parameters are navigation hints, NEVER proof of access. */
export function quoteMessagesHref(quoteId: string): string {
 return '/messages?quote='+encodeURIComponent(quoteId);
}
export function bookingScheduleHref(bookingId: string): string {
 return '/schedule?booking='+encodeURIComponent(bookingId);
}
export function bookingHistoryHref(bookingId: string): string {
 return '/bookings?booking='+encodeURIComponent(bookingId);
}
/** Refuse deep-linked conversations that are absent from an account's visible
 * quote results, even if the caller knows a private UUID. */
export function authorisedQuoteSelection(
 requestedId: string | null,
 allowedIds: readonly string[]
): string {
 return requestedId && allowedIds.includes(requestedId) ? requestedId : '';
}
export function authorisedBookingSelection(
 requestedId: string | null,
 allowedIds: readonly string[]
): string {
 return requestedId && allowedIds.includes(requestedId) ? requestedId : '';
}
