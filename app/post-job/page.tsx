'use client';

import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {PREAUTH_JOB_DRAFT_KEY, type PreAuthJobDraft} from '../../lib/preauth-job-draft';

type Trade = {id: string; name: string; slug: string};

export default function StartCustomerJob() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeSlug, setTradeSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [areaLabel, setAreaLabel] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void supabaseBrowser().from('trades').select('id,name,slug').order('name').then(({data, error: loadError}) => {
      if (!active) return;
      if (loadError) setError('Trade options are unavailable right now. Please try again.');
      else setTrades((data || []) as Trade[]);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const selectedTrade = useMemo(() => trades.find(item => item.slug === tradeSlug), [trades, tradeSlug]);
  const readyForBrief = Boolean(selectedTrade && areaLabel.trim().length >= 2);
  const readyForReview = Boolean(readyForBrief && title.trim().length >= 5 && description.trim().length >= 15);

  function saveDraft() {
    if (!selectedTrade || !readyForReview) return false;
    const draft: PreAuthJobDraft = {
      tradeSlug: selectedTrade.slug,
      title: title.trim(),
      description: description.trim(),
      areaLabel: areaLabel.trim(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    try {
      localStorage.setItem(PREAUTH_JOB_DRAFT_KEY, JSON.stringify(draft));
      return true;
    } catch {
      setError('This browser could not keep your draft for sign-in. Please enable browser storage or sign in first.');
      return false;
    }
  }

  function continueToAccount(mode: 'signup' | 'signin') {
    if (!saveDraft()) return;
    const params = new URLSearchParams({mode, role: 'customer', next: '/jobs'});
    window.location.assign(`/account?${params.toString()}`);
  }

  async function continueAsSignedInCustomer() {
    setError('');
    if (!saveDraft()) return;
    try {
      const {data, error: authError} = await supabaseBrowser().auth.getUser();
      if (authError) throw authError;
      if (data.user) window.location.assign('/jobs');
      else continueToAccount('signup');
    } catch {
      continueToAccount('signup');
    }
  }

  return <main className="container preauth-job-page">
    <div className="preauth-job-heading">
      <span className="eyebrow">For customers</span>
      <h1>Tell us what needs doing</h1>
      <p className="subtle">Build your job request first. Create or log in to a customer account at the end to publish it and compare quotes.</p>
    </div>

    <ol className="preauth-job-steps" aria-label="Job request steps">
      <li aria-current={step === 1 ? 'step' : undefined} className={step >= 1 ? 'is-current' : ''}><span>1</span> Trade &amp; area</li>
      <li aria-current={step === 2 ? 'step' : undefined} className={step >= 2 ? 'is-current' : ''}><span>2</span> Job details</li>
      <li aria-current={step === 3 ? 'step' : undefined} className={step >= 3 ? 'is-current' : ''}><span>3</span> Customer account</li>
    </ol>

    {error && <p className="notice error" role="alert">{error}</p>}
    <section className="card preauth-job-card" aria-labelledby="preauth-job-step-heading">
      {step === 1 && <>
        <h2 id="preauth-job-step-heading">What trade do you need?</h2>
        <p className="subtle">Choose a service and give us a rough area so the job starts in the right place.</p>
        <div className="form">
          <label>Trade<select required value={tradeSlug} onChange={event => setTradeSlug(event.target.value)} disabled={loading}>
            <option value="">{loading ? 'Loading trades…' : 'Choose a trade'}</option>
            {trades.map(item => <option value={item.slug} key={item.id}>{item.name}</option>)}
          </select></label>
          <label>Town or postcode district<input required minLength={2} maxLength={80} autoComplete="postal-code" value={areaLabel} onChange={event => setAreaLabel(event.target.value)} placeholder="e.g. Wakefield or LS5" /></label>
          <p className="muted-note">A rough area only. Don’t enter a full address here. Your exact job-site address is collected privately after you sign in.</p>
        </div>
        <div className="preauth-job-actions"><button type="button" className="btn" disabled={!readyForBrief} onClick={() => {setError('');setStep(2);}}>Continue</button></div>
      </>}

      {step === 2 && <>
        <h2 id="preauth-job-step-heading">Describe the work</h2>
        <p className="subtle">Local approved professionals will use this to decide whether they can help.</p>
        <div className="form">
          <label>Job title<input required minLength={5} maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Install cameras at my home" /></label>
          <label>What needs doing?<textarea required minLength={15} maxLength={3000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the work, access and what you already know. Leave out names, phone numbers and exact addresses." /></label>
          <p className="muted-note">Your brief is saved on this device for up to 24 hours so it survives email confirmation. It includes no phone number or exact address, stays out of the page address, and is removed after you continue to the secure job form.</p>
        </div>
        <div className="preauth-job-actions"><button type="button" className="btn secondary" onClick={() => setStep(1)}>Back</button><button type="button" className="btn" disabled={!readyForReview} onClick={() => {setError('');setStep(3);}}>Review request</button></div>
      </>}

      {step === 3 && <>
        <h2 id="preauth-job-step-heading">Your request is ready to continue</h2>
        <dl className="preauth-job-review">
          <div><dt>Trade</dt><dd>{selectedTrade?.name}</dd></div>
          <div><dt>Area</dt><dd>{areaLabel}</dd></div>
          <div><dt>Job</dt><dd>{title}</dd></div>
          <div><dt>Brief</dt><dd>{description}</dd></div>
        </dl>
        <p className="notice">Next, sign in or create a <strong>customer</strong> account. Then add your exact address privately and publish the request. Posting does not approve or rank any tradesperson.</p>
        <div className="preauth-job-actions"><button type="button" className="btn secondary" onClick={() => setStep(2)}>Edit request</button><button type="button" className="btn" onClick={() => void continueAsSignedInCustomer()}>Continue as customer</button></div>
        <p className="preauth-job-login">Already have an account? <button type="button" onClick={() => continueToAccount('signin')}>Log in and continue</button></p>
      </>}
    </section>
    <p className="preauth-job-footnote">Only approved, eligible professionals can quote. Your private address and contact details are not exposed in public directories.</p>
    <p><Link href="/services">Compare approved professionals instead →</Link></p>
  </main>;
}
