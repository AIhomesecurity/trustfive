/** A client UX preflight, not an authorisation decision.
 * The database remains authoritative about active allocations and quote rights.
 * Fail closed on contradictory or duplicated lead rows rather than choosing
 * whichever record happened to arrive first from an asynchronous query. */
export type ProfessionalLeadRef={job_id:string;allocation_id:string};
export type SubmittedQuoteRef={job_id:string;status:string};
export function canPrepareProfessionalQuote(
 lead:ProfessionalLeadRef|null,
 visibleLeads:readonly ProfessionalLeadRef[],
 submitted:readonly SubmittedQuoteRef[]
):boolean{
 if(!lead?.job_id||!lead.allocation_id)return false;
 const matching=visibleLeads.filter(x=>x.job_id===lead.job_id);
 if(matching.length!==1||matching[0].allocation_id!==lead.allocation_id)return false;
 return !submitted.some(q=>q.job_id===lead.job_id);
}
export function professionalQuoteStats(
 leads:readonly ProfessionalLeadRef[],
 submitted:readonly SubmittedQuoteRef[]
){
 const quotedJobs=new Set(submitted.map(q=>q.job_id));
 return {
  available:leads.filter(l=>!quotedJobs.has(l.job_id)).length,
  submitted:submitted.length,
  awaiting:submitted.filter(q=>q.status==='pending').length
 };
}
