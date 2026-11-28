import {expect, test} from '@playwright/test';
import {
  buildAppointmentIcs,
  buildPrintableQuoteDocument,
  buildQuotesAccountingCsv,
  sanitizeCsvCell,
  summarizeReviewDistribution,
} from '../../lib/tradesman-utilities';

test.describe('Tradesman utilities unit contracts (CSV, printable quote sheet, ICS, review distribution)', () => {
  test('sanitizes spreadsheet formula injection and builds RFC-4180 accounting CSV', () => {
    expect(sanitizeCsvCell('=HYPERLINK("http://evil.example","click")')).toBe(
      `"'=HYPERLINK(""http://evil.example"",""click"")"`
    );
    expect(sanitizeCsvCell('+SUM(A1:A5)')).toBe("'+SUM(A1:A5)");
    expect(sanitizeCsvCell('-cmd|calc')).toBe("'-cmd|calc");
    expect(sanitizeCsvCell('@IMPORTXML')).toBe("'@IMPORTXML");

    const csv = buildQuotesAccountingCsv([
      {
        quote_id: 'q-12345678',
        job_title: '4-Camera CCTV, West Yorkshire',
        amount_pence: 89500,
        status: 'accepted',
        availability_note: 'Monday 09:00',
        message: '=malicious scope',
        created_at: '2026-11-26T10:00:00Z',
      },
    ]);
    expect(csv).toContain('Quote ID,Job Title,Status,Amount (GBP),Availability Note,Created (UTC),Quote Scope');
    expect(csv).toContain('"4-Camera CCTV, West Yorkshire",accepted,895.00,Monday 09:00,2026-11-26T10:00:00Z,\'=malicious scope');
  });

  test('escapes HTML/script payloads cleanly in printable quote sheets', () => {
    const html = buildPrintableQuoteDocument({
      quote_id: 'q-99887766',
      job_title: 'Consumer unit <script>alert(1)</script>',
      amount_pence: 65000,
      status: 'pending',
      availability_note: '<b>Next Tuesday</b>',
      message: 'Includes RCBOs & SPD <img src=x onerror=alert(1)>',
      created_at: '2026-11-26T11:00:00Z',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('£650.00');
    expect(html).toContain('#087c46');
  });

  test('builds RFC-5545 .ics calendar payload and rejects invalid timestamps', () => {
    const ics = buildAppointmentIcs({
      booking_id: 'b-11223344',
      starts_at: '2026-11-28T09:00:00Z',
      ends_at: '2026-11-28T12:30:00Z',
      timezone_name: 'Europe/London',
      status: 'confirmed',
      summary: 'CCTV install; loft access, Didsbury',
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261128T090000Z');
    expect(ics).toContain('DTEND:20261128T123000Z');
    expect(ics).toContain('SUMMARY:CCTV install\\; loft access\\, Didsbury');
    expect(ics).toContain('END:VCALENDAR');

    expect(() =>
      buildAppointmentIcs({
        booking_id: 'b-bad',
        starts_at: 'not-a-date',
        ends_at: '2026-11-28T12:30:00Z',
        status: 'confirmed',
      })
    ).toThrow(/valid ISO/);
  });

  test('summarizes verified booking reviews honestly without fabricating averages when empty', () => {
    const empty = summarizeReviewDistribution([]);
    expect(empty.total).toBe(0);
    expect(empty.average).toBeNull();
    expect(empty.buckets.every((b) => b.count === 0 && b.percent === 0)).toBe(true);

    const populated = summarizeReviewDistribution([
      {stars: 5, date: '2026-11-20', body: 'Spotless work'},
      {stars: 5, date: '2026-11-21', body: 'On time'},
      {stars: 4, date: '2026-11-22', body: 'Good job'},
    ]);
    expect(populated.total).toBe(3);
    expect(populated.average).toBe(4.7);
    expect(populated.buckets[0]).toEqual({stars: 5, count: 2, percent: 67});
    expect(populated.buckets[1]).toEqual({stars: 4, count: 1, percent: 33});
  });
});
