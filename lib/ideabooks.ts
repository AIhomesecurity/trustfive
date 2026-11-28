export type IdeabookRoomType =
  | 'kitchen'
  | 'bathroom'
  | 'security_smart_home'
  | 'loft_roofing'
  | 'garden_exterior'
  | 'electrical_lighting'
  | 'heating_plumbing'
  | 'general_renovation';

export type IdeabookPropertyStyle =
  | 'victorian_terrace'
  | 'semi_detached'
  | 'modern_new_build'
  | 'rural_cottage'
  | 'flat_apartment'
  | 'commercial_unit';

export type IdeabookStatus = 'planning' | 'quoting' | 'completed';
export type IdeabookItemKind = 'showcase' | 'cost_guide' | 'note';

export type HomeownerIdeabook = {
  id: string;
  owner_id: string;
  title: string;
  room_type: IdeabookRoomType;
  property_style: IdeabookPropertyStyle;
  target_budget_pence: number;
  notes: string;
  status: IdeabookStatus;
  created_at: string;
};

export type HomeownerIdeabookItem = {
  id: string;
  ideabook_id: string;
  item_kind: IdeabookItemKind;
  showcase_id: string | null;
  cost_guide_slug: string | null;
  title: string;
  estimated_pence: number;
  notes: string;
  created_at: string;
};

export const IDEABOOK_ROOM_OPTIONS: Array<{value: IdeabookRoomType; label: string; defaultTradeSlug: string}> = [
  {value: 'security_smart_home', label: 'Security, CCTV & Smart Home', defaultTradeSlug: 'cctv-installation'},
  {value: 'kitchen', label: 'Kitchen Renovation', defaultTradeSlug: 'kitchen-fitting'},
  {value: 'bathroom', label: 'Bathroom Upgrade', defaultTradeSlug: 'bathroom-fitting'},
  {value: 'electrical_lighting', label: 'Electrical & Lighting', defaultTradeSlug: 'electrician'},
  {value: 'heating_plumbing', label: 'Heating & Plumbing', defaultTradeSlug: 'plumbing'},
  {value: 'loft_roofing', label: 'Loft, Roof & Guttering', defaultTradeSlug: 'roofing'},
  {value: 'garden_exterior', label: 'Garden, Drive & Exterior', defaultTradeSlug: 'landscaping'},
  {value: 'general_renovation', label: 'General Home Improvement', defaultTradeSlug: 'handyman'},
];

export const IDEABOOK_PROPERTY_STYLES: Array<{value: IdeabookPropertyStyle; label: string}> = [
  {value: 'victorian_terrace', label: 'Victorian / Edwardian terrace'},
  {value: 'semi_detached', label: '1930s–1980s semi-detached / detached'},
  {value: 'modern_new_build', label: 'Modern / new-build home'},
  {value: 'rural_cottage', label: 'Rural / stone cottage'},
  {value: 'flat_apartment', label: 'Flat / apartment'},
  {value: 'commercial_unit', label: 'Commercial / shop / office'},
];

export function readableRoomType(room: string): string {
  return IDEABOOK_ROOM_OPTIONS.find((r) => r.value === room)?.label ?? 'General Home Improvement';
}

export function readablePropertyStyle(style: string): string {
  return IDEABOOK_PROPERTY_STYLES.find((s) => s.value === style)?.label ?? 'UK property';
}

export function summarizeIdeabookBudget(
  targetBudgetPence: number,
  items: Array<Pick<HomeownerIdeabookItem, 'estimated_pence'>>
): {
  targetGbp: number;
  estimatedGbp: number;
  remainingGbp: number;
  overBudget: boolean;
  percentUsed: number;
} {
  const safeTarget = Math.max(0, Math.round(Number(targetBudgetPence) || 0));
  const totalPence = items.reduce(
    (sum, item) => sum + Math.max(0, Math.round(Number(item.estimated_pence) || 0)),
    0
  );
  const targetGbp = Math.round(safeTarget / 100);
  const estimatedGbp = Math.round(totalPence / 100);
  const remainingGbp = targetGbp - estimatedGbp;
  const overBudget = safeTarget > 0 && totalPence > safeTarget;
  const percentUsed =
    safeTarget > 0 ? Math.min(100, Math.round((totalPence / safeTarget) * 100)) : totalPence > 0 ? 100 : 0;
  return {targetGbp, estimatedGbp, remainingGbp, overBudget, percentUsed};
}

