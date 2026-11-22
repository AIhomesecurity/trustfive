'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../lib/supabase';
import {readablePostDate,type SocialPostSummary} from '../lib/social-discovery';
import SocialDiscussion from './social-discussion';

type SavedRecord={post_id:string;saved_at:string};
export default function SocialSavedPosts({userId}:{userId:string}){
 const [posts,setPosts]=useState<SocialPostSummary[]>([]);
 const [saved,setSaved]=useState<SavedRecord[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [retry,setRetry]=useState(0),[busy,setBusy]=useState(false);
 const inFlight=useRef(false);
 useEffect(()=>{
  if(!userId){setLoading(false);return;}
  let active=true;
  (async()=>{
   setLoading(true);setError('');
   try{
    const s=supabaseBrowser();
    const records=await s.from('social_saved_posts')
     .select('post_id,saved_at').eq('user_id',userId)
     .order('saved_at',{ascending:false}).limit(100);
    if(records.error)throw records.error;
    if(!active)return;
    const selection=(records.data||[]) as SavedRecord[];
    setSaved(selection);
    if(!selection.length){setPosts([]);return;}
    const result=await s.from('community_posts')
     .select('id,area_id,body,visibility,created_at')
     .in('id',selection.map(item=>item.post_id)).eq('visibility','published');
    if(result.error)throw result.error;
    if(!active)return;
    const byId=new Map(((result.data||[]) as SocialPostSummary[]).map(item=>[item.id,item]));
    setPosts(selection.map(record=>byId.get(record.post_id)).filter((item):item is SocialPostSummary=>Boolean(item)));
   }catch{if(active){setSaved([]);setPosts([]);setError('Could not load your saved discussions. Please retry.');}}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[userId,retry]);
 async function remove(postId:string){
  if(inFlight.current||!userId)return;
  inFlight.current=true;setBusy(true);setNotice('');
  try{
   const result=await supabaseBrowser().from('social_saved_posts')
    .delete().eq('user_id',userId).eq('post_id',postId);
   if(result.error)throw result.error;
   setPosts(current=>current.filter(item=>item.id!==postId));
   setSaved(current=>current.filter(item=>item.post_id!==postId));
   setNotice('Removed from your private saved posts.');
  }catch{setNotice('Could not remove the saved post. Refresh the list and retry.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 return <section aria-labelledby="saved-social-posts">
  <h2 id="saved-social-posts">My saved discussions</h2>
  <p className="subtle">These bookmarks are private to your account and do not affect professional approval, quality ranking or post popularity. Only currently published posts appear below.</p>
  {!userId?<div className="card" role="status">Sign in to see private saved discussions.</div>:<>
   <button type="button" className="btn secondary" style={{marginBottom:14}}
    disabled={busy} onClick={()=>setRetry(v=>v+1)}>Refresh saved discussions</button>
   {notice&&<p role="status" className="notice">{notice}</p>}
   {loading?<div className="card" role="status">Loading your private saved discussions…</div>
   :error?<div className="card" role="alert"><p>{error}</p><button type="button" className="btn secondary" onClick={()=>setRetry(v=>v+1)}>Retry loading bookmarks</button></div>
   :<>
    <p role="status" className="muted-note">{posts.length} published {posts.length===1?'discussion':'discussions'} from your most recent {saved.length} saved {saved.length===1?'record':'records'} (up to 100 loaded).</p>
    <div className="list">
     {posts.length===0&&<p className="card">No published discussions are currently saved to this account. Find useful conversations in your neighbourhood feed.</p>}
     {posts.map(post=><article className="card" key={post.id}>
      <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{post.body}</p>
      <p className="muted-note"><time dateTime={post.created_at}>{readablePostDate(post.created_at)}</time></p>
      <div className="social-hub-shortcuts">
       <Link className="btn secondary" href={`/community/posts/${post.id}`}>Open discussion</Link>
       <button type="button" className="btn secondary" disabled={busy}
        onClick={()=>{void remove(post.id);}}>Remove bookmark</button>
      </div>
      <SocialDiscussion postId={post.id} userId={userId}/>
     </article>)}
    </div>
   </>}
  </>}
 </section>;
}
