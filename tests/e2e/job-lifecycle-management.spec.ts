import {expect,test} from '@playwright/test';
import {
  applyCommittedJobCancellation,
  applyCommittedJobReopen,
  applyCommittedQuoteAcceptance,
  buildJobRelatedLinks,
  canCancelCustomerJob,
  canReopenCustomerJob,
  executeJobLifecycleAction,
  filterJobsByStatus,
  getJobStatusMeta,
  normalizeJobActivity,
  readableJobStatus,
  reopenIneligibilityReason,
  summarizeJobStatuses,
  validateCancelReason,
} from '../../lib/job-lifecycle';

test('Customer job lifecycle guards enforce exact cancel and reopen RPC rules', () => {
  expect(canCancelCustomerJob({id: 'j1', status: 'draft'})).toBe(true);
  expect(canCancelCustomerJob({id: 'j2', status: 'open'})).toBe(true);
  expect(canCancelCustomerJob({id: 'j2', status: 'open'}, true)).toBe(false);
  expect(canCancelCustomerJob({id: 'j2', status: 'open', has_booking: true})).toBe(false);
  expect(canCancelCustomerJob({id: 'j3', status: 'booked'})).toBe(false);
  expect(canCancelCustomerJob({id: 'j4', status: 'completed'})).toBe(false);
  expect(canCancelCustomerJob({id: 'j5', status: 'cancelled'})).toBe(false);
  expect(canCancelCustomerJob(null)).toBe(false);

  expect(
    canReopenCustomerJob({id: 'j5', status: 'cancelled', trade_id: 't1', area_id: 'a1'})
  ).toBe(true);
  expect(canReopenCustomerJob({id: 'j5', status: 'cancelled'})).toBe(true);
  expect(
    canReopenCustomerJob({id: 'j5', status: 'cancelled', trade_id: 't1', area_id: 'a1'}, true)
  ).toBe(false);
  expect(
    canReopenCustomerJob({id: 'j5', status: 'cancelled', trade_id: null, area_id: 'a1'})
  ).toBe(false);
  expect(
    canReopenCustomerJob({id: 'j5', status: 'cancelled', trade_id: 't1', area_id: null})
  ).toBe(false);
  expect(canReopenCustomerJob({id: 'j2', status: 'open'})).toBe(false);
  expect(canReopenCustomerJob({id: 'j3', status: 'booked'})).toBe(false);
  expect(canReopenCustomerJob({id: 'j4', status: 'completed'})).toBe(false);
  expect(canReopenCustomerJob({id: 'j1', status: 'draft'})).toBe(false);
  expect(canReopenCustomerJob(undefined)).toBe(false);

  expect(
    reopenIneligibilityReason({id: 'j5', status: 'cancelled', trade_id: null, area_id: 'a1'})
  ).toMatch(/valid trade and verified service area/i);
  expect(
    reopenIneligibilityReason({id: 'j5', status: 'cancelled', trade_id: 't1', area_id: 'a1'}, true)
  ).toMatch(/recorded booking/i);
});

test('Job status indicators, counts and status filter tabs classify Open, Booked, Completed and Cancelled cleanly', () => {
  expect(getJobStatusMeta('open').badgeLabel).toBe('Open');
  expect(getJobStatusMeta('booked').badgeLabel).toBe('Booked');
  expect(getJobStatusMeta('completed').badgeLabel).toBe('Completed');
  expect(getJobStatusMeta('cancelled').badgeLabel).toBe('Cancelled');
  expect(readableJobStatus('open')).toBe('Open for quotes');
  expect(readableJobStatus('cancelled')).toBe('Cancelled');

  const sample = [
    {id: '1', status: 'open'},
    {id: '2', status: 'draft'},
    {id: '3', status: 'booked'},
    {id: '4', status: 'completed'},
    {id: '5', status: 'cancelled'},
  ];

  expect(summarizeJobStatuses(sample)).toEqual({
    all: 5,
    open: 2,
    booked: 1,
    completed: 1,
    cancelled: 1,
  });

  expect(filterJobsByStatus(sample, 'all').map(j => j.id)).toEqual(['1', '2', '3', '4', '5']);
  expect(filterJobsByStatus(sample, 'open').map(j => j.id)).toEqual(['1', '2']);
  expect(filterJobsByStatus(sample, 'booked').map(j => j.id)).toEqual(['3']);
  expect(filterJobsByStatus(sample, 'completed').map(j => j.id)).toEqual(['4']);
  expect(filterJobsByStatus(sample, 'cancelled').map(j => j.id)).toEqual(['5']);
});

