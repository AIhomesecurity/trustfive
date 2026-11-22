/** Pure customer & participant booking lifecycle helpers.
 *
 * Strictly separates authoritative PostgreSQL RPC commits from subsequent
 * UI list refreshes so a committed booking, address-consent, appointment or
 * review mutation is never misreported as failed when refreshing fails.
 */

export type BookingRecordLike = {
  id: string;
  quote_id: string;
  job_id: string;
  customer_id: string;
  professional_id: string;
  status: string;
  created_at: string;
};

export type BookingStatusFilter = 'all' | 'active' | 'needs_action' | 'completed';
export type BookingStatusTone = 'booked' | 'awaiting' | 'completed' | 'cancelled' | 'other';

export type BookingStatusMeta = Readonly<{
  badgeLabel: string;
  tone: BookingStatusTone;
  description: string;
}>;

export type BookingFilterCounts = Readonly<{
  all: number;
  active: number;
  needs_action: number;
  completed: number;
}>;

export function getBookingStatusMeta(status: string): BookingStatusMeta {
  switch (status) {
    case 'booked':
      return Object.freeze({
        badgeLabel: 'Booked',
        tone: 'booked',
        description: 'Booking recorded — agree an appointment time and track progress.',
      });
    case 'awaiting_customer':
      return Object.freeze({
        badgeLabel: 'Awaiting confirmation',
        tone: 'awaiting',
        description: 'Work marked ready — inspect the finished job before confirming completion.',
      });
    case 'completed':
      return Object.freeze({
        badgeLabel: 'Completed',
        tone: 'completed',
        description: 'Completion confirmed — a genuine verified-booking review can now be left.',
      });
    case 'cancelled':
      return Object.freeze({
        badgeLabel: 'Cancelled',
        tone: 'cancelled',
        description: 'This booking has been cancelled.',
      });
    default:
      return Object.freeze({
        badgeLabel: status.replace(/_/g, ' '),
        tone: 'other',
        description: 'Current TrustFive booking status.',
      });
  }
}

export function bookingNeedsUserAction(
  booking: Pick<BookingRecordLike, 'status' | 'customer_id' | 'professional_id'>,
  userId: string
): boolean {
  if (!userId) return false;
  return (
    (booking.customer_id === userId && booking.status === 'awaiting_customer') ||
    (booking.professional_id === userId && booking.status === 'booked')
  );
}

export function summarizeBookingStatuses(
  bookings: readonly Pick<BookingRecordLike, 'status' | 'customer_id' | 'professional_id'>[],
  userId: string
): BookingFilterCounts {
  let active = 0;
  let needsAction = 0;
  let completed = 0;
  for (const b of bookings) {
    if (b.status === 'booked' || b.status === 'awaiting_customer') active += 1;
    if (bookingNeedsUserAction(b, userId)) needsAction += 1;
    if (b.status === 'completed') completed += 1;
  }
  return Object.freeze({
    all: bookings.length,
    active,
    needs_action: needsAction,
    completed,
  });
}

export function filterBookings<T extends Pick<BookingRecordLike, 'status' | 'customer_id' | 'professional_id'>>(
  bookings: readonly T[],
  filter: BookingStatusFilter,
  userId: string
): T[] {
  if (filter === 'active') {
    return bookings.filter(b => b.status === 'booked' || b.status === 'awaiting_customer');
  }
  if (filter === 'needs_action') {
    return bookings.filter(b => bookingNeedsUserAction(b, userId));
  }
  if (filter === 'completed') {
    return bookings.filter(b => b.status === 'completed');
  }
  return [...bookings];
}

export function validateBookingReviewInput(starsRaw: string | number, bodyRaw: string): string | null {
  const rating = Number(starsRaw);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 'Choose a rating between 1 and 5 stars.';
  }
  const clean = bodyRaw.trim();
  if (clean.length < 10) {
    return 'Write at least 10 characters describing your real experience of the completed work.';
  }
  if (clean.length > 1500) {
    return 'Reviews must be 1,500 characters or fewer.';
  }
  return null;
}

/** Reflect an ALREADY-COMMITTED booking status transition locally so a refresh failure
 * never leaves stale completion or mark-ready buttons visible. */
export function applyCommittedBookingStatus<T extends {id: string; status: string}>(
  bookings: readonly T[],
  bookingId: string,
  nextStatus: 'awaiting_customer' | 'completed'
): T[] {
  return bookings.map(b => (b.id === bookingId ? {...b, status: nextStatus} : b));
}

/** Reflect an ALREADY-COMMITTED booking review locally so a refresh failure
 * never invites duplicate review submissions. */
export function applyCommittedReview(
  reviews: readonly {booking_id: string}[],
  bookingId: string
): {booking_id: string}[] {
  if (reviews.some(r => r.booking_id === bookingId)) return [...reviews];
  return [...reviews, {booking_id: bookingId}];
}

/** Reflect an ALREADY-COMMITTED appointment confirmation/cancellation locally. */
export function applyCommittedAppointmentStatus<T extends {booking_id: string; status: string}>(
  appointments: readonly T[],
  bookingId: string,
  nextStatus: 'confirmed' | 'cancelled'
): T[] {
  return appointments.map(a => (a.booking_id === bookingId ? {...a, status: nextStatus} : a));
}

export type BookingActionResult =
  | {outcome: 'committed'; committed: true; message: string}
  | {outcome: 'committed_refresh_failed'; committed: true; message: string}
  | {outcome: 'rpc_error'; committed: false; message: string};

/** Separates authoritative DB commit from post-commit refresh.
 * Guarantees a committed server mutation is never reported as failed merely
 * because the subsequent refresh failed. */
export async function executeBookingAction(params: {
  runRpc: () => Promise<{error: {message?: string} | null}>;
  onCommittedLocalUpdate: () => void;
  runRefresh: () => Promise<void>;
  successMessage: string;
  refreshFailedMessage: string;
  fallbackErrorMessage: string;
}): Promise<BookingActionResult> {
  try {
    const {error} = await params.runRpc();
    if (error) {
      return {
        outcome: 'rpc_error',
        committed: false,
        message: error.message || params.fallbackErrorMessage,
      };
    }
  } catch (err) {
    return {
      outcome: 'rpc_error',
      committed: false,
      message: err instanceof Error ? err.message : params.fallbackErrorMessage,
    };
  }

  params.onCommittedLocalUpdate();

  try {
    await params.runRefresh();
    return {
      outcome: 'committed',
      committed: true,
      message: params.successMessage,
    };
  } catch {
    return {
      outcome: 'committed_refresh_failed',
      committed: true,
      message: params.refreshFailedMessage,
    };
  }
}
