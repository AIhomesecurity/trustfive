export type ProfessionalOnboardingItem = {
  application_id: string;
  business_name: string | null;
  about: string | null;
  experience_years: number | null;
  application_status: string;
  submitted_at: string;
  trade_id: string;
  trade_name: string;
  area_id: string;
  area_name: string;
  city: string;
  assessment_state: string | null;
  verification_submission_status: string | null;
  verification_reviewer_note: string | null;
  active_slot: number | null;
  active_slots_filled: number;
  latest_offer_id: string | null;
  latest_offer_status: string | null;
  latest_offer_expires_at: string | null;
  business_page_status: string | null;
};

export type OnboardingStageKey =
  | 'active_slot'
  | 'offer_accepted'
  | 'offer_pending'
  | 'waiting_list'
  | 'eligible_unoffered'
  | 'under_review'
  | 'pending'
  | 'rejected'
  | 'suspended'
  | 'withdrawn';

export type OnboardingStage = {
  key: OnboardingStageKey;
  label: string;
  detail: string;
  isWaitingList: boolean;
  isActiveSlot: boolean;
};

/** Derive an honest, unambiguous status from verified database fields.
 * Never implies approval or active five-slot placement without a real slot. */
export function deriveProfessionalOnboardingStage(
  item: Pick<
    ProfessionalOnboardingItem,
    | 'application_status'
    | 'assessment_state'
    | 'active_slot'
    | 'active_slots_filled'
    | 'latest_offer_status'
    | 'latest_offer_expires_at'
  >,
  nowMs = Date.now()
): OnboardingStage {
  if (item.application_status === 'suspended') {
    return {
      key: 'suspended',
      label: 'Suspended',
      detail: 'This application is currently suspended following an administrative review and holds no active place.',
      isWaitingList: false,
      isActiveSlot: false,
    };
  }
  if (item.application_status === 'rejected') {
    return {
      key: 'rejected',
      label: 'Not approved',
      detail: 'This application was not approved following independent assessment.',
      isWaitingList: false,
      isActiveSlot: false,
    };
  }
  if (item.application_status === 'withdrawn') {
    return {
      key: 'withdrawn',
      label: 'Withdrawn',
      detail: 'This application has been withdrawn.',
      isWaitingList: false,
      isActiveSlot: false,
    };
  }
  if (
    item.active_slot !== null &&
    item.active_slot >= 1 &&
    item.active_slot <= 5 &&
    item.application_status === 'eligible' &&
    item.assessment_state === 'verified'
  ) {
    return {
      key: 'active_slot',
      label: `Verified · Active (Slot ${item.active_slot} of 5)`,
      detail: 'You hold an active independently verified TrustFive place for this trade and territory.',
      isWaitingList: false,
      isActiveSlot: true,
    };
  }

  const offerActive =
    Boolean(item.latest_offer_expires_at) &&
    new Date(item.latest_offer_expires_at as string).getTime() > nowMs;

  if (item.application_status === 'eligible' && item.assessment_state === 'verified') {
    if (item.latest_offer_status === 'accepted' && offerActive) {
      return {
        key: 'offer_accepted',
        label: 'Verified · Offer accepted (activation pending)',
        detail: 'You accepted a vacancy offer. Final authorised activation into one of the five slots is pending.',
        isWaitingList: false,
        isActiveSlot: false,
      };
    }
    if (item.latest_offer_status === 'offered' && offerActive) {
      return {
        key: 'offer_pending',
        label: 'Verified · Vacancy offer waiting',
        detail: 'A place is available in this territory. Respond before the offer expires.',
        isWaitingList: false,
        isActiveSlot: false,
      };
    }
    if (item.active_slots_filled >= 5) {
      return {
        key: 'waiting_list',
        label: 'Verified · Waiting list (5/5 slots full)',
        detail: 'All five active places for this trade and area are filled. You remain on the fair waiting list — payment never changes queue position.',
        isWaitingList: true,
        isActiveSlot: false,
      };
    }
    return {
      key: 'eligible_unoffered',
      label: `Verified · Waiting list (${item.active_slots_filled}/5 slots filled)`,
      detail: 'You are independently verified and eligible. Vacancies are offered by verified quality score and submission date.',
      isWaitingList: true,
      isActiveSlot: false,
    };
  }

  if (item.application_status === 'under_review') {
    return {
      key: 'under_review',
      label: 'Under independent review',
      detail: 'A TrustFive reviewer is checking your verification details. You are not active or listed yet.',
      isWaitingList: false,
      isActiveSlot: false,
    };
  }

  return {
    key: 'pending',
    label: 'Pending verification',
    detail: 'Submit your insurance and qualification details so an administrator can complete independent verification.',
    isWaitingList: false,
    isActiveSlot: false,
  };
}

export function validateProfessionalProfileInput(input: {
  businessName: string;
  about: string;
  experienceYears: string;
}): string | null {
  const name = input.businessName.trim();
  const about = input.about.trim();
  const years = Number(input.experienceYears);
  if (name.length < 2 || name.length > 120) {
    return 'Business or trading name must be between 2 and 120 characters.';
  }
  if (about.length < 30 || about.length > 3000) {
    return 'Describe your services and qualifications in at least 30 characters.';
  }
  if (!Number.isInteger(years) || years < 0 || years > 80) {
    return 'Years of relevant experience must be a whole number between 0 and 80.';
  }
  return null;
}

export function validateVerificationSubmissionInput(
  input: {
    insuranceProvider: string;
    insurancePolicyRef: string;
    insuranceExpiresOn: string;
    tradeBody: string;
    registrationNumber: string;
    qualificationSummary: string;
  },
  todayIso = new Date().toISOString().slice(0, 10)
): string | null {
  const provider = input.insuranceProvider.trim();
  const policy = input.insurancePolicyRef.trim();
  const expiry = input.insuranceExpiresOn.trim();
  const summary = input.qualificationSummary.trim();
  if (provider.length < 2 || provider.length > 120) {
    return 'Enter your public liability insurance provider (2–120 characters).';
  }
  if (policy.length < 3 || policy.length > 80) {
    return 'Enter your insurance policy reference (3–80 characters).';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || expiry <= todayIso) {
    return 'Insurance expiry date must be a valid future date (YYYY-MM-DD).';
  }
  if (summary.length < 15 || summary.length > 1500) {
    return 'Summarise your trade qualifications and compliance checks in 15–1500 characters.';
  }
  if (input.tradeBody.trim() && input.tradeBody.trim().length < 2) {
    return 'Trade body name must be at least 2 characters if supplied.';
  }
  if (input.registrationNumber.trim() && input.registrationNumber.trim().length < 2) {
    return 'Registration number must be at least 2 characters if supplied.';
  }
  return null;
}
