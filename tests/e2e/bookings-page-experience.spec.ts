import {expect, test} from '@playwright/test';
import {
  applyCommittedAppointmentMap,
  applyCommittedBookingStatus,
  applyCommittedReview,
  bookingDisplayTitle,
  bookingNeedsUserAction,
  clearBookingSiteCache,
  createSingleFlightLock,
  deriveBookingNextAction,
  executeBookingAction,
  filterBookings,
  markBookingSiteNeedsRecheck,
  resolveCustomerSiteConsentView,
  resolveSelectedBookingId,
  summarizeBookingStatuses,
  validateBookingReviewInput,
  type BookingAppointmentLike,
  type BookingRecordLike,
} from '../../lib/booking-lifecycle';
import {authorisedBookingSelection} from '../../lib/workflow-links';

const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';
const PRO_ID = '22222222-2222-4222-8222-222222222222';

const FIXTURE_BOOKINGS: BookingRecordLike[] = [
  {
    id: 'aaaa1111-1111-4111-8111-111111111111',
    quote_id: 'q1111111-1111-4111-8111-111111111111',
    job_id: 'j1111111-1111-4111-8111-111111111111',
    customer_id: CUSTOMER_ID,
    professional_id: PRO_ID,
    status: 'booked',
    created_at: '2026-11-20T09:00:00Z',
  },
  {
    id: 'bbbb2222-2222-4222-8222-222222222222',
    quote_id: 'q2222222-2222-4222-8222-222222222222',
    job_id: 'j2222222-2222-4222-8222-222222222222',
    customer_id: CUSTOMER_ID,
    professional_id: PRO_ID,
    status: 'awaiting_customer',
    created_at: '2026-11-19T14:00:00Z',
  },
  {
    id: 'cccc3333-3333-4333-8333-333333333333',
    quote_id: 'q3333333-3333-4333-8333-333333333333',
    job_id: 'j3333333-3333-4333-8333-333333333333',
    customer_id: CUSTOMER_ID,
    professional_id: PRO_ID,
    status: 'completed',
    created_at: '2026-11-15T10:30:00Z',
  },
  {
    id: 'dddd4444-4444-4444-8444-444444444444',
    quote_id: 'q4444444-4444-4444-8444-444444444444',
    job_id: 'j4444444-4444-4444-8444-444444444444',
    customer_id: CUSTOMER_ID,
    professional_id: PRO_ID,
    status: 'completed',
    created_at: '2026-11-10T11:00:00Z',
  },
];

const FIXTURE_APPOINTMENTS: Record<string, BookingAppointmentLike> = {
  'aaaa1111-1111-4111-8111-111111111111': {
    booking_id: 'aaaa1111-1111-4111-8111-111111111111',
    proposed_by: PRO_ID,
    status: 'proposed',
    starts_at: '2026-11-28T09:00:00Z',
    ends_at: '2026-11-28T11:00:00Z',
    timezone_name: 'Europe/London',
  },
  'bbbb2222-2222-4222-8222-222222222222': {
    booking_id: 'bbbb2222-2222-4222-8222-222222222222',
    proposed_by: CUSTOMER_ID,
    status: 'confirmed',
    starts_at: '2026-11-21T10:00:00Z',
    ends_at: '2026-11-21T12:00:00Z',
    timezone_name: 'Europe/London',
  },
};

