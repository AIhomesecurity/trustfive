import {readableAuditAction} from './marketplace-messages';
import {
  bookingHistoryHref,
  bookingScheduleHref,
  quoteMessagesHref,
} from './workflow-links';

export type JobLifecycleState = {
  id: string;
  status: string;
  trade_id?: string | null;
  area_id?: string | null;
  has_booking?: boolean;
};

export type JobStatusFilter = 'all' | 'open' | 'booked' | 'completed' | 'cancelled';

export type JobStatusTone = 'open' | 'booked' | 'completed' | 'cancelled' | 'draft';

export type JobStatusMeta = Readonly<{
  badgeLabel: string;
  label: string;
  tone: JobStatusTone;
  description: string;
}>;

export type JobStatusCounts = Readonly<{
  all: number;
  open: number;
  booked: number;
  completed: number;
  cancelled: number;
}>;

export type JobActivityEvent = {
  event_id: number;
  action: string;
  created_at: string;
};

export type NormalizedJobActivityEvent = JobActivityEvent & {
  label: string;
  tone: 'positive' | 'warning' | 'neutral';
  formattedTimestamp: string;
};

export type RelatedBookingRef = {
  id: string;
  job_id: string;
  quote_id: string;
  status: string;
};

export type RelatedQuoteRef = {
  quote_id: string;
  job_id: string;
  status: string;
};

export type JobRelatedLinks = Readonly<{
  quotesAnchor: string | null;
  quotesCount: number;
  primaryMessageHref: string | null;
  bookingHref: string | null;
  scheduleHref: string | null;
}>;

/** Only unbooked draft or open jobs may be cancelled by the customer.
 * Mirrors public.cancel_customer_job() rules; server-side RPC remains authoritative. */
export function canCancelCustomerJob(
  job: JobLifecycleState | null | undefined,
  hasBooking = false
): boolean {
  if (!job) return false;
  if (hasBooking || job.has_booking) return false;
  return job.status === 'draft' || job.status === 'open';
}

/** Only cancelled unbooked jobs with a valid trade and service area may be reopened.
 * Mirrors public.reopen_customer_job() rules; server-side RPC remains authoritative. */
export function canReopenCustomerJob(
  job: JobLifecycleState | null | undefined,
  hasBooking = false
): boolean {
  if (!job) return false;
  if (hasBooking || job.has_booking) return false;
  if (job.status !== 'cancelled') return false;
  if ('trade_id' in job && !job.trade_id) return false;
  if ('area_id' in job && !job.area_id) return false;
  return true;
}

/** Explains honestly why a cancelled job cannot be reopened under RPC rules. */
export function reopenIneligibilityReason(
  job: JobLifecycleState | null | undefined,
  hasBooking = false
): string | null {
  if (!job || job.status !== 'cancelled') return null;
  if (hasBooking || job.has_booking) {
    return 'This job already has a recorded booking and cannot be reopened.';
  }
  if (('trade_id' in job && !job.trade_id) || ('area_id' in job && !job.area_id)) {
    return 'This cancelled job needs a valid trade and verified service area before it can be reopened.';
  }
  return null;
}

export function readableJobStatus(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    open: 'Open for quotes',
    booked: 'Booked',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] || status.replace(/_/g, ' ');
}

export function getJobStatusMeta(status: string): JobStatusMeta {
  switch (status) {
    case 'open':
      return Object.freeze({
        badgeLabel: 'Open',
        label: readableJobStatus('open'),
        tone: 'open',
        description: 'Visible to eligible approved local professionals for quotations.',
      });
    case 'booked':
      return Object.freeze({
        badgeLabel: 'Booked',
        label: readableJobStatus('booked'),
        tone: 'booked',
        description: 'A quote has been accepted and a TrustFive booking is recorded.',
      });
    case 'completed':
      return Object.freeze({
        badgeLabel: 'Completed',
        label: readableJobStatus('completed'),
        tone: 'completed',
        description: 'Work has been confirmed as completed.',
      });
    case 'cancelled':
      return Object.freeze({
        badgeLabel: 'Cancelled',
        label: readableJobStatus('cancelled'),
        tone: 'cancelled',
        description: 'Closed by you; pending quotes cannot be accepted unless reopened.',
      });
    case 'draft':
      return Object.freeze({
        badgeLabel: 'Draft',
        label: readableJobStatus('draft'),
        tone: 'draft',
        description: 'Saved draft request not yet booked.',
      });
    default:
      return Object.freeze({
        badgeLabel: readableJobStatus(status),
        label: readableJobStatus(status),
        tone: 'draft',
        description: 'Current job status from TrustFive.',
      });
  }
}

export function summarizeJobStatuses(jobs: readonly JobLifecycleState[]): JobStatusCounts {
  let open = 0;
  let booked = 0;
  let completed = 0;
  let cancelled = 0;
  for (const job of jobs) {
    if (job.status === 'open' || job.status === 'draft') open += 1;
    else if (job.status === 'booked') booked += 1;
    else if (job.status === 'completed') completed += 1;
    else if (job.status === 'cancelled') cancelled += 1;
  }
  return Object.freeze({
    all: jobs.length,
    open,
    booked,
    completed,
    cancelled,
  });
}

export function filterJobsByStatus<T extends JobLifecycleState>(
  jobs: readonly T[],
  filter: JobStatusFilter
): T[] {
  if (filter === 'all') return [...jobs];
  if (filter === 'open') {
    return jobs.filter(j => j.status === 'open' || j.status === 'draft');
  }
  return jobs.filter(j => j.status === filter);
}

export function validateCancelReason(raw: string): string | null {
  const clean = raw.trim();
  if (!clean) return null;
  if (clean.length > 240) {
    return 'Cancellation note must be 240 characters or fewer.';
  }
  return null;
}

