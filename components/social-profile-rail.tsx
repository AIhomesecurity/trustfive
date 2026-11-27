'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../lib/supabase';

type ProfileSummary = {
  fullName: string;
  role: 'professional' | 'customer';
  ideabookCount: number;
  jobCount: number;
  bookingReviewCount: number;
  applicationCount: number;
  quoteCount: number;
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function SocialProfileRail({
  userId,
  activeAreaLabel,
}: {
  userId: string;
  activeAreaLabel: string;
}) {
  const [summary, setSummary] = useState<ProfileSummary>({
    fullName: 'TrustFive Member',
    role: 'customer',
    ideabookCount: 0,
    jobCount: 0,
    bookingReviewCount: 0,
    applicationCount: 0,
    quoteCount: 0,
  });

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      try {
        const s = supabaseBrowser();
        const profileResult = await s.from('profiles').select('full_name,requested_role').eq('id', userId).maybeSingle();
        const prof = !profileResult.error
          ? (profileResult.data as {full_name?: string | null; requested_role?: string} | null)
          : null;
        const role = prof?.requested_role === 'professional' ? 'professional' : 'customer';
        const safeCount = async (query: PromiseLike<{count: number | null; error: unknown}>) => {
          try {
            const result = await query;
            return result.error ? 0 : result.count ?? 0;
          } catch {
            return 0;
          }
        };
        const [books, primaryCount, quotes, reviewCount] = await Promise.all([
          role === 'customer'
            ? safeCount(s.from('homeowner_ideabooks').select('id', {count: 'exact', head: true}).eq('owner_id', userId))
            : Promise.resolve(0),
          role === 'customer'
            ? safeCount(s.from('jobs').select('id', {count: 'exact', head: true}).eq('customer_id', userId))
            : safeCount(s.from('professional_applications').select('id', {count: 'exact', head: true}).eq('user_id', userId)),
          role === 'professional'
            ? safeCount(s.from('job_quotes').select('id', {count: 'exact', head: true}).eq('professional_id', userId))
            : Promise.resolve(0),
          safeCount(s.from('booking_reviews').select('id', {count: 'exact', head: true}).eq(role === 'professional' ? 'professional_id' : 'author_id', userId)),
        ]);
        if (!active) return;
        setSummary({
          fullName: prof?.full_name?.trim() || 'TrustFive Member',
          role,
          ideabookCount: role === 'customer' ? books : 0,
          jobCount: role === 'customer' ? primaryCount : 0,
          bookingReviewCount: reviewCount,
          applicationCount: role === 'professional' ? primaryCount : 0,
          quoteCount: role === 'professional' ? quotes : 0,
        });
      } catch {
        // Keep clean default member profile if optional counts fail.
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const initials = initialsFrom(summary.fullName);

  return (
    <aside className="social-rail social-rail-left" aria-label="Your TrustFive Social profile">
      <div className="card social-profile-card" data-testid="social-profile-rail">
        <div className="social-profile-cover" aria-hidden="true" />
        <div className="social-profile-identity">
          <div className="social-avatar-lg" aria-hidden="true">
            {initials}
          </div>
          <h2 className="social-profile-name">{summary.fullName}</h2>
          <span className="social-profile-mode">{summary.role === 'professional' ? 'Your trade workspace' : 'Your homeowner profile'}</span>
          <span className="pill">
            {summary.role === 'professional' ? 'Trade Professional' : 'Homeowner & Neighbour'}
          </span>
          <p className="muted-note" style={{margin: '6px 0 0', fontSize: 12.5}}>
            Area: <strong>{activeAreaLabel}</strong>
          </p>
        </div>

        <dl className="social-profile-stats">
          {summary.role === 'customer' ? (
            <>
              <div><dt><Link href="/jobs">Jobs posted</Link></dt><dd>{summary.jobCount}</dd></div>
              <div><dt><Link href="/bookings">Verified reviews given</Link></dt><dd>{summary.bookingReviewCount}</dd></div>
              <div><dt><Link href="/ideabooks">Project Ideabooks</Link></dt><dd>{summary.ideabookCount}</dd></div>
            </>
          ) : (
            <>
              <div><dt><Link href="/professional/business">Applications</Link></dt><dd>{summary.applicationCount}</dd></div>
              <div><dt><Link href="/quotes">Quotes sent</Link></dt><dd>{summary.quoteCount}</dd></div>
              <div><dt><Link href="/professional/business">Verified reviews received</Link></dt><dd>{summary.bookingReviewCount}</dd></div>
            </>
          )}
          <div>
            <dt>
              <Link href="/community/social?tab=saved">Saved discussions</Link>
            </dt>
            <dd>→</dd>
          </div>
        </dl>

        <nav className="social-rail-links" aria-label={summary.role === 'professional' ? 'Trade workspace shortcuts' : 'Homeowner shortcuts'}>
          {summary.role === 'customer' ? (
            <>
              <Link href="/services"><span aria-hidden="true">🔎</span> Find approved professionals</Link>
              <Link href="/jobs"><span aria-hidden="true">📝</span> Post or manage a job</Link>
              <Link href="/bookings"><span aria-hidden="true">⭐</span> Bookings &amp; reviews</Link>
              <Link href="/ideabooks"><span aria-hidden="true">📌</span> Project Ideabooks</Link>
              <Link href="/community/social?tab=exchange"><span aria-hidden="true">🧰</span> Local For Sale &amp; Free</Link>
              <Link href="/community/events"><span aria-hidden="true">📅</span> Local events</Link>
            </>
          ) : (
            <>
              <Link href="/professional/business"><span aria-hidden="true">🏢</span> Business profile &amp; status</Link>
              <Link href="/quotes"><span aria-hidden="true">💬</span> Quote requests</Link>
              <Link href="/bookings"><span aria-hidden="true">📅</span> Bookings &amp; availability</Link>
              <Link href="/community/social?tab=showcases"><span aria-hidden="true">🛠️</span> Work showcases</Link>
              <Link href="/community/social?tab=trade"><span aria-hidden="true">🤝</span> Trade Network &amp; Referrals</Link>
              <Link href="/community/social?tab=network"><span aria-hidden="true">👤</span> People &amp; Skills</Link>
              <Link href="/cost-guides"><span aria-hidden="true">💷</span> UK Cost Guides</Link>
            </>
          )}
          <Link href="/community/social?tab=saved"><span aria-hidden="true">🔖</span> Saved discussions</Link>
        </nav>
      </div>
    </aside>
  );
}