test('Needs action, Active, Completed, and All booking views classify customer and professional tasks accurately', () => {
  const reviewedSet = new Set(['dddd4444-4444-4444-8444-444444444444']);

  // Customer view:
  // - aaaa1111 needs action (pro proposed appointment)
  // - bbbb2222 needs action (awaiting_customer completion)
  // - cccc3333 needs action (completed, unreviewed)
  // - dddd4444 does NOT need action (completed & reviewed)
  const customerCounts = summarizeBookingStatuses(
    FIXTURE_BOOKINGS,
    CUSTOMER_ID,
    FIXTURE_APPOINTMENTS,
    reviewedSet
  );
  expect(customerCounts).toEqual({
    all: 4,
    active: 2,
    needs_action: 3,
    completed: 2,
  });

  const customerNeeds = filterBookings(
    FIXTURE_BOOKINGS,
    'needs_action',
    CUSTOMER_ID,
    FIXTURE_APPOINTMENTS,
    reviewedSet
  ).map(b => b.id);
  expect(customerNeeds).toEqual([
    'aaaa1111-1111-4111-8111-111111111111',
    'bbbb2222-2222-4222-8222-222222222222',
    'cccc3333-3333-4333-8333-333333333333',
  ]);

  const customerActive = filterBookings(
    FIXTURE_BOOKINGS,
    'active',
    CUSTOMER_ID,
    FIXTURE_APPOINTMENTS,
    reviewedSet
  ).map(b => b.id);
  expect(customerActive).toEqual([
    'aaaa1111-1111-4111-8111-111111111111',
    'bbbb2222-2222-4222-8222-222222222222',
  ]);

  const customerCompleted = filterBookings(
    FIXTURE_BOOKINGS,
    'completed',
    CUSTOMER_ID,
    FIXTURE_APPOINTMENTS,
    reviewedSet
  ).map(b => b.id);
  expect(customerCompleted).toEqual([
    'cccc3333-3333-4333-8333-333333333333',
    'dddd4444-4444-4444-8444-444444444444',
  ]);

  // Once the proposed appointment is confirmed, aaaa1111 leaves customer Needs action
  const confirmedAppts = applyCommittedAppointmentMap(
    FIXTURE_APPOINTMENTS,
    'aaaa1111-1111-4111-8111-111111111111',
    'confirmed'
  );
  expect(
    bookingNeedsUserAction(FIXTURE_BOOKINGS[0], CUSTOMER_ID, confirmedAppts['aaaa1111-1111-4111-8111-111111111111'], false)
  ).toBe(false);

  // Professional view: only booked job aaaa1111 needs action (mark work ready); awaiting_customer waits on customer
  const proCounts = summarizeBookingStatuses(
    FIXTURE_BOOKINGS,
    PRO_ID,
    FIXTURE_APPOINTMENTS,
    new Set()
  );
  expect(proCounts).toEqual({
    all: 4,
    active: 2,
    needs_action: 1,
    completed: 2,
  });
});

test('Next-action guidance and display titles cover customer and professional booking stages', () => {
  expect(bookingDisplayTitle('aaaa1111-1111-4111-8111-111111111111', 'Install 4K CCTV system')).toBe(
    'Install 4K CCTV system'
  );
  expect(bookingDisplayTitle('aaaa1111-1111-4111-8111-111111111111', '   ')).toBe(
    'Booking #aaaa1111'
  );
  expect(bookingDisplayTitle('aaaa1111-1111-4111-8111-111111111111', null)).toBe(
    'Booking #aaaa1111'
  );

  // Customer sees urgent prompt to confirm pro's proposed appointment
  expect(
    deriveBookingNextAction({
      booking: FIXTURE_BOOKINGS[0],
      userId: CUSTOMER_ID,
      appointment: FIXTURE_APPOINTMENTS['aaaa1111-1111-4111-8111-111111111111'],
    })
  ).toMatchObject({
    label: 'Confirm proposed appointment',
    priority: 'urgent',
    section: 'appointment',
  });

  // Customer with confirmed appointment and private address gets clear address-sharing next step
  expect(
    deriveBookingNextAction({
      booking: FIXTURE_BOOKINGS[0],
      userId: CUSTOMER_ID,
      appointment: {status: 'confirmed', proposed_by: PRO_ID},
      siteInfo: {sharing_enabled: false},
    })
  ).toMatchObject({
    label: 'Share exact address when ready',
    section: 'address',
  });

  // Customer awaiting confirmation gets urgent completion action
  expect(
    deriveBookingNextAction({
      booking: FIXTURE_BOOKINGS[1],
      userId: CUSTOMER_ID,
      appointment: FIXTURE_APPOINTMENTS['bbbb2222-2222-4222-8222-222222222222'],
    })
  ).toMatchObject({
    label: 'Confirm work is completed',
    priority: 'urgent',
    section: 'completion',
  });

  // Completed booking without review directs customer to verified-booking review
  expect(
    deriveBookingNextAction({
      booking: FIXTURE_BOOKINGS[2],
      userId: CUSTOMER_ID,
      hasReviewed: false,
    })
  ).toMatchObject({
    label: 'Leave verified-booking review',
    section: 'review',
  });

  // Completed & reviewed booking is cleanly done
  expect(
    deriveBookingNextAction({
      booking: FIXTURE_BOOKINGS[3],
      userId: CUSTOMER_ID,
      hasReviewed: true,
    })
  ).toMatchObject({
    label: 'Completed & reviewed',
    priority: 'done',
    section: 'none',
  });

  // Professional with confirmed appointment is prompted to mark work ready
  expect(
    deriveBookingNextAction({
      booking: FIXTURE_BOOKINGS[0],
      userId: PRO_ID,
      appointment: {status: 'confirmed', proposed_by: PRO_ID},
    })
  ).toMatchObject({
    label: 'Mark work ready when finished',
    priority: 'urgent',
    section: 'completion',
  });
});

