'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../lib/supabase';
import {showcaseFields, type Showcase} from '../lib/completed-work';

export default function SocialShowcasesFeed({userId}: {userId: string}) {
  const [projects, setProjects] = useState<Showcase[]>([]);
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

  return (
    <section aria-labelledby="social-showcases-heading" className="list" data-testid="social-showcases-feed">
      <div className="card">
        <div className="section-heading-row" style={{marginBottom: 10}}>
          <div>
            <span className="eyebrow">Installer work showcases · LinkedIn-style trade portfolio</span>
            <h2 id="social-showcases-heading">Completed work from approved local professionals</h2>
            <p className="subtle">
              Browse real finished installations published by independently approved TrustFive businesses, ask questions
              in moderated threads, and request written quotes safely inside the app — zero phone numbers or external
              links allowed.
            </p>
          </div>
          <Link className="btn secondary" href="/professional/business">
            Publish a work showcase
          </Link>
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
      ) : projects.length === 0 ? (
        <div className="card">
          <h3>No published installer showcases yet</h3>
          <p className="subtle">
            Only independently approved active TrustFive professionals can publish moderated completed-work showcases
            here. Browse the verified directory or post a job request in the meantime.
          </p>
          <div className="social-hub-shortcuts" style={{marginTop: 14, marginBottom: 0}}>
            <Link className="btn" href="/services">
              Find approved professionals
            </Link>
            <Link className="btn secondary" href="/jobs">
              Post a job request
            </Link>
          </div>
        </div>
      ) : (
        <div className="list">
          {projects.map((project) => (
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
