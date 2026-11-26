export type ExportableQuoteRow = {
  quote_id: string;
  job_title: string;
  amount_pence: number;
  status: string;
  availability_note?: string | null;
  message: string;
  created_at: string;
};

export type ExportableAppointment = {
  booking_id: string;
  starts_at: string;
  ends_at: string;
  timezone_name?: string | null;
  status: string;
  summary?: string;
};

export type VerifiedReviewInput = {
  stars: number;
  date: string;
  body: string | null;
};

const FORMULA_PREFIX = /^[\t\r\n]*[=+\-@]/;

/**
 * RFC-4180 CSV cell escaping with spreadsheet formula-injection protection.
 */
export function sanitizeCsvCell(raw: string | number | null | undefined): string {
  const text = String(raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const safe = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildQuotesAccountingCsv(quotes: ExportableQuoteRow[]): string {
  const header = [
    'Quote ID',
    'Job Title',
    'Status',
    'Amount (GBP)',
    'Availability Note',
    'Created (UTC)',
    'Quote Scope',
  ];
  const rows = quotes.map((q) => [
    sanitizeCsvCell(q.quote_id),
    sanitizeCsvCell(q.job_title),
    sanitizeCsvCell(q.status),
    sanitizeCsvCell((q.amount_pence / 100).toFixed(2)),
    sanitizeCsvCell(q.availability_note ?? ''),
    sanitizeCsvCell(q.created_at),
    sanitizeCsvCell(q.message),
  ]);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n') + '\r\n';
}

export function escapeHtmlText(raw: string | number | null | undefined): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPrintableQuoteDocument(quote: ExportableQuoteRow): string {
  const amount = `£${(quote.amount_pence / 100).toFixed(2)}`;
  const created = escapeHtmlText(quote.created_at);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>TrustFive Quote — ${escapeHtmlText(quote.job_title)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #123c2b; background: #f5faf7; margin: 0; padding: 32px; line-height: 1.55; }
  .sheet { max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #dae9df; border-radius: 16px; padding: 28px 32px; }
  .eyebrow { color: #087c46; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
  h1 { margin: 8px 0 4px; font-size: 26px; }
  .meta { color: #60756a; font-size: 13px; margin: 0 0 20px; }
  .amount-box { background: #eaf8f0; border: 1px solid #bcdac8; border-radius: 12px; padding: 16px 20px; margin: 18px 0; display: flex; justify-content: space-between; align-items: baseline; }
  .amount { font-size: 28px; font-weight: 800; color: #087c46; }
  .section-title { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #60756a; margin: 20px 0 6px; }
  .scope { white-space: pre-wrap; background: #f5faf7; border: 1px solid #dae9df; border-radius: 10px; padding: 14px; }
  .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #dae9df; font-size: 12px; color: #60756a; }
  @media print { body { background: #fff; padding: 0; } .sheet { border: none; padding: 0; } }
</style>
</head>
<body>
<article class="sheet">
  <div class="eyebrow">TrustFive Written Quote Summary</div>
  <h1>${escapeHtmlText(quote.job_title)}</h1>
  <p class="meta">Quote Ref: ${escapeHtmlText(quote.quote_id)} &middot; Status: ${escapeHtmlText(quote.status)} &middot; Issued: ${created}</p>
  <div class="amount-box">
    <span>Quoted total (confirm VAT status directly with your professional)</span>
    <span class="amount">${escapeHtmlText(amount)}</span>
  </div>
  ${quote.availability_note ? `<div class="section-title">Proposed Availability</div><p>${escapeHtmlText(quote.availability_note)}</p>` : ''}
  <div class="section-title">Scope of Work</div>
  <div class="scope">${escapeHtmlText(quote.message)}</div>
  <p class="footer">Generated from TrustFive. Professionals are independent UK businesses. Exact customer addresses remain private until booking confirmation and explicit address consent.</p>
</article>
</body>
</html>
`;
}

function formatIcsUtc(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function buildAppointmentIcs(appointment: ExportableAppointment): string {
  const start = formatIcsUtc(appointment.starts_at);
  const end = formatIcsUtc(appointment.ends_at);
  if (!start || !end) {
    throw new Error('Appointment requires valid ISO start and end timestamps.');
  }
  const stamp = formatIcsUtc(new Date().toISOString()) ?? start;
  const uid = `trustfive-booking-${appointment.booking_id.replace(/[^a-zA-Z0-9-]/g, '')}@trustfive.co.uk`;
  const summary = escapeIcsText(appointment.summary || `TrustFive booking appointment (${appointment.status})`);
  const description = escapeIcsText(
    `Booking ID: ${appointment.booking_id}\nStatus: ${appointment.status}\nPrivate customer address is shared only via TrustFive consent controls.`
  );
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TrustFive//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function summarizeReviewDistribution(reviews: VerifiedReviewInput[]): {
  total: number;
  average: number | null;
  buckets: Array<{stars: number; count: number; percent: number}>;
} {
  const counts = new Map<number, number>([
    [5, 0],
    [4, 0],
    [3, 0],
    [2, 0],
    [1, 0],
  ]);
  let sum = 0;
  let validCount = 0;
  for (const r of reviews) {
    const s = Math.round(Number(r.stars));
    if (s >= 1 && s <= 5) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
      sum += s;
      validCount += 1;
    }
  }
  const buckets = [5, 4, 3, 2, 1].map((stars) => {
    const count = counts.get(stars) ?? 0;
    const percent = validCount > 0 ? Math.round((count / validCount) * 100) : 0;
    return {stars, count, percent};
  });
  return {
    total: validCount,
    average: validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : null,
    buckets,
  };
}