test('Job activity normalizer deduplicates, sorts chronologically, classifies tones and never fabricates entries', () => {
  const normalized = normalizeJobActivity([
    {event_id: 20, action: 'job_reopened', created_at: '2026-11-21T12:00:00Z'},
    {event_id: 10, action: 'job_cancelled', created_at: '2026-11-21T10:00:00Z'},
    {event_id: 20, action: 'job_reopened', created_at: '2026-11-21T12:00:00Z'},
    {event_id: 30, action: 'quote_accepted', created_at: '2026-11-21T14:30:00Z'},
  ]);
  expect(normalized.map(e => e.event_id)).toEqual([10, 20, 30]);
  expect(normalized.map(e => e.label)).toEqual([
    'Job cancelled by customer',
    'Job reopened by customer',
    'Quote accepted and booking created',
  ]);
  expect(normalized.map(e => e.tone)).toEqual(['warning', 'positive', 'positive']);
  expect(normalized[0].formattedTimestamp).toContain('2026');

  const badDate = normalizeJobActivity([{event_id: 99, action: 'job_cancelled', created_at: 'not-a-date'}]);
  expect(badDate[0].formattedTimestamp).toBe('Timestamp unavailable');

  expect(normalizeJobActivity([])).toEqual([]);
  expect(normalizeJobActivity(null)).toEqual([]);

  expect(validateCancelReason('')).toBeNull();
  expect(validateCancelReason('Postponing work until spring')).toBeNull();
  expect(validateCancelReason('x'.repeat(241))).toMatch(/240/);
});

