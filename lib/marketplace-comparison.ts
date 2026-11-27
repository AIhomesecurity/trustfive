export type PlatformComparisonRow = {
  id: string;
  platform: string;
  category: 'TrustFive' | 'Lead-Fee Marketplace' | 'Directory & Endorsement' | 'Free Local Visibility';
  pricingModel: string;
  leadFees: string;
  localCap: string;
  rankingModel: string;
  bestFor: string;
  isTrustFive?: boolean;
};

export const UK_PLATFORM_COMPARISON: PlatformComparisonRow[] = [
  {
    id: 'trustfive',
    platform: 'TrustFive',
    category: 'TrustFive',
    pricingModel: 'Transparent network model — approval is earned, never bought',
    leadFees: 'No (£0 per lead / £0 shortlist fee)',
    localCap: 'Up to 5 independently approved active pros per trade & area (DB-enforced)',
    rankingModel: 'Payment-independent (distance, availability & verified completed-job quality)',
    bestFor: 'Homeowners wanting up to 5 vetted local pros & tradespeople tired of lead-credit fees',
    isTrustFive: true,
  },
  {
    id: 'checkatrade',
    platform: 'Checkatrade',
    category: 'Directory & Endorsement',
    pricingModel: 'Monthly directory membership tiers',
    leadFees: 'No per-lead charge (tiered subscription)',
    localCap: 'Uncapped directory listings',
    rankingModel: 'Membership tier & directory visibility options',
    bestFor: 'Broad national directory profile & brand recognition',
  },
  {
    id: 'mybuilder',
    platform: 'MyBuilder',
    category: 'Lead-Fee Marketplace',
    pricingModel: 'Pay-per-shortlist / contact exchange',
    leadFees: 'Yes (charged when shortlisted or details exchanged)',
    localCap: 'Per-job shortlist competition',
    rankingModel: 'Job-by-job homeowner shortlist selection',
    bestFor: 'Picking specific posted jobs without a monthly retainer',
  },
  {
    id: 'bark',
    platform: 'Bark',
    category: 'Lead-Fee Marketplace',
    pricingModel: 'Pay-per-enquiry credit packs',
    leadFees: 'Yes (credits spent per customer enquiry)',
    localCap: 'Multiple pros can unlock the same lead',
    rankingModel: 'Credit unlock & fast response',
    bestFor: 'Flexible spending across broader local service categories',
  },
  {
    id: 'myjobquote',
    platform: 'MyJobQuote',
    category: 'Lead-Fee Marketplace',
    pricingModel: 'Pay-as-you-go or rolling credit plans',
    leadFees: 'Yes (credits per lead, typically shared with up to 3 trades)',
    localCap: 'Typically up to 3 trades per quote request',
    rankingModel: 'Credit purchase on posted homeowner requests',
    bestFor: 'Responding to specific homeowner quote requests',
  },
  {
    id: 'trustatrader',
    platform: 'TrustATrader',
    category: 'Directory & Endorsement',
    pricingModel: 'Annual membership fee',
    leadFees: 'No per-lead fees',
    localCap: 'Capped trade numbers per local area',
    rankingModel: 'Directory membership & customer reviews',
    bestFor: 'Paying once a year without per-lead charges',
  },
  {
    id: 'which-trusted-traders',
    platform: 'Which? Trusted Traders',
    category: 'Directory & Endorsement',
    pricingModel: 'Endorsement & assessment membership',
    leadFees: 'No (does not sell individual job leads)',
    localCap: 'Endorsement assessment standard',
    rankingModel: 'Endorsement & verified customer feedback',
    bestFor: 'Independent endorsement credentials and consumer trust',
  },
  {
    id: 'rated-people',
    platform: 'Rated People (Checkatrade Group)',
    category: 'Lead-Fee Marketplace',
    pricingModel: 'Historically membership + per-lead fees (entered CVL Sept 2026; brand fulfilled via Checkatrade)',
    leadFees: 'Legacy pay-per-lead dissolved into Checkatrade network',
    localCap: 'Historically capped at up to 3 quotes per homeowner job',
    rankingModel: 'Job-post quote matching via parent directory network',
    bestFor: 'Capped-quote homeowner requests (now consolidated under Checkatrade)',
  },
  {
    id: 'houzz-uk',
    platform: 'Houzz UK & Houzz Pro',
    category: 'Directory & Endorsement',
    pricingModel: 'Free homeowner Ideabooks; monthly SaaS & local ad subscriptions for Houzz Pro',
    leadFees: 'No per-lead credits (paid Pro software + local ad packages)',
    localCap: 'Uncapped directory with paid local visibility packages',
    rankingModel: 'Portfolio engagement, reviews & paid local ad placement',
    bestFor: 'Visual home inspiration, Ideabooks & interior design/architectural portfolios',
  },
  {
    id: 'free-local',
    platform: 'FreeIndex / Nextdoor / Google Business Profile',
    category: 'Free Local Visibility',
    pricingModel: 'Free listings & community presence',
    leadFees: 'No',
    localCap: 'Open / uncapped',
    rankingModel: 'Local SEO, maps proximity & unverified/open posts',
    bestFor: 'Free local visibility & direct enquiries without structured booking/vetting workflows',
  },
];

