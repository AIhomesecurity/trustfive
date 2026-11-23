'use client';

import {FormEvent,RefObject,useEffect,useRef} from 'react';
import Link from 'next/link';
import {formatAppointmentWindow} from '../lib/appointment-schedule';
import {deriveBookingProgressSteps} from '../lib/quote-comparison';
import {bookingScheduleHref,quoteMessagesHref} from '../lib/workflow-links';
import {
  bookingDisplayTitle,
  deriveBookingNextAction,
  getBookingStatusMeta,
  resolveCustomerSiteConsentView,
  type BookingAppointmentLike,
  type BookingRecordLike,
  type BookingReviewRecord,
  type BookingSiteLike,
} from '../lib/booking-lifecycle';

const money = (pence: number) => '£' + (pence / 100).toFixed(2);

export type SelectedBookingDetailProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  booking: BookingRecordLike;
  userId: string;
  jobTitle?: string | null;
  businessName?: string | null;
  amountPence?: number | null;
  appointment?: BookingAppointmentLike | null;
  siteInfo?: BookingSiteLike | null;
  siteUnavailable: boolean;
  hasReviewed: boolean;
  submittedReview?: BookingReviewRecord | null;
  loadingBookings: boolean;
  busy: boolean;
  busyActionKey: string;
  siteBusy: boolean;
  confirmApptOpen: boolean;
  shareConfirmOpen: boolean;
  completionConfirmOpen: boolean;
  readyConfirmOpen: boolean;
  reviewOpen: boolean;
  stars: string;
  reviewBody: string;
  reviewError: string | null;
  sectionRetryError?: {section: 'appointment' | 'address' | 'completion' | 'review'; message: string} | null;
  onBackToList?: () => void;
  onOpenConfirmAppt: () => void;
  onAbortConfirmAppt: () => void;
  onConfirmAppt: () => void;
  onOpenShareConfirm: () => void;
  onAbortShareConfirm: () => void;
  onToggleAddressSharing: (enabled: boolean) => void;
  onRecheckAddress: () => void;
  onOpenCompletionConfirm: () => void;
  onAbortCompletionConfirm: () => void;
  onConfirmCompletion: () => void;
  onOpenReadyConfirm: () => void;
  onAbortReadyConfirm: () => void;
  onConfirmReady: () => void;
  onOpenReview: () => void;
  onCloseReview: () => void;
  onStarsChange: (value: string) => void;
  onReviewBodyChange: (value: string) => void;
  onSubmitReview: (e: FormEvent) => void;
};