test('executeJobLifecycleAction distinguishes committed-refresh-failed from RPC failures and unauthorised attempts', async () => {
  let localJobs = [
    {id: 'j1', status: 'open', trade_id: 't1', area_id: 'a1'},
    {id: 'j2', status: 'cancelled', trade_id: 't1', area_id: 'a1'},
  ];
  let localQuotes = [
    {quote_id: 'q1', job_id: 'j1', status: 'pending'},
    {quote_id: 'q2', job_id: 'j1', status: 'withdrawn'},
  ];

  // 1. Cancel RPC commits, but refresh fails -> reports accurate commit success + updates local state
  const cancelCommitRefreshFail = await executeJobLifecycleAction({
    runRpc: async () => ({error: null}),
    onCommittedLocalUpdate: () => {
      const next = applyCommittedJobCancellation(localJobs, localQuotes, 'j1');
      localJobs = next.jobs;
      localQuotes = next.quotes;
    },
    runRefresh: async () => {
      throw new Error('Network disconnected during refresh');
    },
    successMessage: 'Job cancelled.',
    refreshFailedMessage: 'Job cancelled and saved, but refreshing the list failed.',
    fallbackErrorMessage: 'Unable to cancel job',
  });

  expect(cancelCommitRefreshFail.outcome).toBe('committed_refresh_failed');
  expect(cancelCommitRefreshFail.committed).toBe(true);
  expect(cancelCommitRefreshFail.message).toContain('cancelled and saved');
  expect(localJobs.find(j => j.id === 'j1')?.status).toBe('cancelled');
  expect(localQuotes.find(q => q.quote_id === 'q1')?.status).toBe('rejected');
  expect(localQuotes.find(q => q.quote_id === 'q2')?.status).toBe('withdrawn');

  // 2. Unauthorised reopen RPC fails -> local state MUST remain cancelled
  let mutatedOnError = false;
  const unauthorisedReopen = await executeJobLifecycleAction({
    runRpc: async () => ({error: {message: 'Job not found or not authorised'}}),
    onCommittedLocalUpdate: () => {
      mutatedOnError = true;
      localJobs = applyCommittedJobReopen(localJobs, 'j2');
    },
    runRefresh: async () => undefined,
    successMessage: 'Job reopened.',
    refreshFailedMessage: 'Job reopened, refresh failed.',
    fallbackErrorMessage: 'Unable to reopen job',
  });

  expect(unauthorisedReopen.outcome).toBe('rpc_error');
  expect(unauthorisedReopen.committed).toBe(false);
  expect(unauthorisedReopen.message).toMatch(/not authorised/i);
  expect(mutatedOnError).toBe(false);
  expect(localJobs.find(j => j.id === 'j2')?.status).toBe('cancelled');

  // 3. Reopen RPC commits + refresh succeeds -> status becomes open
  const reopenOk = await executeJobLifecycleAction({
    runRpc: async () => ({error: null}),
    onCommittedLocalUpdate: () => {
      localJobs = applyCommittedJobReopen(localJobs, 'j2');
    },
    runRefresh: async () => undefined,
    successMessage: 'Job reopened.',
    refreshFailedMessage: 'Job reopened, refresh failed.',
    fallbackErrorMessage: 'Unable to reopen job',
  });

  expect(reopenOk.outcome).toBe('committed');
  expect(reopenOk.committed).toBe(true);
  expect(localJobs.find(j => j.id === 'j2')?.status).toBe('open');

  // 4. Quote acceptance local sync marks job booked and sibling pending quotes rejected
  const accepted = applyCommittedQuoteAcceptance(
    [{id: 'j9', status: 'open', has_booking: false}],
    [
      {quote_id: 'qa', job_id: 'j9', status: 'pending'},
      {quote_id: 'qb', job_id: 'j9', status: 'pending'},
    ],
    'j9',
    'qa'
  );
  expect(accepted.jobs[0].status).toBe('booked');
  expect(accepted.jobs[0].has_booking).toBe(true);
  expect(canCancelCustomerJob(accepted.jobs[0])).toBe(false);
  expect(accepted.quotes.find(q => q.quote_id === 'qa')?.status).toBe('accepted');
  expect(accepted.quotes.find(q => q.quote_id === 'qb')?.status).toBe('rejected');
});

test('buildJobRelatedLinks creates opaque-ID links to quotes, bookings, schedule and messages without private address leakage', () => {
  const bookedLinks = buildJobRelatedLinks({
    jobId: 'job-123',
    jobStatus: 'booked',
    quotes: [
      {quote_id: 'quote-old', job_id: 'job-123', status: 'rejected'},
      {quote_id: 'quote-win', job_id: 'job-123', status: 'accepted'},
    ],
    booking: {
      id: 'booking-456',
      job_id: 'job-123',
      quote_id: 'quote-win',
      status: 'confirmed',
    },
  });

  expect(bookedLinks).toEqual({
    quotesAnchor: '#job-quotes-job-123',
    quotesCount: 2,
    primaryMessageHref: '/messages?quote=quote-win',
    bookingHref: '/bookings?booking=booking-456',
    scheduleHref: '/schedule?booking=booking-456',
  });

  const completedFallback = buildJobRelatedLinks({
    jobId: 'job-789',
    jobStatus: 'completed',
    quotes: [],
    booking: null,
  });
  expect(completedFallback.bookingHref).toBe('/bookings');
  expect(completedFallback.quotesAnchor).toBeNull();
  expect(completedFallback.scheduleHref).toBeNull();
});

test('Anonymous visitors cannot view job lifecycle controls or activity history across 320px, 360px, 390px and 1280px', async ({
  page,
}) => {
  for (const vp of [
    {width: 320, height: 568},
    {width: 360, height: 740},
    {width: 390, height: 844},
    {width: 1280, height: 800},
  ]) {
    await page.setViewportSize(vp);
    await page.goto('/jobs');
    await expect(page).toHaveURL(/\/account\?next=%2Fjobs$/);
    await expect(
      page.getByRole('button', {name: /Cancel job|Reopen job|View job activity/i})
    ).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `horizontal overflow at ${vp.width}px`).toBeLessThanOrEqual(1);
  }
});
