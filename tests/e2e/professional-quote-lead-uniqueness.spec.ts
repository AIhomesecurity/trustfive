import { expect, test } from '@playwright/test';
import { canPrepareProfessionalQuote, professionalQuoteStats } from '../../lib/professional-quote-guard';

const job = '11111111-1111-4111-8111-111111111111';
const allocation = '22222222-2222-4222-8222-222222222222';
const otherAllocation = '33333333-3333-4333-8333-333333333333';
const lead = { job_id: job, allocation_id: allocation };

test('one visible, unquoted lead is eligible', () => {
  expect(canPrepareProfessionalQuote(lead, [lead], [])).toBe(true);
  expect(professionalQuoteStats([lead], []).available).toBe(1);
});

test('rejects duplicate identical rows without counting phantom opportunities', () => {
  expect(canPrepareProfessionalQuote(lead, [lead, lead], [])).toBe(false);
  expect(professionalQuoteStats([lead, lead], []).available).toBe(0);
});

test('rejects conflicting allocations for the same job', () => {
  const conflicting = { job_id: job, allocation_id: otherAllocation };
  expect(canPrepareProfessionalQuote(lead, [lead, conflicting], [])).toBe(false);
  expect(professionalQuoteStats([lead, conflicting], []).available).toBe(0);
});

test('rejects stale allocations and jobs already quoted', () => {
  expect(canPrepareProfessionalQuote(lead, [{ job_id: job, allocation_id: otherAllocation }], [])).toBe(false);
  expect(canPrepareProfessionalQuote(lead, [lead], [{ job_id: job, status: 'pending' }])).toBe(false);
});

test('rejects missing, malformed and non-UUID identifiers', () => {
  expect(canPrepareProfessionalQuote(null, [lead], [])).toBe(false);
  expect(canPrepareProfessionalQuote({ ...lead, job_id: '' }, [lead], [])).toBe(false);
  expect(canPrepareProfessionalQuote({ ...lead, allocation_id: 'not-an-id' }, [lead], [])).toBe(false);
  expect(professionalQuoteStats([{ job_id: 'invalid', allocation_id: allocation }], []).available).toBe(0);
});

test('separate unique jobs remain available', () => {
  const second = { job_id: '44444444-4444-4444-8444-444444444444', allocation_id: otherAllocation };
  expect(professionalQuoteStats([lead, second], []).available).toBe(2);
});

test('UUID case differences cannot bypass duplicate, quote, or allocation checks', () => {
  const upperJob = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
  const lowerJob = upperJob.toLowerCase();
  const upperAllocation = 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB';
  const lowerAllocation = upperAllocation.toLowerCase();
  const selected = { job_id: upperJob, allocation_id: upperAllocation };
  expect(canPrepareProfessionalQuote(selected, [{ job_id: lowerJob, allocation_id: lowerAllocation }], [])).toBe(true);
  expect(canPrepareProfessionalQuote(selected, [selected, { job_id: lowerJob, allocation_id: lowerAllocation }], [])).toBe(false);
  expect(professionalQuoteStats([selected, { job_id: lowerJob, allocation_id: lowerAllocation }], []).available).toBe(0);
  expect(canPrepareProfessionalQuote(selected, [selected], [{ job_id: lowerJob, status: 'pending' }])).toBe(false);
  expect(professionalQuoteStats([selected], [{ job_id: lowerJob, status: 'pending' }]).available).toBe(0);
});
