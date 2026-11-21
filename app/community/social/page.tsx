'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';
import {findSocialArea,readablePostDate,selectSocialPosts,type SocialArea,type SocialPostSummary,type FeedOrder} from '../../../lib/social-discovery';

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
 const [posts,setPosts]=useState<SocialPostSummary[]>([]);
 const [areaId,setAreaId]=useState('');
 const [query,setQuery]=useState('');
 const [order,setOrder]=useState<FeedOrder>('recent');
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[signedIn,setSignedIn]=useState(false);
 const [refreshKey,setRefreshKey]=useState(0);
 const visible=useMemo(()=>selectSocialPosts(posts,{areaId,query,order}),[posts,areaId,query,order]);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   setLoading(true);setError('');
   try{
    const s=supabaseBrowser();
    const auth=await s.auth.getUser();
    if(auth.error)throw auth.error;
    if(!active)return;
    if(!auth.data.user){setSignedIn(false);setLoading(false);return;}
    setSignedIn(true);
    const [areasResult,postsResult]=await Promise.all([
     s.from('service_areas').select('id,area_name,city').order('city').limit(200),
     s.from('community_posts').select('id,area_id,body,visibility,created_at').eq('visibility','published').order('created_at',{ascending:false}).limit(100)
    ]);
    if(areasResult.error)throw areasResult.error;
    if(postsResult.error)throw postsResult.error;
    if(!active)return;
    setAreas(areasResult.data||[]);
    setPosts(postsResult.data||[]);
   }catch{
    if(active){setPosts([]);setError('Community posts could not be loaded. Please retry.');}
   }finally{if(active)setLoading(false);}
  };
  void load();
  return()=>{active=false;};
 },[refreshKey]);
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
   <p className="subtle">Posts shared to the signed-in community. Search currently covers the most recent 100 published posts; older discussions are not included.</p>
   {loading?<div className="card" role="status">Loading neighbourhood posts…</div>:error?<div className="card" role="alert"><p>{error}</p><button className="btn secondary" type="button" onClick={()=>setRefreshKey(value=>value+1)}>Retry loading posts</button></div>:!signedIn?<div className="card"><p>Sign in to read your community feed.</p><Link className="btn" href={'/account?next='+encodeURIComponent('/community/social')}>Sign in to TrustFive Social</Link></div>:<>
    <div className="card social-hub-filters">
     <label>Search current posts<input type="search" value={query} maxLength={120} onChange={e=>setQuery(e.target.value)} placeholder="Search words in community posts"/></label>
     <label>Neighbourhood<select value={areaId} onChange={e=>setAreaId(e.target.value)}><option value="">All available areas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.area_name}, {a.city}</option>)}</select></label>
     <label>Order<select value={order} onChange={e=>setOrder(e.target.value as FeedOrder)}><option value="recent">Newest first</option><option value="oldest">Oldest first</option></select></label>
     <button className="btn secondary" type="button" onClick={()=>{setAreaId('');setQuery('');setOrder('recent');}}>Clear filters</button>
    </div>
    <p role="status" aria-live="polite" className="muted-note">{visible.length} matching {visible.length===1?'post':'posts'} in the loaded feed.</p>
    <div className="list">
     {visible.length===0&&<div className="card" role="status">{posts.length===0?'No neighbourhood posts are currently listed.':'No posts match the current filters.'} <Link href="/community">Visit the community feed</Link>.</div>}
     {visible.map(post=><article className="card" key={post.id}>
      <span className="pill">{findSocialArea(areas,post.area_id)?.area_name||'Community area'}</span>
      <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginTop:12}}>{post.body}</p>
      <p className="muted-note" style={{marginTop:12}}><time dateTime={post.created_at}>{readablePostDate(post.created_at)}</time></p>
      <Link className="btn secondary" href="/community">View community conversations</Link>
     </article>)}
    </div>
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
