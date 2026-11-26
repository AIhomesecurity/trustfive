import {expect,test} from '@playwright/test';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  formatAppointmentWindow,
  isValidIanaTimezone,
  summarizeAppointments,
  validateAppointmentProposal,
} from '../../lib/appointment-schedule';
import {
  detectPrematureContactWarning,
  readableAuditAction,
  sortAndDedupeMessages,
  validateMessageBody,
} from '../../lib/marketplace-messages';
import {assessSocialPostSafety,publicSocialContactError} from '../../lib/social-safety';

test('Public Social text blocks numeric, fullwidth and spelled-out contact details', () => {
  expect(assessSocialPostSafety('Call me on 07700 900123').blockingError).toMatch(/including numbers written as words/i);
  expect(assessSocialPostSafety('Call zero seven one two three four five six seven eight nine').blockingError).toMatch(/phone numbers/i);
  expect(assessSocialPostSafety('Text ０７１２３ ４５６７８９').blockingError).toMatch(/phone numbers/i);
  expect(assessSocialPostSafety('Meet me at SW1A 1AA').blockingError).toMatch(/full postcodes/i);
  expect(publicSocialContactError('Email me at person@example.com')).toMatch(/email addresses/i);
  expect(assessSocialPostSafety('We installed two aerial sockets with a 10 m cable.').blockingError).toBeNull();
});

test('International appointment helper validates IANA timezones, bounds and formats explicitly in stored timezone', () => {
  expect(isValidIanaTimezone('Europe/London')).toBe(true);
  expect(isValidIanaTimezone('America/New_York')).toBe(true);
  expect(isValidIanaTimezone('Asia/Tokyo')).toBe(true);
  expect(isValidIanaTimezone('Mars/Olympus_Mons')).toBe(false);

  const now = Date.parse('2026-11-21T12:00:00Z');
  expect(
    validateAppointmentProposal(
      {
        bookingId: 'b1',
        startIso: '2026-11-21T11:00:00Z',
        endIso: '2026-11-21T13:00:00Z',
        timezoneName: 'Europe/London',
      },
      now
    )
  ).toMatch(/in the future/i);

  expect(
    validateAppointmentProposal(
      {
        bookingId: 'b1',
        startIso: '2026-11-22T09:00:00Z',
        endIso: '2026-12-15T09:00:00Z',
        timezoneName: 'Europe/London',
      },
      now
    )
  ).toMatch(/14 days/i);

  expect(
    validateAppointmentProposal(
      {
        bookingId: 'b1',
        startIso: '2026-11-22T09:00:00Z',
        endIso: '2026-11-22T12:00:00Z',
        timezoneName: 'America/New_York',
      },
      now
    )
  ).toBeNull();

  // Verify explicit stored-timezone formatting (14:00 UTC in America/New_York EST = 09:00)
  const nyLabel = formatAppointmentWindow(
    '2026-11-22T14:00:00Z',
    '2026-11-22T16:00:00Z',
    'America/New_York',
    'en-GB'
  );
  expect(nyLabel).toContain('09:00');
  expect(nyLabel).toContain('11:00');
  expect(nyLabel).toContain('(America/New_York)');

  const tokyoLabel = formatAppointmentWindow(
    '2026-11-22T14:00:00Z',
    '2026-11-22T16:00:00Z',
    'Asia/Tokyo',
    'en-GB'
  );
  expect(tokyoLabel).toContain('23:00');
  expect(tokyoLabel).toContain('(Asia/Tokyo)');

  const summary = summarizeAppointments(
    [
      {
        booking_id: 'b1',
        proposed_by: 'u2',
        starts_at: '2026-11-23T09:00:00Z',
        ends_at: '2026-11-23T11:00:00Z',
        timezone_name: 'Europe/London',
        status: 'confirmed',
      },
      {
        booking_id: 'b2',
        proposed_by: 'u2',
        starts_at: '2026-11-24T09:00:00Z',
        ends_at: '2026-11-24T11:00:00Z',
        timezone_name: 'Europe/London',
        status: 'proposed',
      },
      {
        booking_id: 'b3',
        proposed_by: 'u1',
        starts_at: '2026-11-25T09:00:00Z',
        ends_at: '2026-11-25T11:00:00Z',
        timezone_name: 'Europe/London',
        status: 'proposed',
      },
    ],
    'u1',
    now
  );
  expect(summary).toEqual({
    upcomingConfirmed: 1,
    awaitingYourConfirmation: 1,
    awaitingOtherParty: 1,
  });
});

