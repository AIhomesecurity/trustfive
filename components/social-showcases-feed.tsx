'use client';

import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../lib/supabase';
import {showcaseFields, type Showcase} from '../lib/completed-work';

const SHOWCASE_FILTERS: Array<{id: string; label: string; keywords: string[]}> = [
  {id: 'all', label: 'All showcases', keywords: []},
  {id: 'security', label: 'CCTV & Security', keywords: ['cctv', 'camera', 'alarm', 'poe', 'nvr', 'security', 'starlink']},
  {id: 'electrical', label: 'Electrical & Lighting', keywords: ['electric', 'rcbo', 'consumer unit', 'rewire', 'socket', 'ev', 'lighting']},
  {id: 'plumbing', label: 'Plumbing & Heating', keywords: ['boiler', 'plumb', 'bath', 'radiator', 'tap', 'heating']},
  {id: 'roofing', label: 'Roofing & Exterior', keywords: ['roof', 'gutter', 'chimney', 'slate', 'driveway', 'garden', 'fence']},
  {id: 'renovation', label: 'Kitchen & Renovation', keywords: ['kitchen', 'plaster', 'tile', 'decor', 'floor', 'loft', 'carpenter']},
];

export default function SocialShowcasesFeed({userId}: {userId: string}) {
  const [projects, setProjects] = useState<Showcase[]>([]);
  const [topicFilter, setTopicFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await supabaseBrowser()
          .from('completed_work_showcases')
          .select(showcaseFields)
          .eq('status', 'published')
          .order('created_at', {ascending: false})
          .limit(24);
        if (result.error) throw result.error;
        if (active) setProjects((result.data || []) as Showcase[]);
      } catch {
        if (active) {
          setProjects([]);
          setError('Installer work showcases could not be loaded right now. Please retry.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, refresh]);

  const visibleProjects = useMemo(() => {
    const activeFilter = SHOWCASE_FILTERS.find((f) => f.id === topicFilter);
    if (!activeFilter || activeFilter.keywords.length === 0) return projects;
    return projects.filter((p) => {
      const hay = `${p.title} ${p.summary}`.toLowerCase();
      return activeFilter.keywords.some((kw) => hay.includes(kw));
    });
  }, [projects, topicFilter]);

  return (
    <section aria-labelledby="social-showcases-heading" className="list" data-testid="social-showcases-feed">
      <div className="card">
        <div className="section-heading-row" style={{marginBottom: 10}}>
          <div>
            <span className="eyebrow">Installer work showcases · LinkedIn &amp; Houzz-style trade portfolio</span>
            <h2 id="social-showcases-heading">Completed work from approved local professionals</h2>
            <p className="subtle">
              Browse real finished installations published by independently approved TrustFive businesses, save ideas
              into your private Project Ideabook, ask questions in moderated threads, and request written quotes safely
              inside the app — zero phone numbers or external links allowed.
            </p>
          </div>
          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
            <Link className="btn secondary" href="/ideabooks">
              My Project Ideabooks
            </Link>
            <Link className="btn secondary" href="/professional/business">
              Publish a work showcase
            </Link>
          </div>
        </div>

        <div className="tf-compare-filters" role="group" aria-label="Filter showcases by project type" style={{marginTop: 12, marginBottom: 0}}>
          {SHOWCASE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={topicFilter === f.id ? 'dashboard-tab active' : 'dashboard-tab'}
              aria-pressed={topicFilter === f.id}
              onClick={() => setTopicFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card" role="status">
          Loading installer showcases…
        </div>
      ) : error ? (
        <div className="card notice error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="btn secondary"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Retry showcases
          </button>
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="card">
          <h3>
            {projects.length === 0
              ? 'No published installer showcases yet'
              : 'No published showcases match this category yet'}
          </h3>
          <p className="subtle">
            Only independently approved active TrustFive professionals can publish moderated completed-work showcases
            here. Browse all showcases, check the verified directory or post a job request in the meantime.
          </p>
          <div className="social-hub-shortcuts" style={{marginTop: 14, marginBottom: 0}}>
            {topicFilter !== 'all' && (
              <button type="button" className="btn" onClick={() => setTopicFilter('all')}>
                Show all showcases
              </button>
            )}
            <Link className="btn secondary" href="/services">
              Find approved professionals
            </Link>
            <Link className="btn secondary" href="/jobs">
              Post a job request
            </Link>
          </div>
        </div>
      ) : (
        <div className="list">
          {visibleProjects.map((project) => (
            <article className="card" key={project.id}>
              <span className="pill">Approved installer showcase</span>
              <h3 style={{marginTop: 10}}>
                <Link href={'/business/' + project.application_id + '/work/' + project.id}>
                  {project.title}
                </Link>
              </h3>
              <p style={{whiteSpace: 'pre-wrap'}}>
                {project.summary.slice(0, 240)}
                {project.summary.length > 240 ? '…' : ''}
              </p>
              <div className="social-hub-shortcuts" style={{marginTop: 14, marginBottom: 0}}>
                <Link
                  className="btn secondary"
                  href={'/business/' + project.application_id + '/work/' + project.id}
                >
                  Ask a question or comment →
                </Link>
                <Link
                  className="btn secondary"
                  href={
                    '/ideabooks?addShowcase=' +
                    encodeURIComponent(project.id) +
                    '&title=' +
                    encodeURIComponent(project.title.slice(0, 120))
                  }
                >
                  Save to Ideabook
                </Link>
                <Link className="service-view-all" href={'/business/' + project.application_id}>
                  View business profile &amp; verified reviews →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
