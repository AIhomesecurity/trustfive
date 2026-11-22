/** Prevent duplicate in-flight consent mutations for the same booking.
 * A rejected request releases its slot so the customer can retry. This is a
 * browser UX guard, not a replacement for server-side ownership/RLS checks.
 */
export function createBookingConsentGate() {
 const inFlight = new Set<string>();
 return {
  isBusy(bookingId: string): boolean { return inFlight.has(bookingId); },
  async run<T>(bookingId: string, mutation: () => Promise<T>): Promise<{started: boolean; value?: T}> {
   if (!bookingId || inFlight.has(bookingId)) return {started:false};
   inFlight.add(bookingId);
   try { return {started:true, value:await mutation()}; }
   finally { inFlight.delete(bookingId); }
  }
 };
}
