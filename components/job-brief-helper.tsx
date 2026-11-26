'use client';

import {useMemo, useState} from 'react';
import {
  findTradeCostGuide,
  PROPERTY_TYPE_OPTIONS,
  URGENCY_OPTIONS,
  type JobUrgency,
  type PropertyType,
} from '../lib/uk-cost-guides';

type Props = {
  tradeSlug?: string;
  onApplySnippet: (snippet: string, suggestedTitle?: string) => void;
};

export default function JobBriefHelper({tradeSlug, onApplySnippet}: Props) {
  const [open, setOpen] = useState(false);
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [urgency, setUrgency] = useState<JobUrgency>('flexible');
  const [accessNote, setAccessNote] = useState('');

  const guide = useMemo(() => findTradeCostGuide(tradeSlug || 'plumbing'), [tradeSlug]);

  function addStructuredSummary() {
    const propLabel = PROPERTY_TYPE_OPTIONS.find((p) => p.value === propertyType)?.label ?? 'House';
    const urgLabel = URGENCY_OPTIONS.find((u) => u.value === urgency)?.label ?? 'Flexible';
    const parts = [
      `Property: ${propLabel}.`,
      `Preferred timing: ${urgLabel}.`,
      accessNote.trim() ? `Access & details: ${accessNote.trim()}.` : '',
    ].filter(Boolean);
    onApplySnippet(parts.join(' '));
  }

  return (
    <div className="tf-brief-helper" data-testid="job-brief-helper">
      <button
        type="button"
        className="btn secondary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide guided brief helper' : 'Need help writing a clear job brief?'}
      </button>

      {open && (
        <div className="tf-brief-panel">
          <p className="muted-note" style={{marginTop: 0}}>
            Tradespeople give faster, tighter written quotes when your brief includes property type, timing and access
            notes. Pick options below to add them into your job description.
          </p>

          <div className="form-grid">
            <label htmlFor="brief-helper-property">
              Property type
              <select
                id="brief-helper-property"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
              >
                {PROPERTY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="brief-helper-urgency">
              Preferred timing
              <select
                id="brief-helper-urgency"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as JobUrgency)}
              >
                {URGENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label htmlFor="brief-helper-access" style={{marginTop: 10}}>
            Access, wall type or materials note (optional)
            <input
              id="brief-helper-access"
              type="text"
              maxLength={200}
              value={accessNote}
              onChange={(e) => setAccessNote(e.target.value)}
              placeholder="e.g. Solid brick walls, parking on driveway, trade to supply materials"
            />
          </label>

          <div className="tf-brief-presets">
            <span className="muted-note">
              <strong>Common {guide.tradeLabel.toLowerCase()} jobs (tap to fill):</strong>
            </span>
            <div className="tf-brief-chips">
              {guide.jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className="tf-chip-btn"
                  onClick={() =>
                    onApplySnippet(
                      `${job.summary} Checklist to confirm: ${job.questions.join(' ')}`,
                      job.title
                    )
                  }
                >
                  + {job.title}
                </button>
              ))}
            </div>
          </div>

          <div style={{marginTop: 12}}>
            <button type="button" className="btn secondary" onClick={addStructuredSummary}>
              Add property &amp; timing to description
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
