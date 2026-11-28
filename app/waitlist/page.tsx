'use client';

import Link from 'next/link';
import {useEffect, useMemo, useState} from 'react';
import {supabaseBrowser} from '../../lib/supabase';

type Trade = {id: string; name: string};
type Applicant = {
  application_id: string;
  display_name: string;
  summary: string | null;
  trade_id: string;
  trade_name: string;
  trade_slug: string;
  area_id: string;
  area_name: string;
  city: string;
  status_label: string;
  experience_years: number | null;
  average_stars: number | string;
  review_count: number;
};

export default function WaitlistDirectoryPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeId, setTradeId] = useState('');
  const [areaQuery, setAreaQuery] = useState('');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const tradeResult = await supabaseBrowser().from('trades').select('id,name').order('name');
        if (!active) return;
        if (tradeResult.error) {
          setError('Directory filters could not load. Please try again.');
          return;
        }
        setTrades((tradeResult.data || []) as Trade[]);
      } catch {
        if (active) setError('Directory filters could not load. Please try again.');
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const {data, error: queryError} = await supabaseBrowser().rpc('find_trustfive_waitlist_profiles', {
          p_trade: tradeId || null,
          p_area: null,
        });
        if (!active) return;
        if (queryError) throw queryError;
        setPeople((data || []) as Applicant[]);
      } catch {
        if (active) {
          setPeople([]);
          setError('The applicant directory is temporarily unavailable.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [tradeId, retry]);

  const visible = useMemo(() => {
    const needle = `${query} ${areaQuery}`.trim().toLocaleLowerCase();
    if (!needle) return people;
    return people.filter(person => `${person.display_name} ${person.summary || ''} ${person.trade_name} ${person.area_name} ${person.city}`.toLocaleLowerCase().includes(needle));
  }, [people, query, areaQuery]);

  return <main className="container waitlist-directory-page">
    <header className="waitlist-directory-hero">
      <span className="eyebrow">TrustFive applicant directory</span>
      <h1>Meet professionals waiting to join</h1>
      <p>These businesses have opted to introduce themselves while their application is in progress or they wait for an active place.</p>
      <div className="waitlist-directory-trust-note"><strong>Not an approved provider list.</strong> Applicant profiles cannot quote on TrustFive jobs. Use the approved directory to find professionals who are currently eligible.</div>
      <Link className="btn" href="/services">Find approved professionals →</Link>
    </header>

    <section className="waitlist-directory-panel" aria-label="Filter applicant profiles">
      <label>Search profiles<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Business, service or area" /></label>
      <label>Trade<select value={tradeId} onChange={event => setTradeId(event.target.value)}><option value="">All trades</option>{trades.map(trade => <option value={trade.id} key={trade.id}>{trade.name}</option>)}</select></label>
      <label>Area or service location<input value={areaQuery} onChange={event => setAreaQuery(event.target.value)} placeholder="e.g. Leeds or LS5" /></label>
    </section>

    {error && <div className="notice error" role="alert"><p>{error}</p><button className="btn secondary" type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    {loading ? <p className="notice" role="status">Loading opted-in profiles…</p> : !error && <p className="waitlist-directory-count" role="status">{visible.length} public applicant profile{visible.length === 1 ? '' : 's'}</p>}
    {!loading && !error && visible.length === 0 && <div className="card waitlist-directory-empty"><h2>No public profiles match yet</h2><p>Applicants choose whether to appear here. That choice never affects their application or waiting-list position.</p></div>}

    <section className="waitlist-directory-grid" aria-label="Opted-in applicant profiles">
      {visible.map(person => {
        const jobParams = new URLSearchParams({trade: person.trade_slug, area: person.area_id});
        const reviewCount = Number(person.review_count) || 0;
        return <article className="card waitlist-applicant-card" key={person.application_id}>
          <div className="waitlist-applicant-card-top"><span className="pill">Applicant · not yet approved</span><span className="waitlist-stage">{person.status_label}</span></div>
          <h2>{person.display_name}</h2>
          <p className="waitlist-applicant-trade">{person.trade_name} · {person.area_name}, {person.city}</p>
          {person.experience_years !== null && <p className="muted-note">{person.experience_years} years of experience stated in their application</p>}
          <p className="waitlist-applicant-summary">{person.summary}</p>
          <div className="waitlist-applicant-reviews">
            {reviewCount > 0 ? <><strong>{Number(person.average_stars).toFixed(1)} / 5</strong><span>{reviewCount} verified review{reviewCount === 1 ? '' : 's'} from completed TrustFive bookings</span></> : <span>No completed TrustFive booking reviews yet</span>}
          </div>
          <p className="muted-note">No phone, website or direct contact details are shown. Applicant status does not confirm TrustFive approval.</p>
          <Link className="btn secondary" href={'/jobs?' + jobParams.toString()}>Post a job for approved local professionals</Link>
        </article>;
      })}
    </section>
    <footer className="waitlist-directory-footer"><p>Tradespeople can opt in from their professional dashboard. No payment is required to apply or appear in this directory.</p><Link href="/professional/apply">Apply as a tradesperson →</Link></footer>
  </main>;
}
