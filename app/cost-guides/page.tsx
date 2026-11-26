import Link from 'next/link';
import type {Metadata} from 'next';
import TradeCostEstimator from '../../components/trade-cost-estimator';
import PlatformComparison from '../../components/platform-comparison';
import {UK_COST_GUIDES} from '../../lib/uk-cost-guides';

export const metadata: Metadata = {
  title: 'UK Trade Cost Guides & Job Estimator | TrustFive',
  description:
    'Check indicative UK job cost ranges across 20 trades, prepare a clear technical job brief, and compare quotes from up to five independently approved local professionals.',
};

type SearchParams = Promise<{trade?: string}>;

export default async function CostGuidesPage({searchParams}: {searchParams: SearchParams}) {
  const params = await searchParams;
  const initialTrade = typeof params?.trade === 'string' && params.trade.trim() ? params.trade.trim() : 'cctv-installation';

  return (
    <main>
      <section className="guide-hero">
        <div className="container guide-hero-inner">
          <div className="eyebrow">Transparent UK pricing guides</div>
          <h1>Know fair UK job costs before you ask for quotes.</h1>
          <p>
            Select a trade and job type to view indicative UK guide ranges, typical visit times, and the key physical
            details professionals need to give an accurate written quote — then pre-fill your TrustFive job brief in one
            click.
          </p>
          <div className="guide-actions">
            <a className="btn" href="#estimator">
              Launch cost estimator
            </a>
            <Link className="btn secondary" href="/jobs">
              Post a job directly
            </Link>
          </div>
        </div>
      </section>

      <section id="estimator" className="container section" aria-labelledby="estimator-heading">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">Interactive UK estimator</div>
            <h2 id="estimator-heading">Estimate your project &amp; build a clear job brief</h2>
            <p className="subtle">
              Guides are indicative UK ranges — every approved TrustFive professional submits their own written quote.
            </p>
          </div>
          <Link className="service-view-all" href="/services">
            Browse verified directory →
          </Link>
        </div>
        <TradeCostEstimator initialTradeSlug={initialTrade} />
      </section>

      <section className="home-how-it-works section" aria-labelledby="all-guides-heading">
        <div className="container">
          <div className="eyebrow">Complete 20-trade reference</div>
          <h2 id="all-guides-heading">UK cost guides by trade category</h2>
          <p className="subtle">
            Jump straight to any trade to see common UK jobs, typical durations and what to check before booking.
          </p>

          <div className="tf-jump-pills" aria-label="Jump to trade cost guide">
            {UK_COST_GUIDES.map((g) => (
              <a key={g.tradeSlug} href={'#guide-' + g.tradeSlug} className="tf-jump-pill">
                <span aria-hidden="true">{g.icon}</span> {g.tradeLabel}
              </a>
            ))}
          </div>

          <div className="tf-guides-grid">
            {UK_COST_GUIDES.map((guide) => (
              <article className="card tf-guide-card" id={'guide-' + guide.tradeSlug} key={guide.tradeSlug}>
                <div className="tf-guide-head">
                  <span className="service-icon" aria-hidden="true">
                    {guide.icon}
                  </span>
                  <div>
                    <h3>{guide.tradeLabel}</h3>
                    <p className="muted-note">{guide.categoryNote}</p>
                  </div>
                </div>
                <ul className="tf-guide-list">
                  {guide.jobs.map((job) => (
                    <li key={job.id}>
                      <div>
                        <strong>{job.title}</strong>
                        <span className="muted-note">{job.durationLabel}</span>
                      </div>
                      <span className="pill">
                        £{job.baseLowGbp.toLocaleString('en-GB')} – £{job.baseHighGbp.toLocaleString('en-GB')}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="tf-guide-actions">
                  <Link className="btn secondary" href={'/services?trade=' + encodeURIComponent(guide.tradeSlug)}>
                    Find {guide.tradeLabel} pros
                  </Link>
                  <Link className="service-view-all" href={'/jobs?trade=' + encodeURIComponent(guide.tradeSlug)}>
                    Post {guide.tradeLabel} job →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container section" aria-labelledby="compare-heading">
        <div className="eyebrow">Why TrustFive is different</div>
        <h2 id="compare-heading">How TrustFive compares to UK lead-fee sites and directories</h2>
        <p className="subtle" style={{marginBottom: 20}}>
          Compare how TrustFive combines local five-place vetting, £0 per-lead fees and built-in job workflows against
          traditional UK directories and credit marketplaces.
        </p>
        <PlatformComparison showSavingsCalculator />
      </section>
    </main>
  );
}