test('Booking selection respects authorised deep links without blocking manual row switching or exposing unauthorised IDs', () => {
  const ids = FIXTURE_BOOKINGS.map(b => b.id);
  const deepLinked = authorisedBookingSelection(ids[1], ids);
  expect(deepLinked).toBe(ids[1]);
  expect(authorisedBookingSelection('99999999-9999-4999-8999-999999999999', ids)).toBe('');

  // Initial load with deep link selects deepLinked booking
  expect(
    resolveSelectedBookingId({
      visibleIds: ids,
      currentSelectedId: '',
      deepLinkBookingId: deepLinked,
    })
  ).toBe(ids[1]);

  // Manual switch to another row takes priority over initial deep link
  expect(
    resolveSelectedBookingId({
      visibleIds: ids,
      currentSelectedId: ids[2],
      deepLinkBookingId: deepLinked,
    })
  ).toBe(ids[2]);

  // Switching to a filter where the previously selected row is absent selects the first visible row
  expect(
    resolveSelectedBookingId({
      visibleIds: [ids[0]],
      currentSelectedId: ids[2],
      deepLinkBookingId: deepLinked,
    })
  ).toBe(ids[0]);
});

test('Failed address-sharing toggle preserves unrelated bookings and renders an explicit unavailable recovery state', () => {
  const initialSites = {
    [FIXTURE_BOOKINGS[0].id]: {
      address_label: '14 Mill Lane, Bury',
      postcode: 'BL9 0AA',
      sharing_enabled: false,
    },
    [FIXTURE_BOOKINGS[1].id]: {
      address_label: '22 Oak Road, Rochdale',
      postcode: 'OL11 1BB',
      sharing_enabled: true,
    },
  };

  // Target booking cache is cleared immediately; unrelated booking stays intact
  const sitesAfterClear = clearBookingSiteCache(initialSites, FIXTURE_BOOKINGS[0].id);
  expect(sitesAfterClear[FIXTURE_BOOKINGS[0].id]).toBeUndefined();
  expect(sitesAfterClear[FIXTURE_BOOKINGS[1].id]).toEqual(initialSites[FIXTURE_BOOKINGS[1].id]);

  // Target booking is marked unavailable until live server check succeeds
  const unavailableAfterClear = markBookingSiteNeedsRecheck([], FIXTURE_BOOKINGS[0].id);
  expect(unavailableAfterClear).toEqual([FIXTURE_BOOKINGS[0].id]);

  // While RPC is in flight
  expect(
    resolveCustomerSiteConsentView({
      bookingStatus: 'booked',
      hasLoadedSite: false,
      siteUnavailable: true,
      siteBusy: true,
      loadingBookings: false,
    })
  ).toBe('updating');

  // After RPC failure: explicit unavailable recovery state, never silently hidden
  expect(
    resolveCustomerSiteConsentView({
      bookingStatus: 'booked',
      hasLoadedSite: false,
      siteUnavailable: true,
      siteBusy: false,
      loadingBookings: false,
    })
  ).toBe('unavailable');
});

