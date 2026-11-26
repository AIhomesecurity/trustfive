'use client';

import {useMemo, useState} from 'react';
import {
  calculateItemisedQuote,
  formatItemisedQuoteScope,
  PAYMENT_MILESTONE_OPTIONS,
  QUOTE_LINE_CATEGORY_LABELS,
  type PaymentMilestoneId,
  type QuoteLineCategory,
  type QuoteLineItem,
} from '../lib/quote-itemiser';

type Props = {
  onApply: (amountString: string, scopeText: string) => void;
};

const INITIAL_ITEMS: QuoteLineItem[] = [
  {id: 'line-1', category: 'labour', description: 'Installation & commissioning labour', amountGbp: 240},
  {id: 'line-2', category: 'materials', description: 'Materials, fixings & consumables', amountGbp: 180},
];

export default function QuoteItemisedBuilder({onApply}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QuoteLineItem[]>(INITIAL_ITEMS);
  const [includeVat, setIncludeVat] = useState(false);
  const [milestoneId, setMilestoneId] = useState<PaymentMilestoneId>('completion_100');
  const [warrantyNote, setWarrantyNote] = useState('12-month workmanship guarantee; site left clean and tested.');

  const totals = useMemo(() => calculateItemisedQuote({items, includeVat}), [items, includeVat]);

  function updateItem(id: string, patch: Partial<QuoteLineItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? {...item, ...patch} : item)));
  }

  function addRow() {
    if (items.length >= 10) return;
    setItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length + 1}`,
        category: 'materials',
        description: '',
        amountGbp: 0,
      },
    ]);
  }

  function removeRow(id: string) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleApply() {
    const formatted = formatItemisedQuoteScope({
      items,
      includeVat,
      milestoneId,
      warrantyNote,
    });
    if (!formatted) return;
    onApply(formatted.amountString, formatted.scopeText);
    setOpen(false);
  }

  return (
    <div className="tf-brief-helper" data-testid="quote-itemised-builder">
      <button
        type="button"
        className="btn secondary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide itemised quote builder' : 'Build itemised quote & milestones (Labour / Materials / VAT)'}
      </button>

      {open && (
        <div className="tf-brief-panel">
          <p className="muted-note" style={{marginTop: 0}}>
            Homeowners trust clear written breakdowns. Add labour, materials and access lines below, choose a UK
            payment milestone schedule, and apply directly to your quote.
          </p>

          <div className="list" style={{gap: 10}}>
            {items.map((row, idx) => (
              <div
                key={row.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 1fr) minmax(160px, 2fr) minmax(90px, 110px) auto',
                  gap: 8,
                  alignItems: 'end',
                }}
              >
                <label>
                  Type
                  <select
                    aria-label={`Line ${idx + 1} category`}
                    value={row.category}
                    onChange={(e) => updateItem(row.id, {category: e.target.value as QuoteLineCategory})}
                  >
                    {Object.entries(QUOTE_LINE_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Description
                  <input
                    aria-label={`Line ${idx + 1} description`}
                    type="text"
                    maxLength={120}
                    value={row.description}
                    onChange={(e) => updateItem(row.id, {description: e.target.value})}
                    placeholder="e.g. Conduit, weatherproof boxes"
                  />
                </label>
                <label>
                  £
                  <input
                    aria-label={`Line ${idx + 1} amount`}
                    type="number"
                    min={0}
                    max={1000000}
                    step="0.01"
                    value={row.amountGbp || ''}
                    onChange={(e) => updateItem(row.id, {amountGbp: Number(e.target.value) || 0})}
                  />
                </label>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={items.length <= 1}
                  onClick={() => removeRow(row.id)}
                  aria-label={`Remove line ${idx + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center'}}>
            <button type="button" className="btn secondary" disabled={items.length >= 10} onClick={addRow}>
              + Add line item
            </button>
            <label style={{display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row', margin: 0}}>
              <input
                type="checkbox"
                checked={includeVat}
                onChange={(e) => setIncludeVat(e.target.checked)}
                style={{width: 18, height: 18}}
              />
              Add UK VAT (20%)
            </label>
          </div>

          <div className="form-grid" style={{marginTop: 12}}>
            <label htmlFor="quote-milestone-select">
              Payment milestone schedule
              <select
                id="quote-milestone-select"
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value as PaymentMilestoneId)}
              >
                {PAYMENT_MILESTONE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="quote-warranty-note">
              Workmanship &amp; exclusions note
              <input
                id="quote-warranty-note"
                type="text"
                maxLength={220}
                value={warrantyNote}
                onChange={(e) => setWarrantyNote(e.target.value)}
              />
            </label>
          </div>

          <div className="tf-savings-summary" style={{marginTop: 12}} data-testid="quote-itemised-totals">
            <div className="tf-savings-metric">
              <span>Subtotal ({totals.validItemCount} line items)</span>
              <strong>£{totals.subtotalGbp.toFixed(2)}</strong>
            </div>
            {includeVat && (
              <div className="tf-savings-metric">
                <span>UK VAT (20%)</span>
                <strong>£{totals.vatGbp.toFixed(2)}</strong>
              </div>
            )}
            <div className="tf-savings-metric" style={{borderBottom: 'none'}}>
              <span>Total written quote</span>
              <strong>£{totals.totalGbp.toFixed(2)}</strong>
            </div>
          </div>

          <div style={{marginTop: 12}}>
            <button
              type="button"
              className="btn"
              disabled={totals.validItemCount === 0 || totals.totalGbp < 1}
              onClick={handleApply}
            >
              Apply itemised breakdown to quote
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
