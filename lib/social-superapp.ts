import {assessSocialPostSafety} from './social-safety';

export type SocialMemberProfile = {
  user_id: string;
  display_name: string;
  headline: string;
  about: string;
  area_id: string | null;
  skills: string[];
  offers_summary: string;
  looking_for_summary: string;
  open_to_work: boolean;
  open_to_referrals: boolean;
  updated_at: string;
};

export type SocialConnection = {
  id: string;
  requester_id: string;
  addressee_id: string;
  intro_note: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
};

export type SocialSkillEndorsement = {
  id: string;
  member_id: string;
  endorser_id: string;
  skill: string;
  created_at: string;
};

export type SocialPoll = {
  id: string;
  author_id: string;
  area_id: string;
  question: string;
  options: string[];
  status: 'open' | 'closed';
  created_at: string;
};

export type SocialPollVote = {
  poll_id: string;
  voter_id: string;
  option_index: number;
};

export type LocalListingCategory = 'tools_materials' | 'home_garden' | 'free_giveaway' | 'wanted';

export type SocialLocalListing = {
  id: string;
  seller_id: string;
  area_id: string;
  category: LocalListingCategory;
  title: string;
  description: string;
  price_pence: number;
  status: 'available' | 'reserved' | 'sold';
  created_at: string;
};

export const LOCAL_LISTING_CATEGORY_LABELS: Record<LocalListingCategory, string> = {
  tools_materials: 'Tools & surplus materials',
  home_garden: 'Home & garden',
  free_giveaway: 'Free to collect',
  wanted: 'Wanted locally',
};

export const SUGGESTED_TRADE_SKILLS = [
  'CCTV & Security',
  'Starlink & Wi-Fi',
  'Electrical (18th Ed)',
  'Plumbing & Boilers',
  'Roofing & Gutters',
  'Cat6 & Data Cabling',
  'Carpentry & Kitchens',
  'Plastering & Tiling',
  'Garden & Landscaping',
  'Smart Alarms',
] as const;

export function calculateProfileCompleteness(profile: Partial<SocialMemberProfile> | null): {
  percent: number;
  missing: string[];
} {
  if (!profile) {
    return {percent: 0, missing: ['Display name', 'Headline', 'About bio', 'Skills', 'Haves & Wants']};
  }
  const checks: Array<{label: string; ok: boolean}> = [
    {label: 'Display name', ok: (profile.display_name ?? '').trim().length >= 2},
    {label: 'Headline', ok: (profile.headline ?? '').trim().length >= 8},
    {label: 'About bio', ok: (profile.about ?? '').trim().length >= 20},
    {label: 'Skills', ok: Array.isArray(profile.skills) && profile.skills.length >= 1},
    {
      label: 'Haves & Wants',
      ok:
        (profile.offers_summary ?? '').trim().length >= 8 ||
        (profile.looking_for_summary ?? '').trim().length >= 8,
    },
  ];
  const passed = checks.filter((c) => c.ok).length;
  return {
    percent: Math.round((passed / checks.length) * 100),
    missing: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}

export function validatePollDraft(input: {
  areaId: string;
  question: string;
  options: string[];
}): string | null {
  if (!input.areaId) return 'Choose a neighbourhood for your poll.';
  const q = input.question.trim();
  if (q.length < 10) return 'Write a poll question of at least 10 characters.';
  if (q.length > 220) return 'Keep your poll question under 220 characters.';
  const qSafety = assessSocialPostSafety(q);
  if (qSafety.blockingError) return qSafety.blockingError;

  const cleanOptions = input.options.map((o) => o.trim()).filter(Boolean);
  if (cleanOptions.length < 2 || cleanOptions.length > 4) {
    return 'Provide between 2 and 4 poll options.';
  }
  for (const opt of cleanOptions) {
    if (opt.length > 80) return 'Keep each poll option under 80 characters.';
    const optSafety = assessSocialPostSafety(opt);
    if (optSafety.blockingError) return optSafety.blockingError;
  }
  return null;
}

export function tallyPollVotes(
  options: string[],
  votes: Array<Pick<SocialPollVote, 'option_index' | 'voter_id'>>,
  currentUserId: string
): {
  totalVotes: number;
  userVoteIndex: number | null;
  breakdown: Array<{index: number; label: string; count: number; percent: number}>;
} {
  const counts = options.map(() => 0);
  let userVoteIndex: number | null = null;
  for (const v of votes) {
    if (v.option_index >= 0 && v.option_index < counts.length) {
      counts[v.option_index] += 1;
      if (v.voter_id === currentUserId) userVoteIndex = v.option_index;
    }
  }
  const totalVotes = counts.reduce((a, b) => a + b, 0);
  return {
    totalVotes,
    userVoteIndex,
    breakdown: options.map((label, index) => ({
      index,
      label,
      count: counts[index],
      percent: totalVotes > 0 ? Math.round((counts[index] / totalVotes) * 100) : 0,
    })),
  };
}

export function validateLocalListingDraft(input: {
  areaId: string;
  title: string;
  description: string;
  priceGbp: number;
}): string | null {
  if (!input.areaId) return 'Choose a local neighbourhood for your listing.';
  const title = input.title.trim();
  const desc = input.description.trim();
  if (title.length < 5) return 'Enter a listing title of at least 5 characters.';
  if (desc.length < 12) return 'Add a short description of at least 12 characters.';
  if (!Number.isFinite(input.priceGbp) || input.priceGbp < 0 || input.priceGbp > 50000) {
    return 'Enter £0 for free items or a price up to £50,000.';
  }
  const combinedSafety = assessSocialPostSafety(`${title} ${desc}`);
  if (combinedSafety.blockingError) return combinedSafety.blockingError;
  return null;
}
