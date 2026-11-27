'use client';

import {FormEvent, useEffect, useMemo, useRef, useState} from 'react';
import {supabaseBrowser} from '../lib/supabase';
import {findSocialArea, type SocialArea} from '../lib/social-discovery';
import {assessSocialPostSafety, classifySocialWriteError} from '../lib/social-safety';
import {
  calculateProfileCompleteness,
  SUGGESTED_TRADE_SKILLS,
  type SocialConnection,
  type SocialMemberProfile,
  type SocialSkillEndorsement,
} from '../lib/social-superapp';

export default function SocialMemberNetwork({
  userId,
  areas,
}: {
  userId: string;
  areas: SocialArea[];
}) {
  const [profiles, setProfiles] = useState<SocialMemberProfile[]>([]);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [endorsements, setEndorsements] = useState<SocialSkillEndorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  // Own profile editor state
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [areaId, setAreaId] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [offersSummary, setOffersSummary] = useState('');
  const [lookingForSummary, setLookingForSummary] = useState('');
  const [openToWork, setOpenToWork] = useState(false);
  const [openToReferrals, setOpenToReferrals] = useState(true);
  const [connectNoteByUser, setConnectNoteByUser] = useState<Record<string, string>>({});

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
        const [pRes, cRes, eRes, baseProf] = await Promise.all([
          s
            .from('social_member_profiles')
            .select(
              'user_id,display_name,headline,about,area_id,skills,offers_summary,looking_for_summary,open_to_work,open_to_referrals,updated_at'
            )
            .order('updated_at', {ascending: false})
            .limit(40),
          s
            .from('social_connections')
            .select('id,requester_id,addressee_id,intro_note,status,created_at')
            .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
            .order('created_at', {ascending: false})
            .limit(100),
          s
            .from('social_skill_endorsements')
            .select('id,member_id,endorser_id,skill,created_at')
            .limit(300),
          s.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
        ]);
        if (!active) return;
        const loadedProfiles = !pRes.error ? ((pRes.data || []) as SocialMemberProfile[]) : [];
        setProfiles(loadedProfiles);
        setConnections(!cRes.error ? ((cRes.data || []) as SocialConnection[]) : []);
        setEndorsements(!eRes.error ? ((eRes.data || []) as SocialSkillEndorsement[]) : []);

        const own = loadedProfiles.find((p) => p.user_id === userId);
        if (own) {
          setDisplayName(own.display_name);
          setHeadline(own.headline);
          setAbout(own.about);
          setAreaId(own.area_id ?? '');
          setSkills(Array.isArray(own.skills) ? own.skills : []);
          setOffersSummary(own.offers_summary);
          setLookingForSummary(own.looking_for_summary);
          setOpenToWork(own.open_to_work);
          setOpenToReferrals(own.open_to_referrals);
        } else if (!baseProf.error && baseProf.data?.full_name) {
          setDisplayName((prev) => prev || String(baseProf.data?.full_name ?? ''));
        }
      } catch {
        // Handled cleanly via empty state.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, refresh]);

  const completeness = useMemo(
    () =>
      calculateProfileCompleteness({
        display_name: displayName,
        headline,
        about,
        skills,
        offers_summary: offersSummary,
        looking_for_summary: lookingForSummary,
      }),
    [displayName, headline, about, skills, offersSummary, lookingForSummary]
  );

  function toggleSkill(skill: string) {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : prev.length < 12 ? [...prev, skill] : prev
    );
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!userId || inFlight.current) return;
    if (displayName.trim().length < 2) {
      setNoticeIsError(true);
      setNotice('Enter a display name of at least 2 characters.');
      return;
    }
    const combined = `${displayName} ${headline} ${about} ${offersSummary} ${lookingForSummary}`;
    const safety = assessSocialPostSafety(combined);
    if (safety.blockingError) {
      setNoticeIsError(true);
      setNotice(safety.blockingError);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setNotice('');
    setNoticeIsError(false);
    try {
      const res = await supabaseBrowser().from('social_member_profiles').upsert(
        {
          user_id: userId,
          display_name: displayName.trim(),
          headline: headline.trim(),
          about: about.trim(),
          area_id: areaId || null,
          skills,
          offers_summary: offersSummary.trim(),
          looking_for_summary: lookingForSummary.trim(),
          open_to_work: openToWork,
          open_to_referrals: openToReferrals,
          updated_at: new Date().toISOString(),
        },
        {onConflict: 'user_id'}
      );
      if (res.error) throw res.error;
      setNoticeIsError(false);
      setNotice('Your LinkedIn & Xing-style TrustFive profile is saved!');
      setRefresh((n) => n + 1);
    } catch (caught) {
      setNoticeIsError(true);
      setNotice(classifySocialWriteError(caught, 'Could not save profile. Remove any phone numbers, links or postcodes.'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function sendConnection(targetUserId: string) {
    if (!userId || targetUserId === userId || inFlight.current) return;
    const note = (connectNoteByUser[targetUserId] ?? '').trim();
    if (note) {
      const safety = assessSocialPostSafety(note);
      if (safety.blockingError) {
        setNoticeIsError(true);
        setNotice(safety.blockingError);
        return;
      }
    }
    inFlight.current = true;
    setBusy(true);
    setNotice('');
    try {
      const res = await supabaseBrowser().from('social_connections').insert({
        requester_id: userId,
        addressee_id: targetUserId,
        intro_note: note,
        status: 'pending',
      });
      if (res.error) throw res.error;
      setConnectNoteByUser((prev) => ({...prev, [targetUserId]: ''}));
      setNoticeIsError(false);
      setNotice('Connection request sent!');
      setRefresh((n) => n + 1);
    } catch (caught) {
      setNoticeIsError(true);
      setNotice(classifySocialWriteError(caught, 'Could not send connection request right now.'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function respondConnection(connId: string, status: 'accepted' | 'declined') {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await supabaseBrowser()
        .from('social_connections')
        .update({status, updated_at: new Date().toISOString()})
        .eq('id', connId)
        .eq('addressee_id', userId);
      if (res.error) throw res.error;
      setNoticeIsError(false);
      setNotice(status === 'accepted' ? 'Connection accepted!' : 'Connection request declined.');
      setRefresh((n) => n + 1);
    } catch {
      setNoticeIsError(true);
      setNotice('Could not update connection request.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function endorseSkill(targetUserId: string, skill: string) {
    if (!userId || targetUserId === userId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await supabaseBrowser().from('social_skill_endorsements').insert({
        member_id: targetUserId,
        endorser_id: userId,
        skill,
      });
      if (res.error) throw res.error;
      setNoticeIsError(false);
      setNotice(`Endorsed “${skill}”!`);
      setRefresh((n) => n + 1);
    } catch {
      setNoticeIsError(true);
      setNotice('You have already endorsed this skill or endorsement could not be saved.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const incomingPending = connections.filter((c) => c.addressee_id === userId && c.status === 'pending');
  const otherMembers = profiles.filter((p) => p.user_id !== userId);

  return (
    <section className="list" aria-labelledby="member-network-heading" data-testid="social-member-network">
      <div className="card">
        <span className="eyebrow">LinkedIn × Xing Dual-Mode Profile</span>
        <h2 id="member-network-heading" className="social-card-title">
          Your TrustFive Profile, Skills &amp; Haves / Wants
        </h2>
        <p className="subtle" style={{marginTop: 0}}>
          Build a rich local member or tradesperson profile with your headline, trade skills, what you offer and what
          you&apos;re looking for — strictly zero phone numbers, websites or off-platform links.
        </p>

        <div className="tf-savings-summary" style={{marginBottom: 16}} data-testid="profile-completeness-meter">
          <div className="tf-savings-metric" style={{borderBottom: 'none'}}>
            <span>Profile completeness</span>
            <strong>{completeness.percent}%</strong>
          </div>
          <div aria-hidden="true" style={{height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden'}}>
            <div style={{width: `${completeness.percent}%`, height: '100%', background: 'var(--green)'}} />
          </div>
          {completeness.missing.length > 0 && (
            <p className="muted-note" style={{margin: '8px 0 0', fontSize: 12.5}}>
              Add to reach 100%: {completeness.missing.join(', ')}.
            </p>
          )}
        </div>

        <form className="form" onSubmit={saveProfile}>
          <div className="form-grid">
            <label htmlFor="sp-display-name">
              Display name
              <input
                id="sp-display-name"
                required
                minLength={2}
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Gary Pearce · ADI Communications"
              />
            </label>
            <label htmlFor="sp-area">
              Primary neighbourhood
              <select id="sp-area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">Choose neighbourhood</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.area_name}, {a.city}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label htmlFor="sp-headline">
            Headline (LinkedIn style)
            <input
              id="sp-headline"
              maxLength={140}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Lead CCTV, Starlink & Network Installer · 25+ Years UK Experience"
            />
          </label>

          <label htmlFor="sp-about">
            About / Experience bio
            <textarea
              id="sp-about"
              maxLength={1200}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Share your background, areas covered and practical expertise (no phone numbers or websites)."
            />
          </label>

          <div>
            <span className="muted-note" style={{display: 'block', marginBottom: 8, fontWeight: 700, color: 'var(--dark)'}}>
              Skills &amp; specialities (tap to select up to 12)
            </span>
            <div className="social-topic-pills">
              {SUGGESTED_TRADE_SKILLS.map((sk) => {
                const active = skills.includes(sk);
                return (
                  <button
                    key={sk}
                    type="button"
                    aria-pressed={active}
                    className={active ? 'dashboard-tab active' : 'dashboard-tab'}
                    onClick={() => toggleSkill(sk)}
                  >
                    {active ? '✓ ' : '+ '}
                    {sk}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-grid">
            <label htmlFor="sp-offers">
              I offer (Xing “Haves”)
              <input
                id="sp-offers"
                maxLength={400}
                value={offersSummary}
                onChange={(e) => setOffersSummary(e.target.value)}
                placeholder="e.g. 4K PoE CCTV, Starlink dish mounting, tidy Cat6 cabling"
              />
            </label>
            <label htmlFor="sp-looking-for">
              I&apos;m looking for (Xing “Wants”)
              <input
                id="sp-looking-for"
                maxLength={400}
                value={lookingForSummary}
                onChange={(e) => setLookingForSummary(e.target.value)}
                placeholder="e.g. Reliable local electricians & roofers for job swaps"
              />
            </label>
          </div>

          <div style={{display: 'flex', gap: 18, flexWrap: 'wrap'}}>
            <label style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0}}>
              <input
                type="checkbox"
                checked={openToWork}
                onChange={(e) => setOpenToWork(e.target.checked)}
                style={{width: 18, height: 18}}
              />
              Open to work / taking bookings
            </label>
            <label style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0}}>
              <input
                type="checkbox"
                checked={openToReferrals}
                onChange={(e) => setOpenToReferrals(e.target.checked)}
                style={{width: 18, height: 18}}
              />
              Open to trade-to-trade referrals
            </label>
          </div>

          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Saving profile…' : 'Save TrustFive Social profile'}
          </button>
        </form>

        {notice && (
          <p className={noticeIsError ? 'notice error' : 'notice'} role={noticeIsError ? 'alert' : 'status'}>
            {notice}
          </p>
        )}
      </div>

      {incomingPending.length > 0 && (
        <div className="card">
          <h3 style={{marginTop: 0}}>Incoming connection requests ({incomingPending.length})</h3>
          <div className="list">
            {incomingPending.map((req) => {
              const requester = profiles.find((p) => p.user_id === req.requester_id);
              return (
                <div key={req.id} className="social-reminder-row">
                  <div>
                    <strong>{requester?.display_name ?? 'TrustFive member'}</strong>
                    {req.intro_note && <p className="muted-note" style={{margin: '4px 0 0'}}>{req.intro_note}</p>}
                  </div>
                  <div style={{display: 'flex', gap: 8}}>
                    <button type="button" className="btn" disabled={busy} onClick={() => void respondConnection(req.id, 'accepted')}>
                      Accept
                    </button>
                    <button type="button" className="btn secondary" disabled={busy} onClick={() => void respondConnection(req.id, 'declined')}>
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <span className="eyebrow">People &amp; Local Trades Network</span>
        <h3 style={{marginTop: 4}}>Connect &amp; endorse skills ({otherMembers.length})</h3>
        <p className="muted-note" style={{marginTop: 0}}>
          Peer skill endorsements reflect neighbour and trade feedback — they never grant an approved five-slot
          marketplace badge or affect ranking.
        </p>

        {loading ? (
          <p className="muted-note">Loading local member profiles…</p>
        ) : otherMembers.length === 0 ? (
          <p className="muted-note" style={{marginBottom: 0}}>
            No other member profiles published yet. Save your profile above so neighbours and local trades can connect
            with you as members join!
          </p>
        ) : (
          <div className="list">
            {otherMembers.map((member) => {
              const area = member.area_id ? findSocialArea(areas, member.area_id) : null;
              const existingConn = connections.find(
                (c) =>
                  (c.requester_id === userId && c.addressee_id === member.user_id) ||
                  (c.addressee_id === userId && c.requester_id === member.user_id)
              );
              return (
                <article key={member.user_id} className="card">
                  <div style={{display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap'}}>
                    <strong>{member.display_name}</strong>
                    <div style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
                      {member.open_to_work && <span className="pill">Open to work</span>}
                      {member.open_to_referrals && <span className="pill">Open to referrals</span>}
                      {area && <span className="pill">{area.area_name}</span>}
                    </div>
                  </div>
                  {member.headline && <p style={{margin: '6px 0', fontWeight: 600}}>{member.headline}</p>}
                  {member.offers_summary && (
                    <p className="muted-note" style={{margin: '4px 0'}}>
                      <strong>Offers:</strong> {member.offers_summary}
                    </p>
                  )}
                  {member.looking_for_summary && (
                    <p className="muted-note" style={{margin: '4px 0'}}>
                      <strong>Looking for:</strong> {member.looking_for_summary}
                    </p>
                  )}
                  {member.skills.length > 0 && (
                    <div className="social-topic-pills" style={{marginTop: 10}}>
                      {member.skills.map((sk) => {
                        const count = endorsements.filter(
                          (e) => e.member_id === member.user_id && e.skill === sk
                        ).length;
                        const endorsedByMe = endorsements.some(
                          (e) => e.member_id === member.user_id && e.skill === sk && e.endorser_id === userId
                        );
                        return (
                          <button
                            key={sk}
                            type="button"
                            className="tf-chip-btn"
                            disabled={busy || endorsedByMe}
                            onClick={() => void endorseSkill(member.user_id, sk)}
                          >
                            {endorsedByMe ? '✓ ' : '+ '}
                            {sk} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div style={{marginTop: 12}}>
                    {existingConn ? (
                      <span className="pill">Connection: {existingConn.status}</span>
                    ) : (
                      <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                        <input
                          type="text"
                          maxLength={200}
                          value={connectNoteByUser[member.user_id] ?? ''}
                          onChange={(e) =>
                            setConnectNoteByUser((prev) => ({...prev, [member.user_id]: e.target.value}))
                          }
                          placeholder="Add a personal intro note (optional, no phones/links)"
                          style={{flex: '1 1 220px'}}
                        />
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={busy}
                          onClick={() => void sendConnection(member.user_id)}
                        >
                          Connect
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
