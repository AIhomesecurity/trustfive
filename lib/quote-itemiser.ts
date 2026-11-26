export type QuoteLineCategory = 'labour' | 'materials' | 'access_callout';

export type QuoteLineItem = {
  id: string;
  category: QuoteLineCategory;
  description: string;
  amountGbp: number;
};

export type PaymentMilestoneId = 'completion_100' | 'materials_balance' | 'three_stage';

export const PAYMENT_MILESTONE_OPTIONS: Array<{
  id: PaymentMilestoneId;
  label: string;
  summary: string;
}> = [
  {
    id: 'completion_100',
    label: '0% deposit · 100% on completion',
    summary: 'Payment schedule: 0% upfront deposit; 100% payable once work is completed and inspected.',
  },
  {
    id: 'materials_balance',
    label: 'Materials on start · Balance on completion',
    summary: 'Payment schedule: Materials cost agreed on start date; labour balance payable on completion.',
  },
  {
    id: 'three_stage',
    label: '3-stage milestone (30% / 40% / 30%)',
    summary: 'Payment schedule: 30% on agreed start, 40% at mid-point inspection, 30% on final sign-off.',
  },
];

export const QUOTE_LINE_CATEGORY_LABELS: Record<QuoteLineCategory, string> = {
  labour: 'Labour',
  materials: 'Materials & parts',
  access_callout: 'Access / equipment',
};

export function calculateItemisedQuote(input: {
  items: Array<Pick<QuoteLineItem, 'category' | 'description' | 'amountGbp'>>;
  includeVat: boolean;
}): {
  subtotalGbp: number;
  vatGbp: number;
  totalGbp: number;
  validItemCount: number;
} {
  let subtotal = 0;
  let validItemCount = 0;
  for (const item of input.items) {
    const val = Number(item.amountGbp);
    if (item.description.trim().length > 0 && Number.isFinite(val) && val > 0 && val <= 1000000) {
      subtotal += val;
      validItemCount += 1;
    }
  }
  const subtotalGbp = Math.round(subtotal * 100) / 100;
  const vatGbp = input.includeVat ? Math.round(subtotalGbp * 0.2 * 100) / 100 : 0;
  const totalGbp = Math.round((subtotalGbp + vatGbp) * 100) / 100;
  return {subtotalGbp, vatGbp, totalGbp, validItemCount};
}

export function formatItemisedQuoteScope(input: {
  items: Array<Pick<QuoteLineItem, 'category' | 'description' | 'amountGbp'>>;
  includeVat: boolean;
  milestoneId: PaymentMilestoneId;
  warrantyNote?: string;
}): {amountString: string; scopeText: string} | null {
  const totals = calculateItemisedQuote({items: input.items, includeVat: input.includeVat});
  if (totals.validItemCount === 0 || totals.totalGbp < 1) return null;

  const lines: string[] = ['Itemised written estimate:'];
  for (const item of input.items) {
    const desc = item.description.trim();
    const val = Number(item.amountGbp);
    if (!desc || !Number.isFinite(val) || val <= 0) continue;
    const cat = QUOTE_LINE_CATEGORY_LABELS[item.category] ?? 'Item';
    lines.push(`- [${cat}] ${desc}: £${val.toFixed(2)}`);
  }
  lines.push(`Subtotal: £${totals.subtotalGbp.toFixed(2)}`);
  lines.push(input.includeVat ? `VAT (20%): £${totals.vatGbp.toFixed(2)}` : 'VAT: Not applicable / excluded');
  lines.push(`Total quote: £${totals.totalGbp.toFixed(2)}`);

  const milestone = PAYMENT_MILESTONE_OPTIONS.find((m) => m.id === input.milestoneId);
  if (milestone) lines.push(milestone.summary);

  const warranty = (input.warrantyNote ?? '').trim();
  if (warranty) lines.push(`Workmanship & exclusions: ${warranty}`);

  return {
    amountString: totals.totalGbp.toFixed(2),
    scopeText: lines.join('\n').slice(0, 2950),
  };
}
