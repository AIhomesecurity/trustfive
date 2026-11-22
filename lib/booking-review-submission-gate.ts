/**
 * A synchronous in-flight gate for booking review writes.
 *
 * React's busy state updates asynchronously, so two submit events can both
 * observe busy=false before a rerender. This gate blocks the second write
 * immediately. The database remains authoritative for one review per booking.
 */
export function createBookingReviewSubmissionGate() {
  let inFlight = false;
  return {
    acquire(): boolean {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    release(): void {
      inFlight = false;
    },
    get pending(): boolean {
      return inFlight;
    },
  };
}