export function validateIdeabookDraft(input: {title: string; targetBudgetGbp: number}): string | null {
  const clean = input.title.trim();
  if (clean.length < 3) return 'Enter a project Ideabook title of at least 3 characters.';
  if (clean.length > 120) return 'Keep your Ideabook title under 120 characters.';
  if (!Number.isFinite(input.targetBudgetGbp) || input.targetBudgetGbp < 0 || input.targetBudgetGbp > 1000000) {
    return 'Enter a valid target budget between £0 and £1,000,000.';
  }
  return null;
}

export function validateIdeabookItemDraft(input: {title: string; estimatedGbp: number}): string | null {
  const clean = input.title.trim();
  if (clean.length < 3) return 'Enter an item title of at least 3 characters.';
  if (clean.length > 140) return 'Keep the item title under 140 characters.';
  if (!Number.isFinite(input.estimatedGbp) || input.estimatedGbp < 0 || input.estimatedGbp > 1000000) {
    return 'Enter a valid item estimate between £0 and £1,000,000.';
  }
  return null;
}

export function buildIdeabookJobBriefHref(
  book: Pick<HomeownerIdeabook, 'title' | 'room_type' | 'property_style' | 'target_budget_pence' | 'notes'>,
  items: Array<Pick<HomeownerIdeabookItem, 'title' | 'estimated_pence' | 'cost_guide_slug' | 'notes'>>
): string {
  const roomMeta = IDEABOOK_ROOM_OPTIONS.find((r) => r.value === book.room_type);
  const inferredTrade =
    items.find((i) => i.cost_guide_slug)?.cost_guide_slug ?? roomMeta?.defaultTradeSlug ?? 'handyman';
  const budgetSummary = summarizeIdeabookBudget(book.target_budget_pence, items);
  const budgetGbp = budgetSummary.estimatedGbp > 0 ? budgetSummary.estimatedGbp : budgetSummary.targetGbp;

  const lines: string[] = [
    `Project Ideabook: ${book.title.trim()}.`,
    `Room / category: ${readableRoomType(book.room_type)}. Property style: ${readablePropertyStyle(book.property_style)}.`,
  ];
  if (items.length > 0) {
    const scopeList = items
      .slice(0, 8)
      .map((i) => (i.estimated_pence > 0 ? `${i.title} (~£${Math.round(i.estimated_pence / 100)})` : i.title))
      .join('; ');
    lines.push(`Saved scope items: ${scopeList}.`);
  }
  if (book.notes.trim()) {
    lines.push(`Notes: ${book.notes.trim().slice(0, 300)}`);
  }

  const params = new URLSearchParams();
  params.set('trade', inferredTrade);
  params.set('title', book.title.trim().slice(0, 120));
  params.set('brief', lines.join(' ').slice(0, 1400));
  if (budgetGbp > 0) params.set('budget', String(budgetGbp));
  return `/jobs?${params.toString()}`;
}

export type IdeabookQuickAdd = {
  kind: IdeabookItemKind;
  costGuideSlug: string;
  showcaseId: string;
  title: string;
  estimatedGbp: number;
};

const SLUG_RE = /^[a-z0-9-]{2,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseIdeabookQuickAddParams(search: string): IdeabookQuickAdd | null {
  const params = new URLSearchParams(search);
  const addGuide = (params.get('addGuide') ?? '').trim().toLowerCase();
  const addShowcase = (params.get('addShowcase') ?? '').trim();
  const rawTitle = (params.get('title') ?? '').trim().slice(0, 140);
  const rawEst = Number(params.get('est') ?? '0');
  const estimatedGbp = Number.isFinite(rawEst) && rawEst > 0 && rawEst <= 1000000 ? Math.round(rawEst) : 0;

  if (addShowcase && UUID_RE.test(addShowcase)) {
    return {
      kind: 'showcase',
      costGuideSlug: '',
      showcaseId: addShowcase,
      title: rawTitle || 'Saved installer showcase',
      estimatedGbp,
    };
  }
  if (addGuide && SLUG_RE.test(addGuide)) {
    return {
      kind: 'cost_guide',
      costGuideSlug: addGuide,
      showcaseId: '',
      title: rawTitle || `UK Cost Guide: ${addGuide.replace(/-/g, ' ')}`,
      estimatedGbp,
    };
  }
  return null;
}
