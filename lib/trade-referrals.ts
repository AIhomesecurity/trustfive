import {assessSocialPostSafety} from './social-safety';

export type SocialTradeReferral = {
  id: string;
  referrer_id: string;
  target_trade_id: string;
  area_id: string;
  recommended_application_id: string | null;
  summary: string;
  referral_code: string;
  referrer_share_bps: number;
  platform_share_bps: number;
  settlement_mode: 'pilot_ledger_only';
  status: 'open' | 'closed';
  created_at: string;
};

export const DEFAULT_REFERRER_SHARE_BPS = 500; // 5%
export const DEFAULT_PLATFORM_SHARE_BPS = 300; // 3%
export const MAX_REFERRER_SHARE_BPS = 1000; // 10%
export const MAX_PLATFORM_SHARE_BPS = 500; // 5%

const REFERRAL_CODE_RE = /^TF-[A-Z0-9]{10}$/;

export function calculateReferralSplit(input: {
  jobAmountGbp: number;
  referrerShareBps?: number;
  platformShareBps?: number;
}): {
  jobAmountGbp: number;
  referrerShareBps: number;
  platformShareBps: number;
  receivingProShareBps: number;
  referrerGbp: number;
  platformGbp: number;
  receivingProGbp: number;
} {
  const jobAmountGbp = Math.min(100000, Math.max(50, Math.round(Number(input.jobAmountGbp) || 50)));
  const referrerShareBps = Math.min(
    MAX_REFERRER_SHARE_BPS,
    Math.max(0, Math.round(Number(input.referrerShareBps ?? DEFAULT_REFERRER_SHARE_BPS)))
  );
  const platformShareBps = Math.min(
    MAX_PLATFORM_SHARE_BPS,
    Math.max(0, Math.round(Number(input.platformShareBps ?? DEFAULT_PLATFORM_SHARE_BPS)))
  );
  const receivingProShareBps = 10000 - referrerShareBps - platformShareBps;
  const referrerGbp = Math.round(((jobAmountGbp * referrerShareBps) / 10000) * 100) / 100;
  const platformGbp = Math.round(((jobAmountGbp * platformShareBps) / 10000) * 100) / 100;
  const receivingProGbp = Math.round((jobAmountGbp - referrerGbp - platformGbp) * 100) / 100;
  return {
    jobAmountGbp,
    referrerShareBps,
    platformShareBps,
    receivingProShareBps,
    referrerGbp,
    platformGbp,
    receivingProGbp,
  };
}

export function validateTradeReferralDraft(input: {
  userId: string;
  targetTradeId: string;
  areaId: string;
  summary: string;
  referrerShareBps: number;
}): string | null {
  if (!input.userId) return 'Sign in as a registered professional to create a trade referral.';
  if (!input.targetTradeId) return 'Choose the target trade needed for this referral.';
  if (!input.areaId) return 'Choose the local area for this referral.';
  const clean = input.summary.trim();
  if (clean.length < 15) {
    return 'Write at least 15 characters describing the work needed (without any customer personal details).';
  }
  if (clean.length > 600) return 'Keep the referral summary under 600 characters.';
  const safety = assessSocialPostSafety(clean);
  if (safety.blockingError) {
    return 'Do not include customer phone numbers, emails, websites or full postcodes in a trade referral. Share the generated TrustFive link with the customer instead.';
  }
  if (
    !Number.isInteger(input.referrerShareBps) ||
    input.referrerShareBps < 0 ||
    input.referrerShareBps > MAX_REFERRER_SHARE_BPS
  ) {
    return 'Referrer share must be between 0% and 10%.';
  }
  return null;
}

export function buildCustomerReferralHref(input: {
  tradeSlug?: string;
  areaId?: string;
  referralCode: string;
}): string {
  const params = new URLSearchParams();
  if (input.tradeSlug) params.set('trade', input.tradeSlug);
  if (input.areaId) params.set('area', input.areaId);
  if (REFERRAL_CODE_RE.test(input.referralCode)) {
    params.set('ref', input.referralCode);
  }
  const qs = params.toString();
  return qs ? `/jobs?${qs}` : '/jobs';
}

export function parseReferralCodeParam(search: string): string {
  const raw = (new URLSearchParams(search).get('ref') ?? '').trim().toUpperCase();
  return REFERRAL_CODE_RE.test(raw) ? raw : '';
}
