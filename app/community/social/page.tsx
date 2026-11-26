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
          <p role="status">Loading Socialâ€¦</p>
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
    const epoch = authEçİ8¶‰ËkºwµçH‚ˆ™ZYÚ›İ\šÛÙÛÛ™\œØ][ÛœÂˆÚ‚ˆ[šÈÛ\ÜÓ˜[YOHš›Ø‹\™[]Y[[šÈˆ™YH‹ØÛÛ[][š]KÙÜ›İ\È‚ˆœ›İÜÙHÜ›İ\È8¡¤‚ˆÓ[šÏ‚ˆÙ]‚‚ˆ›Ü›BˆÛ\ÜÓ˜[YOH˜Ø\™ÛØÚX[ZX‹Yš[\œÈ‚ˆ\šXK[X™[H‘š[\ˆ™ZYÚ›İ\šÛÙ™YY‚ˆÛ”İX›Z]^ÜİX›Z]ÙX\˜ÚBˆ‚ˆX™[[›ÜHœÛØÚX[Yš[\‹\]Y\H‚ˆÙX\˜ÚX›\ÚYÜİÂˆ[œ]ˆYHœÛØÚX[Yš[\‹\]Y\H‚ˆ\OHœÙX\˜Ú‚ˆ˜[YO^Ü]Y\_BˆX^[™İ^ÌLŒBˆÛÚ[™ÙO^ÙHOˆÙ]]Y\JK\™Ù]˜[YJ_BˆXÙZÛ\H™K™ËˆĞÕ‹Ø\™[š[™Ë™[›İ˜][Ûˆ‚ˆÏ‚ˆÛX™[‚ˆX™[[›ÜHœÛØÚX[Yš[\‹X\™XH‚ˆ™ZYÚ›İ\šÛÙˆÙ[XİˆYHœÛØÚX[Yš[\‹X\™XH‚ˆ˜[YO^Ø\™XRYBˆÛÚ[™ÙO^ÙHOˆÚ[™ÙP\™XJK\™Ù]˜[YJ_Bˆ‚ˆÜ[Ûˆ˜[YOHˆ[]˜Z[X›H\™X\ÏÛÜ[Û‚ˆØ\™X\Ë›X\
HOˆ
ˆÜ[ÛˆÙ^O^ØKšYH˜[YO^ØKšYO‚ˆØK˜\™XWÛ˜[Y_KØK˜Ú]_BˆÛÜ[Û‚ˆ
J_BˆÜÙ[Xİ‚ˆÛX™[‚ˆX™[[›ÜHœÛØÚX[Yš[\‹[Ü™\ˆ‚ˆÜ™\‚ˆÙ[XİˆYHœÛØÚX[Yš[\‹[Ü™\ˆ‚ˆ˜[YO^ÛÜ™\ŸBˆÛÚ[™ÙO^ÙHOˆÚ[™ÙSÜ™\ŠK\™Ù]˜[YH\ÈÛØÚX[™YYÜ™\Š_Bˆ‚ˆÜ[Ûˆ˜[YOHœ™XÙ[“™]Ù\İš\œİÛÜ[Û‚ˆÜ[Ûˆ˜[YOH›Û\İ“Û\İš\œİÛÜ[Û‚ˆÜÙ[Xİ‚ˆÛX™[‚ˆ]ÛˆÛ\ÜÓ˜[YOH˜ˆˆ\OHœİX›Z]ˆ\ØX›Y^ÛØY[™ßO‚ˆÙX\˜ÚÜİÂˆØ]Û‚ˆ]Û‚ˆÛ\ÜÓ˜[YOH˜ˆÙXÛÛ™\H‚ˆ\OH˜]Ûˆ‚ˆ\ØX›Y^ÈZ\ĞXİ]™Qš[\œÈ	‰ˆ\]Y\_BˆÛÛXÚÏ^Ü™\Ù]š[\œßBˆ‚ˆÛX\ˆš[\œÂˆØ]Û‚ˆÙ›Ü›O‚‚ˆÛØY[™ÈÈ
ˆ]‚ˆÛ\ÜÓ˜[YOH˜Ø\™‚ˆ›ÛOHœİ]\È‚ˆ\šXK[]™OHœÛ]H‚ˆ]K]\İYHœÛØÚX[Y™YY[ØY[™È‚ˆ‚ˆØY[™ÈX]Ú[™È™ZYÚ›İ\šÛÙÜİø )‚ˆÙ]‚ˆ
Hˆ\œ›ÜˆÈ
ˆ]ˆÛ\ÜÓ˜[YOH˜Ø\™ˆ›ÛOH˜[\ˆ]K]\İYHœÛØÚX[Y™YYY\œ›Üˆ‚ˆİ[O^ŞÛX\™Ú[ˆ	ÌLœ	ß_OÙ\œ›ÜŸOÜ‚ˆ]Û‚ˆÛ\ÜÓ˜[YOH˜ˆÙXÛÛ™\H‚ˆ\OH˜]Ûˆ‚ˆÛÛXÚÏ^Ê
HOˆÂˆ™YYXY[™Ô™Y‹˜İ\œ™[Ë™›Øİ\Ê
NÂˆÙ]™Yœ™\ÚÙ^JˆOˆˆ
ÈJNÂˆ_Bˆ‚ˆ™]HØY[™ÈÜİÂˆØ]Û‚ˆÙ]‚ˆ
Hˆ
ˆ‚ˆ›ÛOHœİ]\Èˆ\šXK[]™OHœÛ]HˆÛ\ÜÓ˜[YOH›]]Y[›İH‚ˆYÙHÜYÙH
È_NˆÚİÚ[™ÈÜÜİË›[™İHX›\ÚYÉÈ	ßBˆÜÜİË›[™İOOHHÈ	ÜÜİ	Èˆ	ÜÜİÉßBˆØœ›İÜÚ[™Ğ\™XHÈ[ˆ	Øœ›İÜÚ[™Ğ\™XK˜\™XWÛ˜[Y_Xˆ	ÉßBˆÜÙX\˜ÚÈX]Ú[™È8 '	ÜÙX\˜Úx 'Xˆ	ÉßBˆÚ\Ó[Ü™HÈ	ÎÈ[Ü™HÜİÈ\™H]˜Z[X›K‰Èˆ	Ë‰ßBˆÜ‚ˆ]ˆÛ\ÜÓ˜[YOH›\İˆ]K]\İYHœÛØÚX[Y™YY[\İ‚ˆÜÜİË›[™İOOHÈ
ˆ]ˆÛ\ÜÓ˜[YOH˜Ø\™ˆ›ÛOHœİ]\Èˆ]K]\İYHœÛØÚX[Y™YYY[\H‚ˆİ[O^ŞÛX\™Ú[ˆ	ÌLœ	ß_O‚ˆÜYÙHˆˆÈ	Ó›ÈÜİÈÛˆ\ÈYÙKˆÛÈ˜XÚÈÈH™]š[İ\ÈYÙK‰ÂˆˆÙX\˜ÚˆÈ›ÈX›\ÚYÜİÈX]Ú8 '	ÜÙX\˜Úx 'K˜ˆˆœ›İÜÚ[™Ğ\™XBˆÈ›ÈX›\ÚYÜİÈ[ˆ	Øœ›İÜÚ[™Ğ\™XK˜\™XWÛ˜[Y_HY]˜ˆˆ	Ó›ÈX›\ÚYÜİÈ[ˆH™ZYÚ›İ\šÛÙ™YYY]‰ßBˆÜ‚ˆ]ˆÛ\ÜÓ˜[YOHœÛØÚX[ZX‹\ÚÜİ]Èˆİ[O^ŞÛX\™Ú[ˆ_O‚ˆ]Ûˆ\OH˜]ÛˆˆÛ\ÜÓ˜[YOH˜ˆˆÛÛXÚÏ^Ù›Øİ\ĞÛÛ\ÜÙ\ŸO‚ˆÜš]HHš\œİÜİˆØ]Û‚ˆÚ\ĞXİ]™Qš[\œÈÈ
ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛ\ÜÓ˜[YOH˜ˆÙXÛÛ™\H‚ˆÛÛXÚÏ^Ü™\Ù]š[\œßBˆ‚ˆÚİÈ[™ZYÚ›İ\šÛÙÂˆØ]Û‚ˆ
Hˆ[BˆÙ]‚ˆÙ]‚ˆ
Hˆ
ˆÜİË›X\
ÜİOˆÂˆÛÛœİÜİ\™XHHš[™ÛØÚX[\™XJ\™X\ËÜİ˜\™XWÚY
NÂˆÛÛœİX™[HÜİ\™XBˆÈ	ÜÜİ\™XK˜\™XWÛ˜[Y_K	ÜÜİ\™XK˜Ú]_Xˆˆ	ĞÛÛ[][š]H\™XIÎÂˆ™]\›ˆ
ˆÛØÚX[ÜİØ\™ˆÙ^O^ÜÜİšYBˆÜİ^ÜÜİBˆ\™XSX™[^ÛX™[Bˆ\Ù\’Y^İ\Ù\’YBˆ™]\›’™Y^Øİ\œ™[™YY™YŸBˆÏ‚ˆ
NÂˆJBˆ
_BˆÙ]‚ˆ˜]ˆ\šXK[X™[H“™ZYÚ›İ\šÛÙ™YYYÙ\ÈˆÛ\ÜÓ˜[YOHœÛØÚX[ZX‹\ÚÜİ]È‚ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛ\ÜÓ˜[YOH˜ˆÙXÛÛ™\H‚ˆ\ØX›Y^ÜYÙHOOHBˆÛÛXÚÏ^Ê
HOˆÚ[™ÙTYÙJYÙHHJ_Bˆ‚ˆ™]š[İ\ÈYÙBˆØ]Û‚ˆ]Û‚ˆ\OH˜]Ûˆ‚ˆÛ\ÜÓ˜[YOH˜ˆÙXÛÛ™\H‚ˆ\ØX›Y^ÈZ\Ó[Ü™HYÙHHLBˆÛÛXÚÏ^Ê
HOˆÚ[™ÙTYÙJYÙH
ÈJ_Bˆ‚ˆ™^YÙBˆØ]Û‚ˆÛ˜]‚ˆÏ‚ˆ
_BˆÜÙXİ[Û‚ˆ
Hˆ[B‚ˆİXˆOOH	İ˜YIÈÈ
ˆ‚ˆÛØÚX[Ü›İ\\ØÛİ™\HÙ^O^ÉÙÜ›İ\ËIÈ
È\Ù\’YH\Ù\’Y^İ\Ù\’YH\™X\Ï^Ø\™X\ßHÏ‚ˆÛØÚX[˜YPÛÛX›Ü˜][Û‚ˆÙ^O^ÉØÛÛX›Ü˜][Û‹IÈ
È\Ù\’YBˆ\Ù\’Y^İ\Ù\’YBˆ\™X\Ï^Ø\™X\ßBˆÏ‚ˆÏ‚ˆ
Hˆ[BˆİXˆOOH	ØYšXÙIÈÈ
ˆÛØÚX[YšXÙP›Ø\™Ù^O^ÉØYšXÙKIÈ
È\Ù\’YH\Ù\’Y^İ\Ù\’YH\™X\Ï^Ø\™X\ßHÏ‚ˆ
Hˆ[BˆİXˆOOH	Ù]™[ÉÈÈ
ˆÛØÚX[]™[Ñ\ØÛİ™\HÙ^O^ÉÙ]™[ËIÈ
È\Ù\’YH\Ù\’Y^İ\Ù\’YH\™X\Ï^Ø\™X\ßHÏ‚ˆ
Hˆ[BˆİXˆOOH	ÜØ]™Y	ÈÈ
ˆÛØÚX[Ø]™YÜİÈÙ^O^ÉÜØ]™YIÈ
È\Ù\’YH\Ù\’Y^İ\Ù\’YHÏ‚ˆ
Hˆ[BˆÏ‚ˆ
_BˆÛXZ[‚ˆ
NÂŸB