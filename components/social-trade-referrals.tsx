'use client';

import {FormEvent, useEffect, useMemo, useRef, useState} from 'react';
import {supabaseBrowser} from '../lib/supabase';
import {findSocialArea, type SocialArea} from '../lib/social-discovery';
import {classifySocialWriteError} from '../lib/social-safety';
import {
  buildCustomerReferralHref,
  calculateReferralSplit,
  DEFAULT_PLATFORM_SHARE_BPS,
  DEFAULT_REFERRER_SHARE_BPS,
  validateTradeReferralDraft,
  type SocialTradeReferral,
} from '../lib/trade-referrals';

type Trade = {id: string; name: string; slug: string};

export default function SocialTradeReferrals({
  userId,
  areas,
}: {
  userId: string;
  areas: SocialArea[];
}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [referrals, setReferrals] = useState<SocialTradeReferral[]>([]);
  const [targetTradeId, setTargetTradeId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [summary, setSummary] = useState('');
  const [referrerPct, setReferrerPct] = useState(5);
  const [exampleJobGbp, setExampleJobGbp] = useState(800);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const inFlight = useRef(false);

  const split = useMemo(
    () =>
      calculateReferralSplit({
        jobAmountGbp: exampleJobGbp,
        referrerShareBps: referrerPct * 100,
        platformShareBps: DEFAULT_PLATFORM_SHARE_BPS,
      }),
    [exampleJobGbp, referrerPct]
  );

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await supabaseBrowser().from('trades').select('id,name,slug').order('name').limit(250);
        if (!res.error && active) setTrades((res.data || []) as Trade[]);
      } catch {
        // Handled cleanly via empty selector fallback.
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await supabaseBrowser()
          .from('social_trade_referrals')
          .select(
            'id,referrer_id,target_trade_id,area_id,recommended_application_id,summary,referral_code,referrer_share_bps,platform_share_bps,settlement_mode,status,created_at'
          )
          .order('created_at', {ascending: false})
          .limit(30);
        if (res.error) throw res.error;
        if (active) setReferrals((res.data || []) as SocialTradeReferral[]);
      } catch {
        if (active) setReferrals([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, refresh]);

  async function createReferral(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const shareBps = Math.round(referrerPct * 100);
    const err = validateTradeReferralDraft({
      userId,
      targetTradeId,
      areaId,
      summary,
      referrerShareBps: shareBps,
    });
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
      const res = await supabaseBrowser().from('social_trade_referrals').insert({
        referrer_id: userId,
        target_trade_id: targetTradeId,
        area_id: areaId,
        summary: summary.trim(),
        referrer_share_bps: shareBps,
        platform_share_bps: DEFAULT_PLATFORM_SHARE_BPS,
      });
      if (res.error) throw res.error;
      setTargetTradeId('');
      setAreaId('');
      setSummary('');
      setReferrerPct(DEFAULT_REFERRER_SHARE_BPS / 100);
      setNoticeIsError(false);
      setNotice(
        'Trade referral handoff created (pilot ledger only). Share the generated TrustFive link directly with your customer so they can request quotes safely in the app.'
      );
      setRefresh((n) => n + 1);
    } catch (caught) {
      setNoticeIsError(true);
      setNotice(
        classifySocialWriteError(
          caught,
          'Could not save referral. You must hold a registered professional application, and no phone numbers, websites or customer addresses are allowed.'
        )
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function closeReferral(refItem: SocialTradeReferral) {
    if (inFlight.current || refItem.referrer_id !== userId) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await supabaseBrowser()
        .from('social_trade_referrals')
        .update({status: 'closed'})
        .eq('id', refItem.id)
        .eq('referrer_id', userId);
      if (res.error) throw res.error;
      setNoticeIsError(false);
      setNotice(`Referral ${refItem.referral_code} closed.`);
      setRefresh((n) => n + 1);
    } catch {
      setNoticeIsError(true);
      setNotice('Could not close referral right now. Please retry.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function copyReferralLink(refItem: SocialTradeReferral) {
    const trade = trades.find((t) => t.id === refItem.target_trade_id);
    const relative = buildCustomerReferralHref({
      tradeSlug: trade?.slug,
      areaId: refItem.area_id,
      referralCode: refItem.referral_code,
    });
    const fullUrl =
      typeof window !== 'undefined' ? `${window.location.origin}${relative}` : relative;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(fullUrl);
      }
      setCopiedId(refItem.id);
      setNoticeIsError(false);
      setNotice(`Customer referral link copied (${refItem.referral_code}).`);
    } catch {
      setNoticeIsError(false);
      setNotice(`Share this link with your customer: ${fullUrl}`);
    }
  }

  return (
    <section
      className="card"
      style={{marginTop: 20}}
      aria-labelledby="trade-referrals-heading"
      data-testid="social-trade-referrals"
    >
      <span className="eyebrow">Trade-to-trade referrals &amp; job swaps · Pilot ledger mode</span>
      <h2 id="trade-referrals-heading">Recommend approved trades &amp; earn a transparent referral share</h2>
      <p className="subtle">
        When your customer needs another trade (for example a plumber recommending a CCTV engineer or electrician),
        create a zero-PII TrustFive referral link instead of texting numbers off-platform. The homeowner sees an upfront
        disclosure, stays free to compare quotes from all eligible approved local pros, and fees apply only after a
        completed booking.
      </p>

      <div className="tf-savings-box" style={{marginTop: 16, padding: 16, border: '1px solid var(--border)', borderRadius: 14}}>
        <div className="tf-savings-grid">
          <div className="tf-savings-sliders">
            <label htmlFor="ref-example-amount">
              Example completed job value: <strong>£{split.jobAmountGbp.toLocaleString('en-GB')}</strong>
              <input
                id="ref-example-amount"
                type="range"
                min={100}
                max={5000}
                step={50}
                value={exampleJobGbp}
                onChange={(e) => setExampleJobGbp(Number(e.target.value))}
              />
            </label>
            <label htmlFor="ref-share-pct">
              Recommending professional share: <strong>{referrerPct}%</strong> (capped at 10%)
              <input
                id="ref-share-pct"
                type="range"
                min={0}
                max={10}
                step={1}
                value={referrerPct}
                onChange={(e) => setReferrerPct(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="tf-savings-summary" aria-live="polite" data-testid="referral-split-summary">
            <div className="tf-savings-metric">
              <span>Receiving approved pro keeps ({(split.receivingProShareBps / 100).toFixed(0)}%)</span>
              <strong>£{split.receivingProGbp.toLocaleString('en-GB')}</strong>
            </div>
            <div className="tf-savings-metric">
              <span>Recommending pro earns ({(split.referrerShareBps / 100).toFixed(0)}%)</span>
              <strong>£{split.referrerGbp.toLocaleString('en-GB')}</strong>
            </div>
            <div className="tf-savings-metric" style={{borderBottom: 'none'}}>
              <span>TrustFive platform fee ({(split.platformShareBps / 100).toFixed(0)}%)</span>
              <strong>£{split.platformGbp.toLocaleString('en-GB')}</strong>
            </div>
            <p className="muted-note" style={{margin: '8px 0 0'}}>
              Pilot ledger mode only — zero live payouts or Stripe Connect transfers are active until UK legal, VAT and
              payment-services sign-offs are approved. Referrals never influence 5-slot approval or ranking.
            </p>
          </div>
        </div>
      </div>

      <form className="form" style={{marginTop: 18}} onSubmit={createReferral}>
        <div className="form-grid">
          <label htmlFor="referral-target-trade">
            Trade needed
            <select
              id="referral-target-trade"
              required
              value={targetTradeId}
              onChange={(e) => setTargetTradeId(e.target.value)}
            >
              <option value="">Choose target trade</option>
              {trades.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="referral-area">
            Local area
            <select
              id="referral-area"
              required
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
            >
              <option value="">Choose local area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.area_name}, {a.city}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label htmlFor="referral-summary">
          Work summary (zero customer names, phone numbers, addresses or websites)
          <textarea
            id="referral-summary"
            required
            minLength={15}
            maxLength={600}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="e.g. Homeowner completing a kitchen remodel needs an approved local electrician for 4 sockets and consumer unit check."
          />
        </label>

        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Creating referral…' : 'Create customer-consented referral link'}
        </button>
      </form>

      {notice && (
        <p className={noticeIsError ? 'notice error' : 'notice'} role={noticeIsError ? 'alert' : 'status'}>
          {notice}
        </p>
      )}

      <div style={{marginTop: 18}}>
        <h3>Active trade referrals ({referrals.length})</h3>
        {loading ? (
          <p className="muted-note">Loading trade referrals…</p>
        ) : referrals.length === 0 ? (
          <p className="muted-note">
            No open trade referrals yet. Only registered professionals can create or browse trade-to-trade referral
            handoffs.
          </p>
        ) : (
          <div className="list">
            {referrals.map((item) => {
              const tradeLabel = trades.find((t) => t.id === item.target_trade_id)?.name ?? 'Trade';
              const areaObj = findSocialArea(areas, item.area_id);
              const areaLabel = areaObj ? `${areaObj.area_name}, ${areaObj.city}` : 'Local area';
              return (
                <article className="card" key={item.id}>
                  <div style={{display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap'}}>
                    <span className="pill">
                      {item.referral_code} · {item.status}
                    </span>
                    <span className="muted-note">
                      Split: {(item.referrer_share_bps / 100).toFixed(0)}% referrer /{' '}
                      {(item.platform_share_bps / 100).toFixed(0)}% TrustFive (pilot ledger)
                    </span>
                  </div>
                  <h4 style={{margin: '10px 0 6px'}}>
                    {tradeLabel} in {areaLabel}
                  </h4>
                  <p style={{whiteSpace: 'pre-wrap'}}>{item.summary}</p>
                  <div className="tf-util-bar" style={{marginBottom: 0}}>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => void copyReferralLink(item)}
                    >
                      {copiedId === item.id ? 'Referral link copied' : 'Copy customer referral link'}
                    </button>
                    {item.referrer_id === userId && item.status === 'open' && (
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={busy}
                        onClick={() => void closeReferral(item)}
                      >
                        Close referral
                      </button>
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
