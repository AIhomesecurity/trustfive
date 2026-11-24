'use client';

import {FormEvent,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {supabaseBrowser} from '../../../lib/supabase';
import {findSocialArea,type SocialArea,type SocialPostSummary} from '../../../lib/social-discovery';
import {socialPageBounds,socialPageRows,socialSearchPattern,type SocialFeedOrder} from '../../../lib/social-feed-paging';
import {socialPostValidationError} from '../../../lib/social-post-composer';
import {
  buildSocialFeedHref,
  getAreaDraft,
  parseSocialFeedParams,
  setAreaDraft,
} from '../../../lib/social-feed-url';
import {
  clearAllSocialDrafts,
  clearScopedDraft,
  clearSocialDraftsForOtherUsers,
  loadScopedDraft,
  saveScopedDraft,
} from '../../../lib/social-draft-storage';
import {assessSocialPostSafety, classifySocialWriteError} from '../../../lib/social-safety';
import SocialMediaPrivacyNotice from '../../../components/social-media-privacy-notice';
import SocialPostCard from '../../../components/social-post-card';
import SocialAdviceBoard from '../../../components/social-advice-board';
import SocialGroupDiscovery from '../../../components/social-group-discovery';
import SocialTradeCollaboration from '../../../components/social-trade-collaboration';
import SocialSavedPosts from '../../../components/social-saved-posts';
import SocialEventsDiscovery from '../../../components/social-events-discovery';
import {socialNeedsAuthRecheck} from '../../../lib/social-auth-identity';
import {SOCIAL_SECTIONS,socialSectionFromQuery,socialSectionHref} from '../../../lib/social-sections';

export default function TrustFiveSocial() {
  return (
    <Suspense
      fallback={
        <main className="container social-hub">
          <h1>TrustFive Social</h1>
          <p role="status">Loading Social…</p>
        </main>
      }
    >
      <SocialHub />
    </Suspense>
  );
}

function SocialHub() {
  const searchParams = useSearchParams();
  const tab = socialSectionFromQuery(searchParams.getAll('tab'));
  const initialFeed = useMemo(() => parseSocialFeedParams(searchParams), [searchParams]);

  const [areas, setAreas] = useState<SocialArea[]>([]);
  const [userId, setUserId] = useState('');
  const currentUserIdRef = useRef('');
  currentUserIdRef.current = userId;

  const [postingAreaId, setPostingAreaId] = useState('');
  const [draftsByArea, setDraftsByArea] = useState<Record<string, string>>({});
  const [restoredDraftArea, setRestoredDraftArea] = useState('');
  const postBody = getAreaDraft(draftsByArea, postingAreaId);

  const [posting, setPosting] = useState(false);
  const [postNotice, setPostNotice] = useState('');
  const [postNoticeIsError, setPostNoticeIsError] = useState(false);
  const publishingRef = useRef(false);

  const [posts, setPosts] = useState<SocialPostSummary[]>([]);
  const [areaId, setAreaId] = useState(initialFeed.areaId);
  const [query, setQuery] = useState(initialFeed.search);
  const [search, setSearch] = useState(initialFeed.search);
  const [order, setOrder] = useState<SocialFeedOrder>(initialFeed.order);
  const [page, setPage] = useState(initialFeed.page);
  const [hasMore, setHasMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [authRevision, setAuthRevision] = useState(0);

  const authEpoch = useRef(0);
  const feedRequestRef = useRef(0);
  const feedHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const composerAreaRef = useRef<HTMLSelectElement | null>(null);
  const composerBodyRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync URL query params into state when navigating Back/Forward or switching tabs.
  useEffect(() => {
    setAreaId(initialFeed.areaId);
    setQuery(initialFeed.search);
    setSearch(initialFeed.search);
    setOrder(initialFeed.order);
    setPage(initialFeed.page);
  }, [initialFeed.areaId, initialFeed.search, initialFeed.order, initialFeed.page]);

  const currentFeedHref = useMemo(
    () => buildSocialFeedHref('neighbourhood', {areaId, search, order, page}),
    [areaId, search, order, page]
  );

  const syncFeedUrl = useCallback(
    (next: {areaId: string; search: string; order: SocialFeedOrder; page: number}) => {
      if (typeof window === 'undefined' || tab !== 'neighbourhood') return;
      const nextHref = buildSocialFeedHref('neighbourhood', next);
      if (window.location.pathname + window.location.search !== nextHref) {
        window.history.replaceState(null, '', nextHref);
      }
    },
    [tab]
  );

  // Supabase broadcasts SIGNED_OUT / SIGNED_IN across tabs. Revalidate with
  // getUser instead of trusting cached posts, drafts, bookmarks or private RSVP state.
  useEffect(() => {
    const {
      data: {subscription},
    } = supabaseBrowser().auth.onAuthStateChange((event, session) => {
      if (!socialNeedsAuthRecheck(event, currentUserIdRef.current, session?.user?.id || '')) {
        return;
      }
      if (event === 'SIGNED_OUT') clearAllSocialDrafts();
      authEpoch.current += 1;
      feedRequestRef.current += 1;
      setAuthRevision(value => value + 1);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    const epoch = authEpoch.current;
    feedRequestRef.current += 1;
    setSignedIn(false);
    setUserId('');
    setAreas([]);
    setPosts([]);
    setHasMore(false);
    setDraftsByArea({});
    setPostingAreaId('');
    setRestoredDraftArea('');
    setPostNotice('');
    setPostNoticeIsError(false);
    setAccountLoading(true);
    setAccountError('');
    setLoading(true);

    (async () => {
      try {
        const s = supabaseBrowser();
        const result = await s.auth.getUser();
        if (result.error) throw result.error;
        if (!active || epoch !== authEpoch.current) return;
        const nextUser = result.data.user;
        setSignedIn(Boolean(nextUser));
        setUserId(nextUser?.id || '');
        if (!nextUser) {
          clearAllSocialDrafts();
          return;
        }
        clearSocialDraftsForOtherUsers(nextUser.id);
        const areasResult = await s
          .from('service_areas')
          .select('id,area_name,city')
          .order('city')
          .limit(200);
        if (areasResult.error) throw areasResult.error;
        if (!active || epoch !== authEpoch.current) return;
        const listedAreas = (areasResult.data || []) as SocialArea[];
        setAreas(listedAreas);
        // Clear any URL-supplied area ID that does not match an available neighbourhood.
        setAreaId(prev => (prev && !listedAreas.some(a => a.id === prev) ? '' : prev));
      } catch {
        if (active && epoch === authEpoch.current) {
          setAccountError('Unable to verify your account or neighbourhoods. Please try again.');
        }
      } finally {
        if (active && epoch === authEpoch.current) setAccountLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authRevision]);

  useEffect(() => {
    if (accountLoading || accountError || !signedIn) {
      setLoading(false);
      return;
    }
    let active = true;
    const requestId = ++feedRequestRef.current;
    const epoch = authEpoch.current;

    // Immediately clear previous neighbourhood posts so switching areas never
    // flashes another neighbourhood's feed while loading.
    setPosts([]);
    setHasMore(false);
    setLoading(true);
    setError('');

    (async () => {
      try {
        const s = supabaseBrowser();
        const bounds = socialPageBounds(page);
        let request = s
          .from('community_posts')
          .select('id,area_id,body,visibility,created_at')
          .eq('visibility', 'published')
          .order('created_at', {ascending: order === 'oldest'})
          .order('id', {ascending: true})
          .range(bounds.from, bounds.to);
        if (areaId) request = request.eq('area_id', areaId);
        if (search.trim()) request = request.ilike('body', socialSearchPattern(search));
        const {data, error: readError} = await request;
        if (readError) throw readError;
        if (!active || requestId !== feedRequestRef.current || epoch !== authEpoch.current) return;
        const result = socialPageRows((data || []) as SocialPostSummary[]);
        setPosts(result.items);
        setHasMore(result.hasMore);
      } catch {
        if (active && requestId === feedRequestRef.current && epoch === authEpoch.current) {
          setPosts([]);
          setHasMore(false);
          setError('Could not load matching neighbourhood posts. Please retry.');
        }
      } finally {
        if (active && requestId === feedRequestRef.current && epoch === authEpoch.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [signedIn, accountLoading, accountError, areaId, order, search, page, refreshKey]);

  function changeArea(value: string) {
    const next = {areaId: value, search, order, page: 0};
    setPage(0);
    setAreaId(value);
    syncFeedUrl(next);
  }

  function changeOrder(value: SocialFeedOrder) {
    const next = {areaId, search, order: value, page: 0};
    setPage(0);
    setOrder(value);
    syncFeedUrl(next);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const cleaned = query.trim().slice(0, 120);
    const next = {areaId, search: cleaned, order, page: 0};
    setPage(0);
    setSearch(cleaned);
    syncFeedUrl(next);
  }

  function resetFilters() {
    const next = {areaId: '', search: '', order: 'recent' as SocialFeedOrder, page: 0};
    setPage(0);
    setAreaId('');
    setQuery('');
    setSearch('');
    setOrder('recent');
    syncFeedUrl(next);
  }

  function changePage(nextPage: number) {
    const bounded = Math.max(0, Math.min(500, nextPage));
    const next = {areaId, search, order, page: bounded};
    setPage(bounded);
    syncFeedUrl(next);
  }

  function selectPostingArea(nextAreaId: string) {
    setPostingAreaId(nextAreaId);
    setPostNotice('');
    setPostNoticeIsError(false);
    if (!nextAreaId || !userId) {
      setRestoredDraftArea('');
      return;
    }
    const existing = getAreaDraft(draftsByArea, nextAreaId);
    if (!existing) {
      const recovered = loadScopedDraft(userId, 'feed', nextAreaId);
      if (recovered) {
        setDraftsByArea(prev => setAreaDraft(prev, nextAreaId, recovered));
        setRestoredDraftArea(nextAreaId);
        return;
      }
    }
    setRestoredDraftArea('');
  }

  function focusComposer() {
    if (postingAreaId) {
      composerBodyRef.current?.focus();
    } else {
      composerAreaRef.current?.focus();
    }
  }

  async function publishNeighbourhoodPost(event: FormEvent) {
    event.preventDefault();
    if (publishingRef.current) return;
    const targetAreaId = postingAreaId;
    const draftText = getAreaDraft(draftsByArea, targetAreaId);
    const problem = socialPostValidationError({
      authorId: userId,
      areaId: targetAreaId,
      availableAreaIds: areas.map(item => item.id),
      body: draftText,
    });
    if (problem) {
      setPostNotice(problem);
      setPostNoticeIsError(true);
      return;
    }
    const safety = assessSocialPostSafety(draftText);
    if (safety.blockingError) {
      setPostNotice(safety.blockingError);
      setPostNoticeIsError(true);
      return;
    }

    publishingRef.current = true;
    setPosting(true);
    setPostNotice('');
    setPostNoticeIsError(false);
    const currentAuthEpoch = authEpoch.current;

    try {
      const {error: publishError} = await supabaseBrowser().from('community_posts').insert({
        author_id: userId,
        area_id: targetAreaId,
        body: draftText.trim(),
        visibility: 'published',
      });
      if (publishError) throw publishError;
      if (authEpoch.current !== currentAuthEpoch) return;

      // Clear only the published neighbourhood's draft; switch feed to that neighbourhood.
      setDraftsByArea(prev => setAreaDraft(prev, targetAreaId, ''));
      clearScopedDraft(userId, 'feed', targetAreaId);
      setRestoredDraftArea('');
      const nextFeed = {areaId: targetAreaId, search: '', order: 'recent' as SocialFeedOrder, page: 0};
      setAreaId(targetAreaId);
      setQuery('');
      setSearch('');
      setPage(0);
      setOrder('recent');
      syncFeedUrl(nextFeed);
      setRefreshKey(value => value + 1);
      setPostNotice(
        'Your neighbourhood post was published. If it does not appear immediately, refresh the feed. Do not repost it.'
      );
      setPostNoticeIsError(false);
    } catch (err) {
      if (authEpoch.current === currentAuthEpoch) {
        setPostNotice(
          classifySocialWriteError(
            err,
            'Your post could not be published — your draft is preserved above so you can retry safely.'
          )
        );
        setPostNoticeIsError(true);
      }
    } finally {
      publishingRef.current = false;
      setPosting(false);
    }
  }

  const browsingArea = findSocialArea(areas, areaId);
  const postingArea = findSocialArea(areas, postingAreaId);
  const postSafety = useMemo(() => assessSocialPostSafety(postBody), [postBody]);
  const hasActiveFilters = Boolean(areaId || search || order !== 'recent' || page > 0);
  const signInReturnHref = tab === 'neighbourhood' ? currentFeedHref : socialSectionHref(tab);

  return (
    <main className="container social-hub">
      <div className="page-heading social-home-head">
        <div>
          <span className="eyebrow">TrustFive Social · UK neighbourhood network</span>
          <h1>TrustFive Social</h1>
          <p className="subtle">
            Find your neighbourhood, ask for local advice, discover community events, and join local groups safely. Only published, authorised content is shown.
          </p>
        </div>
        {signedIn && tab === 'neighbourhood' ? (
          <div className="social-home-head-actions">
            <button type="button" className="btn" onClick={focusComposer}>
              Write a post
            </button>
          </div>
        ) : null}
      </div>

      <nav aria-label="Social network sections" className="social-hub-tabs">
        {SOCIAL_SECTIONS.map(item => (
          <Link
            key={item.id}
            href={
              item.id === 'neighbourhood'
                ? buildSocialFeedHref('neighbourhood', {areaId, search, order, page})
                : socialSectionHref(item.id)
            }
            scroll={false}
            className={item.id === tab ? 'social-hub-tab active' : 'social-hub-tab'}
            aria-current={item.id === tab ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {accountLoading ? (
        <div className="card" role="status" aria-live="polite" data-testid="social-account-loading">
          Checking your community account…
        </div>
      ) : accountError ? (
        <div className="card" role="alert" data-testid="social-account-error">
          <p style={{margin: '0 0 12px'}}>{accountError}</p>
          <button
            className="btn secondary"
            type="button"
            onClick={() => setAuthRevision(value => value + 1)}
          >
            Retry account check
          </button>
        </div>
      ) : !signedIn ? (
        <section
          className="card social-signed-out-card"
          aria-labelledby="social-signed-out-heading"
          data-testid="social-signed-out"
        >
          <span className="eyebrow">Signed-in residents only</span>
          <h2 id="social-signed-out-heading">Join your local neighbourhood on TrustFive Social</h2>
          <p className="subtle">
            Sign in to browse local conversations, ask neighbours for advice, RSVP to community events, join member groups, and save helpful posts privately.
          </p>
          <ul className="social-signed-out-features">
            <li>
              <strong>Neighbourhood Feed:</strong> local updates and questions without public home addresses or private job details.
            </li>
            <li>
              <strong>Groups &amp; Events:</strong> member-only group discussions and local event RSVPs.
            </li>
            <li>
              <strong>Advice &amp; Saved:</strong> community Q&amp;A kept separate from marketplace lead allocation.
            </li>
          </ul>
          <div className="social-hub-shortcuts" style={{marginBottom: 0}}>
            <Link
              className="btn"
              href={'/account?next=' + encodeURIComponent(signInReturnHref)}
            >
              Sign in to TrustFive Social
            </Link>
            <Link className="btn secondary" href="/services">
              Find an approved professional
            </Link>
          </div>
        </section>
      ) : (
        <>
          {tab === 'neighbourhood' ? (
            <section aria-labelledby="social-neighbourhood-title">
              <div className="social-scope-bar" data-testid="social-scope-bar">
                <div className="social-scope-pills">
                  <span className="social-scope-chip">
                    <strong>Browsing:</strong>{' '}
                    {browsingArea
                      ? `${browsingArea.area_name}, ${browsingArea.city}`
                      : 'All pilot neighbourhoods'}
                  </span>
                  <span className="social-scope-chip">
                    <strong>Posting to:</strong>{' '}
                    {postingArea
                      ? `${postingArea.area_name}, ${postingArea.city}`
                      : 'Choose a neighbourhood below'}
                  </span>
                </div>
                <p className="muted-note" style={{margin: 0}}>
                  <strong>Pilot discovery:</strong> signed-in members can browse listed neighbourhoods until verified resident membership launches. Exact home addresses, customer job details and private quotes never appear here.
                </p>
              </div>

              <section
                className="card social-composer-card"
                aria-labelledby="social-share-title"
                data-testid="social-composer"
              >
                <h2 id="social-share-title" className="social-card-title">
                  Share with your neighbours
                </h2>
                <p className="muted-note" style={{margin: '0 0 12px'}}>
                  Posting location is chosen separately from the neighbourhood you browse. Changing neighbourhoods never carries your draft across areas.
                </p>
                {areas.length === 0 ? (
                  <p role="status" className="notice" style={{margin: 0}}>
                    No neighbourhoods are available to select yet. Posting will open once local areas are listed.
                  </p>
                ) : (
                  <form className="form" onSubmit={publishNeighbourhoodPost}>
                    <label htmlFor="social-post-area">
                      Neighbourhood to post in
                      <select
                        id="social-post-area"
                        ref={composerAreaRef}
                        required
                        value={postingAreaId}
                        onChange={event => selectPostingArea(event.target.value)}
                        disabled={posting || areas.length === 0}
                      >
                        <option value="">Choose a neighbourhood</option>
                        {areas.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.area_name}, {item.city}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label htmlFor="social-post-body">
                      Write your community post
                      <textarea
                        id="social-post-body"
                        ref={composerBodyRef}
                        required
                        minLength={8}
                        maxLength={3000}
                        value={postBody}
                        disabled={posting || !postingAreaId}
                        onChange={event => {
                          const nextVal = event.target.value;
                          setDraftsByArea(prev => setAreaDraft(prev, postingAreaId, nextVal));
                          saveScopedDraft(userId, 'feed', postingAreaId, nextVal);
                          if (restoredDraftArea === postingAreaId) setRestoredDraftArea('');
                          if (postNotice) {
                            setPostNotice('');
                            setPostNoticeIsError(false);
                          }
                        }}
                        aria-describedby="social-composer-guidance"
                        placeholder={
                          postingAreaId
                            ? 'Ask neighbours a question, share local advice or recommend something useful…'
                            : 'Choose a neighbourhood above to start writing…'
                        }
                      />
                    </label>
                    {restoredDraftArea === postingAreaId && postingAreaId ? (
                      <p role="status" className="muted-note" style={{margin: 0}}>
                        Draft recovered for {postingArea ? postingArea.area_name : 'this neighbourhood'}.
                      </p>
                    ) : null}
                    {postSafety.privacyWarnings.length > 0 ? (
                      <div
                        className="notice notice-warn"
                        role="status"
                        data-testid="social-privacy-warning"
                        style={{margin: 0}}
                      >
                        <strong>Privacy reminder:</strong> {postSafety.privacyWarnings.join(' ')}
                      </div>
                    ) : null}
                    <p id="social-composer-guidance" className="muted-note" style={{margin: 0}}>
                      {!postingAreaId ? 'Choose a neighbourhood first. ' : ''}
                      {postBody.length.toLocaleString('en-GB')} / 3,000 characters. Minimum 8 characters. Avoid sharing private addresses or contact details.
                    </p>
                    <div className="social-composer-actions">
                      <button
                        type="submit"
                        className="btn"
                        disabled={
                          posting ||
                          Boolean(
                            socialPostValidationError({
                              authorId: userId,
                              areaId: postingAreaId,
                              availableAreaIds: areas.map(item => item.id),
                              body: postBody,
                            })
                          )
                        }
                      >
                        {posting ? 'Publishing…' : 'Publish neighbourhood post'}
                      </button>
                      {browsingArea && browsingArea.id !== postingAreaId ? (
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={posting}
                          onClick={() => {
                            selectPostingArea(browsingArea.id);
                            window.requestAnimationFrame(() => composerBodyRef.current?.focus());
                          }}
                        >
                          Post in {browsingArea.area_name}
                        </button>
                      ) : null}
                    </div>
                  </form>
                )}
                <SocialMediaPrivacyNotice />
                {postNotice ? (
                  <p
                    role={postNoticeIsError ? 'alert' : 'status'}
                    className={postNoticeIsError ? 'notice error' : 'notice'}
                    style={{marginBottom: 0}}
                  >
                    {postNotice}
                  </p>
                ) : null}
              </section>

              <div className="social-feed-header">
                <h2
                  id="social-neighbourhood-title"
                  ref={feedHeadingRef}
                  tabIndex={-1}
                  style={{margin: 0}}
                >
                  Neighbourhood conversations
                </h2>
                <Link className="job-related-link" href="/community/groups">
                  Browse groups →
                </Link>
              </div>

              <form
                className="card social-hub-filters"
                aria-label="Filter neighbourhood feed"
                onSubmit={submitSearch}
              >
                <label htmlFor="social-filter-query">
                  Search published posts
                  <input
                    id="social-filter-query"
                    type="search"
                    value={query}
                    maxLength={120}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="e.g. CCTV, gardening, renovation"
                  />
                </label>
                <label htmlFor="social-filter-area">
                  Neighbourhood
                  <select
                    id="social-filter-area"
                    value={areaId}
                    onChange={e => changeArea(e.target.value)}
                  >
                    <option value="">All available areas</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.area_name}, {a.city}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="social-filter-order">
                  Order
                  <select
                    id="social-filter-order"
                    value={order}
                    onChange={e => changeOrder(e.target.value as SocialFeedOrder)}
                  >
                    <option value="recent">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </label>
                <button className="btn" type="submit" disabled={loading}>
                  Search posts
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={!hasActiveFilters && !query}
                  onClick={resetFilters}
                >
                  Clear filters
                </button>
              </form>

              {loading ? (
                <div
                  className="card"
                  role="status"
                  aria-live="polite"
                  data-testid="social-feed-loading"
                >
                  Loading matching neighbourhood posts…
                </div>
              ) : error ? (
                <div className="card" role="alert" data-testid="social-feed-error">
                  <p style={{margin: '0 0 12px'}}>{error}</p>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => {
                      feedHeadingRef.current?.focus();
                      setRefreshKey(v => v + 1);
                    }}
                  >
                    Retry loading posts
                  </button>
                </div>
              ) : (
                <>
                  <p role="status" aria-live="polite" className="muted-note">
                    Page {page + 1}: showing {posts.length} published{' '}
                    {posts.length === 1 ? 'post' : 'posts'}
                    {browsingArea ? ` in ${browsingArea.area_name}` : ''}
                    {search ? ` matching “${search}”` : ''}
                    {hasMore ? '; more posts are available.' : '.'}
                  </p>
                  <div className="list" data-testid="social-feed-list">
                    {posts.length === 0 ? (
                      <div className="card" role="status" data-testid="social-feed-empty">
                        <p style={{margin: '0 0 12px'}}>
                          {page > 0
                            ? 'No posts on this page. Go back to the previous page.'
                            : search
                              ? `No published posts match “${search}”.`
                              : browsingArea
                                ? `No published posts in ${browsingArea.area_name} yet.`
                                : 'No published posts in the neighbourhood feed yet.'}
                        </p>
                        <div className="social-hub-shortcuts" style={{margin: 0}}>
                          <button type="button" className="btn" onClick={focusComposer}>
                            Write the first post
                          </button>
                          {hasActiveFilters ? (
                            <button
                              type="button"
                              className="btn secondary"
                              onClick={resetFilters}
                            >
                              Show all neighbourhoods
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      posts.map(post => {
                        const postArea = findSocialArea(areas, post.area_id);
                        const label = postArea
                          ? `${postArea.area_name}, ${postArea.city}`
                          : 'Community area';
                        return (
                          <SocialPostCard
                            key={post.id}
                            post={post}
                            areaLabel={label}
                            userId={userId}
                            returnHref={currentFeedHref}
                          />
                        );
                      })
                    )}
                  </div>
                  <nav aria-label="Neighbourhood feed pages" className="social-hub-shortcuts">
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={page === 0}
                      onClick={() => changePage(page - 1)}
                    >
                      Previous page
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={!hasMore || page >= 500}
                      onClick={() => changePage(page + 1)}
                    >
                      Next page
                    </button>
                  </nav>
                </>
              )}
            </section>
          ) : null}

          {tab === 'trade' ? (
            <>
              <SocialGroupDiscovery key={'groups-' + userId} userId={userId} areas={areas} />
              <SocialTradeCollaboration
                key={'collaboration-' + userId}
                userId={userId}
                areas={areas}
              />
            </>
          ) : null}
          {tab === 'advice' ? (
            <SocialAdviceBoard key={'advice-' + userId} userId={userId} areas={areas} />
          ) : null}
          {tab === 'events' ? (
            <SocialEventsDiscovery key={'events-' + userId} userId={userId} areas={areas} />
          ) : null}
          {tab === 'saved' ? (
            <SocialSavedPosts key={'saved-' + userId} userId={userId} />
          ) : null}
        </>
      )}
    </main>
  );
}
