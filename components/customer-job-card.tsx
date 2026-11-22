'use client';

import Link from 'next/link';
import {
  buildJobRelatedLinks,
  canCancelCustomerJob,
  canReopenCustomerJob,
  getJobStatusMeta,
  reopenIneligibilityReason,
  type NormalizedJobActivityEvent,
  type RelatedBookingRef,
} from '../lib/job-lifecycle';
import {
  readableContactPreference,
  summarizeJobQuotes,
} from '../lib/quote-comparison';
import {quoteMessagesHref} from '../lib/workflow-links';

export type CustomerJobRecord = {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  budget_pence: number | null;
  contact_preference?: string | null;
  trade_id?: string | null;
  area_id?: string | null;
};

export type CustomerQuoteRecord = {
  quote_id: string;
  job_id: string;
  business_name: string;
  amount_pence: number;
  message: string;
  availability_note?: string | null;
  status: string;
  created_at?: string;
};

export type JobActivityDrawerState = {
  open: boolean;
  loading: boolean;
  error: string;
  events: NormalizedJobActivityEvent[];
};

const money = (pence: number) => '£' + (pence / 100).toFixed(2);

type CustomerJobCardProps = {
  job: CustomerJobRecord;
  quotes: CustomerQuoteRecord[];
  booking?: RelatedBookingRef | null;
  busy: boolean;
  busyActionLabel?: string;
  confirmCancelOpen: boolean;
  cancelReason: string;
  cancelReasonError?: string | null;
  confirmReopenOpen: boolean;
  confirmQuoteId: string | null;
  activity: JobActivityDrawerState;
  onToggleActivity: (jobId: string) => void;
  onRetryActivity: (jobId: string) => void;
  onStartCancel: (jobId: string) => void;
  onAbortCancel: () => void;
  onCancelReasonChange: (value: string) => void;
  onConfirmCancel: (job: CustomerJobRecord) => void;
  onStartReopen: (jobId: string) => void;
  onAbortReopen: () => void;
  onConfirmReopen: (job: CustomerJobRecord) => void;
  onStartAcceptQuote: (quoteId: string) => void;
  onAbortAcceptQuote: () => void;
  onConfirmAcceptQuote: (quoteId: string) => void;
};