export type VettingStage = {
  step: string;
  title: string;
  detail: string;
};

export const TRUSTFIVE_VETTING_STAGES: VettingStage[] = [
  {
    step: '01',
    title: 'Identity & UK business verification',
    detail: 'Applicant trading name, business history and contact ownership are reviewed before any listing goes live.',
  },
  {
    step: '02',
    title: 'Public liability insurance check',
    detail: 'Insurer, policy reference and expiry date are submitted privately for verification — never self-certified as approved.',
  },
  {
    step: '03',
    title: 'Qualifications & trade bodies',
    detail: 'Relevant credentials (e.g. Gas Safe, NICEIC/NAPIT, NVQ, FENSA or specialist security training) are recorded and checked against claimed trades.',
  },
  {
    step: '04',
    title: 'Defined local territory & 5-slot cap',
    detail: 'Each trade has a database-enforced maximum of five active approved professionals per reviewed UK local area. Additional qualified applicants join a fair waiting list.',
  },
  {
    step: '05',
    title: 'Independent human approval (never bought)',
    detail: 'No payment, subscription or social activity can approve an account, jump the waiting list or boost directory ranking.',
  },
  {
    step: '06',
    title: 'Verified completed-job reviews & fair dispute charter',
    detail: 'Reviews can only be submitted once per genuinely completed TrustFive booking. Complaints and appeals receive documented human review.',
  },
];

export const TRUSTFIVE_CHARTER_COMMITMENTS: Array<{title: string; body: string}> = [
  {
    title: 'Written quotes before work starts',
    body: 'Professionals submit itemised prices, availability notes and clear scope inside TrustFive before you confirm a booking.',
  },
  {
    title: 'Private address protection with revocable consent',
    body: 'Your exact house number and street stay private while gathering quotes and are only shared with your booked professional when you opt in — and can be revoked immediately.',
  },
  {
    title: 'Honest availability & zero invented profiles',
    body: 'If fewer than five professionals qualify in your postcode area, TrustFive tells you honestly rather than padding results with unvetted listings.',
  },
  {
    title: 'Impartial human complaint & appeal review',
    body: 'No automated suspension traps and no ignored disputes: customers and tradespeople can log evidence and appeal decisions fairly. TrustFive does not currently promise an insured workmanship guarantee or escrow.',
  },
];

export function calculateAnnualLeadFeeSavings(input: {
  monthlyQuotes: number;
  avgLeadFeeGbp: number;
}): {
  monthlyQuotes: number;
  avgLeadFeeGbp: number;
  monthlyLeadSpendGbp: number;
  annualLeadSpendGbp: number;
  trustFiveLeadFeesGbp: 0;
  annualLeadFeeSavingsGbp: number;
} {
  const monthlyQuotes = Math.min(200, Math.max(1, Math.round(Number(input.monthlyQuotes) || 1)));
  const avgLeadFeeGbp = Math.min(150, Math.max(1, Math.round(Number(input.avgLeadFeeGbp) || 1)));
  const monthlyLeadSpendGbp = monthlyQuotes * avgLeadFeeGbp;
  const annualLeadSpendGbp = monthlyLeadSpendGbp * 12;
  return {
    monthlyQuotes,
    avgLeadFeeGbp,
    monthlyLeadSpendGbp,
    annualLeadSpendGbp,
    trustFiveLeadFeesGbp: 0,
    annualLeadFeeSavingsGbp: annualLeadSpendGbp,
  };
}
