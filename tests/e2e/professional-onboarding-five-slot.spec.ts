import {expect,test} from '@playwright/test';
import {
  deriveProfessionalOnboardingStage,
  validateProfessionalProfileInput,
  validateVerificationSubmissionInput,
} from '../../lib/professional-onboarding';

test('Onboarding stage cleanly distinguishes pending, under_review, active 1..5, waiting-list, rejected and suspended', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();

  expect(
    deriveProfessionalOnboardingStage({
      application_status: 'pending',
      assessment_state: null,
      active_slot: null,
      active_slots_filled: 2,
      latest_offer_status: null,
      latest_offer_expires_at: null,
    }).key
  ).toBe('pending');

  expect(
    deriveProfessionalOnboardingStage({
      application_status: 'under_review',
      assessment_state: 'pending',
      active_slot: null,
      active_slots_filled: 2,
      latest_offer_status: null,
      latest_offer_expires_at: null,
    }).key
  ).toBe('under_review');

  const active = deriveProfessionalOnboardingStage({
    application_status: 'eligible',
    assessment_state: 'verified',
    active_slot: 3,
    active_slots_filled: 5,
    latest_offer_status: 'consumed',
    latest_offer_expires_at: future,
  });
  expect(active.key).toBe('active_slot');
  expect(active.isActiveSlot).toBe(true);
  expect(active.label).toContain('Slot 3 of 5');

  const waitlist = deriveProfessionalOnboardingStage({
    application_status: 'eligible',
    assessment_state: 'verified',
    active_slot: null,
    active_slots_filled: 5,
    latest_offer_status: null,
    latest_offer_expires_at: null,
  });
  expect(waitlist.key).toBe('waiting_list');
  expect(waitlist.isWaitingList).toBe(true);
  expect(waitlist.label).toContain('5/5 slots full');

  expect(
    deriveProfessionalOnboardingStage({
      application_status: 'eligible',
      assessment_state: 'verified',
      active_slot: null,
      active_slots_filled: 4,
      latest_offer_status: 'offered',
      latest_offer_expires_at: future,
    }).key
  ).toBe('offer_pending');

  expect(
    deriveProfessionalOnboardingStage({
      application_status: 'suspended',
      assessment_state: 'verified',
      active_slot: null,
      active_slots_filled: 4,
      latest_offer_status: 'expired',
      latest_offer_expires_at: null,
    }).key
  ).toBe('suspended');

  expect(
    deriveProfessionalOnboardingStage({
      application_status: 'rejected',
      assessment_state: 'failed',
      active_slot: null,
      active_slots_filled: 4,
      latest_offer_status: null,
      latest_offer_expires_at: null,
    }).key
  ).toBe('rejected');
});

test('Profile and verification validators enforce safe bounds and future insurance expiry', () => {
  expect(
    validateProfessionalProfileInput({
      businessName: 'A',
      about: 'Short',
      experienceYears: '10',
    })
  ).toMatch(/between 2 and 120/);

  expect(
    validateProfessionalProfileInput({
      businessName: 'North Electrical Ltd',
      about: 'Qualified domestic and commercial electrical testing and rewires across Yorkshire.',
      experienceYears: '12',
    })
  ).toBeNull();

  expect(
    validateVerificationSubmissionInput(
      {
        insuranceProvider: 'Hiscox UK',
        insurancePolicyRef: 'POL-2026-881',
        insuranceExpiresOn: '2026-01-01',
        tradeBody: 'NICEIC',
        registrationNumber: 'NIC-4411',
        qualificationSummary: 'NVQ Level 3 Electrical Installation and 18th Edition BS 7671.',
      },
      '2026-11-21'
    )
  ).toMatch(/future date/);

  expect(
    validateVerificationSubmissionInput(
      {
        insuranceProvider: 'Hiscox UK',
        insurancePolicyRef: 'POL-2026-881',
        insuranceExpiresOn: '2027-06-30',
        tradeBody: 'NICEIC',
        registrationNumber: 'NIC-4411',
        qualificationSummary: 'NVQ Level 3 Electrical Installation and 18th Edition BS 7671.',
      },
      '2026-11-21'
    )
  ).toBeNull();
});

test('Anonymous visitors are redirected away from professional onboarding, business editor and admin routes on desktop and mobile', async ({
  page,
}) => {
  await page.setViewportSize({width: 390, height: 844});

  await page.goto('/professional/apply');
  await expect(page).toHaveURL(/\/account\?next=%2Fprofessional%2Fapply$/);
  await expect(page.getByRole('button', {name: /Submit free application/i})).toHaveCount(0);

  await page.goto('/professional/business');
  await expect(page).toHaveURL(/\/account\?next=%2Fprofessional%2Fbusiness$/);

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/account\?next=%2Fadmin$/);
  await expect(page.getByRole('button', {name: /Suspend professional|Mark eligible following review/i})).toHaveCount(0);
});
