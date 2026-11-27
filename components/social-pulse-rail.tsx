'use client';

import Link from 'next/link';

const TRENDING_TOPICS = [
  {label: 'CCTV & Security', query: 'CCTV'},
  {label: 'Boilers & Heating', query: 'boiler'},
  {label: 'Roofing & Gutters', query: 'roof'},
  {label: 'Electricians & EV', query: 'electric'},
  {label: 'Kitchen & Renovation', query: 'kitchen'},
  {label: 'Garden & Driveways', query: 'garden'},
];

export default function SocialPulseRail({
  onSelectTopic,
}: {
  onSelectTopic?: (topicQuery: string) => void;
}) {
  return (
    <aside className="social-rail social-rail-right" aria-label="Local Trade Pulse and Network">
      <section className="card social-pulse-card" data-testid="social-pulse-rail">
        <span className="eyebrow">Local Trade Pulse</span>
        <h2 className="social-rail-heading">Explore local topics</h2>
        <p className="muted-note" style={{margin: '4px 0 12px', fontSize: 13}}>
          Filter neighbourhood posts and trade Q&amp;A by home-improvement topic.
        </p>
        <div className="social-topic-pills">
          {TRENDING_TOPICS.map((topic) =>
            onSelectTopic ? (
              <button
                key={topic.label}
                type="button"
                className="tf-chip-btn"
                onClick={() => onSelectTopic(topic.query)}
              >
                # {topic.label}
              </button>
            ) : (
              <Link
                key={topic.label}
                className="tf-chip-btn"
                href={`/community/social?q=${encodeURIComponent(topic.query)}`}
              >
                # {topic.label}
              </Link>
            )
          )}
        </div>
      </section>

      <section className="card social-pulse-card">
        <span className="eyebrow">LinkedIn-style Trade Proof</span>
        <h2 className="social-rail-heading">Installer Showcases</h2>
        <p className="muted-note" style={{margin: '4px 0 12px', fontSize: 13}}>
          Browse finished installations from independently approved local businesses, ask questions in-app, and save
          favourites to your Project Ideabook.
        </p>
        <div style={{display: 'grid', gap: 8}}>
          <Link className="btn secondary" href="/community/social?tab=showcases">
            Browse work showcases →
          </Link>
          <Link className="service-view-all" href="/professional/business">
            Are you approved? Publish a job →
          </Link>
        </div>
      </section>

      <section className="card social-pulse-card">
        <span className="eyebrow">Trade-to-Trade Network</span>
        <h2 className="social-rail-heading">Swap jobs &amp; refer trades</h2>
        <p className="muted-note" style={{margin: '4px 0 12px', fontSize: 13}}>
          Recommend trusted local trades via zero-PII customer-consented links and model transparent referral splits.
        </p>
        <Link className="btn secondary" href="/community/social?tab=trade">
          Open Trade Referrals →
        </Link>
      </section>

      <section className="card social-charter-mini">
        <strong style={{fontSize: 13.5, color: 'var(--dark)'}}>🛡️ Zero-Spam Community Charter</strong>
        <p className="muted-note" style={{margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5}}>
          Phone numbers, external websites, email addresses and full postcodes are automatically blocked in TrustFive
          Social so every quote stays safe, private and inside the app.
        </p>
      </section>
    </aside>
  );
}
