import {test, expect} from '@playwright/test';
import {createBookingReviewSubmissionGate} from '../../lib/booking-review-submission-gate';

test.describe('booking review submission gate', () => {
  test('allows only one submission until the first settles', () => {
    const gate = createBookingReviewSubmissionGate();
    expect(gate.acquire()).toBe(true);
    expect(gate.pending).toBe(true);
    expect(gate.acquire()).toBe(false);
    expect(gate.acquire()).toBe(false);
    gate.release();
    expect(gate.pending).toBe(false);
    expect(gate.acquire()).toBe(true);
  });

  test('releases after an unsuccessful asynchronous write for retry', async () => {
    const gate = createBookingReviewSubmissionGate();
    const send = async () => {
      if (!gate.acquire()) return 'blocked';
      try {
        await Promise.resolve();
        throw new Error('write rejected');
      } finally {
        gate.release();
      }
    };
    const first = send();
    expect(await send()).toBe('blocked');
    await expect(first).rejects.toThrow('write rejected');
    expect(gate.acquire()).toBe(true);
  });

  test('different forms have independent gates', () => {
    const customerA = createBookingReviewSubmissionGate();
    const customerB = createBookingReviewSubmissionGate();
    expect(customerA.acquire()).toBe(true);
    expect(customerA.acquire()).toBe(false);
    expect(customerB.acquire()).toBe(true);
  });

  test('release is safe after multiple attempts', () => {
    const gate = createBookingReviewSubmissionGate();
    gate.release();
    expect(gate.acquire()).toBe(true);
    gate.release();
    gate.release();
    expect(gate.acquire()).toBe(true);
  });
});
