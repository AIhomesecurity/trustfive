'use client';

import Link from 'next/link';
import {readablePostDate, type SocialPostSummary} from '../lib/social-discovery';
import {buildSocialPostHref, classifySocialPostKind} from '../lib/social-feed-url';
import SocialDiscussion from './social-discussion';

export type SocialPostCardProps = {
  post: SocialPostSummary;
  areaLabel: string;
  userId: string;
  returnHref?: string;
  hidePermalink?: boolean;
};

function areaInitials(areaLabel: string): string {
  const words = areaLabel.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'TF';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function SocialPostCard({
  post,
  areaLabel,
  userId,
  returnHref,
  hidePermalink = false,
}: SocialPostCardProps) {
  const kind = classifySocialPostKind(post.body);
  const kindLabel = kind === 'question' ? 'Question' : 'Discussion';

  return (
    <article
      className={`card social-post-card is-${kind}`}
      data-testid={`social-post-card-${post.id}`}
      data-post-kind={kind}
    >
      <header className="social-post-header">
        <div className="social-post-author-row">
          <span className={`social-avatar-sm is-${kind}`} aria-hidden="true">
            {kind === 'question' ? '?' : areaInitials(areaLabel)}
          </span>
          <div className="social-post-author-meta">
            <strong className="social-post-author-label">
              {kind === 'question' ? 'Local Neighbour Question' : 'Neighbourhood Update'}
            </strong>
            <div className="social-post-submeta">
              <span className="pill">{areaLabel}</span>
              <span className={`social-kind-badge is-${kind}`}>
                {kind === 'question' ? '? ' : ''}
                {kindLabel}
              </span>
              <time className="muted-note social-post-time" dateTime={post.created_at}>
                · {readablePostDate(post.created_at)}
              </time>
            </div>
          </div>
        </div>
      </header>

      <p className="social-post-body">{post.body}</p>

      <div className="social-post-footer">
        <SocialDiscussion postId={post.id} userId={userId} />
        {!hidePermalink ? (
          <div className="social-post-permalink-wrap">
            <Link
              className="btn secondary social-post-permalink"
              href={buildSocialPostHref(post.id, returnHref)}
            >
              Open this discussion →
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}
