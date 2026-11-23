import {safeNotificationTarget} from './notification-target';
import {bookingHistoryHref} from './workflow-links';

/** Client-side quote confirmation guard. Database access and quote eligibility
 * remain authoritative and must be rechecked by accept_job_quote. */
export type QuoteConfirmationCandidate = {
 quote_id: string;
 job_id: string;
 status: string;
};
export type JobConfirmationCandidate = {
 id: string;
 status: string;
};

/** Only a pending quote for an open job can reach the confirmation action. */
export function canConfirmJobQuote(
 quoteId: string | null,
 quotes: readonly QuoteConfirmationCandidate[],
 jobs: readonly JobConfirmationCandidate[],
): boolean {
 if(!quoteId) return false;
 const selected = quotes.find(q=>q.quote_id===quoteId && q.status==='pending');
 return Boolean(selected && jobs.some(job=>job.id===selected.job_id && job.status==='open'));
}

export function acceptedQuoteBookingHref(bookingId: unknown): string {
 return (typeof bookingId==='string' && safeNotificationTarget(bookingHistoryHref(bookingId))) || '/bookings';
}
