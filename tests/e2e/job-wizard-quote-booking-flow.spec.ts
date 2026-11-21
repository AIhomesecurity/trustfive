import {expect,test} from '@playwright/test';
import {
  deriveBookingProgressSteps,
  readableContactPreference,
  sortCustomerQuotes,
  summarizeJobQuotes,
  validateQuoteAvailability,
} from '../../lib/quote-comparison';

test('Quote comparison sorts accurately by lowest price or newest and summarises genuine price range', () => {
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
      message: 'Withdrawn quote should not skew active price range.',
      status: 'withdrawn',
      created_at: '2026-11-21T08:00:00Z',
    },
  ];

  const byPrice = sortCustomerQuotes(quotes, 'lowest_price');
  expect(byPrice.map(q => q.quote_id)).toEqual(['q3', 'q2', 'q1']);

  const byNewest = sortCustomerQuotes(quotes, 'newest');
  expect(byNewest.map(q => q.quote_id)).toEqual(['q1', 'q2', 'q3']);

  const summary = summarizeJobQuotes(quotes);
  expect(summary).toEqual({
    total: 3,
    pending: 2,
    lowestPence: 18500,
    highestPence: 24000,
  });

  expect(summarizeJobQuotes([])).toEqual({
    total: 0,
    pending: 0,
    lowestPence: null,
    highestPence: null,
  });
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