export default function SelectedBookingDetail({
  headingRef,
  booking,
  userId,
  jobTitle,
  businessName,
  amountPence,
  appointment,
  siteInfo,
  siteUnavailable,
  hasReviewed,
  submittedReview,
  loadingBookings,
  busy,
  busyActionKey,
  siteBusy,
  confirmApptOpen,
  shareConfirmOpen,
  completionConfirmOpen,
  readyConfirmOpen,
  reviewOpen,
  stars,
  reviewBody,
  reviewError,
  sectionRetryError,
  onBackToList,
  onOpenConfirmAppt,
  onAbortConfirmAppt,
  onConfirmAppt,
  onOpenShareConfirm,
  onAbortShareConfirm,
  onToggleAddressSharing,
  onRecheckAddress,
  onOpenCompletionConfirm,
  onAbortCompletionConfirm,
  onConfirmCompletion,
  onOpenReadyConfirm,
  onAbortReadyConfirm,
  onConfirmReady,
  onOpenReview,
  onCloseReview,
  onStarsChange,
  onReviewBodyChange,
  onSubmitReview,
}: SelectedBookingDetailProps) {
  const title = bookingDisplayTitle(booking.id, jobTitle);
  const keepPrivateRef = useRef<HTMLButtonElement>(null);
  const addressHeadingRef = useRef<HTMLHeadingElement>(null);
  const shareAddressTriggerRef = useRef<HTMLButtonElement>(null);
  const wasShareConfirmationOpen = useRef(false);

  useEffect(() => {
    if (shareConfirmOpen) keepPrivateRef.current?.focus();
    else if (wasShareConfirmationOpen.current) shareAddressTriggerRef.current?.focus();
    wasShareConfirmationOpen.current = shareConfirmOpen;
  }, [shareConfirmOpen]);

  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewErrorRef = useRef<HTMLParagraphElement>(null);
  const visibleReviewError = reviewError || (sectionRetryError?.section === 'review' ? sectionRetryError.message : null);

  useEffect(() => {
    if (reviewOpen && !busy && visibleReviewError) reviewErrorRef.current?.focus();
  }, [reviewOpen, busy, visibleReviewError]);
  const abortCompletionRef = useRef<HTMLButtonElement>(null);
  const completionTriggerRef = useRef<HTMLButtonElement>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  const reviewSubmittedRef = useRef<HTMLDivElement>(null);
  const pendingReviewUnlockFocus = useRef(false);
  const prevCompletionStateRef = useRef({bookingId: booking.id, open: completionConfirmOpen});
  const prevReviewStateRef = useRef({
    bookingId: booking.id,
    open: reviewOpen,
    status: booking.status,
    hasReviewed,
  });

  useEffect(() => {
    const prev = prevCompletionStateRef.current;
    const sameBooking = prev.bookingId === booking.id;
    if (completionConfirmOpen) {
      abortCompletionRef.current?.focus();
    } else if (sameBooking && prev.open && booking.status === 'awaiting_customer') {
      completionTriggerRef.current?.focus();
    }
    prevCompletionStateRef.current = {bookingId: booking.id, open: completionConfirmOpen};
  }, [booking.id, booking.status, completionConfirmOpen]);

  useEffect(() => {
    const prev = prevReviewStateRef.current;
    const sameBooking = prev.bookingId === booking.id;
    if (!sameBooking) {
      pendingReviewUnlockFocus.current = false;
    } else if (prev.status === 'awaiting_customer' && booking.status === 'completed' && !hasReviewed) {
      pendingReviewUnlockFocus.current = true;
    }

    if (reviewOpen) {
      pendingReviewUnlockFocus.current = false;
      if (!sameBooking || !prev.open) reviewHeadingRef.current?.focus();
    } else if (sameBooking && !prev.hasReviewed && hasReviewed) {
      pendingReviewUnlockFocus.current = false;
      reviewSubmittedRef.current?.focus();
    } else if (sameBooking && prev.open && booking.status === 'completed' && !hasReviewed && !busy) {
      pendingReviewUnlockFocus.current = false;
      reviewTriggerRef.current?.focus();
    } else if (
      pendingReviewUnlockFocus.current &&
      !busy &&
      booking.status === 'completed' &&
      !hasReviewed
    ) {
      pendingReviewUnlockFocus.current = false;
      reviewTriggerRef.current?.focus();
    }

    prevReviewStateRef.current = {
      bookingId: booking.id,
      open: reviewOpen,
      status: booking.status,
      hasReviewed,
    };
  }, [booking.id, booking.status, busy, hasReviewed, reviewOpen]);

  const statusMeta = getBookingStatusMeta(booking.status);

  useEffect(() => {
    if (!confirmApptOpen && !shareConfirmOpen && !completionConfirmOpen && !readyConfirmOpen && !reviewOpen) {
      return;
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (confirmApptOpen && !busy) onAbortConfirmAppt();
      else if (shareConfirmOpen && !siteBusy && !busy) onAbortShareConfirm();
      else if (completionConfirmOpen && !busy) onAbortCompletionConfirm();
      else if (readyConfirmOpen && !busy) onAbortReadyConfirm();
      else if (reviewOpen && !busy) onCloseReview();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    confirmApptOpen,
    shareConfirmOpen,
    completionConfirmOpen,
    readyConfirmOpen,
    reviewOpen,
    busy,
    siteBusy,
    onAbortConfirmAppt,
    onAbortShareConfirm,
    onAbortCompletionConfirm,
    onAbortReadyConfirm,
    onCloseReview,
  ]);
  const timeline = deriveBookingProgressSteps(booking.status, appointment?.status);
  const isCustomer = booking.customer_id === userId;
  const isProfessional = booking.professional_id === userId;
  const isActive = booking.status === 'booked' || booking.status === 'awaiting_customer';
  const canConfirmProposedAppt = Boolean(
    isActive &&
      appointment?.status === 'proposed' &&
      appointment.proposed_by &&
      appointment.proposed_by !== userId
  );

  const nextAction = deriveBookingNextAction({
    booking,
    userId,
    appointment,
    hasReviewed,
    siteInfo,
    siteUnavailable,
  });

  const customerConsentView = isCustomer
    ? resolveCustomerSiteConsentView({
        bookingStatus: booking.status,
        hasLoadedSite: Boolean(siteInfo),
        siteUnavailable,
        siteBusy,
        loadingBookings,
      })
    : 'none';

  const consentPill = isCustomer
    ? customerConsentView === 'updating'
      ? {label: 'Updating…', tone: 'other'}
      : customerConsentView === 'checking'
        ? {label: 'Checking consent…', tone: 'other'}
        : customerConsentView === 'unavailable'
          ? {label: 'Consent check unavailable', tone: 'awaiting'}
          : siteInfo?.sharing_enabled
            ? {label: 'Address shared', tone: 'completed'}
            : {label: 'Kept private', tone: 'booked'}
    : loadingBookings
      ? {label: 'Checking consent…', tone: 'other'}
      : siteUnavailable
        ? {label: 'Consent check unavailable', tone: 'awaiting'}
        : siteInfo
          ? {label: 'Shared by customer', tone: 'completed'}
          : {label: 'Kept private', tone: 'booked'};

  return (
    <article
      className="card booking-detail"
      id={`booking-${booking.id}`}
      data-testid={`booking-detail-${booking.id}`}
      data-booking-status={booking.status}
      aria-labelledby="selected-booking-heading"
    >
      <div className="booking-detail-header" data-testid="selected-booking-header">
        <div className="job-card-head">
          <span
            className={`booking-status-pill is-${statusMeta.tone}`}
            data-testid={`booking-status-${booking.id}`}
            aria-label={`Booking status: ${statusMeta.badgeLabel}`}
          >
            <span className="job-status-dot" aria-hidden="true" />
            {statusMeta.badgeLabel}
          </span>
          <span className="muted-note">
            Booking #{booking.id.slice(0, 8)} · {isCustomer ? 'Customer' : 'Professional'}
          </span>
        </div>

        <h2
          id="selected-booking-heading"
          ref={headingRef}
          tabIndex={-1}
          className="booking-detail-title"
        >
          {title}
        </h2>

        <p className="muted-note" style={{margin: '4px 0 0'}}>
          {businessName ? `${businessName} · ` : ''}
          {typeof amountPence === 'number' ? `${money(amountPence)} · ` : ''}
          Booked {new Date(booking.created_at).toLocaleDateString('en-GB')}
        </p>

        {onBackToList ? (
          <div className="booking-mobile-jump">
            <button type="button" className="booking-text-btn" onClick={onBackToList}>
              ↑ Back to booking list
            </button>
          </div>
        ) : null}

        <ol className="booking-stepper" aria-label={`Progress for ${title}`}>
          {timeline.map((step, idx) => (
            <li key={step.label} className={`booking-step is-${step.state}`}>
              <span className="booking-step-num" aria-hidden="true">
                {step.state === 'done' ? '✓' : idx + 1}
              </span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>

        <div
          className={`booking-next-callout is-${nextAction.priority}`}
          data-testid="selected-booking-next-action"
        >
          <div className="booking-next-copy">
            <span className="booking-next-eyebrow">What to do next</span>
            <strong>{nextAction.label}</strong>
            <p>{nextAction.detail}</p>
          </div>

          <div className="booking-next-cta">
            {isCustomer && booking.status === 'awaiting_customer' && !completionConfirmOpen ? (
              <button
                type="button"
                className="btn"
                disabled={busy || loadingBookings}
                onClick={onOpenCompletionConfirm}
              >
                Review job completion
              </button>
            ) : canConfirmProposedAppt && !confirmApptOpen ? (
              <button
                type="button"
                className="btn"
                disabled={busy || loadingBookings}
                onClick={onOpenConfirmAppt}
              >
                Confirm proposed appointment
              </button>
            ) : isProfessional && booking.status === 'booked' && !readyConfirmOpen ? (
              <button
                type="button"
                className="btn"
                disabled={busy || loadingBookings}
                onClick={onOpenReadyConfirm}
              >
                Mark work ready
              </button>
            ) : isCustomer && booking.status === 'completed' && !hasReviewed && !reviewOpen ? (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={onOpenReview}
              >
                Leave verified-booking review
              </button>
            ) : isActive && (!appointment || appointment.status === 'cancelled') ? (
              <Link className="btn" href={bookingScheduleHref(booking.id)}>
                Agree appointment time →
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Section 1: Appointment & Messages */}
      <section
        className="booking-section"
        aria-labelledby="section-appointment-heading"
        data-testid="booking-section-appointment"
      >
        <div className="booking-section-head">
          <h3 id="section-appointment-heading">1. Appointment &amp; messages</h3>
          <span className={`booking-status-pill is-${appointment?.status === 'confirmed' ? 'completed' : appointment?.status === 'proposed' ? 'awaiting' : 'other'}`}>
            {appointment ? `Appointment ${appointment.status}` : 'Not scheduled yet'}
          </span>
        </div>

        {appointment ? (
          <p className="booking-appointment-note">
            <strong>Window:</strong>{' '}
            {formatAppointmentWindow(
              appointment.starts_at,
              appointment.ends_at,
              appointment.timezone_name
            )}
          </p>
        ) : (
          <p className="muted-note" style={{margin: 0}}>
            No appointment time has been agreed yet. Use the schedule page to propose a visit window in your IANA time zone.
          </p>
        )}

        {appointment?.status === 'proposed' && appointment.proposed_by === userId ? (
          <p className="muted-note" style={{marginTop: 8}}>
            Waiting for the other participant to confirm your proposed time.
          </p>
        ) : null}

        {canConfirmProposedAppt ? (
          confirmApptOpen ? (
            <div
              className="job-confirm-panel"
              role="group"
              aria-label={`Confirm proposed appointment for ${title}`}
              data-testid="confirm-appointment-panel"
              onKeyDown={e => {
                if (e.key === 'Escape' && !busy) onAbortConfirmAppt();
              }}
            >
              <h4>Confirm this proposed appointment time?</h4>
              <p className="muted-note">
                {appointment
                  ? formatAppointmentWindow(
                      appointment.starts_at,
                      appointment.ends_at,
                      appointment.timezone_name
                    )
                  : ''}
              </p>
              <div className="job-confirm-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy || loadingBookings}
                  onClick={onConfirmAppt}
                >
                  {busy && busyActionKey === `confirm_booking_appointment:${booking.id}`
                    ? 'Confirming…'
                    : 'Confirm appointment time'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={onAbortConfirmAppt}
                >
                  Go back
                </button>
              </div>
            </div>
          ) : (
            <div className="job-actions-bar">
              <button
                type="button"
                className="btn secondary"
                disabled={busy || loadingBookings}
                onClick={onOpenConfirmAppt}
              >
                Review &amp; confirm proposed time
              </button>
            </div>
          )
        ) : null}

        {sectionRetryError?.section === 'appointment' ? (
          <div className="notice error" role="alert" style={{marginTop: 10}}>
            <p style={{margin: '0 0 8px'}}>{sectionRetryError.message}</p>
            <button type="button" className="btn secondary" disabled={busy} onClick={onOpenConfirmAppt}>
              Try again
            </button>
          </div>
        ) : null}

        <nav className="job-related-links" aria-label={`Appointment and message links for ${title}`}>
          <Link className="job-related-link" href={bookingScheduleHref(booking.id)}>
            Manage appointment →
          </Link>
          <Link className="job-related-link" href={quoteMessagesHref(booking.quote_id)}>
            Open quote conversation →
          </Link>
          <Link className="job-related-link" href="/jobs">
            My jobs &amp; quotes →
          </Link>
        </nav>
      </section>

      {/* Section 2: Private Address Sharing */}
      <section
        className="booking-section"
        aria-labelledby="section-address-heading"
        data-testid="booking-section-address"
      >
        <div className="booking-section-head">
          <h3 id="section-address-heading" ref={addressHeadingRef} tabIndex={-1}>2. Private address sharing</h3>
          <span
            className={`booking-status-pill is-${consentPill.tone}`}
            data-testid={`address-consent-badge-${booking.id}`}
          >
            {consentPill.label}
          </span>
        </div>

        {isCustomer ? (
          customerConsentView === 'updating' ? (
            <p className="muted-note" role="status" style={{margin: 0}}>
              Updating private address sharing consent…
            </p>
          ) : customerConsentView === 'checking' ? (
            <p className="muted-note" role="status" style={{margin: 0}}>
              Checking your live private address sharing status…
            </p>
          ) : customerConsentView === 'unavailable' ? (
            <div className="notice notice-warn" style={{margin: 0}}>
              {sectionRetryError?.section === 'address' ? (
                <p role="alert">Your address sharing change could not be confirmed. Recheck its status before trying again.</p>
              ) : null}
              <p style={{margin: '0 0 10px'}}>
                Private address sharing status could not be confirmed. No cached address is displayed until a live check succeeds.
              </p>
              <button
                type="button"
                className="btn secondary"
                disabled={Boolean(loadingBookings || busy || siteBusy)}
                onClick={() => {
                  addressHeadingRef.current?.focus();
                  onRecheckAddress();
                }}
              >
                {loadingBookings ? 'Rechecking…' : 'Recheck address status'}
              </button>
            </div>
          ) : siteInfo ? (
            <div>
              <p className="booking-address-value" data-testid={`customer-address-${booking.id}`}>
                {siteInfo.address_label}
              </p>
              <p className="muted-note" style={{margin: '4px 0 0'}}>
                Only the booked professional can view your exact address, and only while sharing is enabled. Your address is never shown in public job leads.
              </p>

              {isActive ? (
                <div style={{marginTop: 12}}>
                  {siteInfo.sharing_enabled ? (
                    <>
                      <p className="muted-note" style={{marginBottom: 8}}>
                        <strong>Sharing is active</strong> for this booked professional. Turn sharing off at any time to revoke access in TrustFive.
                      </p>
                      <button
                        type="button"
                        className="btn secondary job-btn-danger-outline"
                        disabled={Boolean(siteBusy || busy)}
                        onClick={() => onToggleAddressSharing(false)}
                      >
                        {siteBusy ? 'Updating…' : 'Turn off exact address sharing'}
                      </button>
                    </>
                  ) : shareConfirmOpen ? (
                    <div
                      className="job-confirm-panel"
                      role="group"
                      aria-label={`Confirm sharing private address for ${title}`}
                      data-testid="confirm-share-address-panel"
                      onKeyDown={e => {
                        if (e.key === 'Escape' && !siteBusy) onAbortShareConfirm();
                      }}
                    >
                      <h4>Share your exact address with this booked professional?</h4>
                      <p className="muted-note">
                        Only the independently approved professional assigned to this booking will see it, and you can revoke access at any time.
                      </p>
                      <div className="job-confirm-actions">
                        <button
                          type="button"
                          className="btn"
                          disabled={Boolean(siteBusy || busy)}
                          onClick={() => onToggleAddressSharing(true)}
                        >
                          {siteBusy ? 'Sharing…' : 'Confirm share address'}
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={Boolean(siteBusy)}
                          ref={keepPrivateRef}
                          onClick={onAbortShareConfirm}
                        >
                          Keep private
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={Boolean(siteBusy || busy)}
                      ref={shareAddressTriggerRef}
                      onClick={onOpenShareConfirm}
                    >
                      Share exact address with booked professional
                    </button>
                  )}
                </div>
              ) : (
                <p className="muted-note" style={{marginTop: 8}}>
                  Address sharing controls apply only while a booking is active.
                </p>
              )}
            </div>
          ) : (
            <p className="muted-note" style={{margin: 0}}>
              No private job-site address record is attached to this booking.
            </p>
          )
        ) : isProfessional ? (
          isActive ? (
            loadingBookings ? (
              <p className="muted-note" role="status" style={{margin: 0}}>
                Checking customer address consent…
              </p>
            ) : siteUnavailable ? (
              <div className="notice notice-warn" style={{margin: 0}}>
                <p style={{margin: '0 0 10px'}}>
                  Address access check is temporarily unavailable. No address is displayed without live consent confirmation.
                </p>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={loadingBookings || busy}
                  onClick={onRecheckAddress}
                >
                  Retry address check
                </button>
              </div>
            ) : siteInfo ? (
              <div>
                <p className="booking-address-value" data-testid={`pro-shared-address-${booking.id}`}>
                  {siteInfo.address_label}
                </p>
                <p className="muted-note" style={{margin: '4px 0 0'}}>
                  Shared by the customer for this booking only. If the customer revokes sharing, this address will no longer appear.
                </p>
              </div>
            ) : (
              <div>
                <p className="muted-note" style={{margin: '0 0 8px'}} data-testid={`pro-address-private-${booking.id}`}>
                  The customer has kept the exact address private. Request permission through your booking conversation when needed.
                </p>
                <Link className="job-related-link" href={quoteMessagesHref(booking.quote_id)}>
                  Message customer →
                </Link>
              </div>
            )
          ) : (
            <p className="muted-note" style={{margin: 0}}>
              Private job-site addresses are not shown after a booking closes.
            </p>
          )
        ) : null}
      </section>

      {/* Section 3: Completion & Verified Review */}
      <section
        className="booking-section"
        aria-labelledby="section-completion-heading"
        data-testid="booking-section-completion"
      >
        <div className="booking-section-head">
          <h3 id="section-completion-heading">3. Completion &amp; verified review</h3>
          <span className={`booking-status-pill is-${statusMeta.tone}`}>
            {statusMeta.badgeLabel}
          </span>
        </div>

        {/* Customer booked — waiting for professional */}
        {isCustomer && booking.status === 'booked' ? (
          <p className="muted-note" style={{margin: 0}}>
            Once the professional finishes the agreed work and marks it ready, your completion confirmation controls will appear here.
          </p>
        ) : null}

        {/* Customer awaiting_customer — two-step completion confirmation */}
        {isCustomer && booking.status === 'awaiting_customer' ? (
          completionConfirmOpen ? (
            <div
              className="booking-completion-check"
              style={{margin: 0}}
              role="group"
              aria-label={`Confirm completed booking for ${title}`}
              data-testid={`confirm-completion-panel-${booking.id}`}
              onKeyDown={e => {
                if (e.key === 'Escape' && !busy) onAbortCompletionConfirm();
              }}
            >
              <h4>Has the agreed work actually been completed?</h4>
              <p>
                Only confirm if you are satisfied that this job is finished. This records your completion confirmation and unlocks your genuine verified-booking review. It does not charge a payment or resolve disputes.
              </p>
              <p className="muted-note">
                If something is outstanding, message the professional or contact TrustFive support instead.
              </p>
              {sectionRetryError?.section === 'completion' ? (
                <p className="notice error" role="alert">{sectionRetryError.message} Try confirming again when ready.</p>
              ) : null}
              <div className="booking-completion-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy || loadingBookings}
                  onClick={onConfirmCompletion}
                >
                  {busy && busyActionKey === `confirm_job_completed:${booking.id}`
                    ? 'Confirming…'
                    : 'Yes, work is completed'}
                </button>
                <button
                  ref={abortCompletionRef}
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={onAbortCompletionConfirm}
                >
                  Not yet — go back
                </button>
                <Link className="btn secondary" href={quoteMessagesHref(booking.quote_id)}>
                  Message professional
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <p style={{margin: '0 0 12px'}}>
                The professional marked this job ready. Inspect the work and confirm when satisfied.
              </p>
              <button
                ref={completionTriggerRef}
                type="button"
                className="btn"
                disabled={busy || loadingBookings}
                onClick={onOpenCompletionConfirm}
              >
                Review job completion
              </button>
            </div>
          )
        ) : null}

        {/* Professional booked — two-step mark work ready */}
        {isProfessional && booking.status === 'booked' ? (
          readyConfirmOpen ? (
            <div
              className="booking-completion-check"
              style={{margin: 0}}
              role="group"
              aria-label={`Confirm marking work ready for ${title}`}
              data-testid={`confirm-ready-panel-${booking.id}`}
              onKeyDown={e => {
                if (e.key === 'Escape' && !busy) onAbortReadyConfirm();
              }}
            >
              <h4>Mark work ready for customer confirmation?</h4>
              <p className="muted-note">
                Only mark work ready once the agreed job is finished. The customer must independently confirm completion before a verified-booking review can be submitted.
              </p>
              <div className="booking-completion-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy || loadingBookings}
                  onClick={onConfirmReady}
                >
                  {busy && busyActionKey === `mark_job_ready_for_confirmation:${booking.id}`
                    ? 'Saving…'
                    : 'Confirm work ready'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={onAbortReadyConfirm}
                >
                  Not yet
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="muted-note" style={{margin: '0 0 10px'}}>
                When you have finished the agreed work, mark it ready so the customer can inspect and confirm completion.
              </p>
              <button
                type="button"
                className="btn"
                disabled={busy || loadingBookings}
                onClick={onOpenReadyConfirm}
              >
                Mark work ready
              </button>
            </div>
          )
        ) : null}

        {/* Professional awaiting_customer */}
        {isProfessional && booking.status === 'awaiting_customer' ? (
          <p className="muted-note" style={{margin: 0}}>
            Work is marked ready. Waiting for the customer to independently confirm completion.
          </p>
        ) : null}

        {sectionRetryError?.section === 'completion' && !(isCustomer && completionConfirmOpen) ? (
          <div className="notice error" role="alert" style={{marginTop: 10}}>
            <p style={{margin: '0 0 8px'}}>{sectionRetryError.message}</p>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={isCustomer ? onOpenCompletionConfirm : onOpenReadyConfirm}
            >
              Retry completion action
            </button>
          </div>
        ) : null}

        {/* Completed booking: inline review form or submitted confirmation */}
        {booking.status === 'completed' ? (
          isCustomer ? (
            hasReviewed ? (
              <div
                ref={reviewSubmittedRef}
                tabIndex={-1}
                className="notice booking-submitted-review"
                role="status"
                style={{margin: 0}}
                data-testid={`review-submitted-${booking.id}`}
              >
                <div className="booking-submitted-review-head">
                  <strong>✓ Verified-booking review submitted.</strong>
                  {typeof submittedReview?.stars === 'number' &&
                  submittedReview.stars >= 1 &&
                  submittedReview.stars <= 5 ? (
                    <span className="booking-submitted-review-stars">
                      {'★'.repeat(submittedReview.stars)} {submittedReview.stars}/5 stars
                    </span>
                  ) : null}
                </div>
                {submittedReview?.body ? (
                  <blockquote className="booking-submitted-review-body">
                    {submittedReview.body}
                  </blockquote>
                ) : (
                  <p className="muted-note" style={{margin: 0}}>
                    Thank you for sharing your genuine experience.
                  </p>
                )}
              </div>
            ) : reviewOpen ? (
              <div
                className="booking-review-inline"
                role="region"
                aria-label={`Review completed booking ${title}`}
                data-testid="booking-review-form"
                onKeyDown={e => {
                  if (e.key === 'Escape' && !busy) onCloseReview();
                }}
              >
                <h4 ref={reviewHeadingRef} tabIndex={-1}>Leave a verified-booking review</h4>
                <p className="muted-note" style={{marginBottom: 12}}>
                  Your review will appear publicly on this professional&apos;s verified record. Describe your experience and leave out addresses, phone numbers and other private details.
                </p>
                <form className="form" onSubmit={onSubmitReview}>
                  <label htmlFor={`review-stars-${booking.id}`}>
                    Overall rating
                    <select
                      id={`review-stars-${booking.id}`}
                      value={stars}
                      disabled={busy}
                      onChange={e => onStarsChange(e.target.value)}
                    >
                      {[5, 4, 3, 2, 1].map(n => (
                        <option key={n} value={n}>
                          {n} star{n !== 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor={`review-body-${booking.id}`}>
                    Your experience ({reviewBody.trim().length}/1500 characters)
                    <textarea
                      id={`review-body-${booking.id}`}
                      required
                      minLength={10}
                      maxLength={1500}
                      disabled={busy}
                      value={reviewBody}
                      onChange={e => onReviewBodyChange(e.target.value)}
                      placeholder="Describe punctuality, workmanship, tidiness and communication."
                    />
                  </label>
                  {visibleReviewError ? (
                    <p ref={reviewErrorRef} tabIndex={-1} className="notice error" role="alert" style={{margin: 0}}>
                      {visibleReviewError}{!reviewError && ' — your draft is preserved above so you can retry safely.'}
                    </p>
                  ) : null}
                  <div className="job-confirm-actions">
                    <button className="btn" disabled={busy} type="submit">
                      {busy && busyActionKey === `review:${booking.id}`
                        ? 'Submitting review…'
                        : 'Submit review'}
                    </button>
                    <button
                      className="btn secondary"
                      disabled={busy}
                      type="button"
                      onClick={onCloseReview}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div>
                <p style={{margin: '0 0 12px'}}>
                  Work is confirmed completed. You can now leave a genuine verified-booking review.
                </p>
                <button
                  ref={reviewTriggerRef}
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={onOpenReview}
                >
                  Leave verified-booking review
                </button>
              </div>
            )
          ) : (
            <p className="muted-note" style={{margin: 0}}>
              The customer has confirmed this booking as completed.
            </p>
          )
        ) : null}

        {booking.status === 'cancelled' ? (
          <p className="muted-note" style={{margin: 0}}>
            This booking was cancelled and cannot be completed or reviewed.
          </p>
        ) : null}

        <p className="muted-note" style={{marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)'}}>
          <strong>Fair reviews:</strong> Only the customer on a confirmed completed TrustFive booking can submit a review. Payment disputes and allegations of misconduct are investigated independently.
        </p>
      </section>
    </article>
  );
}
