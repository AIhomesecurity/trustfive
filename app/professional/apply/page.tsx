'use client';
import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';
import {
  deriveProfessionalOnboardingStage,
  validateProfessionalProfileInput,
  validateVerificationSubmissionInput,
  type ProfessionalOnboardingItem,
} from '../../../lib/professional-onboarding';
import PlatformComparison from '../../../components/platform-comparison';
import VettingCharter from '../../../components/vetting-charter';
import WaitlistDirectoryEditor, {type WaitlistPublicProfile} from '../../../components/waitlist-directory-editor';

type Trade = {id: string; name: string};
type Area = {id: string; area_name: string; city: string};
type VerificationRecord = {
  application_id: string;
  insurance_provider: string;
  insurance_policy_ref: string;
  insurance_expires_on: string;
  trade_body: string | null;
  registration_number: string | null;
  qualification_summary: string;
  verification_status: string;
  reviewer_note: string | null;
  updated_at: string;
};

export default function Apply() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [items, setItems] = useState<ProfessionalOnboardingItem[]>([]);
  const [verifications, setVerifications] = useState<Record<string, VerificationRecord>>({});
  const [waitlistProfiles, setWaitlistProfiles] = useState<Record<string, WaitlistPublicProfile>>({});
  const [trade, setTrade] = useState('');
  const [area, setArea] = useState('');
  const [business, setBusiness] = useState('');
  const [about, setAbout] = useState('');
  const [years, setYears] = useState('0');
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Permitted profile edit drawer state
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editBusiness, setEditBusiness] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [editYears, setEditYears] = useState('0');

  // Private verification submission drawer state
  const [verifyingAppId, setVerifyingAppId] = useState<string | null>(null);
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyRef, setInsurancePolicyRef] = useState('');
  const [insuranceExpiresOn, setInsuranceExpiresOn] = useState('');
  const [tradeBody, setTradeBody] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [qualificationSummary, setQualificationSummary] = useState('');

  async function refresh() {
    const s = supabaseBrowser();
    const [overview, ver, publicProfiles] = await Promise.all([
      s.rpc('my_professional_onboarding_status'),
      s
        .from('professional_verification_submissions')
        .select(
          'application_id,insurance_provider,insurance_policy_ref,insurance_expires_on,trade_body,registration_number,qualification_summary,verification_status,reviewer_note,updated_at'
        ),
      s.rpc('my_waitlist_public_profiles'),
    ]);
    if (overview.error) throw overview.error;
    if (ver.error) throw ver.error;
    if (publicProfiles.error) throw publicProfiles.error;
    setItems((overview.data || []) as ProfessionalOnboardingItem[]);
    const byApp: Record<string, VerificationRecord> = {};
    for (const row of (ver.data || []) as VerificationRecord[]) {
      byApp[row.application_id] = row;
    }
    setVerifications(byApp);
    const byApplication: Record<string, WaitlistPublicProfile> = {};
    for (const row of (publicProfiles.data || []) as WaitlistPublicProfile[]) byApplication[row.application_id] = row;
    setWaitlistProfiles(byApplication);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = supabaseBrowser();
        const [u, t, a] = await Promise.all([
          s.auth.getUser(),
          s.from('trades').select('id,name').order('name'),
          s.from('service_areas').select('id,area_name,city').order('city'),
        ]);
        if (!active) return;
        if (u.error) throw u.error;
        if (!u.data.user) {
          setMessage('Sign in to apply and track your professional verification status.');
          return;
        }
        setAuth(true);
        if (t.error) throw t.error;
        if (a.error) throw a.error;
        setTrades(t.data || []);
        setAreas(a.data || []);
        await refresh();
      } catch {
        if (active) setLoadFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const validationError = validateProfessionalProfileInput({
      businessName: business,
      about,
      experienceYears: years,
    });
    if (validationError) {
      setMessage(validationError);
      return;
    }
    if (!trade || !area) {
      setMessage('Select both a trade category and a local service area.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const s = supabaseBrowser();
      const {
        data: {user},
      } = await s.auth.getUser();
      if (!user) throw Error('Please sign in');
      const {error: roleErr} = await s
        .from('profiles')
        .update({requested_role: 'professional'})
        .eq('id', user.id);
      if (roleErr) throw roleErr;
      const {error} = await s.from('professional_applications').insert({
        user_id: user.id,
        trade_id: trade,
        area_id: area,
        business_name: business.trim(),
        about: about.trim(),
        experience_years: Number(years),
        status: 'pending',
      });
      if (error) throw error;
      await refresh();
      setMessage(
        'Application submitted as pending. Next, submit your private insurance and qualification details for independent review. You are not approved or active yet.'
      );
      setBusiness('');
      setAbout('');
      setYears('0');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Application failed');
    } finally {
      setBusy(false);
    }
  }

  function startEditProfile(item: ProfessionalOnboardingItem) {
    setVerifyingAppId(null);
    setEditingAppId(item.application_id);
    setEditBusiness(item.business_name || '');
    setEditAbout(item.about || '');
    setEditYears(String(item.experience_years ?? 0));
    setMessage('');
  }

  async function saveProfileEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingAppId || busy) return;
    const validationError = validateProfessionalProfileInput({
      businessName: editBusiness,
      about: editAbout,
      experienceYears: editYears,
    });
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const {error} = await supabaseBrowser().rpc('update_my_professional_application_profile', {
        p_application: editingAppId,
        p_business_name: editBusiness.trim(),
        p_about: editAbout.trim(),
        p_experience_years: Number(editYears),
      });
      if (error) throw error;
      await refresh();
      setEditingAppId(null);
      setMessage('Permitted business profile details updated. Approval and slot status remain independently controlled.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to update application profile');
    } finally {
      setBusy(false);
    }
  }

  function startVerification(item: ProfessionalOnboardingItem) {
    setEditingAppId(null);
    setVerifyingAppId(item.application_id);
    const existing = verifications[item.application_id];
    setInsuranceProvider(existing?.insurance_provider || '');
    setInsurancePolicyRef(existing?.insurance_policy_ref || '');
    setInsuranceExpiresOn(existing?.insurance_expires_on || '');
    setTradeBody(existing?.trade_body || '');
    setRegistrationNumber(existing?.registration_number || '');
    setQualificationSummary(existing?.qualification_summary || '');
    setMessage('');
  }

  async function saveVerification(e: FormEvent) {
    e.preventDefault();
    if (!verifyingAppId || busy) return;
    const validationError = validateVerificationSubmissionInput({
      insuranceProvider,
      insurancePolicyRef,
      insuranceExpiresOn,
      tradeBody,
      registrationNumber,
      qualificationSummary,
    });
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const {error} = await supabaseBrowser().rpc('submit_professional_verification', {
        p_application: verifyingAppId,
        p_insurance_provider: insuranceProvider.trim(),
        p_insurance_policy_ref: insurancePolicyRef.trim(),
        p_insurance_expires_on: insuranceExpiresOn.trim(),
        p_trade_body: tradeBody.trim() || null,
        p_registration_number: registrationNumber.trim() || null,
        p_qualification_summary: qualificationSummary.trim(),
      });
      if (error) throw error;
      await refresh();
      setVerifyingAppId(null);
      setMessage(
        'Private verification details saved for independent administrator review. Submitting details does not grant approval or an active place.'
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to save verification details');
    } finally {
      setBusy(false);
    }
  }

  async function answer(id: string, accept: boolean) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const {error} = await supabaseBrowser().rpc('respond_to_vacancy_offer', {
        p_offer: id,
        p_accept: accept,
      });
      if (error) throw error;
      await refresh();
      setMessage(
        accept
          ? 'You accepted the vacancy offer. Final authorised activation into one of the five slots is still required.'
          : 'You declined the vacancy offer.'
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not respond to vacancy offer');
    } finally {
      setBusy(false);
    }
  }

  const derived = items.map(item => ({item, stage: deriveProfessionalOnboardingStage(item)}));
  const activeCount = derived.filter(x => x.stage.isActiveSlot).length;
  const waitlistCount = derived.filter(x => x.stage.isWaitingList).length;
  const offerCount = derived.filter(
    x => x.stage.key === 'offer_pending' || x.stage.key === 'offer_accepted'
  ).length;

  return (
    <main className="container">
      <div className="page-heading">
        <span className="eyebrow">Professional onboarding &amp; five-place network</span>
        <h1>Professional dashboard and applications</h1>
        <p className="subtle">
          Application is free. TrustFive caps each trade category at a strict maximum of five independently
          approved active professionals per local territory. Paying for optional software never influences
          approval or waiting-list priority.
        </p>
        <p style={{display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14}}>
          <Link className="btn secondary" href="/professional/business">
            Manage business profile page
          </Link>
          <Link className="btn secondary" href="/quotes">
            Leads and quotes
          </Link>
          <Link className="btn secondary" href="/coverage">
            Request coverage in another UK postcode
          </Link>
        </p>
      </div>

      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}

      {loading ? (
        <p role="status" className="notice">
          Loading your professional onboarding status…
        </p>
      ) : loadFailed ? (
        <div role="alert" className="notice error">
          <p>Could not load your professional onboarding status.</p>
          <button type="button" className="btn secondary" onClick={() => {
            setLoadFailed(false);
            setLoading(true);
            setLoadAttempt(attempt => attempt + 1);
          }}>Retry loading onboarding</button>
        </div>
      ) : !auth ? (
        <Link className="btn" href="/account?next=%2Fprofessional%2Fapply">
          Sign in to apply
        </Link>
      ) : (
        <>
          <div className="grid" style={{marginBottom: 24}} aria-label="Professional onboarding summary">
            <div className="card">
              <h3>{items.length}</h3>
              <p>Total applications</p>
            </div>
            <div className="card">
              <h3>{activeCount}</h3>
              <p>Active five-slot places</p>
            </div>
            <div className="card">
              <h3>{waitlistCount}</h3>
              <p>Verified waiting list</p>
            </div>
            <div className="card">
              <h3>{offerCount}</h3>
              <p>Active vacancy offers</p>
            </div>
          </div>

          <div className="two-col">
            <section className="card">
              <h2>Apply for a trade &amp; service area</h2>
              <form className="form" onSubmit={submit}>
                <label>
                  Business or trading name
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={business}
                    onChange={e => setBusiness(e.target.value)}
                  />
                </label>
                <label>
                  Trade category
                  <select required value={trade} onChange={e => setTrade(e.target.value)}>
                    <option value="">Select a trade</option>
                    {trades.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Local service area
                  <select required value={area} onChange={e => setArea(e.target.value)}>
                    <option value="">Select an area</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.area_name}, {a.city}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Years of relevant experience
                  <input
                    type="number"
                    required
                    min="0"
                    max="80"
                    value={years}
                    onChange={e => setYears(e.target.value)}
                  />
                </label>
                <label>
                  Services, experience and qualifications
                  <textarea
                    required
                    minLength={30}
                    maxLength={3000}
                    value={about}
                    onChange={e => setAbout(e.target.value)}
                    placeholder="Describe your trade services, relevant experience and qualifications"
                  />
                </label>
                <p className="muted-note">
                  After submitting your application, enter your insurance and registration references
                  privately on your application card for administrator verification.
                </p>
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? 'Submitting…' : 'Submit free application'}
                </button>
              </form>
            </section>

            <section aria-labelledby="pro-applications-heading">
              <h2 id="pro-applications-heading">Verification progress &amp; waiting-list status</h2>
              <div className="list">
                {derived.length === 0 && (
                  <div className="card">
                    No applications yet. Submit your first trade application on the left to start
                    independent verification.
                  </div>
                )}
                {derived.map(({item, stage}) => {
                  const ver = verifications[item.application_id];
                  const canEdit =
                    item.application_status !== 'withdrawn' &&
                    item.application_status !== 'suspended';
                  const canVerify =
                    canEdit && item.application_status !== 'rejected';
                  return (
                    <article className="card" key={item.application_id}>
                      <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'}}>
                        <span className="pill">{stage.label}</span>
                        <span className="muted-note">
                          Territory capacity: {item.active_slots_filled}/5 active
                        </span>
                      </div>
                      <h3 style={{marginTop: 10}}>
                        {item.business_name || 'Unnamed business'} — {item.trade_name}
                      </h3>
                      <p className="muted-note">
                        {item.area_name}, {item.city} · Submitted{' '}
                        {new Date(item.submitted_at).toLocaleDateString('en-GB')}
                        {item.experience_years !== null ? ` · ${item.experience_years} yrs exp` : ''}
                      </p>
                      <p style={{marginTop: 8}}>{stage.detail}</p>
                      <p className="muted-note" style={{marginTop: 8}}>
                        Verification details:{' '}
                        <strong>
                          {item.verification_submission_status
                            ? item.verification_submission_status.replace(/_/g, ' ')
                            : 'Not submitted yet'}
                        </strong>
                        {item.business_page_status
                          ? ` · Business page: ${item.business_page_status}`
                          : ''}
                      </p>
                      {item.verification_reviewer_note && (
                        <div className="notice">
                          <strong>Verification reviewer note:</strong> {item.verification_reviewer_note}
                        </div>
                      )}

                      {item.latest_offer_id && item.latest_offer_status && (
                        <div className="notice">
                          <p>
                            Vacancy offer: <strong>{item.latest_offer_status}</strong>
                          </p>
                          {item.latest_offer_expires_at && (
                            <p className="muted-note">
                              Expires {new Date(item.latest_offer_expires_at).toLocaleString('en-GB')}
                            </p>
                          )}
                          {stage.key === 'offer_pending' && (
                            <div style={{display: 'flex', gap: 10, marginTop: 9, flexWrap: 'wrap'}}>
                              <button
                                type="button"
                                className="btn"
                                disabled={busy}
                                onClick={() => void answer(item.latest_offer_id as string, true)}
                              >
                                Accept vacancy offer
                              </button>
                              <button
                                type="button"
                                className="btn secondary"
                                disabled={busy}
                                onClick={() => void answer(item.latest_offer_id as string, false)}
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {(item.application_status === 'pending' || item.application_status === 'under_review' || stage.isWaitingList) && !stage.isActiveSlot && (
                        <WaitlistDirectoryEditor
                          key={`${item.application_id}:${waitlistProfiles[item.application_id]?.updated_at || ''}`}
                          applicationId={item.application_id}
                          initial={waitlistProfiles[item.application_id]}
                          defaultName={item.business_name || ''}
                          defaultSummary={item.about || ''}
                          onSaved={profile => setWaitlistProfiles(previous => {
                            const next = {...previous};
                            if (profile) next[item.application_id] = profile;
                            else delete next[item.application_id];
                            return next;
                          })}
                        />
                      )}

                      <div style={{display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12}}>
                        {canVerify && (
                          <button
                            type="button"
                            className="btn secondary"
                            disabled={busy}
                            onClick={() => startVerification(item)}
                          >
                            {ver ? 'Update verification details' : 'Submit verification details'}
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            className="btn secondary"
                            disabled={busy}
                            onClick={() => startEditProfile(item)}
                          >
                            Edit business details
                          </button>
                        )}
                      </div>

                      {editingAppId === item.application_id && (
                        <form className="form" style={{marginTop: 16}} onSubmit={saveProfileEdit}>
                          <h4>Edit permitted business profile details</h4>
                          <label>
                            Business or trading name
                            <input
                              required
                              minLength={2}
                              maxLength={120}
                              value={editBusiness}
                              onChange={e => setEditBusiness(e.target.value)}
                            />
                          </label>
                          <label>
                            Years of experience
                            <input
                              type="number"
                              required
                              min="0"
                              max="80"
                              value={editYears}
                              onChange={e => setEditYears(e.target.value)}
                            />
                          </label>
                          <label>
                            Services and qualifications
                            <textarea
                              required
                              minLength={30}
                              maxLength={3000}
                              value={editAbout}
                              onChange={e => setEditAbout(e.target.value)}
                            />
                          </label>
                          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
                            <button type="submit" className="btn" disabled={busy}>
                              {busy ? 'Saving…' : 'Save profile changes'}
                            </button>
                            <button
                              type="button"
                              className="btn secondary"
                              disabled={busy}
                              onClick={() => setEditingAppId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}

                      {verifyingAppId === item.application_id && (
                        <form className="form" style={{marginTop: 16}} onSubmit={saveVerification}>
                          <h4>Private verification submission (admins only)</h4>
                          <p className="muted-note">
                            Visible only to you and authorised TrustFive administrators — never to
                            customers or public visitors.
                          </p>
                          <label>
                            Public liability insurance provider
                            <input
                              required
                              minLength={2}
                              maxLength={120}
                              value={insuranceProvider}
                              onChange={e => setInsuranceProvider(e.target.value)}
                              placeholder="e.g. Hiscox UK"
                            />
                          </label>
                          <label>
                            Insurance policy reference
                            <input
                              required
                              minLength={3}
                              maxLength={80}
                              value={insurancePolicyRef}
                              onChange={e => setInsurancePolicyRef(e.target.value)}
                            />
                          </label>
                          <label>
                            Insurance expiry date
                            <input
                              type="date"
                              required
                              value={insuranceExpiresOn}
                              onChange={e => setInsuranceExpiresOn(e.target.value)}
                            />
                          </label>
                          <label>
                            Trade registration body (optional)
                            <input
                              maxLength={120}
                              value={tradeBody}
                              onChange={e => setTradeBody(e.target.value)}
                              placeholder="e.g. Gas Safe, NICEIC, NAPIT"
                            />
                          </label>
                          <label>
                            Registration number (optional)
                            <input
                              maxLength={80}
                              value={registrationNumber}
                              onChange={e => setRegistrationNumber(e.target.value)}
                            />
                          </label>
                          <label>
                            Qualifications and compliance summary
                            <textarea
                              required
                              minLength={15}
                              maxLength={1500}
                              value={qualificationSummary}
                              onChange={e => setQualificationSummary(e.target.value)}
                              placeholder="List relevant NVQs, accreditations and safety checks for independent review"
                            />
                          </label>
                          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
                            <button type="submit" className="btn" disabled={busy}>
                              {busy ? 'Saving…' : 'Submit private verification details'}
                            </button>
                            <button
                              type="button"
                              className="btn secondary"
                              disabled={busy}
                              onClick={() => setVerifyingAppId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}
      <section className="section" aria-labelledby="pro-why-trustfive-heading">
        <div className="eyebrow">Built for independent UK trades</div>
        <h2 id="pro-why-trustfive-heading">Why tradespeople move away from pay-per-lead credits</h2>
        <p className="subtle" style={{marginBottom: 18}}>
          No bidding wars against twenty accounts and no paying for unreturned enquiries. Every trade is capped at up to
          five independently approved places per local area, and approval is never sold.
        </p>
        <PlatformComparison showSavingsCalculator />
      </section>
      <section className="section" aria-labelledby="pro-vetting-heading">
        <div className="eyebrow">What we check</div>
        <h2 id="pro-vetting-heading">Six-stage independent human verification</h2>
        <p className="subtle" style={{marginBottom: 18}}>
          Prepare these details ahead of review. Submitting documents never guarantees approval or skips the waiting list.
        </p>
        <VettingCharter compact />
      </section>
    </main>
  );
}
