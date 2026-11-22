import {expect,test} from '@playwright/test';
import {
  applyCommittedAppointmentStatus,
  applyCommittedBookingStatus,
  applyCommittedReview,
  bookingNeedsUserAction,
  executeBookingAction,
  filterBookings,
  getBookingStatusMeta,
  summarizeBookingStatuses,
  validateBookingReviewInput,
} from '../../lib/booking-lifecycle';
import {canConfirmCompletedBooking} from '../../lib/booking-completion-guard';
import {deriveBookingProgressSteps} from '../../lib/quote-comparison';
import {formatAppointmentWindow} from '../../lib/appointment-schedule';

test('Booking status indicators, progress steps and role-aware filters cover booked, awaiting confirmation and completed states', () => {
  expect(getBookingStatusMeta('booked').badgeLabel).toBe('Booked');
  expect(getBookingStatusMeta('awaiting_customer').badgeLabel).toBe('Awaiting confirmation');
  expect(getBookingStatusMeta('completed').badgeLabel).toBe('Completed');
  expect(getBookingStatusMeta('cancelled').badgeLabel).toBe('Cancelled');

  const customerId = 'cust-1';
  const proId = 'pro-1';
  const list = [
    {id: 'b1', status: 'booked', customer_id: customerId, professional_id: proId},
    {id: 'b2', status: 'awaiting_customer', customer_id: customerId, professional_id: proId},
    {id: 'b3', status: 'completed', customer_id: customerId, professional_id: proId},
    {id: 'b4', status: 'cancelled', customer_id: customerId, professional_id: proId},
  ];

  expect(bookingNeedsUserAction(list[0], customerId)).toBe(false);
  expect(bookingNeedsUserAction(list[0], proId)).toBe(true);
  expect(bookingNeedsUserAction(list[1], customerId)).toBe(true);
  expect(bookingNeedsUserAction(list[1], proId)).toBe(false);

  expect(summarizeBookingStatuses(list, customerId)).toEqual({
    all: 4,
    active: 2,
    needs_action: 1,
    completed: 1,
  });

  expect(filterBookings(list, 'active', customerId).map(b => b.id)).toEqual(['b1', 'b2']);
  expect(filterBookings(list, 'needs_action', customerId).map(b => b.id)).toEqual(['b2']);
  expect(filterBookings(list, 'completed', customerId).map(b => b.id)).toEqual(['b3']);

  const awaitingSteps = deriveBookingProgressSteps('awaiting_customer', 'confirmed');
  expect(awaitingSteps.map(s => s.state)).toEqual(['done', 'done', 'done', 'current']);
  const completedSteps = deriveBookingProgressSteps('completed', 'confirmed');
  expect(completedSteps.map(s => s.state)).toEqual(['done', 'done', 'done', 'done']);

  // Stored IANA timezone formatting stays explicit (not browser-local)
  const formatted = formatAppointmentWindow(
    '2026-07-15T14:30:00Z',
    '2026-07-15T16:00:00Z',
    'Europe/London'
  );
  expect(formatted).toContain('15:30');
  expect(formatted).toContain('(Europe/London)');
});

