/** Link only with the opaque record identifiers returned by authorised queries.
 * Query parameters are navigation hints, NEVER proof of access. */
/** Malformed identifiers must not crash navigation or produce unsafe URL hints.
 * This is not an authorisation check; RLS and participant queries remain required. */
function opaqueRecordId(id: string): string | null {
 if (!id || id.length > 128 || id.trim() !== id || /[\u0000-\u001f\u007f]/.test(id)) return null;
 try { return encodeURIComponent(id); } catch { return null; }
}
function privateRecordHref(path: string, key: string, id: string): string {
 const encoded = opaqueRecordId(id);
 return encoded === null ? path : path + '?' + key + '=' + encoded;
}
export function quoteMessagesHref(quoteId: string): string {
 return privateRecordHref('/messages', 'quote', quoteId);
}
export function bookingScheduleHref(bookingId: string): string {
 return privateRecordHref('/schedule', 'booking', bookingId);
}
export function bookingHistoryHref(bookingId: string): string {
 return privateRecordHref('/bookings', 'booking', bookingId);
}
/** A navigation hint can only select a record present in an authorised result. */
export function authorisedQuoteSelection(
 requestedId: string | null,
 allowedIds: readonly string[]
): string {
 return requestedId && opaqueRecordId(requestedId) !== null && allowedIds.includes(requestedId) ? requestedId : '';
}
export function authorisedBookingSelection(
 requestedId: string | null,
 allowedIds: readonly string[]
): string {
 return requestedId && opaqueRecordId(requestedId) !== null && allowedIds.includes(requestedId) ? requestedId : '';
}
