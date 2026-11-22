/** A client UX preflight, not an authorisation decision.
 * The database remains authoritative about active allocations and quote rights. */
export type ProfessionalLeadRef = { job_id: string; allocation_id: string };
export type SubmittedQuoteRef = { job_id: string; status: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A quote is prepared only for one unambiguous visible allocation.
 * Duplicate job rows can reflect stale or inconsistent lead results;
 * never guess which allocation to submit against.
 */
export function canPrepareProfessionalQuote(
  lead: ProfessionalLeadRef | null,
  visibleLeads: readonly ProfessionalLeadRef[],
  submitted: readonly SubmittedQuoteRef[]
): boolean {
  if (!lead || !UUID.test(lead.job_id) || !UUID.test(lead.allocation_id)) return false;
  const jobId = lead.job_id.toLowerCase();
  const matchingJob = visibleLeads.filter(row => row.job_id.toLowerCase() === jobId);
  return matchingJob.length === 1 &&
    matchingJob[0].allocation_id.toLowerCase() === lead.allocation_id.toLowerCase() &&
    !submitted.some(quote => quote.job_id.toLowerCase() === jobId);
}

export function professionalQuoteStats(
  leads: readonly ProfessionalLeadRef[],
  submitted: readonly SubmittedQuoteRef[]
) {
  const quotedJobs = new Set(submitted.map(quote => quote.job_id.toLowerCase()));
  // Count unique, unambiguous jobs rather than duplicate lead rows.
  const leadCounts = new Map<string, number>();
  for (const lead of leads) leadCounts.set(lead.job_id.toLowerCase(), (leadCounts.get(lead.job_id.toLowerCase()) ?? 0) + 1);
  return {
    available: leads.filter(lead => UUID.test(lead.job_id) &&
      UUID.test(lead.allocation_id) && leadCounts.get(lead.job_id.toLowerCase()) === 1 &&
      !quotedJobs.has(lead.job_id.toLowerCase())).length,
    submitted: submitted.length,
    awaiting: submitted.filter(quote => quote.status === 'pending').length
  };
}