test('Single-flight lock prevents duplicate rapid submissions and executeBookingAction preserves committed state on refresh failure', async () => {
  const lock = createSingleFlightLock();
  let rpcCount = 0;

  let releaseRpc!: () => void;
  const pendingRpc = new Promise<void>(resolve => {
    releaseRpc = resolve;
  });

  const first = lock.run(async () => {
    rpcCount += 1;
    await pendingRpc;
    return 'done';
  });
  const second = lock.run(async () => {
    rpcCount += 1;
    return 'duplicate';
  });
  const third = lock.run(async () => {
    rpcCount += 1;
    return 'triplicate';
  });

  expect(lock.isLocked()).toBe(true);
  releaseRpc();

  const [r1, r2, r3] = await Promise.all([first, second, third]);
  expect(rpcCount).toBe(1);
  expect(r1).toEqual({skipped: false, value: 'done'});
  expect(r2).toEqual({skipped: true});
  expect(r3).toEqual({skipped: true});
  expect(lock.isLocked()).toBe(false);

  // Committed completion whose follow-up refresh throws is still reported as committed
  let bookingsState = [...FIXTURE_BOOKINGS];
  let reviewsState: {booking_id: string}[] = [];

  const completionResult = await executeBookingAction({
    runRpc: async () => ({error: null}),
    onCommittedLocalUpdate: () => {
      bookingsState = applyCommittedBookingStatus(
        bookingsState,
        FIXTURE_BOOKINGS[1].id,
        'completed'
      );
    },
    runRefresh: async () => {
      throw new Error('Network dropped during refresh');
    },
    successMessage: 'Completed',
    refreshFailedMessage: 'Saved, refresh failed',
    fallbackErrorMessage: 'Failed',
  });

  expect(completionResult).toEqual({
    outcome: 'committed_refresh_failed',
    committed: true,
    message: 'Saved, refresh failed',
  });
  expect(bookingsState.find(b => b.id === FIXTURE_BOOKINGS[1].id)?.status).toBe('completed');

  // Review validation enforces 1-5 stars and 10-1500 chars
  expect(validateBookingReviewInput('0', 'Great tidy installation work.')).toContain('1 and 5');
  expect(validateBookingReviewInput('5', 'Too short')).toContain('10 characters');
  expect(validateBookingReviewInput('5', 'A'.repeat(1501))).toContain('1,500');
  expect(validateBookingReviewInput('5', 'Punctual, neat cable routing and thorough testing.')).toBeNull();

  // Committed review updates local list idempotently
  reviewsState = applyCommittedReview(reviewsState, FIXTURE_BOOKINGS[1].id);
  reviewsState = applyCommittedReview(reviewsState, FIXTURE_BOOKINGS[1].id);
  expect(reviewsState).toEqual([{booking_id: FIXTURE_BOOKINGS[1].id}]);
});

test('unauthenticated /bookings and deep-linked booking routes enforce server auth redirect cleanly on 360px mobile and 1280px desktop', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  for (const viewport of [
    {width: 360, height: 740},
    {width: 1280, height: 800},
  ]) {
    await page.setViewportSize(viewport);
    const destination = '/bookings?booking=unauthorised-booking-id';
    await page.goto(destination, {waitUntil: 'networkidle'});
    await expect(page).toHaveURL(/\/account\?next=/);
    const redirect = new URL(page.url());
    expect(redirect.pathname).toBe('/account');
    expect(redirect.searchParams.get('next')).toBe(destination);
    await expect(page.getByRole('button', {name: 'Sign in', exact: true})).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }

  expect(pageErrors).toEqual([]);
});
