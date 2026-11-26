'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {assessSocialPostSafety} from '../../lib/social-safety';
type Area={id:string;area_name:string;city:string};
type Post={id:string;area_id:string;body:string;created_at:string;visibility:string};
type Comment={id:string;post_id:string;body:string;created_at:string};
type Reaction={post_id:string;likes:number;supports:number;my_reaction:string|null};
export default function Community(){
 const [userId,setUserId]=useState(''),[areas,setAreas]=useState<Area[]>([]),[area,setArea]=useState(''),[drafts,setDrafts]=useState<Record<string,string>>({});
 const body=drafts[area]??'';
 const postSafety=assessSocialPostSafety(body);
 const [posts,setPosts]=useState<Post[]>([]),[comments,setComments]=useState<Comment[]>([]),[replyTo,setReplyTo]=useState(''),[reply,setReply]=useState('');
 const replySafety=assessSocialPostSafety(reply);
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[feedLoading,setFeedLoading]=useState(true),[feedError,setFeedError]=useState(''),[accountLoading,setAccountLoading]=useState(true),[accountError,setAccountError]=useState(false);
 const [reactions,setReactions]=useState<Record<string,Reaction>>({});
 const feedRequest=useRef(0);
 const currentArea=useRef('');
 const feedHeading=useRef<HTMLHeadingElement>(null);
 const [reportingPost,setReportingPost]=useState('');
 async function loadPosts(filter:string){
  const request=++feedRequest.current;
  setFeedLoading(true);setFeedError('');setPosts([]);setComments([]);setReactions({});
  try{
  const s=supabaseBrowser();
  let query=s.from('community_posts').select('id,area_id,body,visibility,created_at').order('created_at',{ascending:false}).limit(30);
  if(filter)query=query.eq('area_id',filter);
  const {data,error}=await query;
  if(request!==feedRequest.current)return;
  if(error)throw error;
  const rows=(data||[]) as Post[];setPosts(rows);
  if(rows.length){
  const ids=rows.map(p=>p.id);
  const [commentsResult,reactionResult]=await Promise.all([
   s.from('community_comments').select('id,post_id,body,created_at').in('post_id',ids).order('created_at',{ascending:true}),
   s.rpc('community_reactions_for_posts',{p_post_ids:ids})
  ]);
  if(request!==feedRequest.current)return;
  if(commentsResult.error)throw commentsResult.error;if(reactionResult.error)throw reactionResult.error;
  setComments(commentsResult.data||[]);
  setReactions(Object.fromEntries(((reactionResult.data||[]) as Reaction[]).map(r=>[r.post_id,r])));
 }else{setComments([]);setReactions({});}
  }catch(e){if(request!==feedRequest.current)return;setFeedError('Unable to load neighbourhood posts. Please try choosing an area again.');throw e;}
  finally{if(request===feedRequest.current)setFeedLoading(false);}
 }
 useEffect(()=>{(async()=>{try{const s=supabaseBrowser();const [authResult,areasResult]=await Promise.all([s.auth.getUser(),s.from('service_areas').select('id,area_name,city').order('city')]);if(authResult.error)throw authResult.error;const user=authResult.data.user;if(!user){setFeedLoading(false);setMessage('Sign in to participate in the neighbourhood community.');return}setUserId(user.id);if(areasResult.error)throw areasResult.error;setAreas(areasResult.data||[]);await loadPosts('').catch(()=>{})}catch{setFeedLoading(false);setAccountError(true);setMessage('Unable to check your account or load neighbourhoods. Please try again.')}finally{setAccountLoading(false)}})()},[]);
 async function changeArea(value:string){if(currentArea.current!==value){setReplyTo('');setReply('');}currentArea.current=value;setArea(value);try{await loadPosts(value)}catch(e){setMessage(e instanceof Error?e.message:'Unable to load posts')}}
 async function submit(e:FormEvent){e.preventDefault();if(!userId||busy||!areas.some(a=>a.id===area)||body.trim().length<8)return;if(postSafety.blockingError){setMessage(postSafety.blockingError);return;}setBusy(true);setMessage('');try{const {error}=await supabaseBrowser().from('community_posts').insert({author_id:userId,area_id:area,body:body.trim(),visibility:'published'});if(error)throw error;setDrafts(previous=>previous[area]===body?{...previous,[area]:''}:previous);try{await loadPosts(currentArea.current);setMessage('Your neighbourhood post is published to signed-in members.')}catch{setMessage('Your post was published, but the feed could not be refreshed. Retry loading posts to see it.')}}catch{setMessage('Could not publish your post. Please try again.')}finally{setBusy(false)}}
 async function addComment(e:FormEvent){e.preventDefault();if(!userId||!replyTo||busy||reply.trim().length<2)return;if(replySafety.blockingError){setMessage(replySafety.blockingError);return;}setBusy(true);setMessage('');try{const {error}=await supabaseBrowser().from('community_comments').insert({post_id:replyTo,author_id:userId,body:reply.trim()});if(error)throw error;setReply('');setReplyTo('');try{await loadPosts(currentArea.current);setMessage('Your reply was published.')}catch{setMessage('Your reply was published, but the feed could not be refreshed. Retry loading posts to see it.')}}catch{setMessage('Could not add your reply. Please try again.')}finally{setBusy(false)}}
 async function react(postId:string,kind:'like'|'support'){
  if(!userId||busy)return;setBusy(true);
  try{
   const s=supabaseBrowser();const current=reactions[postId]?.my_reaction;
   const result=current===kind?
    await s.from('community_post_reactions').delete().eq('post_id',postId).eq('user_id',userId):
    current?await s.from('community_post_reactions').update({reaction:kind}).eq('post_id',postId).eq('user_id',userId):
    await s.from('community_post_reactions').insert({post_id:postId,user_id:userId,reaction:kind});
   if(result.error)throw result.error;
   const next=await s.rpc('community_reactions_for_posts',{p_post_ids:[postId]});
   if(next.error)throw next.error;
   const row=(next.data||[])[0] as Reaction|undefined;
   if(row)setReactions(previous=>({...previous,[postId]:row}));
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to save reaction')}finally{setBusy(false)}
 }
 async function report(postId:string){if(!userId||reportingPost)return;setReportingPost(postId);setMessage('');try{const {error}=await supabaseBrowser().from('community_reports').insert({post_id:postId,reporter_id:userId,category:'other',explanation:'Flagged by a community member for moderator review'});if(error)throw error;setMessage('Post reported for moderator review.')}catch{setMessage('Could not report this post. Please try again.')}finally{setReportingPost('')}}
 return <main className="container"><div className="page-heading"><span className="eyebrow">Your community, your neighbourhood</span><h1>TrustFive Community</h1><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}><Link className="btn" href="/community/social">Explore TrustFive Social</Link><Link className="btn secondary" href="/community/groups">Explore groups</Link><Link className="btn secondary" href="/community/events">Find local events</Link></div><p className="subtle">Local conversations and recommendations. Posts are visible to other signed-in members; do not share private details or emergency information.</p></div>{message&&<p role="status" className="notice">{message}</p>}
 {accountLoading?<p role="status">Loading your community account…</p>:accountError&&!userId?<div className="card" role="alert"><p>We could not verify your account or load neighbourhoods. This is not a sign-in requirement.</p><button type="button" className="btn secondary" onClick={()=>window.location.reload()}>Retry loading community</button></div>:!userId?<Link className="btn" href="/account">Sign in to join</Link>:<div className="two-col"><div><section className="card"><h2>Share something locally</h2>{areas.length===0&&<p role="status" className="muted-note">No neighbourhoods are available to select yet. Posting is unavailable until an area is listed.</p>}<form className="form" onSubmit={submit}><label>Neighbourhood<select required value={area} onChange={e=>changeArea(e.target.value)}><option value="">Select area to post</option>{areas.map(a=><option key={a.id} value={a.id}>{a.area_name}, {a.city}</option>)}</select></label><label htmlFor="community-post-body">Your post</label><textarea id="community-post-body" required value={body} minLength={8} maxLength={3000} disabled={!area} aria-describedby="community-post-guidance" onChange={e=>{const value=e.target.value;setDrafts(previous=>({...previous,[area]:value}));}} placeholder="Ask a question, recommend a business, or help your neighbours…"/><p id="community-post-guidance" className="muted-note">{!area&&'Choose a neighbourhood to start writing. '}At least 8 characters · {body.length.toLocaleString('en-GB')} of 3,000 characters. Avoid sharing private addresses or contact details.</p>{postSafety.blockingError&&<p role="alert" className="notice error" data-testid="social-contact-block">{postSafety.blockingError}</p>}<button className="btn" disabled={busy||Boolean(postSafety.blockingError)||areas.length===0||!areas.some(a=>a.id===area)||body.trim().length<8} type="submit">{busy?'Posting…':'Publish post'}</button></form></section></div><section><h2 ref={feedHeading} tabIndex={-1}>Neighbourhood feed</h2><label>Show posts from<select value={area} onChange={e=>changeArea(e.target.value)}><option value="">All areas (pilot)</option>{areas.map(a=><option key={a.id} value={a.id}>{a.area_name}, {a.city}</option>)}</select></label><div className="list" style={{marginTop:16}} aria-busy={feedLoading}>{feedLoading?<div className="card" role="status">Loading neighbourhood posts…</div>:feedError?<div className="card" role="alert"><p>{feedError}</p><button type="button" className="btn secondary" onClick={()=>{feedHeading.current?.focus();void loadPosts(area).catch(()=>{});}}>Try loading posts again</button></div>:posts.length===0?<div className="card" role="status">No posts yet in this feed. Start the conversation!</div>:posts.map(p=><article className="card" key={p.id}><span className="pill">{areas.find(a=>a.id===p.area_id)?.area_name||'Neighbourhood'}</span><p style={{whiteSpace:'pre-wrap',marginTop:14,color:'#17372b'}}>{p.body}</p><p className="muted-note">{new Date(p.created_at).toLocaleString('en-GB')} · {p.visibility}</p><div style={{display:'flex',gap:12,marginTop:12,flexWrap:'wrap'}}><button type="button" className="btn secondary" disabled={busy} aria-pressed={reactions[p.id]?.my_reaction==='like'} aria-label={`Like post (${reactions[p.id]?.likes||0} likes)`} onClick={()=>react(p.id,'like')}>👍 {reactions[p.id]?.likes||0}</button><button type="button" className="btn secondary" disabled={busy} aria-pressed={reactions[p.id]?.my_reaction==='support'} aria-label={`Support post (${reactions[p.id]?.supports||0} supports)`} onClick={()=>react(p.id,'support')}>💚 {reactions[p.id]?.supports||0}</button><button className="btn secondary" aria-expanded={replyTo===p.id} aria-label={`Reply to post from ${areas.find(a=>a.id===p.area_id)?.area_name||'neighbourhood'}`} onClick={()=>{setReply('');setReplyTo(replyTo===p.id?'':p.id);}}>Reply</button><button type="button" className="btn secondary" disabled={Boolean(reportingPost)} aria-busy={reportingPost===p.id} aria-label="Report post for moderator review" onClick={()=>report(p.id)}>{reportingPost===p.id?'Reporting…':'Report'}</button></div>{comments.filter(c=>c.post_id===p.id).map(c=><div style={{padding:'10px 12px',background:'#f1f7f3',borderRadius:10,marginTop:10}} key={c.id}><p style={{whiteSpace:'pre-wrap',color:'#17372b'}}>{c.body}</p><small className="muted-note">{new Date(c.created_at).toLocaleString('en-GB')}</small></div>)}{replyTo===p.id&&<form className="form" style={{marginTop:15}} onSubmit={addComment}><label>Write a reply<textarea required minLength={2} maxLength={1500} value={reply} onChange={e=>setReply(e.target.value)}/></label>{replySafety.blockingError&&<p role="alert" className="notice error" data-testid="social-contact-block">{replySafety.blockingError}</p>}<button type="submit" disabled={busy||Boolean(replySafety.blockingError)||reply.trim().length<2} className="btn">Add reply</button></form>}</article>)}</div></section></div>}</main>
}
