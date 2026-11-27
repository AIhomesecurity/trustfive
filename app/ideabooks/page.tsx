'use client';

import {FormEvent, useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {
  buildIdeabookJobBriefHref,
  IDEABOOK_PROPERTY_STYLES,
  IDEABOOK_ROOM_OPTIONS,
  parseIdeabookQuickAddParams,
  readablePropertyStyle,
  readableRoomType,
  summarizeIdeabookBudget,
  validateIdeabookDraft,
  validateIdeabookItemDraft,
  type HomeownerIdeabook,
  type HomeownerIdeabookItem,
  type IdeabookPropertyStyle,
  type IdeabookQuickAdd,
  type IdeabookRoomType,
} from '../../lib/ideabooks';

export default function ProjectIdeabooksPage() {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);

  const [books, setBooks] = useState<HomeownerIdeabook[]>([]);
  const [itemsByBook, setItemsByBook] = useState<Record<string, HomeownerIdeabookItem[]>>({});
  const [selectedBookId, setSelectedBookId] = useState('');

  // New Ideabook form state
  const [newTitle, setNewTitle] = useState('');
  const [newRoom, setNewRoom] = useState<IdeabookRoomType>('security_smart_home');
  const [newStyle, setNewStyle] = useState<IdeabookPropertyStyle>('semi_detached');
  const [newBudget, setNewBudget] = useState('1000');
  const [newNotes, setNewNotes] = useState('');

  // Add item form state
  const [itemTitle, setItemTitle] = useState('');
  const [itemEstGbp, setItemEstGbp] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [quickAdd, setQuickAdd] = useState<IdeabookQuickAdd | null>(null);

  const inFlight = useRef(false);

  async function loadIdeabooks(uid: string) {
    const s = supabaseBrowser();
    const booksRes = await s
      .from('homeowner_ideabooks')
      .select('id,owner_id,title,room_type,property_style,target_budget_pence,notes,status,created_at')
      .eq('owner_id', uid)
      .order('created_at', {ascending: false})
      .limit(40);
    if (booksRes.error) throw booksRes.error;
    const loadedBooks = (booksRes.data || []) as HomeownerIdeabook[];
    setBooks(loadedBooks);

    if (loadedBooks.length > 0) {
      const bookIds = loadedBooks.map((b) => b.id);
      const itemsRes = await s
        .from('homeowner_ideabook_items')
        .select('id,ideabook_id,item_kind,showcase_id,cost_guide_slug,title,estimated_pence,notes,created_at')
        .in('ideabook_id', bookIds)
        .order('created_at', {ascending: true})
        .limit(300);
      if (itemsRes.error) throw itemsRes.error;
      const grouped: Record<string, HomeownerIdeabookItem[]> = {};
      for (const row of (itemsRes.data || []) as HomeownerIdeabookItem[]) {
        if (!grouped[row.ideabook_id]) grouped[row.ideabook_id] = [];
        grouped[row.ideabook_id].push(row);
      }
      setItemsByBook(grouped);
      setSelectedBookId((prev) =>
        prev && loadedBooks.some((b) => b.id === prev) ? prev : loadedBooks[0].id
      );
    } else {
      setItemsByBook({});
      setSelectedBookId('');
    }
  }

  useEffect(() => {
    const parsedQuick = parseIdeabookQuickAddParams(window.location.search);
    if (parsedQuick) {
      setQuickAdd(parsedQuick);
      setItemTitle(parsedQuick.title);
      if (parsedQuick.estimatedGbp > 0) setItemEstGbp(String(parsedQuick.estimatedGbp));
    }

    let active = true;
    (async () => {
      try {
        const {data, error} = await supabaseBrowser().auth.getUser();
        if (error) throw error;
        if (!active) return;
        if (!data.user) {
          setLoading(false);
          return;
        }
        setUserId(data.user.id);
        await loadIdeabooks(data.user.id);
      } catch {
        if (active) {
          setNoticeIsError(true);
          setNotice('Could not load your Project Ideabooks right now. Please retry.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const activeBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) ?? books[0] ?? null,
    [books, selectedBookId]
  );

  const activeItems = useMemo(
    () => (activeBook ? itemsByBook[activeBook.id] ?? [] : []),
    [activeBook, itemsByBook]
  );

  const budgetSummary = useMemo(
    () =>
      activeBook
        ? summarizeIdeabookBudget(activeBook.target_budget_pence, activeItems)
        : null,
    [activeBook, activeItems]
  );

  async function createIdeabook(e: FormEvent) {
    e.preventDefault();
    if (!userId || inFlight.current) return;
    const budgetNum = Number(newBudget || '0');
    const err = validateIdeabookDraft({title: newTitle, targetBudgetGbp: budgetNum});
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
      const res = await supabaseBrowser()
        .from('homeowner_ideabooks')
        .insert({
          owner_id: userId,
          title: newTitle.trim(),
          room_type: newRoom,
          property_style: newStyle,
          target_budget_pence: Math.round(budgetNum * 100),
          notes: newNotes.trim(),
          status: 'planning',
        })
        .select('id')
        .single();
      if (res.error) throw res.error;
      setNewTitle('');
      setNewNotes('');
      await loadIdeabooks(userId);
      if (res.data?.id) setSelectedBookId(res.data.id);
      setNoticeIsError(false);
      setNotice('Project Ideabook created. Add saved showcases, UK cost guides or scope notes below.');
    } catch {
      setNoticeIsError(true);
      setNotice('Could not save Project Ideabook. Please check your entries and try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!userId || !activeBook || inFlight.current) return;
    const estNum = Number(itemEstGbp || '0');
    const err = validateIdeabookItemDraft({title: itemTitle, estimatedGbp: estNum});
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
      const res = await supabaseBrowser().from('homeowner_ideabook_items').insert({
        ideabook_id: activeBook.id,
        item_kind: quickAdd ? quickAdd.kind : 'note',
        showcase_id: quickAdd?.showcaseId || null,
        cost_guide_slug: quickAdd?.costGuideSlug || null,
        title: itemTitle.trim(),
        estimated_pence: Math.round(estNum * 100),
        notes: itemNotes.trim(),
      });
      if (res.error) throw res.error;
      setItemTitle('');
      setItemEstGbp('');
      setItemNotes('');
      setQuickAdd(null);
      await loadIdeabooks(userId);
      setNoticeIsError(false);
      setNotice(`Added item to “${activeBook.title}”.`);
    } catch {
      setNoticeIsError(true);
      setNotice('Could not add item to this Ideabook. Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await supabaseBrowser()
        .from('homeowner_ideabook_items')
        .delete()
        .eq('id', itemId);
      if (res.error) throw res.error;
      await loadIdeabooks(userId);
      setNoticeIsError(false);
      setNotice('Item removed from Ideabook.');
    } catch {
      setNoticeIsError(true);
      setNotice('Could not remove item right now.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function deleteBook(bookId: string) {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await supabaseBrowser()
        .from('homeowner_ideabooks')
        .delete()
        .eq('id', bookId)
        .eq('owner_id', userId);
      if (res.error) throw res.error;
      await loadIdeabooks(userId);
      setNoticeIsError(false);
      setNotice('Project Ideabook deleted.');
    } catch {
      setNoticeIsError(true);
      setNotice('Could not delete Ideabook right now.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="container" data-testid="ideabooks-page">
      <div className="page-heading">
        <span className="eyebrow">Homeowner Project Planner · Private Ideabooks</span>
        <h1>Project Ideabooks &amp; Budget Planner</h1>
        <p className="subtle">
          Collect approved installer showcases, UK cost guide ranges and room notes into private project boards, track
          your running budget, and turn any Ideabook into a ready-to-quote TrustFive job brief in one click.
        </p>
      </div>

      {quickAdd && (
        <div className="notice" role="status" data-testid="ideabook-quick-add-banner">
          <strong>Ready to save to an Ideabook:</strong> “{quickAdd.title}”
          {quickAdd.estimatedGbp > 0 ? ` (~£${quickAdd.estimatedGbp.toLocaleString('en-GB')})` : ''}. Pick an existing
          Ideabook below or create a new project board first.
        </div>
      )}

      {notice && (
        <p className={noticeIsError ? 'notice error' : 'notice'} role={noticeIsError ? 'alert' : 'status'}>
          {notice}
        </p>
      )}

      {loading ? (
        <p className="notice" role="status">
          Loading your private Project Ideabooks…
        </p>
      ) : !userId ? (
        <section className="card" data-testid="ideabooks-signed-out">
          <span className="eyebrow">Private to your TrustFive account</span>
          <h2>Plan home improvements without losing track of ideas or budgets</h2>
          <p className="subtle">
            Sign in to save completed installer showcases from TrustFive Social, add indicative UK Cost Guide ranges,
            and convert your finished checklist straight into quotes from up to five independently approved local
            professionals.
          </p>
          <div className="social-hub-shortcuts" style={{marginBottom: 0}}>
            <Link className="btn" href="/account?next=%2Fideabooks">
              Sign in to open Ideabooks
            </Link>
            <Link className="btn secondary" href="/cost-guides">
              Browse UK Cost Guides
            </Link>
            <Link className="btn secondary" href="/community/social?tab=showcases">
              Explore installer showcases
            </Link>
          </div>
        </section>
      ) : (
        <div className="two-col">
          <section className="card" aria-labelledby="create-ideabook-heading">
            <h2 id="create-ideabook-heading">Create a new Project Ideabook</h2>
            <p className="muted-note" style={{marginTop: 0}}>
              Strictly private to your account. Nothing here is shared publicly until you choose to post a job.
            </p>
            <form className="form" onSubmit={createIdeabook}>
              <label htmlFor="ideabook-title">
                Project title
                <input
                  id="ideabook-title"
                  required
                  minLength={3}
                  maxLength={120}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Driveway CCTV & Porch Lighting"
                />
              </label>

              <div className="form-grid">
                <label htmlFor="ideabook-room">
                  Room / project category
                  <select
                    id="ideabook-room"
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value as IdeabookRoomType)}
                  >
                    {IDEABOOK_ROOM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label htmlFor="ideabook-style">
                  UK property style
                  <select
                    id="ideabook-style"
                    value={newStyle}
                    onChange={(e) => setNewStyle(e.target.value as IdeabookPropertyStyle)}
                  >
                    {IDEABOOK_PROPERTY_STYLES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label htmlFor="ideabook-budget">
                Target project budget (£)
                <input
                  id="ideabook-budget"
                  type="number"
                  min={0}
                  max={1000000}
                  step={50}
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                />
              </label>

              <label htmlFor="ideabook-notes">
                Project notes (wall type, access, timing)
                <textarea
                  id="ideabook-notes"
                  maxLength={1500}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Victorian red-brick terrace, prefer black conduit and neat loft cable run."
                />
              </label>

              <button type="submit" className="btn" disabled={busy}>
                {busy ? 'Saving…' : 'Create Project Ideabook'}
              </button>
            </form>
          </section>

          <section aria-labelledby="saved-ideabooks-heading">
            <div className="section-heading-row" style={{marginBottom: 14}}>
              <h2 id="saved-ideabooks-heading" style={{margin: 0}}>
                Your Ideabooks ({books.length})
              </h2>
              <Link className="service-view-all" href="/cost-guides">
                + Browse cost guides
              </Link>
            </div>

            {books.length === 0 ? (
              <div className="card">
                <h3>No Project Ideabooks yet</h3>
                <p className="subtle">
                  Create your first project board on the left, then save completed installer showcases and UK cost guide
                  items to plan your budget before requesting quotes.
                </p>
              </div>
            ) : (
              <>
                <div className="tf-compare-filters" role="tablist" aria-label="Choose a Project Ideabook">
                  {books.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      role="tab"
                      aria-selected={activeBook?.id === book.id}
                      className={activeBook?.id === book.id ? 'dashboard-tab active' : 'dashboard-tab'}
                      onClick={() => setSelectedBookId(book.id)}
                    >
                      {book.title} ({(itemsByBook[book.id] ?? []).length})
                    </button>
                  ))}
                </div>

                {activeBook && budgetSummary && (
                  <article className="card" data-testid="active-ideabook-panel">
                    <div style={{display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap'}}>
                      <span className="pill">
                        {readableRoomType(activeBook.room_type)} · {readablePropertyStyle(activeBook.property_style)}
                      </span>
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={busy}
                        onClick={() => void deleteBook(activeBook.id)}
                      >
                        Delete board
                      </button>
                    </div>

                    <h3 style={{marginTop: 12}}>{activeBook.title}</h3>
                    {activeBook.notes && <p className="subtle">{activeBook.notes}</p>}

                    <div
                      className="tf-savings-summary"
                      style={{marginTop: 14, marginBottom: 16}}
                      data-testid="ideabook-budget-summary"
                    >
                      <div className="tf-savings-metric">
                        <span>Saved scope estimate</span>
                        <strong>£{budgetSummary.estimatedGbp.toLocaleString('en-GB')}</strong>
                      </div>
                      <div className="tf-savings-metric" style={{borderBottom: 'none'}}>
                        <span>
                          Target budget{' '}
                          {budgetSummary.overBudget
                            ? `(£${Math.abs(budgetSummary.remainingGbp).toLocaleString('en-GB')} over)`
                            : budgetSummary.targetGbp > 0
                              ? `(£${budgetSummary.remainingGbp.toLocaleString('en-GB')} remaining)`
                              : ''}
                        </span>
                        <strong>£{budgetSummary.targetGbp.toLocaleString('en-GB')}</strong>
                      </div>
                      <div
                        aria-hidden="true"
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: 'var(--border)',
                          overflow: 'hidden',
                          marginTop: 6,
                        }}
                      >
                        <div
                          style={{
                            width: `${budgetSummary.percentUsed}%`,
                            height: '100%',
                            background: budgetSummary.overBudget ? '#b42318' : 'var(--green)',
                          }}
                        />
                      </div>
                    </div>

                    <div className="social-hub-shortcuts" style={{marginBottom: 18}}>
                      <Link
                        className="btn"
                        href={buildIdeabookJobBriefHref(activeBook, activeItems)}
                        data-testid="ideabook-to-job-link"
                      >
                        Turn Ideabook into a Job Brief →
                      </Link>
                      <Link className="btn secondary" href="/community/social?tab=showcases">
                        Browse installer showcases
                      </Link>
                    </div>

                    <h4 style={{margin: '0 0 10px'}}>Saved items &amp; scope checklist ({activeItems.length})</h4>
                    {activeItems.length === 0 ? (
                      <p className="muted-note">
                        No items saved in this board yet. Add an item below or save directly from UK Cost Guides or
                        Social Showcases.
                      </p>
                    ) : (
                      <ul className="tf-guide-list" style={{marginBottom: 16}}>
                        {activeItems.map((item) => (
                          <li key={item.id} style={{flexWrap: 'wrap', gap: 10, alignItems: 'center'}}>
                            <div style={{minWidth: 0, flex: '1 1 210px'}}>
                              <strong>{item.title}</strong>
                              <span className="muted-note">
                                {item.item_kind === 'showcase'
                                  ? 'Saved installer showcase'
                                  : item.item_kind === 'cost_guide'
                                    ? 'UK cost guide item'
                                    : 'Custom scope note'}
                                {item.notes ? ` · ${item.notes}` : ''}
                              </span>
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0}}>
                              {item.estimated_pence > 0 && (
                                <span className="pill">
                                  ~£{Math.round(item.estimated_pence / 100).toLocaleString('en-GB')}
                                </span>
                              )}
                              <button
                                type="button"
                                className="btn secondary"
                                style={{padding: '8px 14px'}}
                                disabled={busy}
                                onClick={() => void removeItem(item.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <form className="form" onSubmit={addItem} style={{borderTop: '1px solid var(--border)', paddingTop: 14}}>
                      <h4 style={{margin: 0}}>Add scope item or estimate to “{activeBook.title}”</h4>
                      <div className="form-grid">
                        <label htmlFor="ideabook-item-title">
                          Item title
                          <input
                            id="ideabook-item-title"
                            required
                            minLength={3}
                            maxLength={140}
                            value={itemTitle}
                            onChange={(e) => setItemTitle(e.target.value)}
                            placeholder="e.g. 4-camera PoE CCTV kit & conduit"
                          />
                        </label>
                        <label htmlFor="ideabook-item-est">
                          Estimated cost (£; optional)
                          <input
                            id="ideabook-item-est"
                            type="number"
                            min={0}
                            max={1000000}
                            step={10}
                            value={itemEstGbp}
                            onChange={(e) => setItemEstGbp(e.target.value)}
                            placeholder="850"
                          />
                        </label>
                      </div>
                      <label htmlFor="ideabook-item-notes">
                        Item notes (optional)
                        <input
                          id="ideabook-item-notes"
                          type="text"
                          maxLength={600}
                          value={itemNotes}
                          onChange={(e) => setItemNotes(e.target.value)}
                          placeholder="e.g. Include night-vision colour cameras on front drive"
                        />
                      </label>
                      <button type="submit" className="btn secondary" disabled={busy}>
                        {busy ? 'Adding…' : 'Add item to Ideabook'}
                      </button>
                    </form>
                  </article>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