test('executeBookingAction preserves committed completion, review and appointment updates even when refresh fails', async () => {
  let localBookings = [
    {id: 'b1', status: 'booked'},
    {id: 'b2', status: 'awaiting_customer'},
  ];
  let localReviews: {booking_id: string}[] = [];
  let localAppointments = [{booking_id: 'b1', status: 'proposed'}];

  // 1. Completion confirmation commits in DB, then refresh fails -> reported as committed_refresh_failed, NOT failed
  const confirmResult = await executeBookingAction({
    runRpc: async () => ({error: null}),
    onCommittedLocalUpdate: () => {
      localBookings = applyCommittedBookingStatus(localBookings, 'b2', 'completed');
    },
    runRefresh: async () => {
      throw new Error('503 Service Unavailable during refresh');
    },
    successMessage: 'Completion confirmed.',
    refreshFailedMessage: 'Completion confirmed and saved, but refreshing failed.',
    fallbackErrorMessage: 'Unable to update booking',
  });

  expect(confirmResult.outcome).toBe('committed_refresh_failed');
  expect(confirmResult.committed).toBe(true);
  expect(confirmResult.message).toContain('confirmed and saved');
  expect(localBookings.find(b => b.id === 'b2')?.status).toBe('completed');

  // 2. Unauthorised RPC failure NEVER mutates local state
  let mutated = false;
  const deniedResult = await executeBookingAction({
    runRpc: async () => ({error: {message: 'Not authorised to update this booking'}}),
    onCommittedLocalUpdate: () => {
      mutated = true;
      localBookings = applyCommittedBookingStatus(localBookings, 'b1', 'completed');
    },
    runRefresh: async () => undefined,
    successMessage: 'Completed',
    refreshFailedMessage: 'Completed refresh failed',
    fallbackErrorMessage: 'Unable to update booking',
  });

  expect(deniedResult.outcome).toBe('rpc_error');
  expect(deniedResult.committed).toBe(false);
  expect(deniedResult.message).toMatch(/Not authorised/i);
  expect(mutated).toBe(false);
  expect(localBookings.find(b => b.id === 'b1')?.status).toBe('booked');

  // 3. Review submission commits, then refresh fails -> review recorded locally to prevent duplicate submit
  const reviewResult = await executeBookingAction({
    runRpc: async () => ({error: null}),
    onCommittedLocalUpdate: () => {
      localReviews = applyCommittedReview(localReviews, 'b2');
    },
    runRefresh: async () => {
      throw new Error('Timeout');
    },
    successMessage: 'Review submitted.',
    refreshFailedMessage: 'Review submitted and saved, but refreshing failed.',
    fallbackErrorMessage: 'Unable to submit review',
  });

  expect(reviewResult.outcome).toBe('committed_refresh_failed');
  expect(reviewResult.committed).toBe(true);
  expect(localReviews).toEqual([{booking_id: 'b2'}]);
  expect(applyCommittedReview(localReviews, 'b2')).toEqual([{booking_id: 'b2'}]);

  // 4. Appointment confirmation commits, then refresh fails -> local status updates to confirmed
  const apptResult = await executeBookingAction({
    runRpc: async () => ({error: null}),
    onCommittedLocalUpdate: () => {
      localAppointments = applyCommittedAppointmentStatus(localAppointments, 'b1', 'confirmed');
    },
    runRefresh: async () => {
      throw new Error('Offline');
    },
    successMessage: 'Appointment confirmed.',
    refreshFailedMessage: 'Appointment confirmed and saved, but refreshing failed.',
    fallbackErrorMessage: 'Could not update appointment',
  });

  expect(apptResult.outcome).toBe('committed_refresh_failed');
  expect(apptResult.committed).toBe(true);
  expect(localAppointments[0].status).toBe('confirmed');
});

test('Review validation and customer completion guard enforce strict input and participant boundaries', () => {
  expect(validateBookingReviewInput(5, 'Arrived on time and finished neatly.')).toBeNull();
  expect(validateBookingReviewInput(0, 'Arrived on time and finished neatly.')).toMatch(/1 and 5/);
  expect(validateBookingReviewInput(5, 'Too short')).toMatch(/at least 10/);
  expect(validateBookingReviewInput(5, 'x'.repeat(1501))).toMatch(/1,500/);

  const awaiting = {id: 'b2', customer_id: 'cust-1', status: 'awaiting_customer'};
  expect(canConfirmCompletedBooking('b2', awaiting, 'cust-1')).toBe(true);
  expect(canConfirmCompletedBooking('b2', awaiting, 'other-user')).toBe(false);
  expect(canConfirmCompletedBooking(null, awaiting, 'cust-1')).toBe(false);
  expect(canConfirmCompletedBooking('b2', {...awaiting, status: 'booked'}, 'cust-1')).toBe(false);
});

test('Protected customer job-to-booking routes preserve return paths and zero overflow across 320px, 360px, 390px and 1280px', async ({
  page,
}) => {
  for (const route of ['/jobs', '/bookings', '/schedule']) {
    for (const vp of [
      {width: 320, height: 568},
      {width: 360, height: 740},
      {width: 390, height: 844},
      {width: 1280, height: 800},
    ]) {
      await page.setViewportSize(vp);
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`/account\\?next=${encodeURIComponent(route)}$`));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${route} redirect overflow at ${vp.width}px`).toBeLessThanOrEqual(1);
    }
  }
});
