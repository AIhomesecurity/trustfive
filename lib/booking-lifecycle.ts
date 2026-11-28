import {safeNotificationTarget} from './notification-target';
/** Pure customer & participant booking lifecycle helpers for /bookings.
 *
 * Carries forward commit-vs-refresh isolation and privacy-preserving address
 * consent recovery from PR #66 (95562b4), and adds next-action guidance,
 * booking selection resolution, and single-flight duplicate-submit protection.
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

export type BookingAppointmentLike = {
  booking_id: string;
  proposed_by?: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  timezone_name: string;
};

export type BookingSiteLike = {
  address_label: string;
  postcode: string | null;
  sharing_enabled: boolean;
};

export type BookingReviewRecord = {
  booking_id: string;
  stars?: number | null;
  body?: string | null;
  created_at?: string | null;
};

export type BookingStatusFilter = 'needs_action' | 'active' | 'completed' | 'all';
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

export type BookingNextAction = Readonly<{
  label: string;
  detail: string;
  priority: 'urgent' | 'normal' | 'done';
  section: 'appointment' | 'address' | 'completion' | 'review' | 'none';
}>;

export function bookingDisplayTitle(bookingId: string, jobTitle?: string | null): string {
  const clean = typeof jobTitle === 'string' ? jobTitle.trim() : '';
  return clean || `Booking #${bookingId.slice(0, 8)}`;
}

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
  userId: string,
  appointment?: Pick<BookingAppointmentLike, 'status' | 'proposed_by'> | null,
  hasReviewed = false
): boolean {
  if (!userId) return false;
  const isCustomer = booking.customer_id === userId;
  const isProfessional = booking.professional_id === userId;

  // Pending appointment proposal from the other party always requires action while active
  if (
    (booking.status === 'booked' || booking.status === 'awaiting_customer') &&
    appointment?.status === 'proposed' &&
    Boolean(appointment.proposed_by) &&
    appointment.proposed_by !== userId
  ) {
    return true;
  }

  if (isCustomer && booking.status === 'awaiting_customer') return true;
  if (isCustomer && booking.status === 'completed' && !hasReviewed) return true;
  if (isProfessional && booking.status === 'booked') return true;
  return false;
}

export function deriveBookingNextAction(params: {
  booking: Pick<BookingRecordLike, 'status' | 'customer_id' | 'professional_id'>;
  userId: string;
  appointment?: Pick<BookingAppointmentLike, 'status' | 'proposed_by'> | null;
  hasReviewed?: boolean;
  siteInfo?: Pick<BookingSiteLike, 'sharing_enabled'> | null;
  siteUnavailable?: boolean;
}): BookingNextAction {
  const {booking, userId, appointment, hasReviewed = false, siteInfo, siteUnavailable = false} = params;
  const isCustomer = booking.customer_id === userId;
  const isProfessional = booking.professional_id === userId;

  if (booking.status === 'cancelled') {
    return Object.freeze({
      label: 'Booking cancelled',
      detail: 'No further action is required on this booking.',
      priority: 'done',
      section: 'none',
    });
  }

  if (booking.status === 'completed') {
    if (isCustomer && !hasReviewed) {
      return Object.freeze({
        label: 'Leave verified-booking review',
        detail: 'Share your genuine experience of the completed work.',
        priority: 'normal',
        section: 'review',
      });
    }
    return Object.freeze({
      label: hasReviewed ? 'Completed & reviewed' : 'Completed',
      detail: hasReviewed
        ? 'Your verified-booking review has been recorded.'
        : 'Work has been confirmed as completed.',
      priority: 'done',
      section: 'none',
    });
  }

  if (isCustomer && booking.status === 'awaiting_customer') {
    return Object.freeze({
      label: 'Confirm work is completed',
      detail: 'The professional marked this job ready. Inspect the work before confirming.',
      priority: 'urgent',
      section: 'completion',
    });
  }

  if (isProfessional && booking.status === 'awaiting_customer') {
    return Object.freeze({
      label: 'Awaiting customer confirmation',
      detail: 'The customer must independently confirm completion before a review unlocks.',
      priority: 'normal',
      section: 'completion',
    });
  }

  // Active booked stage: check appointment proposals first
  if (appointment?.status === 'proposed') {
    if (appointment.proposed_by && appointment.proposed_by !== userId) {
      return Object.freeze({
        label: 'Confirm proposed appointment',
        detail: 'Review and confirm the proposed time, or suggest a different slot.',
        priority: 'urgent',
        section: 'appointment',
      });
    }
    return Object.freeze({
      label: 'Awaiting appointment confirmation',
      detail: 'Waiting for the other participant to confirm your proposed time.',
      priority: 'normal',
      section: 'appointment',
    });
  }

  if (!appointment || appointment.status === 'cancelled') {
    return Object.freeze({
      label: 'Agree an appointment time',
      detail: 'Propose a visit window in the booking schedule.',
      priority: isCustomer ? 'normal' : 'urgent',
      section: 'appointment',
    });
  }

  if (isCustomer) {
    if (siteUnavailable) {
      return Object.freeze({
        label: 'Recheck address sharing status',
        detail: 'Verify whether your exact address is shared with this professional.',
        priority: 'normal',
        section: 'address',
      });
    }
    if (siteInfo && !siteInfo.sharing_enabled) {
      return Object.freeze({
        label: 'Share exact address when ready',
        detail: 'Appointment confirmed. Share your exact job address when you are ready for the visit.',
        priority: 'normal',
        section: 'address',
      });
    }
    return Object.freeze({
      label: 'Appointment confirmed — await completion',
      detail: 'Once the professional finishes and marks work ready, you can confirm completion here.',
      priority: 'normal',
      section: 'completion',
    });
  }

  if (isProfessional) {
    return Object.freeze({
      label: 'Mark work ready when finished',
      detail: 'Once the agreed work is done, mark it ready for customer confirmation.',
      priority: 'urgent',
      section: 'completion',
    });
  }

  return Object.freeze({
    label: 'View booking details',
    detail: 'Track booking progress below.',
    priority: 'normal',
    section: 'none',
  });
}

export function summarizeBookingStatuses(
  bookings: readonly Pick<BookingRecordLike, 'id' | 'status' | 'customer_id' | 'professional_id'>[],
  userId: string,
  appointments: Readonly<Record<string, Pick<BookingAppointmentLike, 'status' | 'proposed_by'>>> = {},
  reviewedBookingIds: ReadonlySet<string> = new Set()
): BookingFilterCounts {
  let active = 0;
  let needsAction = 0;
  let completed = 0;
  for (const b of bookings) {
    if (b.status === 'booked' || b.status === 'awaiting_customer') active += 1;
    if (bookingNeedsUserAction(b, userId, appointments[b.id], reviewedBookingIds.has(b.id))) {
      needsAction += 1;
    }
    if (b.status === 'completed') completed += 1;
  }
  return Object.freeze({
    all: bookings.length,
    active,
    needs_action: needsAction,
    completed,
  });
}

export function filterBookings<
  T extends Pick<BookingRecordLike, 'id' | 'status' | 'customer_id' | 'professional_id'>,
>(
  bookings: readonly T[],
  filter: BookingStatusFilter,
  userId: string,
  appointments: Readonly<Record<string, Pick<BookingAppointmentLike, 'status' | 'proposed_by'>>> = {},
  reviewedBookingIds: ReadonlySet<string> = new Set()
): T[] {
  if (filter === 'active') {
    return bookings.filter(b => b.status === 'booked' || b.status === 'awaiting_customer');
  }
  if (filter === 'needs_action') {
    return bookings.filter(b =>
      bookingNeedsUserAction(b, userId, appointments[b.id], reviewedBookingIds.has(b.id))
    );
  }
  if (filter === 'completed') {
    return bookings.filter(b => b.status === 'completed');
  }
  return [...bookings];
}

/** Deterministically choose which booking is selected in the detail workspace.
 * Never selects a booking ID that is absent from the authorised list. */
