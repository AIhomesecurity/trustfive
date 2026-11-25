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
      <div className="social-post-meta">
        <div className="social-post-badges">
          <span className="pill">{areaLabel}</span>
          <span className={`social-kind-badge is-${kind}`}>
            {kind === 'question' ? '? ' : ''}
            {kindLabel}
          </span>
        </div>
        <time className="muted-note social-post-time" dateTime={post.created_at}>
          {readablePostDate(post.created_at)}
        </time>
      </div>

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
