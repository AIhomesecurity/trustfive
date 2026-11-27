'use client';

import {FormEvent, useEffect, useRef, useState} from 'react';
import {supabaseBrowser} from '../lib/supabase';
import {findSocialArea, type SocialArea} from '../lib/social-discovery';
import {classifySocialWriteError} from '../lib/social-safety';
import {
  tallyPollVotes,
  validatePollDraft,
  type SocialPoll,
  type SocialPollVote,
} from '../lib/social-superapp';

export default function SocialPollsPanel({
  userId,
  areas,
}: {
  userId: string;
  areas: SocialArea[];
}) {
  const [polls, setPolls] = useState<SocialPoll[]>([]);
  const [votesByPoll, setVotesByPoll] = useState<Record<string, SocialPollVote[]>>({});
  const [openComposer, setOpenComposer] = useState(false);
  const [areaId, setAreaId] = useState('');
  const [question, setQuestion] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const s = supabaseBrowser();
        const pRes = await s
          .from('social_polls')
          .select('id,author_id,area_id,question,options,status,created_at')
          .order('created_at', {ascending: false})
          .limit(12);
        if (pRes.error) throw pRes.error;
        const rows = ((pRes.data || []) as Array<Omit<SocialPoll, 'options'> & {options: unknown}>).map((r) => ({
          ...r,
          options: Array.isArray(r.options) ? r.options.map((x) => String(x)) : [],
        }));
        if (!active) return;
        setPolls(rows);
        if (rows.length > 0) {
          const vRes = await s
            .from('social_poll_votes')
            .select('poll_id,voter_id,option_index')
            .in(
              'poll_id',
              rows.map((r) => r.id)
            )
            .limit(500);
          if (!vRes.error && active) {
            const grouped: Record<string, SocialPollVote[]> = {};
            for (const v of (vRes.data || []) as SocialPollVote[]) {
              if (!grouped[v.poll_id]) grouped[v.poll_id] = [];
              grouped[v.poll_id].push(v);
            }
            setVotesByPoll(grouped);
          }
        } else {
          setVotesByPoll({});
        }
      } catch {
        if (active) setPolls([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, refresh]);

  async function createPoll(e: FormEvent) {
    e.preventDefault();
    if (!userId || inFlight.current) return;
    const opts = [optA, optB, optC].map((x) => x.trim()).filter(Boolean);
    const err = validatePollDraft({areaId, question, options: opts});
    if (err) {
      setNoticeIsError(true);
      setNotice(err);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setNotice('');
    setNoticeIsError(false);
    try {
      const res = await supabaseBrowser().from('social_polls').insert({
        author_id: userId,
        area_id: areaId,
        question: question.trim(),
        options: opts,
        status: 'open',
      });
      if (res.error) throw res.error;
      setQuestion('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOpenComposer(false);
      setNoticeIsError(false);
      setNotice('Community poll published!');
      setRefresh((n) => n + 1);
    } catch (caught) {
      setNoticeIsError(true);
      setNotice(classifySocialWriteError(caught, 'Could not publish poll. Please try again.'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function vote(poll: SocialPoll, optionIndex: number) {
    if (!userId || poll.status !== 'open' || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice('');
    try {
      const res = await supabaseBrowser()
        .from('social_poll_votes')
        .upsert({poll_id: poll.id, voter_id: userId, option_index: optionIndex}, {onConflict: 'poll_id,voter_id'});
      if (res.error) throw res.error;
      setRefresh((n) => n + 1);
    } catch {
      setNoticeIsError(true);
      setNotice('Could not record your vote right now. Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{margin: '18px 0'}} aria-labelledby="social-polls-heading" data-testid="social-polls-panel">
      <div className="section-heading-row" style={{marginBottom: 10}}>
        <div>
          <span className="eyebrow">Live Neighbourhood &amp; Trade Polls</span>
          <h2 id="social-polls-heading" className="social-card-title" style={{marginBottom: 4}}>
            Quick local polls
          </h2>
          <p className="muted-note" style={{margin: 0}}>
            Ask neighbours or local trades to vote on home-improvement choices, seasonal priorities or street topics.
          </p>
        </div>
        <button
          type="button"
          className="btn secondary"
          aria-expanded={openComposer}
          onClick={() => setOpenComposer((v) => !v)}
        >
          {openComposer ? 'Close poll form' : '+ Create a poll'}
        </button>
      </div>

      {openComposer && (
        <form className="form" onSubmit={createPoll} style={{marginBottom: 16, paddingTop: 10, borderTop: '1px solid var(--border)'}}>
          <label htmlFor="poll-area">
            Neighbourhood
            <select id="poll-area" required value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Choose neighbourhood</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.area_name}, {a.city}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="poll-question">
            Poll question (no phones, links or full postcodes)
            <input
              id="poll-question"
              required
              minLength={10}
              maxLength={220}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which security upgrade gives the biggest peace of mind?"
            />
          </label>
          <div className="form-grid">
            <label htmlFor="poll-opt-1">
              Option 1
              <input id="poll-opt-1" required maxLength={80} value={optA} onChange={(e) => setOptA(e.target.value)} placeholder="e.g. 4K PoE CCTV cameras" />
            </label>
            <label htmlFor="poll-opt-2">
              Option 2
              <input id="poll-opt-2" required maxLength={80} value={optB} onChange={(e) => setOptB(e.target.value)} placeholder="e.g. Wireless smart alarm" />
            </label>
          </div>
          <label htmlFor="poll-opt-3">
            Option 3 (optional)
            <input id="poll-opt-3" maxLength={80} value={optC} onChange={(e) => setOptC(e.target.value)} placeholder="e.g. Security floodlights & locks" />
          </label>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Publishing…' : 'Publish poll'}
          </button>
        </form>
      )}

      {notice && (
        <p className={noticeIsError ? 'notice error' : 'notice'} role={noticeIsError ? 'alert' : 'status'}>
          {notice}
        </p>
      )}

      {loading ? (
        <p className="muted-note" style={{margin: 0}}>Loading community polls…</p>
      ) : polls.length === 0 ? (
        <p className="muted-note" style={{margin: 0}}>
          No live polls yet — tap <strong>+ Create a poll</strong> above to start the first neighbourhood vote.
        </p>
      ) : (
        <div className="list" style={{gap: 12}}>
          {polls.map((poll) => {
            const area = findSocialArea(areas, poll.area_id);
            const tally = tallyPollVotes(poll.options, votesByPoll[poll.id] ?? [], userId);
            return (
              <article key={poll.id} className="social-poll-card">
                <div style={{display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap'}}>
                  <span className="pill">{area ? `${area.area_name}, ${area.city}` : 'Local area'}</span>
                  <span className="muted-note" style={{fontSize: 12.5}}>
                    {tally.totalVotes} {tally.totalVotes === 1 ? 'vote' : 'votes'} · {poll.status}
                  </span>
                </div>
                <h3 style={{margin: '8px 0 10px', fontSize: 16}}>{poll.question}</h3>
                <div className="list" style={{gap: 8}}>
                  {tally.breakdown.map((opt) => {
                    const selected = tally.userVoteIndex === opt.index;
                    return (
                      <button
                        key={opt.index}
                        type="button"
                        disabled={busy || poll.status !== 'open'}
                        className={selected ? 'social-poll-option is-selected' : 'social-poll-option'}
                        onClick={() => void vote(poll, opt.index)}
                      >
                        <span className="social-poll-bar" style={{width: `${opt.percent}%`}} aria-hidden="true" />
                        <span className="social-poll-option-label">
                          {selected ? '✓ ' : ''}
                          {opt.label}
                        </span>
                        <strong className="social-poll-option-pct">{opt.percent}%</strong>
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
