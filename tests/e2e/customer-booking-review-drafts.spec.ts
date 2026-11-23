import {expect,test} from '@playwright/test';
import {bookingReviewDraft, updateBookingReviewDraft, type BookingReviewDrafts} from '../../lib/booking-review-draft';
import {executeBookingAction} from '../../lib/booking-lifecycle';

test('completed bookings keep independent drafts through switching, failed submission and retry', async () => {
  let drafts: BookingReviewDrafts = new Map();
  drafts = updateBookingReviewDraft(drafts, 'booking-a', {stars: '2', body: 'Synthetic first review'});
  expect(bookingReviewDraft(drafts, 'booking-b')).toEqual({stars: '5', body: ''});
  drafts = updateBookingReviewDraft(drafts, 'booking-b', {body: 'Synthetic second review'});

  async function submitFirstBooking(fail: boolean) {
    return executeBookingAction({
      runRpc: async () => ({error: fail ? {message: 'Synthetic retryable error'} : null}),
      onCommittedLocalUpdate: () => {
        drafts = updateBookingReviewDraft(drafts, 'booking-a', null);
      },
      runRefresh: async () => {},
      successMessage: 'Saved',
      refreshFailedMessage: 'Saved, refresh failed',
      fallbackErrorMessage: 'Unable to save',
    });
  }

  expect((await submitFirstBooking(true)).outcome).toBe('rpc_error');
  expect(bookingReviewDraft(drafts, 'booking-a')).toEqual({stars: '2', body: 'Synthetic first review'});
  await submitFirstBooking(false);
  expect(bookingReviewDraft(drafts, 'booking-a')).toEqual({stars: '5', body: ''});
  expect(bookingReviewDraft(drafts, 'booking-b')).toEqual({stars: '5', body: 'Synthetic second review'});
});
