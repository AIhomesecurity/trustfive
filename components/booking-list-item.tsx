'use client';

import {formatAppointmentWindow} from '../lib/appointment-schedule';
import {
  bookingDisplayTitle,
  deriveBookingNextAction,
  getBookingStatusMeta,
  type BookingAppointmentLike,
  type BookingRecordLike,
  type BookingSiteLike,
} from '../lib/booking-lifecycle';

export type BookingListItemProps = {
  booking: BookingRecordLike;
  userId: string;
  jobTitle?: string | null;
  businessName?: string | null;
  amountPence?: number | null;
  appointment?: BookingAppointmentLike | null;
  siteInfo?: BookingSiteLike | null;
  siteUnavailable?: boolean;
  hasReviewed: boolean;
  selected: boolean;
  onSelect: (bookingId: string) => void;
};

const money = (pence: number) => '£' + (pence / 100).toFixed(2);

export default function BookingListItem({
  booking,
  userId,
  jobTitle,
  businessName,
  amountPence,
  appointment,
  siteInfo,
  siteUnavailable,
  hasReviewed,
  selected,
  onSelect,
}: BookingListItemProps) {
  const title = bookingDisplayTitle(booking.id, jobTitle);
  const statusMeta = getBookingStatusMeta(booking.status);
  const nextAction = deriveBookingNextAction({
    booking,
    userId,
    appointment,
    hasReviewed,
    siteInfo,
    siteUnavailable,
  });
  const roleLabel = booking.customer_id === userId ? 'Customer' : 'Professional';

  return (
    <button
      type="button"
      className={`booking-row${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      aria-current={selected ? 'true' : undefined}
      data-testid={`booking-row-${booking.id}`}
      data-booking-status={booking.status}
      onClick={() => onSelect(booking.id)}
    >
      <span className="booking-row-top">
        <span className={`booking-status-pill is-${statusMeta.tone}`}>
          <span className="job-status-dot" aria-hidden="true" />
          {statusMeta.badgeLabel}
        </span>
        <span className="booking-row-role">
          {roleLabel} · #{booking.id.slice(0, 8)}
        </span>
      </span>

      <strong className="booking-row-title">{title}</strong>

      {(businessName || typeof amountPence === 'number') ? (
        <span className="booking-row-sub">
          {businessName ? businessName : null}
          {businessName && typeof amountPence === 'number' ? ' · ' : null}
          {typeof amountPence === 'number' ? money(amountPence) : null}
        </span>
      ) : null}

      <span className="booking-row-appt">
        {appointment ? (
          <>
            <strong>Appointment ({appointment.status}):</strong>{' '}
            {formatAppointmentWindow(
              appointment.starts_at,
              appointment.ends_at,
              appointment.timezone_name
            )}
          </>
        ) : (
          'No appointment agreed yet'
        )}
      </span>

      <span className={`booking-row-next is-${nextAction.priority}`}>
        <strong>Next:</strong> {nextAction.label}
      </span>
    </button>
  );
}
