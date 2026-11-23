import {expect,test} from '@playwright/test';
import {
  canCancelCustomerJob,
  canReopenCustomerJob,
  normalizeJobActivity,
  readableJobStatus,
  validateCancelReason,
} from '../../lib/job-lifecycle';

test('Customer job lifecycle guards restrict cancel and reopen strictly to eligible statuses', () => {
  expect(canCancelCustomerJob({id: 'j1', status: 'draft'})).toBe(true);
  expect(canCancelCustomerJob({id: 'j2', status: 'open'})).toBe(true);
  expect(canCancelCustomerJob({id: 'j3', status: 'booked'})).toBe(false);
  expect(canCancelCustomerJob({id: 'j4', status: 'completed'})).toBe(false);
  expect(canCancelCustomerJob({id: 'j5', status: 'cancelled'})).toBe(false);
  expect(canCancelCustomerJob(null)).toBe(false);

  expect(canReopenCustomerJob({id: 'j5', status: 'cancelled'})).toBe(true);
  expect(canReopenCustomerJob({id: 'j2', status: 'open'})).toBe(false);
  expect(canReopenCustomerJob({id: 'j3', status: 'booked'})).toBe(false);
  expect(canReopenCustomerJob({id: 'j4', status: 'completed'})).toBe(false);
  expect(canReopenCustomerJob({id: 'j1', status: 'draft'})).toBe(false);
  expect(canReopenCustomerJob(undefined)).toBe(false);
});

test('Job activity normalizer deduplicates, sorts chronologically and maps audit actions honestly', () => {
  const normalized = normalizeJobActivity([
    {event_id: 20, action: 'job_reopened', created_at: '2026-11-21T12:00:00Z'},
    {event_id: 10, action: 'job_cancelled', created_at: '2026-11-21T10:00:00Z'},
    {event_id: 20, action: 'job_reopened', created_at: '2026-11-21T12:00:00Z'},
  ]);
  expect(normalized.map(e => e.event_id)).toEqual([10, 20]);
  expect(normalized.map(e => e.label)).toEqual([
    'Job cancelled by customer',
    'Job reopened by customer',
  ]);
  expect(normalizeJobActivity([])).toEqual([]);
  expect(normalizeJobActivity(null)).toEqual([]);

  expect(readableJobStatus('open')).toBe('Open for quotes');
  expect(readableJobStatus('cancelled')).toBe('Cancelled');
  expect(validateCancelReason('')).toBeNull();
  expect(validateCancelReason('Postponing work until spring')).toBeNull();
  expect(validateCancelReason('x'.repeat(241))).toMatch(/240/);
});

test('Anonymous visitors cannot view job lifecycle controls or activity history on mobile or desktop', async ({
  page,
}) => {
  for (const vp of [
    {width: 320, height: 568},
    {width: 390, height: 844},
    {width: 1280, height: 800},
  ]) {
    await page.setViewportSize(vp);
    await page.goto('/jobs');
    await expect(page).toHaveURL(/\/account\?next=%2Fjobs$/);
    await expect(page.getByRole('button', {name: /Cancel job|Reopen job|View job activity/i})).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
