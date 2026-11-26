'use client';

import {useMemo, useState} from 'react';
import Link from 'next/link';
import {
  buildJobsPrefillHref,
  calculateEstimate,
  COMPLEXITY_OPTIONS,
  findTradeCostGuide,
  PROPERTY_TYPE_OPTIONS,
  UK_COST_GUIDES,
  URGENCY_OPTIONS,
  type JobComplexity,
  type JobUrgency,
  type PropertyType,
} from '../lib/uk-cost-guides';

type Props = {
  initialTradeSlug?: string;
  compact?: boolean;
};

export default function TradeCostEstimator({initialTradeSlug = 'cctv-installation', compact = false}: Props) {
  const initialGuide = findTradeCostGuide(initialTradeSlug);
  const [tradeSlug, setTradeSlug] = useState(initialGuide.tradeSlug);
  const guide = useMemo(() => findTradeCostGuide(tradeSlug), [tradeSlug]);
  const [jobId, setJobId] = useState(initialGuide.jobs[0].id);
  const [complexity, setComplexity] = useState<JobComplexity>('standard');
  const [urgency, setUrgency] = useState<JobUrgency>('flexible');
  const [propertyType, setPropertyType] = useState<PropertyType>('house');
  const [siteNotes, setSiteNotes] = useState('');

  const selectedJob = useMemo(
    () => guide.jobs.find((j) => j.id === jobId) ?? guide.jobs[0],
    [guide, jobId]
  );

  const estimate = useMemo(
    () => calculateEstimate({job: selectedJob, complexity, urgency}),
    [selectedJob, complexity, urgency]
  );

  const prefillHref = useMemo(
    () =>
      buildJobsPrefillHref({
        tradeSlug: guide.tradeSlug,
        jobTitle: selectedJob.title,
        midGbp: estimate.midGbp,
        urgency,
        propertyType,
        siteNotes,
      }),
    [guide.tradeSlug, selectedJob.title, estimate.midGbp, urgency, propertyType, siteNotes]
  );

  function handleTradeChange(nextSlug: string) {
    setTradeSlug(nextSlug);
    const nextGuide = findTradeCostGuide(nextSlug);
    setJobId(nextGuide.jobs[0].id);
  }

  return (
    <div className="tf-estimator card" data-testid="trade-cost-estimator">
      <div className="tf-estimator-grid">
        <div className="tf-estimator-controls">
          <div className="tf-estimator-row">
            <label htmlFor={compact ? 'home-est-trade' : 'est-trade'}>
              Trade category
              <select
                id={compact ? 'home-est-trade' : 'est-trade'}
                value={guide.tradeSlug}
                onChange={(e) => handleTradeChange(e.target.value)}
              >
                {UK_COST_GUIDES.map((g) => (
                  <option key={g.tradeSlug} value={g.tradeSlug}>
                    {g.icon} {g.tradeLabel}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor={compact ? 'home-est-job' : 'est-job'}>
              Typical UK job type
              <select
                id={compact ? 'home-est-job' : 'est-job'}
                value={selectedJob.id}
                onChange={(e) => setJobId(e.target.value)}
              >
                {guide.jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="tf-estimator-row">
            <label htmlFor={compact ? 'home-est-complexity' : 'est-complexity'}>
              Job size &amp; access
              <select
                id={compact ? 'home-est-complexity' : 'est-complexity'}
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as JobComplexity)}
              >
                {COMPLEXITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor={compact ? 'home-est-urgency' : 'est-urgency'}>
              Preferred timing
              <select
                id={compact ? 'home-est-urgency' : 'est-urgency'}
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

          {!compact && (
            <div className="tf-estimator-row">
              <label htmlFor="est-property">
                Property type
                <select
                  id="est-property"
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

              <label htmlFor="est-notes">
                Optional notes for your job brief
                <input
                  id="est-notes"
                  type="text"
                  maxLength={220}
                  value={siteNotes}
                  onChange={(e) => setSiteNotes(e.target.value)}
                  placeholder="e.g. 2-storey brick semi, loft access available"
                />
              </label>
            </div>
          )}

          <p className="muted-note" style={{marginTop: 4}}>
            {selectedJob.summary}
          </p>
        </div>

        <div className="tf-estimator-result" aria-live="polite">
          <span className="pill">Indicative UK guide range</span>
          <div className="tf-estimator-price" data-testid="estimator-price-range">
            £{estimate.lowGbp.toLocaleString('en-GB')} – £{estimate.highGbp.toLocaleString('en-GB')}
          </div>
          <p className="tf-estimator-meta">
            <strong>Typical duration:</strong> {estimate.durationLabel}
          </p>
          <p className="tf-estimator-meta">
            <strong>What pros check:</strong> {selectedJob.siteVisitNote}
          </p>

          <div className="tf-estimator-checklist">
            <strong>Include in your brief for accurate written quotes:</strong>
            <ul>
              {selectedJob.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>

          <div className="tf-estimator-actions">
            <Link className="btn" href={prefillHref}>
              Post this job for free quotes
            </Link>
            <Link className="btn secondary" href={'/services?trade=' + encodeURIComponent(guide.tradeSlug)}>
              Browse {guide.tradeLabel} pros
            </Link>
          </div>
          {compact && (
            <p className="muted-note" style={{marginTop: 10}}>
              <Link className="service-view-all" href={'/cost-guides?trade=' + encodeURIComponent(guide.tradeSlug)}>
                Open full UK cost guide for all 20 trades →
              </Link>
            </p>
          )}
          <p className="muted-note" style={{marginTop: 10}}>
            {estimate.note}
          </p>
        </div>
      </div>
    </div>
  );
}