export default function CustomerJobCard({
  job,
  quotes,
  booking,
  busy,
  busyActionLabel,
  confirmCancelOpen,
  cancelReason,
  cancelReasonError,
  confirmReopenOpen,
  confirmQuoteId,
  activity,
  onToggleActivity,
  onRetryActivity,
  onStartCancel,
  onAbortCancel,
  onCancelReasonChange,
  onConfirmCancel,
  onStartReopen,
  onAbortReopen,
  onConfirmReopen,
  onStartAcceptQuote,
  onAbortAcceptQuote,
  onConfirmAcceptQuote,
}: CustomerJobCardProps) {
  const statusMeta = getJobStatusMeta(job.status);
  const summary = summarizeJobQuotes(quotes);
  const hasBooking = Boolean(booking);
  const showCancel = canCancelCustomerJob(job, hasBooking);
  const showReopen = canReopenCustomerJob(job, hasBooking);
  const reopenBlockedReason = !showReopen ? reopenIneligibilityReason(job, hasBooking) : null;
  const links = buildJobRelatedLinks({
    jobId: job.id,
    jobStatus: job.status,
    quotes,
    booking,
  });
  const activityPanelId = `job-activity-${job.id}`;
  const quotesSectionId = `job-quotes-${job.id}`;

  return (
    <article
      className="card job-card"
      data-testid={`job-card-${job.id}`}
      data-job-status={job.status}
      aria-labelledby={`job-title-${job.id}`}
    >
      <div className="job-card-head">
        <span
          className={`job-status-pill is-${statusMeta.tone}`}
          data-testid={`job-status-${job.id}`}
          aria-label={`Job status: ${statusMeta.badgeLabel}`}
        >
          <span className="job-status-dot" aria-hidden="true" />
          {statusMeta.badgeLabel}
        </span>
        {summary.total > 0 ? (
          <span className="muted-note job-quote-summary">
            {summary.total} quote{summary.total === 1 ? '' : 's'}
            {summary.lowestPence !== null && summary.highestPence !== null
              ? ` · ${money(summary.lowestPence)}${
                  summary.highestPence > summary.lowestPence ? `–${money(summary.highestPence)}` : ''
                }`
              : ' · no active quotes'}
          </span>
        ) : (
          <span className="muted-note job-quote-summary">No quotes received yet</span>
        )}
      </div>

      <h3 id={`job-title-${job.id}`} className="job-card-title">
        {job.title}
      </h3>
      <p className="job-card-description">{job.description}</p>

      <div className="job-card-meta">
        <span>{statusMeta.description}</span>
        {job.budget_pence !== null ? (
          <span>
            <strong>Budget estimate:</strong> {money(job.budget_pence)}
          </span>
        ) : null}
        <span className="muted-note">
          Posted {new Date(job.created_at).toLocaleDateString('en-GB')} · Contact:{' '}
          {readableContactPreference(job.contact_preference)}
        </span>
      </div>

      {(links.quotesAnchor || links.bookingHref || links.scheduleHref || links.primaryMessageHref) ? (
        <nav
          className="job-related-links"
          aria-label={`Related links for ${job.title}`}
          data-testid={`job-links-${job.id}`}
        >
          {links.quotesAnchor ? (
            <a className="job-related-link" href={links.quotesAnchor}>
              View quotes ({links.quotesCount})
            </a>
          ) : null}
          {links.bookingHref ? (
            <Link className="job-related-link" href={links.bookingHref}>
              {job.status === 'completed' ? 'View completed booking →' : 'Manage booking →'}
            </Link>
          ) : null}
          {links.scheduleHref ? (
            <Link className="job-related-link" href={links.scheduleHref}>
              Appointments →
            </Link>
          ) : null}
          {links.primaryMessageHref ? (
            <Link className="job-related-link" href={links.primaryMessageHref}>
              Messages →
            </Link>
          ) : null}
        </nav>
      ) : null}

      <div className="job-actions-bar">
        <button
          type="button"
          className="btn secondary"
          aria-expanded={activity.open}
          aria-controls={activityPanelId}
          onClick={() => onToggleActivity(job.id)}
        >
          {activity.open ? 'Hide job activity' : 'View job activity'}
        </button>

        {showCancel && !confirmCancelOpen ? (
          <button
            type="button"
            className="btn secondary job-btn-danger-outline"
            disabled={busy}
            onClick={() => onStartCancel(job.id)}
          >
            Cancel job
          </button>
        ) : null}

        {showReopen && !confirmReopenOpen ? (
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={() => onStartReopen(job.id)}
          >
            Reopen job
          </button>
        ) : null}
      </div>

      {reopenBlockedReason ? (
        <p className="muted-note" style={{marginTop: 10}} role="note">
          {reopenBlockedReason}
        </p>
      ) : null}

      {showCancel && confirmCancelOpen ? (
        <div
          className="job-confirm-panel is-cancel"
          role="group"
          aria-label={`Confirm cancelling job ${job.title}`}
          data-testid={`confirm-cancel-panel-${job.id}`}
          onKeyDown={e => {
            if (e.key === 'Escape' && !busy) onAbortCancel();
          }}
        >
          <h4>Cancel “{job.title}”?</h4>
          <p className="muted-note">
            Cancelling closes this unbooked request and stops pending quotes from being accepted.
            You can reopen it later if no booking exists.
          </p>
          <label className="job-confirm-label" htmlFor={`cancel-reason-${job.id}`}>
            <span>Optional note ({cancelReason.trim().length}/240 characters)</span>
            <input
              id={`cancel-reason-${job.id}`}
              maxLength={240}
              disabled={busy}
              value={cancelReason}
              onChange={e => onCancelReasonChange(e.target.value)}
              placeholder="e.g. Postponing work until next month"
            />
          </label>
          {cancelReasonError ? (
            <p className="notice error" role="alert" style={{marginTop: 8}}>
              {cancelReasonError}
            </p>
          ) : null}
          <div className="job-confirm-actions">
            <button
              type="button"
              className="btn job-btn-danger"
              disabled={busy}
              onClick={() => onConfirmCancel(job)}
            >
              {busy && busyActionLabel === `cancel:${job.id}`
                ? 'Cancelling…'
                : 'Confirm cancel job'}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={onAbortCancel}
            >
              Keep job open
            </button>
          </div>
        </div>
      ) : null}

      {showReopen && confirmReopenOpen ? (
        <div
          className="job-confirm-panel"
          role="group"
          aria-label={`Confirm reopening job ${job.title}`}
          data-testid={`confirm-reopen-panel-${job.id}`}
          onKeyDown={e => {
            if (e.key === 'Escape' && !busy) onAbortReopen();
          }}
        >
          <h4>Reopen “{job.title}”?</h4>
          <p className="muted-note">
            Reopening makes this unbooked job visible again to eligible local approved professionals
            in your verified service territory.
          </p>
          <div className="job-confirm-actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => onConfirmReopen(job)}
            >
              {busy && busyActionLabel === `reopen:${job.id}`
                ? 'Reopening…'
                : 'Confirm reopen job'}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={onAbortReopen}
            >
              Keep cancelled
            </button>
          </div>
        </div>
      ) : null}

      {activity.open ? (
        <section
          id={activityPanelId}
          className="job-timeline-panel"
          aria-label={`Chronological activity timeline for ${job.title}`}
          aria-live="polite"
          aria-busy={activity.loading}
          data-testid={`activity-panel-${job.id}`}
        >
          <div className="job-timeline-header">
            <h4>Job activity timeline</h4>
            <span className="muted-note">Oldest to newest</span>
          </div>

          {activity.loading ? (
            <p className="muted-note" role="status">
              Loading genuine job activity…
            </p>
          ) : activity.error ? (
            <div className="notice error" role="alert" style={{margin: 0}}>
              <p style={{margin: '0 0 10px'}}>{activity.error}</p>
              <button
                type="button"
                className="btn secondary"
                onClick={() => onRetryActivity(job.id)}
              >
                Retry activity load
              </button>
            </div>
          ) : activity.events.length === 0 ? (
            <p className="muted-note" style={{margin: 0}}>
              No lifecycle events recorded yet. Genuine events such as bookings, cancellations,
              reopenings and completions appear here automatically.
            </p>
          ) : (
            <ol className="job-timeline">
              {activity.events.map((ev, index) => (
                <li
                  key={ev.event_id}
                  className={`job-timeline-item is-${ev.tone}`}
                  data-testid={`activity-event-${ev.event_id}`}
                >
                  <span className="job-timeline-marker" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className="job-timeline-body">
                    <strong>{ev.label}</strong>
                    <time className="muted-note" dateTime={ev.created_at}>
                      {ev.formattedTimestamp}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      {quotes.length > 0 ? (
        <div id={quotesSectionId} className="job-quotes-list" aria-label={`Quotes for ${job.title}`}>
          {quotes.map(q => (
            <div key={q.quote_id} className="notice job-quote-item">
              <div className="job-quote-head">
                <span className="pill">{q.status} quote</span>
                <strong>{money(q.amount_pence)}</strong>
              </div>
              <h4>{q.business_name}</h4>
              {q.status === 'withdrawn' ? (
                <p className="muted-note" style={{marginTop: 4}}>
                  This quote was withdrawn and is no longer available to accept.
                </p>
              ) : null}
              {q.availability_note ? (
                <p className="muted-note" style={{marginTop: 4}}>
                  <strong>Availability:</strong> {q.availability_note}
                </p>
              ) : null}
              <p className="job-quote-message">{q.message}</p>
              <div className="job-quote-footer">
                <Link className="job-related-link" href={quoteMessagesHref(q.quote_id)}>
                  Message this professional →
                </Link>
              </div>
              {job.status === 'open' && q.status === 'pending' ? (
                confirmQuoteId === q.quote_id ? (
                  <div
                    className="quote-confirmation"
                    role="group"
                    aria-label={`Confirm quote from ${q.business_name}`}
                  >
                    <h4>Confirm this booking?</h4>
                    <p>
                      You are choosing <strong>{q.business_name}</strong> for{' '}
                      <strong>{money(q.amount_pence)}</strong> for “{job.title}”.
                    </p>
                    <p className="muted-note">
                      Confirming creates a TrustFive booking. No payment is collected here. Agree
                      the work, timing and terms with the professional. Your exact job address stays
                      private unless you separately choose to share it for the booking.
                    </p>
                    <div className="quote-confirmation-actions">
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => onConfirmAcceptQuote(q.quote_id)}
                      >
                        {busy && busyActionLabel === `accept:${q.quote_id}`
                          ? 'Confirming…'
                          : 'Confirm and create booking'}
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={busy}
                        onClick={onAbortAcceptQuote}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn"
                    style={{marginTop: 10}}
                    onClick={() => onStartAcceptQuote(q.quote_id)}
                  >
                    Review and accept quote
                  </button>
                )
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
