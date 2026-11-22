'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';
import {filterLoadedCommunityGroups} from '../../../lib/community-group-search';
import {canPublishCommunityGroupPost} from '../../../lib/community-group-publishing';
type Area={id:string;area_name:string;city:string};
type Group={id:string;area_id:string;name:string;description:string;created_at:string};
type Membership={group_id:string;role:string};
type Post={id:string;group_id:string;body:string;created_at:string};
export default function CommunityGroups(){
 const [userId,setUserId]=useState('');
 const [areas,setAreas]=useState<Area[]>([]);
 const [groups,setGroups]=useState<Group[]>([]);
 const [groupSearch,setGroupSearch]=useState('');
 const [memberships,setMemberships]=useState<Membership[]>([]);
 const [posts,setPosts]=useState<Post[]>([]);
 const [area,setArea]=useState(''),[name,setName]=useState(''),[description,setDescription]=useState('');
 const [selected,setSelected]=useState(''),[postBody,setPostBody]=useState('');
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(false);
 const [postsLoading,setPostsLoading]=useState(false),[postsError,setPostsError]=useState(false);
 const selectedRequest=useRef(0);
 const selectedHeadingRef=useRef<HTMLHeadingElement>(null);
 const lastOpenedGroupButton=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{if(selected)selectedHeadingRef.current?.focus();},[selected]);
 async function load(){
  const s=supabaseBrowser();
  const [g,m]=await Promise.all([
   s.from('community_groups').select('id,area_id,name,description,created_at').order('created_at',{ascending:false}).limit(100),
   s.from('community_group_memberships').select('group_id,role')
  ]);
  if(g.error)throw g.error;if(m.error)throw m.error;
  setGroups(g.data||[]);setMemberships(m.data||[]);setLoadError(false);
 }
 async function loadPosts(id:string){
  const request=++selectedRequest.current;
  if(!id){setPosts([]);return;}
  const {data,error}=await supabaseBrowser().from('community_group_posts')
    .select('id,group_id,body,created_at').eq('group_id',id).order('created_at',{ascending:false}).limit(50);
  if(error)throw error;if(request===selectedRequest.current)setPosts(data||[]);
 }
 useEffect(()=>{(async()=>{try{
  const s=supabaseBrowser();
  const [{data:{user}},a]=await Promise.all([
   s.auth.getUser(),s.from('service_areas').select('id,area_name,city').order('city')
  ]);
  if(!user){setNotice('Sign in to join community groups.');return;}
  if(a.error)throw a.error;setUserId(user.id);setAreas(a.data||[]);await load();
 }catch{setLoadError(true);setNotice('Unable to load community groups. Please try again.');}finally{setLoading(false);}})()},[]);
 async function retryGroups(){if(busy)return;setBusy(true);setNotice('');try{await load();}catch{setLoadError(true);setNotice('Unable to load community groups. Please try again.');}finally{setBusy(false);}}
 async function create(e:FormEvent){e.preventDefault();if(busy||!userId)return;
  setBusy(true);setNotice('');
  try{
   const {error}=await supabaseBrowser().from('community_groups')
    .insert({creator_id:userId,area_id:area,name:name.trim(),description:description.trim()});
   if(error)throw error;setName('');setDescription('');
   // Creation succeeded: a listing refresh failure must not invite a duplicate group.
   try{await load();setNotice('Group created. You are the founding member.');}
   catch{setNotice('Group created, but the group list could not be refreshed. Reload the page to see it.');}
  }catch(e){setNotice(e instanceof Error?e.message:'Unable to create group');}
  finally{setBusy(false);}
 }
 async function join(groupId:string){if(busy)return;setBusy(true);
  try{
   const {error}=await supabaseBrowser().from('community_group_memberships')
    .insert({group_id:groupId,user_id:userId,role:'member'});
   if(error)throw error;
   try{await load();setNotice('You have joined this community group.');}
   catch{setNotice('You joined the group, but the group list could not be refreshed. Retry loading groups to see your membership.');}
  }catch(e){setNotice(e instanceof Error?e.message:'Unable to join group');}
  finally{setBusy(false);}
 }
 async function choose(id:string,opener:HTMLButtonElement){if(busy)return;lastOpenedGroupButton.current=opener;setSelected(id);setPostBody('');setPosts([]);setPostsError(false);setPostsLoading(true);setNotice('');
  const request=selectedRequest.current+1;
  try{await loadPosts(id)}catch{if(request===selectedRequest.current){setPostsError(true);setNotice('Unable to load group posts. Please retry.');}}
  finally{if(request===selectedRequest.current)setPostsLoading(false);}
 }
 async function retryPosts(){
  if(!selected||busy||postsLoading)return;
  const id=selected;
  const request=selectedRequest.current+1;
  setPostsError(false);setPostsLoading(true);setNotice('');
  try{await loadPosts(id)}
  catch{if(request===selectedRequest.current){setPostsError(true);setNotice('Unable to load group posts. Please retry.');}}
  finally{if(request===selectedRequest.current)setPostsLoading(false);}
 }
 async function publish(e:FormEvent){e.preventDefault();if(!canPublishCommunityGroupPost({signedIn:Boolean(userId),selectedGroupId:selected,memberGroupIds:memberships.map(m=>m.group_id),body:postBody,busy,postsLoading,postsError}))return;setBusy(true);
  try{
   const {error}=await supabaseBrowser().from('community_group_posts')
    .insert({group_id:selected,author_id:userId,body:postBody.trim()});
   if(error)throw error;setPostBody('');
   // The insert succeeded even if reading the updated post list fails.
   try{await loadPosts(selected);setNotice('Post published to your group.');}
   catch{setPostsError(true);setPosts([]);setNotice('Post published, but group posts could not be refreshed. Retry loading posts to see it.');}
  }catch(e){setNotice(e instanceof Error?e.message:'Unable to publish group post');}
  finally{setBusy(false);}
 }
 const filteredGroups=filterLoadedCommunityGroups(groups,areas,groupSearch);
 return <main className="container">
  <div className="page-heading"><span className="eyebrow">Find your people</span><h1>Neighbourhood groups</h1>
  <p className="subtle">Create or join local interest groups and share updates with members.</p></div>
  {notice&&<p className="notice" role="status">{notice}</p>}
  {loading?<p role="status">Loading community groups…</p>:loadError&&!userId?<div className="card" role="alert"><p>We could not check your account or load neighbourhoods. Please try again.</p><button type="button" className="btn secondary" onClick={()=>window.location.reload()}>Retry loading groups</button></div>:!userId?<Link className="btn" href="/account">Sign in</Link>:
  <div className="two-col">
   <section><div className="card"><h2>Start a group</h2>
    {areas.length===0&&<p role="status" className="muted-note">No neighbourhoods are available to select yet. Creating a group is unavailable until an area is listed.</p>}
    <form className="form" onSubmit={create}>
     <label>Neighbourhood<select required value={area} onChange={e=>setArea(e.target.value)}>
      <option value="">Choose area</option>{areas.map(a=><option value={a.id} key={a.id}>{a.area_name}, {a.city}</option>)}
     </select></label>
     <label>Group name<input required minLength={4} maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Community gardeners"/></label>
     <label>What is this group about?<textarea required minLength={15} maxLength={1200} value={description} onChange={e=>setDescription(e.target.value)}/></label>
     <button className="btn" disabled={busy||areas.length===0} type="submit">Create community group</button>
    </form><p className="muted-note">Groups are publicly discoverable to signed-in members in this pilot. Address verification and private groups are not yet supported.</p>
   </div></section>
   <section><h2>Explore groups</h2>
    <div className="card"><label htmlFor="community-group-search">Find a group by name, topic, neighbourhood or city</label>
     <input id="community-group-search" type="search" maxLength={120} value={groupSearch} onChange={e=>setGroupSearch(e.target.value)} placeholder="Try CCTV, alarms or Manchester" aria-describedby="community-group-search-help"/>
     <p id="community-group-search-help" className="muted-note">Search covers the 100 most recently listed groups, not every group on TrustFive.</p>
     {!loadError&&<p role="status" aria-live="polite" className="muted-note">{filteredGroups.length} matching {filteredGroups.length===1?'group':'groups'} in the loaded list.</p>}
    </div><div className="list">
    {!loading&&loadError&&<div className="card" role="alert"><p>Community groups could not be loaded. We cannot confirm whether any groups are available.</p><button type="button" className="btn secondary" disabled={busy} onClick={retryGroups}>Try loading groups again</button></div>}
    {!loading&&!loadError&&groups.length===0&&<div className="card">No groups yet. Start the first one!</div>}
    {!loading&&!loadError&&groups.length>0&&filteredGroups.length===0&&<div className="card" role="status">No listed groups match your search. <button type="button" className="btn secondary" onClick={()=>setGroupSearch('')}>Clear group search</button></div>}
    {!loadError&&filteredGroups.map(g=>{const member=memberships.some(m=>m.group_id===g.id);return <article className="card" key={g.id}>
     <span className="pill">{areas.find(a=>a.id===g.area_id)?.area_name||'Neighbourhood'}</span>
     <h3 style={{marginTop:12}}>{g.name}</h3><p>{g.description}</p>
     <div style={{display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}>
      {member?<button type="button" className="btn secondary" aria-expanded={selected===g.id} aria-controls="selected-group-posts" aria-label={`Open posts for ${g.name}`} onClick={e=>choose(g.id,e.currentTarget)}>Open group</button>:
       <button type="button" className="btn" disabled={busy} onClick={()=>join(g.id)}>Join group</button>}
     </div>
    </article>})}
   </div></section>
  </div>}
  {userId&&selected&&<section id="selected-group-posts" className="section" aria-labelledby="selected-group-heading">
   <h2 id="selected-group-heading" ref={selectedHeadingRef} tabIndex={-1}>{groups.find(g=>g.id===selected)?.name||'Group'} — posts</h2>
   <button type="button" className="btn secondary" disabled={busy} onClick={()=>{selectedRequest.current++;setSelected('');setPosts([]);setPostBody('');setPostsError(false);setPostsLoading(false);setNotice('');lastOpenedGroupButton.current?.focus();}}>Close group posts</button>
   <p className="muted-note">Draft updates are cleared when you switch or close a group, so they cannot be posted to the wrong group.</p>
   <div className="two-col">
    <div className="card"><form className="form" onSubmit={publish}>
     <label>Share an update<textarea required minLength={8} maxLength={3000} value={postBody} onChange={e=>setPostBody(e.target.value)} aria-describedby="group-post-guidance"/></label>
     <p id="group-post-guidance" className="muted-note">Posts are visible to group members. Avoid sharing private addresses or customer information. {postBody.length} of 3,000 characters.</p>
     <button type="submit" disabled={!canPublishCommunityGroupPost({signedIn:Boolean(userId),selectedGroupId:selected,memberGroupIds:memberships.map(m=>m.group_id),body:postBody,busy,postsLoading,postsError})} className="btn">Publish to group</button>
    </form></div>
    <div className="list" aria-busy={postsLoading}>{postsLoading?<div className="card" role="status">Loading group posts…</div>:postsError?<div className="card" role="alert"><p>Group posts could not be loaded. We cannot confirm whether this group has any posts.</p><button type="button" className="btn secondary" disabled={busy} onClick={()=>void retryPosts()}>Retry loading group posts</button></div>:posts.length===0?<div className="card">No group posts yet.</div>:null}
     {!postsLoading&&!postsError&&posts.map(p=><article className="card" key={p.id}><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{p.body}</p>
      <p className="muted-note"><time dateTime={p.created_at}>{new Date(p.created_at).toLocaleString('en-GB')}</time></p></article>)}
    </div>
   </div>
  </section>}
 </main>;
}
