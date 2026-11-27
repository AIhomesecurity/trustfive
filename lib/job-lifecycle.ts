import {readableAuditAction} from './marketplace-messages';

export type JobLifecycleState = {
  id: string;
  status: string;
};

export type JobActivityEvent = {
  event_id: number;
  action: string;
  created_at: string;
};

export type NormalizedJobActivityEvent = JobActivityEvent & {
  label: string;
};

/** Only unbooked draft or open jobs may be cancelled by the customer.
 * Server-side cancel_customer_job() remains authoritative. */
export function canCancelCustomerJob(job: JobLifecycleState | null | undefined): boolean {
  if (!job) return false;
  return job.status === 'draft' || job.status === 'open';
}

/** Only cancelled jobs may be reopened by the customer.
 * Server-side reopen_customer_job() additionally enforces no existing booking and valid trade/area. */
export function canReopenCustomerJob(job: JobLifecycleState | null | undefined): boolean {
  if (!job) return false;
  return job.status === 'cancelled';
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

export function validateCancelReason(raw: string): string | null {
  const clean = raw.trim();
  if (!clean) return null;
  if (clean.length > 240) {
    return 'Cancellation note must be 240 characters or fewer.';
  }
  return null;
}

/** Deduplicate and sort genuine marketplace_audit_events chronologically (oldest first). */
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
    }));
}
