'use client';

import {useState} from 'react';
import Link from 'next/link';
import {CURATED_UK_GUIDES, type CuratedUkGuide} from '../lib/curated-uk-guides';

export default function SocialCuratedGuides({
  onDiscussPrompt,
}: {
  onDiscussPrompt?: (prompt: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string>(CURATED_UK_GUIDES[0]?.id ?? '');

  return (
    <section className="card" style={{marginTop: 18}} aria-labelledby="curated-guides-heading" data-testid="social-curated-guides">
      <div className="section-heading-row" style={{marginBottom: 12}}>
        <div>
          <span className="eyebrow">Curated UK Home &amp; Trade Briefings · LinkedIn Insider Style</span>
          <h2 id="curated-guides-heading" className="social-card-title" style={{marginBottom: 4}}>
            Shareable UK safety, compliance &amp; home-care guides
          </h2>
          <p className="muted-note" style={{margin: 0}}>
            Clean-room summaries of established UK home and trade standards (ICO CCTV privacy, Gas Safe, BS 7671,
            storm care &amp; Consumer Rights). Tap any guide to discuss it with your neighbours.
          </p>
        </div>
      </div>

      <div className="list" style={{gap: 12}}>
        {CURATED_UK_GUIDES.map((guide: CuratedUkGuide) => {
          const isOpen = expandedId === guide.id;
          return (
            <article key={guide.id} className="social-poll-card">
              <div style={{display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap'}}>
                <span className="pill">{guide.category}</span>
                <span className="muted-note" style={{fontSize: 12}}>
                  {guide.sourceLabel} · {guide.readMinutes} min read
                </span>
              </div>
              <h3 style={{margin: '8px 0 6px', fontSize: 16.5}}>{guide.title}</h3>
              <p className="subtle" style={{margin: '0 0 10px', fontSize: 14}}>
                {guide.summary}
              </p>

              {isOpen && (
                <ul style={{margin: '0 0 12px', paddingLeft: 18, display: 'grid', gap: 6, fontSize: 13.5, color: 'var(--dark)'}}>
                  {guide.keyTakeaways.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}

              <div style={{display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center'}}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setExpandedId(isOpen ? '' : guide.id)}
                >
                  {isOpen ? 'Hide key checklist' : 'Read checklist'}
                </button>
                {onDiscussPrompt && (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => onDiscussPrompt(guide.discussionPrompt)}
                  >
                    Discuss in your neighbourhood
                  </button>
                )}
                <Link className="service-view-all" href={`/cost-guides?trade=${encodeURIComponent(guide.relatedTradeSlug)}`}>
                  Check UK cost guide →
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
