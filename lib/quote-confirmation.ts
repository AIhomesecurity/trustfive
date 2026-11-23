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

export function customerJobBookingLinks(
 jobIds:readonly string[],
 customerId:string,
 bookings:readonly {id:string;job_id:string;customer_id:string}[]
):Map<string,string>{
 const visibleJobs=new Set(jobIds);
 const links=new Map<string,string>();
 const seen=new Set<string>();
 for(const booking of bookings){
  if(!customerId||booking.customer_id!==customerId||!visibleJobs.has(booking.job_id))continue;
  const href=acceptedQuoteBookingHref(booking.id);
  if(seen.has(booking.job_id))links.delete(booking.job_id);
  else if(href!=='/bookings')links.set(booking.job_id,href);
  seen.add(booking.job_id);
 }
 return links;
}
