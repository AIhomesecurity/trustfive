import {expect,test} from '@playwright/test';
import {
  deriveBookingProgressSteps,
  readableContactPreference,
  sortCustomerQuotes,
  summarizeJobQuotes,
  validateQuoteAvailability,
} from '../../lib/quote-comparison';

test('Quote comparison keeps withdrawn quotes below available quotes and excludes them from price summaries (mixed-status)', () => {
  const quotes = [
    {
      quote_id: 'q1',
      job_id: 'j1',
      business_name: 'Alpha Plumbing',
      amount_pence: 24000,
      message: 'Full replacement and test.',
      availability_note: 'Next Thursday',
      status: 'pending',
      created_at: '2026-11-21T10:00:00Z',
    },
    {
      quote_id: 'q2',
      job_id: 'j1',
      business_name: 'Beta Plumbing',
      amount_pence: 18500,
      message: 'Includes brass valve and pressure check.',
      availability_note: 'Tomorrow morning',
      status: 'pending',
      created_at: '2026-11-21T09:00:00Z',
    },
    {
      quote_id: 'q3',
      job_id: 'j1',
      business_name: 'Gamma Plumbing',
      amount_pence: 9500,
      message: 'Withdrawn quote must never rank as cheapest available option.',
      status: 'withdrawn',
      created_at: '2026-11-21T08:00:00Z',
    },
    {
      quote_id: 'q4',
      job_id: 'j1',
      business_name: 'Delta Plumbing',
      amount_pence: 15000,
      message: 'Rejected quote ranks behind currently available pending quotes.',
      status: 'rejected',
      created_at: '2026-11-21T07:00:00Z',
    },
  ];

  // Lowest price puts available pending quotes first (q2 £185, q1 £240), then rejected (q4), then withdrawn (q3 £95) last
  const byPrice = sortCustomerQuotes(quotes, 'lowest_price');
  expect(byPrice.map(q => q.quote_id)).toEqual(['q2', 'q1', 'q4', 'q3']);
  expect(byPrice[0].status).toBe('pending');
  expect(byPrice[byPrice.length - 1].status).toBe('withdrawn');

  const byNewest = sortCustomerQuotes(quotes, 'newest');
  expect(byNewest.map(q => q.quote_id)).toEqual(['q1', 'q2', 'q3', 'q4']);

  // Price summary excludes withdrawn £95 quote (lowest non-withdrawn is £150, highest is £240)
  const summary = summarizeJobQuotes(quotes);
  expect(summary).toEqual({
    total: 4,
    pending: 2,
    lowestPence: 15000,
    highestPence: 24000,
  });
});

test('Quote comparison returns null price bounds for all-withdrawn and zero-quote lists', () => {
  const allWithdrawn = [
    {
      quote_id: 'w1',
      job_id: 'j2',
      business_name: 'Withdrawn One',
      amount_pence: 12000,
      message: 'No longer available.',
      status: 'withdrawn',
      created_at: '2026-11-21T09:00:00Z',
    },
    {
      quote_id: 'w2',
      job_id: 'j2',
      business_name: 'Withdrawn Two',
      amount_pence: 8500,
      message: 'Pulled quote.',
      status: 'withdrawn',
      created_at: '2026-11-21T10:00:00Z',
    },
  ];

  expect(summarizeJobQuotes(allWithdrawn)).toEqual({
    total: 2,
    pending: 0,
    lowestPence: null,
    highestPence: null,
  });
  expect(sortCustomerQuotes(allWithdrawn, 'lowest_price').map(q => q.quote_id)).toEqual(['w2', 'w1']);

  expect(summarizeJobQuotes([])).toEqual({
    total: 0,
    pending: 0,
    lowestPence: null,
    highestPence: null,
  });
  expect(sortCustomerQuotes([], 'lowest_price')).toEqual([]);
});

test('Booking progress timeline tracks quote acceptance, appointment, work ready, completion and cancellation honestly', () => {
  const bookedNoAppt = deriveBookingProgressSteps('booked', null);
  expect(bookedNoAppt.map(s => s.state)).toEqual(['done', 'current', 'upcoming', 'upcoming']);

  const bookedConfirmedAppt = deriveBookingProgressSteps('booked', 'confirmed');
  expect(bookedConfirmedAppt.map(s => s.state)).toEqual(['done', 'done', 'current', 'upcoming']);

  const awaitingCustomer = deriveBookingProgressSteps('awaiting_customer', 'confirmed');
  expect(awaitingCustomer.map(s => s.state)).toEqual(['done', 'done', 'done', 'current']);

  const completed = deriveBookingProgressSteps('completed', 'confirmed');
  expect(completed.map(s => s.state)).toEqual(['done', 'done', 'done', 'done']);

  const cancelled = deriveBookingProgressSteps('cancelled', null);
  expect(cancelled.map(s => s.state)).toEqual(['done', 'cancelled', 'cancelled', 'cancelled']);
});

test('Contact preference labels and availability validator enforce clean bounds', () => {
  expect(readableContactPreference('in_app_messages')).toBe('TrustFive messages only');
  expect(readableContactPreference('phone_after_booking')).toBe('Phone call after booking is confirmed');
  expect(readableContactPreference('unknown_value')).toBe('TrustFive messages only');

  expect(validateQuoteAvailability('')).toBeNull();
  expect(validateQuoteAvailability('Ok')).toMatch(/between 3 and 240/);
  expect(validateQuoteAvailability('Available Tuesday morning')).toBeNull();
});

test('Anonymous visitors on mobile are redirected away from /jobs, /quotes and /bookings with preserved return paths', async ({
  page,
}) => {
  await page.setViewportSize({width: 390, height: 844});

  await page.goto('/jobs?trade=plumbing');
  await expect(page).toHaveURL(/\/account\?next=%2Fjobs%3Ftrade%3Dplumbing$/);
  await expect(page.getByRole('button', {name: /Publish job request/i})).toHaveCount(0);

  await page.goto('/quotes');
  await expect(page).toHaveURL(/\/account\?next=%2Fquotes$/);
  await expect(page.getByRole('button', {name: /Send quote/i})).toHaveCount(0);

  await page.goto('/bookings');
  await expect(page).toHaveURL(/\/account\?next=%2Fbookings$/);
  await expect(page.getByText(/Private job-site address/i)).toHaveCount(0);
});
