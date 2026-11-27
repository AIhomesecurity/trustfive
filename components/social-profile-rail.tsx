'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../lib/supabase';

type ProfileSummary = {
  fullName: string;
  role: 'professional' | 'customer';
  ideabookCount: number;
  jobCount: number;
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
  });

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      try {
        const s = supabaseBrowser();
        const settled = await Promise.allSettled([
          s.from('profiles').select('full_name,requested_role').eq('id', userId).maybeSingle(),
          s.from('homeowner_ideabooks').select('id').eq('owner_id', userId).limit(50),
          s.from('jobs').select('id').eq('customer_id', userId).limit(50),
        ]);
        if (!active) return;
        const prof =
          settled[0].status === 'fulfilled' && !settled[0].value.error
            ? (settled[0].value.data as {full_name?: string | null; requested_role?: string} | null)
            : null;
        const books =
          settled[1].status === 'fulfilled' && !settled[1].value.error && Array.isArray(settled[1].value.data)
            ? settled[1].value.data.length
            : 0;
        const jobs =
          settled[2].status === 'fulfilled' && !settled[2].value.error && Array.isArray(settled[2].value.data)
            ? settled[2].value.data.length
            : 0;

        setSummary({
          fullName: prof?.full_name?.trim() || 'TrustFive Member',
          role: prof?.requested_role === 'professional' ? 'professional' : 'customer',
          ideabookCount: books,
          jobCount: jobs,
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
          <span className="pill">
            {summary.role === 'professional' ? 'Trade Professional' : 'Homeowner & Neighbour'}
          </span>
          <p className="muted-note" style={{margin: '6px 0 0', fontSize: 12.5}}>
            Area: <strong>{activeAreaLabel}</strong>
          </p>
        </div>

        <dl className="social-profile-stats">
          <div>
            <dt>
              <Link href="/ideabooks">Project Ideabooks</Link>
            </dt>
            <dd>{summary.ideabookCount}</dd>
          </div>
          <div>
            <dt>
              <Link href="/jobs">My jobs</Link>
            </dt>
            <dd>{summary.jobCount}</dd>
          </div>
          <div>
            <dt>
              <Link href="/community/social?tab=saved">Saved discussions</Link>
            </dt>
            <dd>→</dd>
          </div>
        </dl>

        <nav className="social-rail-links" aria-label="Workspace shortcuts">
          <Link href="/community/social?tab=network">
            <span aria-hidden="true">👤</span> People, Profile &amp; Skills
          </Link>
          <Link href="/community/social?tab=exchange">
            <span aria-hidden="true">🧰</span> Local For Sale &amp; Free
          </Link>
          <Link href="/community/social?tab=showcases">
            <span aria-hidden="true">🛠️</span> Installer Showcases
          </Link>
          <Link href="/community/social?tab=trade">
            <span aria-hidden="true">🤝</span> Trade Network &amp; Referrals
          </Link>
          <Link href="/ideabooks">
            <span aria-hidden="true">📌</span> Project Ideabooks
          </Link>
          <Link href="/cost-guides">
            <span aria-hidden="true">💷</span> UK Cost Guides
          </Link>
          <Link href="/services">
            <span aria-hidden="true">🔎</span> Find Approved Pros
          </Link>
        </nav>
      </div>
    </aside>
  );
}
