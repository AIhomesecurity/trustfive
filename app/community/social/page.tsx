'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';
import {findSocialArea,readablePostDate,type SocialArea,type SocialPostSummary} from '../../../lib/social-discovery';
import {socialPageBounds,socialPageRows,socialSearchPattern,type SocialFeedOrder} from '../../../lib/social-feed-paging';
import {socialPostValidationError} from '../../../lib/social-post-composer';
import SocialDiscussion from '../../../components/social-discussion';

type SocialTab='neighbourhood'|'trade'|'advice';
const TABS:{id:SocialTab;label:string}[]=[
 {id:'neighbourhood',label:'Neighbourhood'},
 {id:'trade',label:'Trade Network'},
 {id:'advice',label:'Questions & Advice'}
];

/** Early social hub: honest, signed-in data only; no fabricated social graph. */
export default function TrustFiveSocial(){
 const [tab,setTab]=useState<SocialTab>('neighbourhood');
 const [areas,setAreas]=useState<SocialArea[]>([]);
 const [userId,setUserId]=useState('');
 const [postingAreaId,setPostingAreaId]=useState(''),[postBody,setPostBody]=useState('');
 const [posting,setPosting]=useState(false),[postNotice,setPostNotice]=useState('');
 const publishingRef=useRef(false);
 const [posts,setPosts]=useState<SocialPostSummary[]>([]);
 const [areaId,setAreaId]=useState('');
 const [query,setQuery]=useState('');
 const [search,setSearch]=useState('');
 const [order,setOrder]=useState<SocialFeedOrder>('recent');
 const [page,setPage]=useState(0),[hasMore,setHasMore]=useState(false);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[signedIn,setSignedIn]=useState(false),[accountLoading,setAccountLoading]=useState(true),[accountError,setAccountError]=useState('');
 const [refreshKey,setRefreshKey]=useState(0);

 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const s=supabaseBrowser();
    const result=await s.auth.getUser();
    if(result.error)throw result.error;
    if(!active)return;
    setSignedIn(Boolean(result.data.user));
    setUserId(result.data.user?.id||'');
    if(!result.data.user)return;
    const areasResult=await s.from('service_areas').select('id,area_name,city').order('city').limit(200);
    if(areasResult.error)throw areasResult.error;
    if(active)setAreas(areasResult.data||[]);
   }catch{if(active)setAccountError('Unable to verify your account or neighbourhoods. Try again.');}
   finally{if(active)setAccountLoading(false);}
  })();
  return()=>{active=false;};
 },[]);

 useEffect(()=>{
  if(accountLoading||accountError||!signedIn){setLoading(false);return;}
  let active=true;
  (async()=>{
   setLoading(true);setError('');
   try{
    const s=supabaseBrowser();
    const bounds=socialPageBounds(page);
    let request=s.from('community_posts')
     .select('id,area_id,body,visibility,created_at')
     .eq('visibility','published')
     .order('created_at',{ascending:order==='oldest'})
     .order('id',{ascending:true})
     .range(bounds.from,bounds.to);
    if(areaId)request=request.eq('area_id',areaId);
    if(search.trim())request=request.ilike('body',socialSearchPattern(search));
    const {data,error:readError}=await request;
    if(readError)throw readError;
    if(!active)return;
    const result=socialPageRows((data||[]) as SocialPostSummary[]);
    setPosts(result.items);
    setHasMore(result.hasMore);
   }catch{if(active){setPosts([]);setHasMore(false);setError('Could not load matching posts. Please retry.');}}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[signedIn,accountLoading,accountError,areaId,order,search,page,refreshKey]);

 function changeArea(value:string){setPage(0);setAreaId(value);}
 function changeOrder(value:SocialFeedOrder){setPage(0);setOrder(value);}
 function submitSearch(event:FormEvent){event.preventDefault();setPage(0);setSearch(query.trim());}
 function resetFilters(){setPage(0);setAreaId('');setQuery('');setSearch('');setOrder('recent');}

 async function publishNeighbourhoodPost(event:FormEvent){
  event.preventDefault();
  if(publishingRef.current)return;
  const problem=socialPostValidationError({authorId:userId,areaId:postingAreaId,availableAreaIds:areas.map(item=>item.id),body:postBody});
  if(problem){setPostNotice(problem);return;}
  publishingRef.current=true;setPosting(true);setPostNotice('');
  try{
   const {error:publishError}=await supabaseBrowser().from('community_posts').insert({
    author_id:userId,area_id:postingAreaId,body:postBody.trim(),visibility:'published'
   });
   if(publishError)throw publishError;
   setPostBody('');
   setAreaId(postingAreaId);setQuery('');setSearch('');setPage(0);setOrder('recent');
   setRefreshKey(value=>value+1);
   setPostNotice('Your neighbourhood post was published. If it does not appear immediately, refresh the feed. Do not repost it.');
  }catch{setPostNotice('Your post could not be published. Check your connection and permissions before trying again.');}
  finally{publishingRef.current=false;setPosting(false);}
 }

 return <main className="container social-hub">
  <div className="page-heading">
   <span className="eyebrow">Neighbours and professionals, connected</span>
   <h1>TrustFive Social</h1>
   <p className="subtle">Local conversations, community events and a developing space for trade collaboration. Only published, authorised content is shown.</p>
   <div className="social-hub-shortcuts">
    <Link className="btn secondary" href="/community">Write a neighbourhood post</Link>
    <Link className="btn secondary" href="/community/groups">Explore groups</Link>
    <Link className="btn secondary" href="/community/events">Community events</Link>
   </div>
  </div>
  <nav aria-label="Social network sections" className="social-hub-tabs">
   {TABS.map(item=><button key={item.id} type="button" className={item.id===tab?'social-hub-tab active':'social-hub-tab'} aria-current={item.id===tab?'page':undefined} onClick={()=>setTab(item.id)}>{item.label}</button>)}
  </nav>
  {tab==='neighbourhood'&&<section aria-labelledby="social-neighbourhood-title">
   <h2 id="social-neighbourhood-title">Neighbourhood conversations</h2>
   <p className="subtle">Browse genuine published posts. Search and neighbourhood filters run against the authorised community feed; results are shown 20 at a time.</p>
   {accountLoading?<div className="card" role="status">Checking your community account…</div>:accountError?<div className="card" role="alert"><p>{accountError}</p><button className="btn secondary" type="button" onClick={()=>window.location.reload()}>Retry account check</button></div>:!signedIn?<div className="card"><p>Sign in to read your community feed.</p><Link className="btn" href={'/account?next='+encodeURIComponent('/community/social')}>Sign in to TrustFive Social</Link></div>:<>
    <section className="card" aria-labelledby="social-share-title" style={{marginBottom:16}}>
     <h3 id="social-share-title">Share with your neighbours</h3>
     <p className="muted-note">Choose where to post separately from the neighbourhoods you browse. Posts are visible to other authorised signed-in members. Never include private addresses, customer information or contact details.</p>
     <form className="form" onSubmit={publishNeighbourhoodPost}>
      <label>Neighbourhood to post in
       <select required value={postingAreaId} onChange={event=>{setPostingAreaId(event.target.value);setPostNotice('');}} disabled={posting||areas.length===0}>
        <option value="">Choose a neighbourhood</option>
        {areas.map(item=><option key={item.id} value={item.id}>{item.area_name}, {item.city}</option>)}
       </select>
      </label>
      <label>Write your community post
       <textarea required minLength={8} maxLength={3000} value={postBody} onChange={event=>{setPostBody(event.target.value);setPostNotice('');}} aria-describedby="social-composer-guidance" placeholder="Ask neighbours a question, share advice or recommend something useful…" disabled={posting}/>
      </label>
      <p id="social-composer-guidance" className="muted-note">{postBody.length.toLocaleString('en-GB')} / 3,000 characters. A minimum of 8 characters is required.</p>
      <button type="submit" className="btn" disabled={posting||Boolean(socialPostValidationError({authorId:userId,areaId:postingAreaId,availableAreaIds:areas.map(item=>item.id),body:postBody}))}>{posting?'Publishing…':'Publish neighbourhood post'}</button>
     </form>
     {postNotice&&<p role="status" className="notice">{postNotice}</p>}
    </section>
    <form className="card social-hub-filters" onSubmit={submitSearch}>
     <label>Search published posts<input type="search" value={query} maxLength={120} onChange={e=>setQuery(e.target.value)} placeholder="e.g. CCTV, gardening, renovation"/></label>
     <label>Neighbourhood<select value={areaId} onChange={e=>changeArea(e.target.value)}><option value="">All available areas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.area_name}, {a.city}</option>)}</select></label>
     <label>Order<select value={order} onChange={e=>changeOrder(e.target.value as SocialFeedOrder)}><option value="recent">Newest first</option><option value="oldest">Oldest first</option></select></label>
     <button className="btn" type="submit" disabled={loading}>Search posts</button>
     <button className="btn secondary" type="button" onClick={resetFilters}>Clear filters</button>
    </form>
    {loading?<div className="card" role="status" aria-live="polite">Loading matching community posts…</div>:error?<div className="card" role="alert"><p>{error}</p><button className="btn secondary" type="button" onClick={()=>setRefreshKey(v=>v+1)}>Retry loading posts</button></div>:<>
     <p role="status" aria-live="polite" className="muted-note">Page {page+1}: showing {posts.length} published {posts.length===1?'post':'posts'}{hasMore?'; more posts are available.':'.'}</p>
     <div className="list">
      {posts.length===0&&<div className="card" role="status">{page>0?'No posts on this page. Go back to the previous page.': 'No published posts match your filters.'} <Link href="/community">Visit the community feed</Link>.</div>}
      {posts.map(post=><article className="card" key={post.id}>
       <span className="pill">{findSocialArea(areas,post.area_id)?.area_name||'Community area'}</span>
       <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginTop:12}}>{post.body}</p>
       <p className="muted-note" style={{marginTop:12}}><time dateTime={post.created_at}>{readablePostDate(post.created_at)}</time></p>
       <SocialDiscussion postId={post.id} userId={userId}/>
       <Link className="btn secondary" href="/community">View full community</Link>
      </article>)}
     </div>
     <nav aria-label="Neighbourhood feed pages" className="social-hub-shortcuts">
      <button type="button" className="btn secondary" disabled={page===0} onClick={()=>setPage(v=>Math.max(0,v-1))}>Previous page</button>
      <button type="button" className="btn secondary" disabled={!hasMore||page>=500} onClick={()=>setPage(v=>v+1)}>Next page</button>
     </nav>
    </>}
   </>}
  </section>}
  {tab==='trade'&&<section className="card" aria-labelledby="social-trade-title">
   <span className="eyebrow">Professional community</span>
   <h2 id="social-trade-title">Trade Network</h2>
   <p>We're building a dedicated space for professional discussions, specialist advice and safe collaboration requests. The professional social feed and job exchange are not yet live.</p>
   <p className="muted-note">Joining a discussion will not grant approved professional status. Customer job details and exact addresses cannot be shared here without customer consent and server authorisation. TrustFive's five-approved-professionals-per-trade-per-area rule stays independent.</p>
   <Link className="btn secondary" href="/services">Explore the existing approved directory</Link>
  </section>}
  {tab==='advice'&&<section className="card" aria-labelledby="social-advice-title">
   <span className="eyebrow">Help from your community</span>
   <h2 id="social-advice-title">Questions & Advice</h2>
   <p>Ask your neighbours about home improvement, maintenance or local services through the existing community composer. Dedicated question categories and verified professional answer badges are being developed; we will not assign them to existing posts without evidence.</p>
   <p className="muted-note">For electrical, gas or other regulated work, use a suitably qualified professional. Social replies are not a substitute for a professional inspection.</p>
   <Link className="btn" href="/community">Ask in the neighbourhood community</Link>
  </section>}
 </main>;
}
