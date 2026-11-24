'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../lib/supabase';
import {type SocialArea} from '../lib/social-discovery';
import {socialPageBounds,socialPageRows} from '../lib/social-feed-paging';
import {socialGroupAreaLabel,socialGroupSearchPattern,socialOwnGroupIds,type SocialGroupSummary} from '../lib/social-group-discovery';

export default function SocialGroupDiscovery({userId,areas}:{userId:string;areas:SocialArea[]}){
 const [input,setInput]=useState(''),[search,setSearch]=useState(''),[areaId,setAreaId]=useState('');
 const [myGroupsOnly,setMyGroupsOnly]=useState(false);
 const [membershipOwner,setMembershipOwner]=useState(''),[ownGroupIds,setOwnGroupIds]=useState<string[]>([]);
 const [membershipError,setMembershipError]=useState(''),[membershipRetry,setMembershipRetry]=useState(0);
 const [page,setPage]=useState(0),[retry,setRetry]=useState(0);
 const [groups,setGroups]=useState<SocialGroupSummary[]>([]);
 const [hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const headingRef=useRef<HTMLHeadingElement>(null);

 useEffect(()=>{
  let active=true;
  setMembershipOwner('');setOwnGroupIds([]);setMembershipError('');
  if(!userId)return()=>{active=false;};
  (async()=>{
   try{
    const result=await supabaseBrowser().from('community_group_memberships')
     .select('group_id,user_id').eq('user_id',userId).order('joined_at',{ascending:false}).limit(200);
    if(result.error)throw result.error;
    if(!active)return;
    setOwnGroupIds(socialOwnGroupIds(result.data||[],userId));setMembershipOwner(userId);
   }catch{
    if(active){setMembershipOwner(userId);setMembershipError('Could not verify your group memberships. Retry My groups.');}
   }
  })();
  return()=>{active=false;};
 },[userId,membershipRetry]);

 const membershipFilterKey=myGroupsOnly?`${membershipOwner}:${membershipError}:${ownGroupIds.join(',')}`:'all';

 useEffect(()=>{
  if(!userId){setLoading(false);return;}
  if(myGroupsOnly&&membershipOwner!==userId){setLoading(true);return;}
  if(myGroupsOnly&&membershipError){setLoading(false);return;}
  if(myGroupsOnly&&ownGroupIds.length===0){
   setGroups([]);setHasMore(false);setLoading(false);setError('');return;
  }
  let active=true;
  (async()=>{
   setLoading(true);setError('');
   try{
    const bounds=socialPageBounds(page);
    let request=supabaseBrowser().from('community_groups')
     .select('id,area_id,name,description,created_at')
     .eq('visibility','public')
     .order('created_at',{ascending:false})
     .order('id',{ascending:true})
     .range(bounds.from,bounds.to);
    if(areaId)request=request.eq('area_id',areaId);
    if(myGroupsOnly)request=request.in('id',ownGroupIds);
    const pattern=socialGroupSearchPattern(search);
    if(pattern)request=request.ilike('name',pattern);
    const {data,error:queryError}=await request;
    if(queryError)throw queryError;
    if(!active)return;
    const selection=socialPageRows((data||[]) as SocialGroupSummary[]);
    setGroups(selection.items);setHasMore(selection.hasMore);
   }catch{if(active){setGroups([]);setHasMore(false);setError('Public community groups could not be loaded. Please retry.');}}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[userId,areaId,search,page,retry,myGroupsOnly,membershipFilterKey]);

 function searchGroups(event:FormEvent){event.preventDefault();setSearch(input.trim());setPage(0);}
 function clearGroupFilters(){setInput('');setSearch('');setAreaId('');setMyGroupsOnly(false);setPage(0);}
 const hasGroupFilters=Boolean(search||areaId||myGroupsOnly||page>0);

 return <section aria-labelledby="social-trade-title">
  <span className="eyebrow">People sharing practical knowledge</span>
  <h2 id="social-trade-title" ref={headingRef} tabIndex={-1}>Trade Network &amp; Community Groups</h2>
  <p className="subtle">Explore actual public TrustFive community groups, including any formed around trades and specialist interests. A group&apos;s name does not prove its members are verified or approved professionals.</p>
  <div className="card" style={{marginBottom:16}}>
   <h3>Professional collaboration is being developed</h3>
   <p className="muted-note">Use these groups for general conversation only. Never publish a customer&apos;s address, contact details, quote, protected lead or private job information. Sharing in Social does not grant marketplace approval, a sixth professional slot, or access to private customer work.</p>
   <div className="social-hub-shortcuts" style={{marginBottom:0}}>
    <Link className="btn secondary" href="/services">Find genuinely approved professionals</Link>
    <Link className="btn secondary" href="/community/groups">Create or manage groups</Link>
   </div>
  </div>
  {!userId?<div className="card" role="status">Sign in to discover TrustFive groups.</div>:<>
   <form className="card social-hub-filters" onSubmit={searchGroups}>
    <label>Search group names<input type="search" value={input} maxLength={120}
     placeholder="e.g. CCTV, plumbing, electricians"
     onChange={event=>setInput(event.target.value)}/></label>
    <label>Neighbourhood<select value={areaId} onChange={event=>{setAreaId(event.target.value);setPage(0);}}>
     <option value="">All available areas</option>
     {areas.map(item=><option key={item.id} value={item.id}>{item.area_name}, {item.city}</option>)}
    </select></label>
    <label style={{display:'flex',alignItems:'center',gap:8,alignSelf:'end',minHeight:44}}><input type="checkbox" style={{width:18,height:18}} checked={myGroupsOnly} onChange={event=>{setMyGroupsOnly(event.target.checked);setPage(0);}}/> My groups only</label>
    <button type="submit" className="btn" disabled={loading}>Find groups</button>
    <button type="button" className="btn secondary" disabled={!hasGroupFilters&&!input} onClick={clearGroupFilters}>Clear filters</button>
   </form>
   {myGroupsOnly&&membershipError?<div className="card" role="alert"><p>{membershipError}</p><button className="btn secondary" type="button" onClick={()=>{headingRef.current?.focus();setMembershipRetry(v=>v+1);}}>Retry memberships</button></div>
   :loading?<div className="card" role="status">Loading public groups…</div>
   :error?<div className="card" role="alert"><p>{error}</p><button type="button" className="btn secondary" onClick={()=>{headingRef.current?.focus();setRetry(n=>n+1);}}>Retry groups</button></div>
   :<>
    <p className="muted-note" role="status">Page {page+1}: {groups.length} public {groups.length===1?'group':'groups'}.</p>
    <div className="list">
     {!groups.length&&<div className="card" role="status">
      <p style={{margin:'0 0 12px'}}>{myGroupsOnly?'No joined groups match these filters. Join a group from the public directory first.':'No public groups match the current filters. You can create a new group from the groups directory.'}</p>
      <div className="social-hub-shortcuts" style={{margin:0}}>
       {myGroupsOnly?<button type="button" className="btn" onClick={()=>{setMyGroupsOnly(false);setPage(0);headingRef.current?.focus();}}>Show all public groups</button>
        :hasGroupFilters?<button type="button" className="btn secondary" onClick={()=>{clearGroupFilters();headingRef.current?.focus();}}>Clear filters</button>:null}
       <Link className="btn secondary" href="/community/groups">Create a group</Link>
      </div>
     </div>}
     {groups.map(group=><article key={group.id} className="card">
      <span className="pill">{socialGroupAreaLabel(group.area_id,areas)}</span>
      <h3 style={{marginTop:12}}>{group.name}</h3>
      <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{group.description}</p>
      <p className="muted-note">Public group — membership is not a professional verification</p>
      <Link className="btn secondary" href={`/community/groups/${group.id}`}>Open this group</Link>
     </article>)}
    </div>
    <nav className="social-hub-shortcuts" aria-label="Public group pages">
     <button type="button" className="btn secondary" disabled={page===0} onClick={()=>setPage(n=>Math.max(0,n-1))}>Previous groups</button>
     <button type="button" className="btn secondary" disabled={!hasMore||page>=500} onClick={()=>setPage(n=>n+1)}>Next groups</button>
    </nav>
   </>}
  </>}
 </section>;
}
