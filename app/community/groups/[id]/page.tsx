'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import GroupPostReport from '../../../../components/group-post-report';
import {supabaseBrowser} from '../../../../lib/supabase';
import {readablePostDate} from '../../../../lib/social-discovery';
import {socialNeedsAuthRecheck} from '../../../../lib/social-auth-identity';
import {clearAllSocialDrafts,clearScopedDraft,clearSocialDraftsForOtherUsers,loadScopedDraft,saveScopedDraft} from '../../../../lib/social-draft-storage';
import {socialGroupCanLeave,socialGroupCanPublish,socialGroupPostError,socialGroupPostPage,
 socialGroupRouteId,socialGroupVisiblePage,socialGroupFocusTarget,type SocialGroupMembershipAction,
 type GroupConversationMembership,type GroupConversationPost,type GroupConversationSummary
} from '../../../../lib/social-group-conversation';

/** A genuine group destination. Group posts are fetched only after an RLS-backed
 * membership lookup. No client-side flag creates access to a group's content.
 */
export default function SocialGroupConversation(){
 const params=useParams<{id:string}>();
 const groupId=socialGroupRouteId(params?.id);
 const [userId,setUserId]=useState('');
 const [group,setGroup]=useState<GroupConversationSummary|null>(null);
 const [membership,setMembership]=useState<GroupConversationMembership|null>(null);
 const [posts,setPosts]=useState<GroupConversationPost[]>([]);
 const [page,setPage]=useState(0),[hasMore,setHasMore]=useState(false);
 const [body,setBody]=useState(''),[notice,setNotice]=useState('');
 const [loading,setLoading]=useState(true),[postsLoading,setPostsLoading]=useState(false);
 const [error,setError]=useState(''),[postsError,setPostsError]=useState('');
 const [busy,setBusy]=useState(false),[leaveConfirm,setLeaveConfirm]=useState(false);
 const [revision,setRevision]=useState(0),[postsRevision,setPostsRevision]=useState(0);
 const userIdRef=useRef('');
 userIdRef.current=userId;
 const inFlight=useRef(false);
 const joinButtonRef=useRef<HTMLButtonElement>(null);
 const composerHeadingRef=useRef<HTMLHeadingElement>(null);
 const pendingFocus=useRef<SocialGroupMembershipAction|null>(null);
 useEffect(()=>{
  if(!pendingFocus.current)return;
  const target=socialGroupFocusTarget(pendingFocus.current);
  pendingFocus.current=null;
  if(target==='join')joinButtonRef.current?.focus();
  else composerHeadingRef.current?.focus();
 },[membership]);
 const authEpoch=useRef(0);
 const postLoadEpoch=useRef(0);
 const groupKey=groupId||'invalid';

 // Supabase auth changes can arrive from another browser tab. Never keep
 // previous member posts or a draft visible across a real account switch.
  useEffect(()=>{
   const {data:{subscription}}=supabaseBrowser().auth.onAuthStateChange((event,session)=>{
    if(!socialNeedsAuthRecheck(event,userIdRef.current,session?.user?.id||''))return;
    if(event==='SIGNED_OUT')clearAllSocialDrafts();
    authEpoch.current++;
    postLoadEpoch.current++;
    setPosts([]);setMembership(null);setBody('');setNotice('');
    setRevision(value=>value+1);
   });
   return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
   authEpoch.current++;
   setUserId('');setGroup(null);setMembership(null);setPosts([]);setBody('');setNotice('');
   setLoading(true);setError('');setPage(0);setLeaveConfirm(false);
   if(!groupId){setError('This community group link is invalid.');setLoading(false);return;}
   let active=true;
   (async()=>{
    try{
     const s=supabaseBrowser();
     const result=await s.auth.getUser();
     if(result.error||!result.data.user)throw Error('Sign in required');
     if(!active)return;
     const id=result.data.user.id;
     clearSocialDraftsForOtherUsers(id);
     const [g,m]=await Promise.all([
      s.from('community_groups').select('id,name,description,area_id,creator_id,visibility,created_at')
       .eq('id',groupId).eq('visibility','public').maybeSingle(),
      s.from('community_group_memberships').select('group_id,user_id,role')
       .eq('group_id',groupId).eq('user_id',id).maybeSingle()
     ]);
     if(g.error||m.error)throw g.error||m.error;
     if(!active)return;
     setUserId(id);
     setGroup((g.data||null) as GroupConversationSummary|null);
     const nextMembership=(m.data||null) as GroupConversationMembership|null;
     setMembership(nextMembership);
     if(nextMembership){
      const recovered=loadScopedDraft(id,'group',groupId);
      if(recovered)setBody(recovered);
     }
     if(!g.data)setError('This public group is not available. It may have been removed or hidden.');
    }catch{
     if(active)setError('Unable to load this group and verify membership. Please retry.');
    }finally{if(active)setLoading(false);}
   })();
   return()=>{active=false;};
  },[groupKey,revision]);

  useEffect(()=>{
   ++postLoadEpoch.current;
   setPosts([]);setHasMore(false);setPostsError('');
   if(!userId||!groupId||!group||!membership){setPostsLoading(false);return;}
   const epoch=postLoadEpoch.current;
   let active=true;
   (async()=>{
    setPostsLoading(true);
    try{
     const bounds=socialGroupPostPage(page);
     const result=await supabaseBrowser().from('community_group_posts')
      .select('id,group_id,body,author_id,created_at,visibility')
      .eq('group_id',groupId).eq('visibility','published')
      .order('created_at',{ascending:false}).order('id',{ascending:true})
      .range(bounds.from,bounds.to);
     if(result.error)throw result.error;
     if(!active||epoch!==postLoadEpoch.current)return;
     const selection=socialGroupVisiblePage((result.data||[]) as GroupConversationPost[],groupId);
     setPosts(selection.posts);setHasMore(selection.hasMore);
    }catch{
     if(active&&epoch===postLoadEpoch.current)
      setPostsError('Group discussions could not be loaded. Please retry.');
    }finally{if(active&&epoch===postLoadEpoch.current)setPostsLoading(false);}
   })();
   return()=>{active=false;};
  },[groupId,userId,group,membership,page,postsRevision]);

  async function joinGroup(){
   if(!userId||!groupId||!group||membership||inFlight.current)return;
   const epoch=authEpoch.current;
   inFlight.current=true;setBusy(true);setNotice('');
   try{
    const s=supabaseBrowser();
    const result=await s.from('community_group_memberships')
     .insert({group_id:groupId,user_id:userId,role:'member'});
    if(result.error)throw result.error;
    if(epoch!==authEpoch.current)return;
    pendingFocus.current='joined';
    setMembership({group_id:groupId,user_id:userId,role:'member'});
    setNotice('You joined this group. Only members can read its discussions.');
   }catch{if(epoch===authEpoch.current)setNotice('Unable to join this group. Please retry.');}
   finally{inFlight.current=false;setBusy(false);}
  }

  async function leaveGroup(){
   if(!socialGroupCanLeave(userId,membership)||!groupId||!leaveConfirm||inFlight.current)return;
   const epoch=authEpoch.current;
   inFlight.current=true;setBusy(true);setNotice('');
   try{
    const result=await supabaseBrowser().from('community_group_memberships').delete()
     .eq('group_id',groupId).eq('user_id',userId).eq('role','member').select('group_id').maybeSingle();
    if(result.error||!result.data)throw Error('Membership not changed');
    if(epoch!==authEpoch.current)return;
    pendingFocus.current='left';
    clearScopedDraft(userId,'group',groupId);
    ++postLoadEpoch.current;setMembership(null);setPosts([]);setBody('');setLeaveConfirm(false);
    setNotice('You left this group. Its members-only discussions are no longer displayed.');
   }catch{if(epoch===authEpoch.current)setNotice('Unable to confirm that you left. Refresh membership before retrying.');}
   finally{inFlight.current=false;setBusy(false);}
  }

  async function publish(event:FormEvent){
   event.preventDefault();
   if(!groupId||inFlight.current||!socialGroupCanPublish(userId,groupId,membership,body))return;
   const epoch=authEpoch.current;
   inFlight.current=true;setBusy(true);setNotice('');
   try{
    const result=await supabaseBrowser().from('community_group_posts')
     .insert({group_id:groupId,author_id:userId,body:body.trim(),visibility:'published'});
    if(result.error)throw result.error;
    if(epoch!==authEpoch.current)return;
    clearScopedDraft(userId,'group',groupId);
    setBody('');setPage(0);setPostsRevision(x=>x+1);
    setNotice('Your group update was published. If the list does not refresh, do not repost it.');
   }catch{if(epoch===authEpoch.current)setNotice('Could not publish the update. Check membership and connection, then retry.');}
   finally{inFlight.current=false;setBusy(false);}
  }

 return <main className="container">
  <div className="page-heading">
   <span className="eyebrow">TrustFive Social · Community group</span>
   <h1>Group conversations</h1>
   <p className="subtle">Community group membership is not TrustFive professional verification. Only group members may see or write group updates.</p>
   <div className="social-hub-shortcuts">
    <Link href="/community/social?tab=trade" className="btn secondary">Back to Social Groups</Link>
    <Link href="/community/groups" className="btn secondary">Browse all groups</Link>
   </div>
  </div>
  {loading?<p className="card" role="status">Checking group and membership…</p>
   :error?<div className="card" role="alert"><p>{error}</p>{groupId&&<button type="button" className="btn secondary" onClick={()=>setRevision(v=>v+1)}>Retry group</button>}</div>
   :group&&<div className="list">
    <section className="card" aria-labelledby="group-current-name">
     <h2 id="group-current-name">{group.name}</h2>
     <p style={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{group.description}</p>
     <p className="muted-note">{membership?'You are a member.':'This group is public to discover. Join to access its members-only posts.'}</p>
     {!membership?<button ref={joinButtonRef} className="btn" type="button" disabled={busy} onClick={()=>{void joinGroup();}}>
      {busy?'Joining…':'Join group'}
     </button>:membership.role==='owner'?<p className="muted-note">You founded this group. Owners cannot leave through this member-only control.</p>
     :<div>
      {!leaveConfirm?<button type="button" className="btn secondary" disabled={busy} onClick={()=>setLeaveConfirm(true)}>Leave group</button>
       :<div role="group" aria-label="Confirm leaving this group" className="social-hub-shortcuts">
        <p>Leaving removes access to members-only posts. You can join again while the group remains public.</p>
        <button type="button" className="btn" disabled={busy} onClick={()=>{void leaveGroup();}}>Confirm leave</button>
        <button type="button" className="btn secondary" disabled={busy} onClick={()=>setLeaveConfirm(false)}>Keep membership</button>
       </div>}
     </div>}
     {notice&&<p role="status" className="notice">{notice}</p>}
    </section>
    {membership&&<>
     <section className="card" aria-labelledby="group-compose-title">
      <h2 id="group-compose-title" ref={composerHeadingRef} tabIndex={-1}>Write to this group</h2>
      <p className="muted-note">Only members can read these posts. Never share private job addresses, phone numbers, private quotes or customer leads.</p>
      <form className="form" onSubmit={publish}>
       <label>Group update
        <textarea required minLength={8} maxLength={3000} disabled={busy} value={body}
         onChange={event=>{const next=event.target.value;setBody(next);if(userId&&groupId)saveScopedDraft(userId,'group',groupId,next);}} aria-describedby="group-body-guidance"
         placeholder="Share an update or ask your fellow group members…"/>
       </label>
       <p id="group-body-guidance" className="muted-note">{body.length} / 3,000 characters. Minimum 8.</p>
       <button type="submit" className="btn" disabled={busy||!socialGroupCanPublish(userId,groupId||'',membership,body)}>
        {busy?'Publishing…':'Publish group update'}
       </button>
      </form>
     </section>
     <section aria-labelledby="group-discussions-title">
      <h2 id="group-discussions-title">Member discussions</h2>
      <button type="button" className="btn secondary" aria-disabled={postsLoading||busy}
       onClick={()=>{if(!postsLoading&&!busy)setPostsRevision(v=>v+1);}}>
       {postsLoading?'Refreshing discussions…':'Refresh discussions'}
      </button>
      {postsLoading?<p className="card" role="status">Loading real group posts…</p>
       :postsError?<div className="card" role="alert"><p>{postsError}</p><button type="button" className="btn secondary" onClick={()=>setPostsRevision(v=>v+1)}>Retry posts</button></div>
       :<>
        <p className="muted-note" role="status">Page {page+1}: {posts.length} published group {posts.length===1?'post':'posts'}{hasMore?'; more posts are available.':'.'}</p>
        {!posts.length&&<p className="card">{page?'No posts on this page. Go to the previous page.':'No published updates yet. Start the conversation above.'}</p>}
        <div className="list">
         {posts.map(post=><article className="card" key={post.id}>
          <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{post.body}</p>
          <p className="muted-note"><time dateTime={post.created_at}>{readablePostDate(post.created_at)}</time></p>
          {post.author_id!==userId&&<GroupPostReport key={`${userId}:${post.id}`} postId={post.id} userId={userId}/>}
         </article>)}
        </div>
        <nav aria-label="Group post pages" className="social-hub-shortcuts">
         <button type="button" className="btn secondary" disabled={page===0||busy} onClick={()=>setPage(v=>Math.max(0,v-1))}>Previous posts</button>
         <button type="button" className="btn secondary" disabled={!hasMore||busy||page>=100} onClick={()=>setPage(v=>v+1)}>Next posts</button>
        </nav>
       </>}
     </section>
    </>}
   </div>}
 </main>;
}
