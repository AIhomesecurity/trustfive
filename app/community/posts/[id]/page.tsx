'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {supabaseBrowser} from '../../../../lib/supabase';
import {readablePostDate,type SocialPostSummary} from '../../../../lib/social-discovery';
import {socialPostIdFromRoute} from '../../../../lib/social-post-route';
import SocialDiscussion from '../../../../components/social-discussion';

/**
 * One genuine post permalink; authenticated Supabase RLS prevents reading
 * private/removed content even if its UUID is guessed or shared.
 */
export default function SocialPostDetail(){
 const params=useParams<{id:string}>();
 const postId=socialPostIdFromRoute(params?.id);
 const [post,setPost]=useState<SocialPostSummary|null>(null);
 const [areaLabel,setAreaLabel]=useState('Community area');
 const [userId,setUserId]=useState('');
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  if(!postId){setError('This discussion link is invalid.');setLoading(false);return;}
  let active=true;
  (async()=>{
   setLoading(true);setError('');
   try{
    const s=supabaseBrowser();
    const user=await s.auth.getUser();
    if(user.error||!user.data.user)throw Error('Sign in required');
    if(!active)return;
    setUserId(user.data.user.id);
    const {data, error:readError}=await s.from('community_posts')
     .select('id,area_id,body,visibility,created_at')
     .eq('id',postId).eq('visibility','published').maybeSingle();
    if(readError)throw readError;
    if(!active)return;
    if(!data){setPost(null);setError('This published discussion is not available. It may have been removed.');return;}
    setPost(data as SocialPostSummary);
    const area=await s.from('service_areas').select('area_name,city').eq('id',data.area_id).maybeSingle();
    if(active&&area.data)setAreaLabel(area.data.area_name+', '+area.data.city);
   }catch{
    if(active){setPost(null);setError('Unable to load this discussion. Please try again.');}
   }finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[postId,version]);
 return <main className="container social-hub">
  <div className="page-heading">
   <span className="eyebrow">TrustFive Social · Local discussion</span>
   <h1>Neighbourhood conversation</h1>
   <p className="subtle">Published posts are available to signed-in members. Never share private job-site addresses or customer contact details.</p>
   <Link className="btn secondary" href="/community/social">Back to Social</Link>
  </div>
  {loading?<div className="card" role="status">Loading this community discussion…</div>
  :error?<div className="card" role="alert"><p>{error}</p>{postId&&<button type="button" className="btn secondary" onClick={()=>setVersion(v=>v+1)}>Retry</button>}</div>
  :post&&<article className="card">
   <span className="pill">{areaLabel}</span>
   <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginTop:14}}>{post.body}</p>
   <p className="muted-note"><time dateTime={post.created_at}>{readablePostDate(post.created_at)}</time></p>
   <SocialDiscussion postId={post.id} userId={userId}/>
  </article>}
 </main>;
}
