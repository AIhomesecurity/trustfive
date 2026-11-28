'use client';

import {FormEvent, useEffect, useRef, useState} from 'react';
import {supabaseBrowser} from '../lib/supabase';
import {findSocialArea, type SocialArea} from '../lib/social-discovery';
import {classifySocialWriteError} from '../lib/social-safety';
import {
  LOCAL_LISTING_CATEGORY_LABELS,
  validateLocalListingDraft,
  type LocalListingCategory,
  type SocialLocalListing,
} from '../lib/social-superapp';

export default function SocialLocalExchange({
  userId,
  areas,
}: {
  userId: string;
  areas: SocialArea[];
}) {
  const [listings, setListings] = useState<SocialLocalListing[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [areaId, setAreaId] = useState('');
  const [category, setCategory] = useState<LocalListingCategory>('tools_materials');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceGbp, setPriceGbp] = useState('0');
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
        const res = await supabaseBrowser()
          .from('social_local_listings')
          .select('id,seller_id,area_id,category,title,description,price_pence,status,created_at')
          .order('created_at', {ascending: false})
          .limit(30);
        if (!res.error && active) setListings((res.data || []) as SocialLocalListing[]);
      } catch {
        if (active) setListings([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, refresh]);

  async function createListing(e: FormEvent) {
    e.preventDefault();
    if (!userId || inFlight.current) return;
    const priceNum = category === 'free_giveaway' ? 0 : Number(priceGbp || '0');
    const err = validateLocalListingDraft({areaId, title, description, priceGbp: priceNum});
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
      const res = await supabaseBrowser().from('social_local_listings').insert({
        seller_id: userId,
        area_id: areaId,
        category,
        title: title.trim(),
        description: description.trim(),
        price_pence: Math.round(priceNum * 100),
        status: 'available',
      });
      if (res.error) throw res.error;
      setTitle('');
      setDescription('');
      setPriceGbp('0');
      setNoticeIsError(false);
      setNotice('Local exchange listing published!');
      setRefresh((n) => n + 1);
    } catch (caught) {
      setNoticeIsError(true);
      setNotice(classifySocialWriteError(caught, 'Could not publish listing. Remove any phone numbers, links or postcodes.'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function updateStatus(item: SocialLocalListing, status: 'available' | 'reserved' | 'sold') {
    if (!userId || item.seller_id !== userId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await supabaseBrowser()
        .from('social_local_listings')
        .update({status})
        .eq('id', item.id)
        .eq('seller_id', userId);
      if (res.error) throw res.error;
      setRefresh((n) => n + 1);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const visible = listings.filter((l) => categoryFilter === 'all' || l.category === categoryFilter);

  return (
    <section className="list" aria-labelledby="local-exchange-heading" data-testid="social-local-exchange">
      <div className="card">
        <span className="eyebrow">Nextdoor For Sale &amp; Free · Trade Surplus Exchange</span>
        <h2 id="local-exchange-heading" className="social-card-title">
          Local tools, surplus materials &amp; free giveaways
        </h2>
        <p className="subtle" style={{marginTop: 0}}>
          Pass on leftover bricks, Cat6 cable reels, spare tiles, ladders or garden kit to neighbours and local trades.
          Phone numbers, external links and full home addresses are blocked for safety.
        </p>

        <form className="form" onSubmit={createListing}>
          <div className="form-grid">
            <label htmlFor="ex-area">
              Neighbourhood
              <select id="ex-area" required value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">Choose neighbourhood</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.area_name}, {a.city}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="ex-category">
              Category
              <select
                id="ex-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as LocalListingCategory)}
              >
                {Object.entries(LOCAL_LISTING_CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label htmlFor="ex-title">
              Item title
              <input
                id="ex-title"
                required
                minLength={5}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Half box of white metro tiles (free to collect)"
              />
            </label>
            <label htmlFor="ex-price">
              Price (£; enter 0 for FREE)
              <input
                id="ex-price"
                type="number"
                min={0}
                max={50000}
                step={1}
                disabled={category === 'free_giveaway'}
                value={category === 'free_giveaway' ? '0' : priceGbp}
                onChange={(e) => setPriceGbp(e.target.value)}
              />
            </label>
          </div>
          <label htmlFor="ex-desc">
            Description (no phone numbers, links or full postcodes)
            <textarea
              id="ex-desc"
              required
              minLength={12}
              maxLength={800}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Condition, dimensions or collection notes (e.g. Left over from bathroom job, dry-stored in garage)."
            />
          </label>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Publishing…' : 'Post to local exchange'}
          </button>
        </form>

        {notice && (
          <p className={noticeIsError ? 'notice error' : 'notice'} role={noticeIsError ? 'alert' : 'status'}>
            {notice}
          </p>
        )}
      </div>

      <div className="card">
        <div className="tf-compare-filters" role="group" aria-label="Filter local exchange listings" style={{marginBottom: 14}}>
          <button
            type="button"
            className={categoryFilter === 'all' ? 'dashboard-tab active' : 'dashboard-tab'}
            onClick={() => setCategoryFilter('all')}
          >
            All ({listings.length})
          </button>
          {Object.entries(LOCAL_LISTING_CATEGORY_LABELS).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={categoryFilter === k ? 'dashboard-tab active' : 'dashboard-tab'}
              onClick={() => setCategoryFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="muted-note">Loading local exchange listings…</p>
        ) : visible.length === 0 ? (
          <p className="muted-note" style={{margin: 0}}>
            No local exchange items posted in this category yet — share spare materials or tools above!
          </p>
        ) : (
          <div className="list">
            {visible.map((item) => {
              const area = findSocialArea(areas, item.area_id);
              return (
                <article key={item.id} className="card">
                  <div style={{display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap'}}>
                    <span className="pill">
                      {LOCAL_LISTING_CATEGORY_LABELS[item.category]} · {area ? area.area_name : 'Local'}
                    </span>
                    <strong style={{color: 'var(--green)'}}>
                      {item.price_pence === 0 ? 'FREE' : `£${(item.price_pence / 100).toFixed(2)}`} · {item.status}
                    </strong>
                  </div>
                  <h3 style={{margin: '10px 0 6px'}}>{item.title}</h3>
                  <p style={{whiteSpace: 'pre-wrap', margin: '0 0 10px'}}>{item.description}</p>
                  {item.seller_id === userId && (
                    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                      {item.status !== 'reserved' && (
                        <button type="button" className="btn secondary" disabled={busy} onClick={() => void updateStatus(item, 'reserved')}>
                          Mark reserved
                        </button>
                      )}
                      {item.status !== 'sold' && (
                        <button type="button" className="btn secondary" disabled={busy} onClick={() => void updateStatus(item, 'sold')}>
                          Mark collected / sold
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
