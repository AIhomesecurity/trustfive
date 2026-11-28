/** Secure customer-professional messaging validation, chronological ordering,
 * duplicate protection and premature contact-detail caution helpers. */

export type QuoteMessageItem = {
  id: string;
  quote_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export function validateMessageBody(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Write a message before sending.';
  }
  if (trimmed.length > 2000) {
    return 'Messages must be 2,000 characters or fewer.';
  }
  return null;
}

/** Deterministic chronological sort with ID tie-breaker and deduplication by ID. */
export function sortAndDedupeMessages<T extends QuoteMessageItem>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => {
    const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff;
    const rawDiff = a.created_at.localeCompare(b.created_at);
    if (rawDiff !== 0) return rawDiff;
    return a.id.localeCompare(b.id);
  });
}

/** Non-blocking privacy caution when a message appears to contain a phone number
 * or email before a booking is confirmed. */
export function detectPrematureContactWarning(
  body: string,
  quoteStatus: string
): string | null {
  if (quoteStatus === 'accepted') return null;
  const text = body.trim();
  if (!text) return null;
  const looksLikePhone = /(?:\+?\d[\d\s\-()]{8,}\d)/.test(text);
  const looksLikeEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text);
  if (looksLikePhone || looksLikeEmail) {
    return 'Tip: Keep phone numbers, email addresses and exact street addresses private until you confirm a booking.';
  }
  return null;
}

export function readableAuditAction(action: string): string {
  const map: Record<string, string> = {
    quote_accepted: 'Quote accepted and booking created',
    work_marked_ready: 'Professional marked work ready for confirmation',
    job_completion_confirmed: 'Customer confirmed work completed',
    appointment_proposed: 'Appointment time proposed',
    appointment_confirmed: 'Appointment time confirmed',
    appointment_cancelled: 'Appointment time cancelled',
    job_cancelled: 'Job cancelled by customer',
    job_reopened: 'Job reopened by customer',
    quote_withdrawn: 'Quote withdrawn by professional',
  };
  return map[action] || action.replace(/_/g, ' ');
}
