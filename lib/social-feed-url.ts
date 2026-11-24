import type {SocialFeedOrder} from './social-feed-paging';
import type {SocialSection} from './social-sections';

export type SocialFeedState = {
  areaId: string;
  search: string;
  order: SocialFeedOrder;
  page: number;
};

export type SocialPostKind = 'question' | 'discussion';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUESTION_LEAD_RE =
  /^(who|what|when|where|why|how|can anyone|does anyone|anyone know|looking for|recommendations? for|any recommendations?)\b/i;

export const DEFAULT_SOCIAL_FEED_STATE: Readonly<SocialFeedState> = Object.freeze({
  areaId: '',
  search: '',
  order: 'recent',
  page: 0,
});

export function parseSocialFeedParams(
  params: Pick<URLSearchParams, 'get' | 'getAll'>
): SocialFeedState {
  const areaValues = params.getAll('area');
  const rawArea = areaValues.length === 1 ? areaValues[0].trim() : '';
  const areaId = UUID_RE.test(rawArea) ? rawArea : '';

  const qValues = params.getAll('q');
  const search = qValues.length === 1 ? qValues[0].trim().slice(0, 120) : '';

  const orderValues = params.getAll('order');
  const order: SocialFeedOrder =
    orderValues.length === 1 && orderValues[0] === 'oldest' ? 'oldest' : 'recent';

  const pageValues = params.getAll('page');
  const parsedPage =
    pageValues.length === 1 && /^\d+$/.test(pageValues[0]) ? Number(pageValues[0]) : 0;
  const page = Number.isInteger(parsedPage) && parsedPage >= 0 && parsedPage <= 500 ? parsedPage : 0;

  return {areaId, search, order, page};
}

export function buildSocialFeedHref(
  section: SocialSection,
  feed?: Partial<SocialFeedState>
): string {
  const params = new URLSearchParams();
  if (section !== 'neighbourhood') {
    params.set('tab', section);
  }
  if (section === 'neighbourhood' && feed) {
    if (feed.areaId && UUID_RE.test(feed.areaId)) params.set('area', feed.areaId);
    const cleanSearch = (feed.search || '').trim().slice(0, 120);
    if (cleanSearch) params.set('q', cleanSearch);
    if (feed.order === 'oldest') params.set('order', 'oldest');
    if (typeof feed.page === 'number' && Number.isInteger(feed.page) && feed.page > 0 && feed.page <= 500) {
      params.set('page', String(feed.page));
    }
  }
  const qs = params.toString();
  return qs ? `/community/social?${qs}` : '/community/social';
}

export function safeSocialReturnHref(raw: string | null | undefined): string {
  if (!raw) return '/community/social';
  if (
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.length > 1024 ||
    /[\\#\u0000-\u001f\u007f]/.test(raw)
  ) {
    return '/community/social';
  }
  const path = raw.split('?', 1)[0];
  if (path !== '/community/social' && path !== '/community') {
    return '/community/social';
  }
  return raw;
}

export function buildSocialPostHref(postId: string, returnHref?: string): string {
  const base = `/community/posts/${encodeURIComponent(postId)}`;
  if (!returnHref) return base;
  const safe = safeSocialReturnHref(returnHref);
  if (safe === '/community/social') return base;
  return `${base}?from=${encodeURIComponent(safe)}`;
}

export function classifySocialPostKind(body: string): SocialPostKind {
  const clean = body.trim();
  if (!clean) return 'discussion';
  if (clean.includes('?') || QUESTION_LEAD_RE.test(clean)) return 'question';
  return 'discussion';
}

export function getAreaDraft(drafts: Readonly<Record<string, string>>, areaId: string): string {
  if (!areaId) return '';
  return drafts[areaId] ?? '';
}

export function setAreaDraft(
  drafts: Readonly<Record<string, string>>,
  areaId: string,
  value: string
): Record<string, string> {
  if (!areaId) return {...drafts};
  if (!value) {
    const next = {...drafts};
    delete next[areaId];
    return next;
  }
  return {...drafts, [areaId]: value};
}