test('Messaging helper validates bodies, dedupes/sorts chronologically and warns on pre-booking contact sharing', () => {
  expect(validateMessageBody('   ')).toMatch(/Write a message/);
  expect(validateMessageBody('a'.repeat(2001))).toMatch(/2,000/);
  expect(validateMessageBody('Can you confirm materials included?')).toBeNull();

  const sorted = sortAndDedupeMessages([
    {id: 'm2', quote_id: 'q1', author_id: 'u1', body: 'Second', created_at: '2026-11-21T10:05:00Z'},
    {id: 'm1', quote_id: 'q1', author_id: 'u2', body: 'First', created_at: '2026-11-21T10:00:00Z'},
    {id: 'm2', quote_id: 'q1', author_id: 'u1', body: 'Second', created_at: '2026-11-21T10:05:00Z'},
  ]);
  expect(sorted.map(m => m.id)).toEqual(['m1', 'm2']);

  expect(detectPrematureContactWarning('Call me on 07700 900123', 'pending')).toMatch(/private until you confirm/i);
  expect(detectPrematureContactWarning('Email me at person@example.com', 'pending')).toMatch(/private until you confirm/i);
  expect(detectPrematureContactWarning('Call me on 07700 900123', 'accepted')).toBeNull();
  expect(detectPrematureContactWarning('Does this quote include parts?', 'pending')).toBeNull();

  expect(readableAuditAction('job_cancelled')).toBe('Job cancelled by customer');
  expect(readableAuditAction('job_reopened')).toBe('Job reopened by customer');
});

test('Protected marketplace routes enforce auth redirect with preserved return paths and zero horizontal overflow across 320px to desktop', async ({
  page,
}) => {
  const viewports = [
    {width: 320, height: 568},
    {width: 360, height: 740},
    {width: 390, height: 844},
    {width: 768, height: 1024},
    {width: 1024, height: 768},
    {width: 1280, height: 800},
  ];
  const protectedRoutes = [
    '/schedule',
    '/messages',
    '/support/complaints',
    '/jobs',
    '/quotes',
    '/bookings',
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto('/services');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({width: 360, height: 740});
  for (const route of protectedRoutes) {
    await page.goto(route);
    const expectedNext = encodeURIComponent(route);
    await expect(page).toHaveURL(new RegExp(`/account\\?next=${expectedNext}$`));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test('Playwright E2E specs never place worker-scoped test.use options inside test.describe blocks', () => {
  const e2eDir = join(process.cwd(), 'tests', 'e2e');
  const specFiles = readdirSync(e2eDir).filter(name => name.endsWith('.spec.ts'));
  expect(specFiles.length).toBeGreaterThan(10);

  const workerScoped = /\b(?:trace|screenshot|video|headless|launchOptions|channel)\s*:/;
  for (const file of specFiles) {
    const raw = readFileSync(join(e2eDir, file), 'utf8');
    const src = raw.replace(/^\s*\/\/.*$/gm, '');
    const describeIdx = src.indexOf('test.describe(');
    if (describeIdx === -1) continue;
    const afterDescribe = src.slice(describeIdx);
    const nestedUseMatches = afterDescribe.match(/test\.use\s*\(\s*\{[\s\S]*?\}\s*\)/g) || [];
    for (const block of nestedUseMatches) {
      expect(
        workerScoped.test(block),
        `${file} must place worker-scoped test.use() options at file top-level, outside test.describe()`
      ).toBe(false);
    }
  }
});
