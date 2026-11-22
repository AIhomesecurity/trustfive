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

/** Only one pending quote for exactly one open job can reach confirmation.
 * Ambiguous or stale result sets must fail closed rather than picking the
 * first matching row. The database still authorises every acceptance. */
export function canConfirmJobQuote(
 quoteId: string | null,
 quotes: readonly QuoteConfirmationCandidate[],
 jobs: readonly JobConfirmationCandidate[],
): boolean {
 if(!quoteId || !quoteId.trim()) return false;
 const matchingQuotes=quotes.filter(q=>q.quote_id===quoteId);
 if(matchingQuotes.length!==1 || matchingQuotes[0].status!=='pending') return false;
 const matchingJobs=jobs.filter(job=>job.id===matchingQuotes[0].job_id);
 return matchingJobs.length===1 && matchingJobs[0].status==='open';
}