function classifyActivityTone(action: string): 'positive' | 'warning' | 'neutral' {
  if (
    action === 'quote_accepted' ||
    action === 'job_completion_confirmed' ||
    action === 'appointment_confirmed' ||
    action === 'job_reopened'
  ) {
    return 'positive';
  }
  if (
    action === 'job_cancelled' ||
    action === 'appointment_cancelled' ||
    action === 'quote_withdrawn'
  ) {
    return 'warning';
  }
  return 'neutral';
}

function formatActivityTimestamp(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Timestamp unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Deduplicate and sort genuine marketplace_audit_events chronologically (oldest first).
 * Never fabricates synthetic events. */
export function normalizeJobActivity(
  rows: JobActivityEvent[] | null | undefined
): NormalizedJobActivityEvent[] {
  if (!Array.isArray(rows) || !rows.length) return [];
  const byId = new Map<number, JobActivityEvent>();
  for (const row of rows) {
    if (typeof row?.event_id === 'number' && typeof row?.action === 'string') {
      byId.set(row.event_id, row);
    }
  }
  return [...byId.values()]
    .sort((a, b) => {
      const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff;
      return a.event_id - b.event_id;
    })
    .map(item => ({
      ...item,
      label: readableAuditAction(item.action),
      tone: classifyActivityTone(item.action),
      formattedTimestamp: formatActivityTimestamp(item.created_at),
    }));
}

/** Reflect an ALREADY-COMMITTED cancel_customer_job() RPC locally so a refresh failure
 * never leaves stale cancel controls on screen. Must NEVER be called before RPC commit. */
export function applyCommittedJobCancellation<
  J extends JobLifecycleState,
  Q extends RelatedQuoteRef,
>(
  jobs: readonly J[],
  quotes: readonly Q[],
  jobId: string
): {jobs: J[]; quotes: Q[]} {
  return {
    jobs: jobs.map(job => (job.id === jobId ? {...job, status: 'cancelled'} : job)),
    quotes: quotes.map(quote =>
      quote.job_id === jobId && quote.status === 'pending'
        ? {...quote, status: 'rejected'}
        : quote
    ),
  };
}

/** Reflect an ALREADY-COMMITTED reopen_customer_job() RPC locally so a refresh failure
 * never leaves stale reopen controls on screen. Must NEVER be called before RPC commit. */
export function applyCommittedJobReopen<J extends JobLifecycleState>(
  jobs: readonly J[],
  jobId: string
): J[] {
  return jobs.map(job => (job.id === jobId ? {...job, status: 'open'} : job));
}

/** Reflect an ALREADY-COMMITTED accept_job_quote() RPC locally so a refresh failure
 * never leaves stale quote-accept or cancel-job buttons on screen. */
export function applyCommittedQuoteAcceptance<
  J extends JobLifecycleState,
  Q extends RelatedQuoteRef,
>(
  jobs: readonly J[],
  quotes: readonly Q[],
  jobId: string,
  acceptedQuoteId: string
): {jobs: J[]; quotes: Q[]} {
  return {
    jobs: jobs.map(job => (job.id === jobId ? {...job, status: 'booked', has_booking: true} : job)),
    quotes: quotes.map(quote => {
      if (quote.job_id !== jobId) return quote;
      if (quote.quote_id === acceptedQuoteId) return {...quote, status: 'accepted'};
      if (quote.status === 'pending') return {...quote, status: 'rejected'};
      return quote;
    }),
  };
}

export type LifecycleActionResult =
  | {outcome: 'committed'; committed: true; message: string}
  | {outcome: 'committed_refresh_failed'; committed: true; message: string}
  | {outcome: 'rpc_error'; committed: false; message: string};

/** Separates authoritative database commit from subsequent UI list refresh.
 * Guarantees that a failed refresh after commit reports accurate success + refresh guidance
 * instead of pretending the mutation failed. */
export async function executeJobLifecycleAction(params: {
  runRpc: () => Promise<{error: {message?: string} | null}>;
  onCommittedLocalUpdate: () => void;
  runRefresh: () => Promise<void>;
  successMessage: string;
  refreshFailedMessage: string;
  fallbackErrorMessage: string;
}): Promise<LifecycleActionResult> {
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

  // RPC has committed in PostgreSQL. Apply exact committed state locally before refreshing.
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

/** Build opaque-ID-only links from a job to its related quotes, bookings, schedule and messages.
 * Never embeds private customer addresses or personal details. */
export function buildJobRelatedLinks(params: {
  jobId: string;
  jobStatus: string;
  quotes: readonly RelatedQuoteRef[];
  booking?: RelatedBookingRef | null;
}): JobRelatedLinks {
  const {jobId, jobStatus, quotes, booking} = params;
  const acceptedQuote =
    (booking ? quotes.find(q => q.quote_id === booking.quote_id) : null) ||
    quotes.find(q => q.status === 'accepted') ||
    null;
  const preferredQuote =
    acceptedQuote || quotes.find(q => q.status === 'pending') || quotes[0] || null;

  const hasBookingStatus = jobStatus === 'booked' || jobStatus === 'completed';

  return Object.freeze({
    quotesAnchor: quotes.length > 0 ? `#job-quotes-${jobId}` : null,
    quotesCount: quotes.length,
    primaryMessageHref: preferredQuote
      ? quoteMessagesHref(preferredQuote.quote_id)
      : booking
        ? quoteMessagesHref(booking.quote_id)
        : null,
    bookingHref: booking
      ? bookingHistoryHref(booking.id)
      : hasBookingStatus
        ? '/bookings'
        : null,
    scheduleHref: booking ? bookingScheduleHref(booking.id) : null,
  });
}