export function resolveSelectedBookingId(params: {
  visibleIds: readonly string[];
  currentSelectedId: string;
  deepLinkBookingId?: string;
}): string {
  const {visibleIds, currentSelectedId, deepLinkBookingId} = params;
  if (currentSelectedId && visibleIds.includes(currentSelectedId)) {
    return currentSelectedId;
  }
  if (deepLinkBookingId && visibleIds.includes(deepLinkBookingId)) {
    return deepLinkBookingId;
  }
  return visibleIds[0] || '';
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

export function applyCommittedBookingStatus<T extends {id: string; status: string}>(
  bookings: readonly T[],
  bookingId: string,
  nextStatus: 'awaiting_customer' | 'completed'
): T[] {
  return bookings.map(b => (b.id === bookingId ? {...b, status: nextStatus} : b));
}

export function applyCommittedReview<T extends BookingReviewRecord>(
  reviews: readonly T[],
  bookingId: string,
  submitted?: {stars?: number; body?: string; created_at?: string}
): T[] {
  const nextRecord = (submitted
    ? {booking_id: bookingId, ...submitted}
    : {booking_id: bookingId}) as T;
  if (reviews.some(r => r.booking_id === bookingId)) {
    if (!submitted) return [...reviews];
    return reviews.map(r => (r.booking_id === bookingId ? {...r, ...submitted} : r));
  }
  return [...reviews, nextRecord];
}

export function applyCommittedAppointmentMap<T extends {booking_id: string; status: string}>(
  appointments: Readonly<Record<string, T>>,
  bookingId: string,
  nextStatus: 'confirmed' | 'cancelled'
): Record<string, T> {
  const existing = appointments[bookingId];
  if (!existing) return {...appointments};
  return {
    ...appointments,
    [bookingId]: {...existing, status: nextStatus},
  };
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

/** Synchronous single-flight lock preventing rapid repeat clicks from
 * submitting the same booking action twice before React re-renders. */
export function createSingleFlightLock() {
  let active = false;
  return {
    isLocked(): boolean {
      return active;
    },
    async run<T>(task: () => Promise<T>): Promise<{skipped: true} | {skipped: false; value: T}> {
      if (active) return {skipped: true};
      active = true;
      try {
        const value = await task();
        return {skipped: false, value};
      } finally {
        active = false;
      }
    },
  };
}

export type CustomerSiteConsentView = 'updating' | 'checking' | 'unavailable' | 'loaded' | 'none';

export function clearBookingSiteCache<T>(
  sites: Readonly<Record<string, T | null>>,
  bookingId: string
): Record<string, T | null> {
  const next: Record<string, T | null> = {...sites};
  delete next[bookingId];
  return next;
}

export function markBookingSiteNeedsRecheck(
  unavailableIds: readonly string[],
  bookingId: string
): string[] {
  if (unavailableIds.includes(bookingId)) return [...unavailableIds];
  return [...unavailableIds, bookingId];
}

export function resolveCustomerSiteConsentView(params: {
  bookingStatus: string;
  hasLoadedSite: boolean;
  siteUnavailable: boolean;
  siteBusy: boolean;
  loadingBookings: boolean;
}): CustomerSiteConsentView {
  if (params.siteBusy) return 'updating';
  if (params.hasLoadedSite) return 'loaded';
  if (params.siteUnavailable) return 'unavailable';
  if (
    params.loadingBookings &&
    (params.bookingStatus === 'booked' || params.bookingStatus === 'awaiting_customer')
  ) {
    return 'checking';
  }
  return 'none';
}


export async function resolveLinkedBooking<T extends BookingRecordLike>(
  requested: readonly string[],
  recent: T[],
  userId: string,
  lookup: (id: string) => Promise<T | null>
): Promise<{records: T[]; selectedId: string}> {
  const unavailable = {records: recent, selectedId: ''};
  if (requested.length !== 1 || !userId) return unavailable;
  const target = safeNotificationTarget('/bookings?booking=' + encodeURIComponent(requested[0]));
  if (!target) return unavailable;
  const id = target.split('=')[1];
  const owns = (booking: T) => booking.id === id &&
    (booking.customer_id === userId || booking.professional_id === userId);
  if (recent.some(owns)) return {records: recent, selectedId: id};
  try {
    const booking = await lookup(id);
    if (booking && owns(booking)) return {records: [booking, ...recent], selectedId: id};
  } catch {
    // An unavailable linked record should not prevent browsing recent bookings.
  }
  return unavailable;
}
