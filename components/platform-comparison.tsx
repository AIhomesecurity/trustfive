'use client';

import {useMemo, useState} from 'react';
import Link from 'next/link';
import {
  calculateAnnualLeadFeeSavings,
  UK_PLATFORM_COMPARISON,
  type PlatformComparisonRow,
} from '../lib/marketplace-comparison';

type FilterMode = 'all' | 'lead-fee' | 'directory';

type Props = {
  showSavingsCalculator?: boolean;
};

export default function PlatformComparison({showSavingsCalculator = true}: Props) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [monthlyQuotes, setMonthlyQuotes] = useState(15);
  const [avgLeadFee, setAvgLeadFee] = useState(22);

  const rows = useMemo<PlatformComparisonRow[]>(() => {
    if (filter === 'lead-fee') {
      return UK_PLATFORM_COMPARISON.filter((r) => r.isTrustFive || r.category === 'Lead-Fee Marketplace');
    }
    if (filter === 'directory') {
      return UK_PLATFORM_COMPARISON.filter(
        (r) => r.isTrustFive || r.category === 'Directory & Endorsement' || r.category === 'Free Local Visibility'
      );
    }
    return UK_PLATFORM_COMPARISON;
  }, [filter]);

  const savings = useMemo(
    () => calculateAnnualLeadFeeSavings({monthlyQuotes, avgLeadFeeGbp: avgLeadFee}),
    [monthlyQuotes, avgLeadFee]
  );

  return (
    <div className="tf-compare-wrap" data-testid="platform-comparison">
      <div className="tf-compare-filters" role="group" aria-label="Filter UK platforms">
        <button
          type="button"
          className={filter === 'all' ? 'dashboard-tab active' : 'dashboard-tab'}
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          All UK platforms ({UK_PLATFORM_COMPARISON.length})
        </button>
        <button
          type="button"
          className={filter === 'lead-fee' ? 'dashboard-tab active' : 'dashboard-tab'}
          aria-pressed={filter === 'lead-fee'}
          onClick={() => setFilter('lead-fee')}
        >
          vs Pay-per-lead sites
        </button>
        <button
          type="button"
          className={filter === 'directory' ? 'dashboard-tab active' : 'dashboard-tab'}
          aria-pressed={filter === 'directory'}
          onClick={() => setFilter('directory')}
        >
          vs Directories &amp; free listings
        </button>
      </div>

      <div className="tf-table-scroll" role="region" aria-label="UK trade platform comparison table">
        <table className="tf-compare-table">
          <thead>
            <tr>
              <th scope="col">Platform</th>
              <th scope="col">Pricing model</th>
              <th scope="col">Per-lead fees</th>
              <th scope="col">Local competition cap</th>
              <th scope="col">Best for</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.isTrustFive ? 'tf-compare-highlight' : undefined}>
                <th scope="row">
                  <span>{row.platform}</span>
                  {row.isTrustFive && <span className="pill" style={{marginLeft: 8}}>Recommended</span>}
                </th>
                <td>{row.pricingModel}</td>
                <td>{row.leadFees}</td>
                <td>{row.localCap}</td>
                <td>{row.bestFor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tf-compare-cards" aria-label="UK trade platform comparison cards">
        {rows.map((row) => (
          <article
            key={row.id}
            className={row.isTrustFive ? 'card tf-compare-card-highlight' : 'card'}
          >
            <div className="tf-compare-card-head">
              <h3>{row.platform}</h3>
              <span className="pill">{row.isTrustFive ? '£0 lead fees' : row.category}</span>
            </div>
            <dl className="tf-compare-dl">
              <div>
                <dt>Pricing model</dt>
                <dd>{row.pricingModel}</dd>
              </div>
              <div>
                <dt>Per-lead fees</dt>
                <dd>{row.leadFees}</dd>
              </div>
              <div>
                <dt>Local cap &amp; ranking</dt>
                <dd>{row.localCap}</dd>
              </div>
              <div>
                <dt>Best for</dt>
                <dd>{row.bestFor}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {showSavingsCalculator && (
        <div className="card tf-savings-box" data-testid="lead-fee-calculator">
          <div className="tf-savings-grid">
            <div>
              <span className="pill">For UK tradespeople</span>
              <h3 style={{marginTop: 10}}>How much do pay-per-lead credits cost you per year?</h3>
              <p className="subtle" style={{margin: '6px 0 16px'}}>
                On credit and shortlist marketplaces, you pay every time you quote — even when a customer never replies.
                TrustFive charges <strong>£0 per lead</strong> and caps every trade at up to five independently approved
                local professionals per area.
              </p>

              <div className="tf-savings-sliders">
                <label htmlFor="calc-monthly-quotes">
                  Quotes sent per month: <strong>{savings.monthlyQuotes}</strong>
                  <input
                    id="calc-monthly-quotes"
                    type="range"
                    min={1}
                    max={60}
                    step={1}
                    value={monthlyQuotes}
                    onChange={(e) => setMonthlyQuotes(Number(e.target.value))}
                  />
                </label>

                <label htmlFor="calc-lead-fee">
                  Typical lead / shortlist fee: <strong>£{savings.avgLeadFeeGbp}</strong>
                  <input
                    id="calc-lead-fee"
                    type="range"
                    min={5}
                    max={60}
                    step={1}
                    value={avgLeadFee}
                    onChange={(e) => setAvgLeadFee(Number(e.target.value))}
                  />
                </label>
              </div>
            </div>

            <div className="tf-savings-summary" aria-live="polite">
              <div className="tf-savings-metric">
                <span>Typical per-lead credit spend / year</span>
                <strong data-testid="annual-lead-spend">£{savings.annualLeadSpendGbp.toLocaleString('en-GB')}</strong>
              </div>
              <div className="tf-savings-metric">
                <span>TrustFive per-lead / shortlist fees</span>
                <strong>£0</strong>
              </div>
              <p className="muted-note" style={{margin: '8px 0 14px'}}>
                Illustrative calculation only ({savings.monthlyQuotes} quotes/month × £{savings.avgLeadFeeGbp}/lead × 12
                months). TrustFive does not guarantee specific lead volumes or earnings, and approval is always earned
                through independent review.
              </p>
              <Link className="btn" href="/professional/apply">
                Apply for one of five local places
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
