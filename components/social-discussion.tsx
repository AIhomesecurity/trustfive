'use client';
import {FormEvent,useRef,useState} from 'react';
import {supabaseBrowser} from '../lib/supabase';
import {readablePostDate} from '../lib/social-discovery';
import {SOCIAL_REPORT_CATEGORIES,socialReactionIsActive,socialReplyError,socialReportError,type SocialComment,type SocialReactionKind,type SocialReactionSummary,type SocialReportCategory} from '../lib/social-discussion';

/**
 * Loads only the discussion opened by the user, instead of downloading
 * comments/reactions for every card in a large paginated neighbourhood feed.
 * The server's RLS policies decide which content the viewer may access.
 */
export default function SocialDiscussion({postId,userId}:{postId:string;userId:string}){
 const [expanded,setExpanded]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [comments,setComments]=useState<SocialComment[]>([]);
 const [reaction,setReaction]=useState<SocialReactionSummary|null>(null);
 const [saved,setSaved]=useState(false);
 const [reply,setReply]=useState('');
 const [busy,setBusy]=useState(false);
 const [reporting,setReporting]=useState(false);
 const [reportOpen,setReportOpen]=useState(false);
 const [reportCategory,setReportCategory]=useState<SocialReportCategory>('spam');
 const [reportDetails,setReportDetails]=useState('');
 const discussionToggle=useRef<HTMLButtonElement>(null);
 const inFlight=useRef(false);

 async function readDiscussion(){
  setLoading(true);setError('');
  try{
   const s=supabaseBrowser();
   const [commentResult,reactionResult,savedResult]=await Promise.all([
    s.from('community_comments').select('id,post_id,body,created_at')
     .eq('post_id',postId).order('created_at',{ascending:true}).limit(100),
    s.rpc('community_reactions_for_posts',{p_post_ids:[postId]}),
    s.from('social_saved_posts').select('post_id')
     .eq('post_id',postId).eq('user_id',userId).maybeSingle()
   ]);
   if(commentResult.error)throw commentResult.error;
   if(reactionResult.error)throw reactionResult.error;
   if(savedResult.error)throw savedResult.error;
   setSaved(Boolean(savedResult.data));
   setComments(commentResult.data||[]);
   const row=((reactionResult.data||[]) as SocialReactionSummary[]).find(item=>item.post_id===postId);
   setReaction(row||null);
  }catch{
   setError('Unable to load this discussion. Retry to see replies and reactions.');
  }finally{setLoading(false);}
 }
 async function toggle(){
  if(expanded){setExpanded(false);return;}
  setExpanded(true);
  await readDiscussion();
 }
 async function submitReply(event:FormEvent){
  event.preventDefault();
  const validation=socialReplyError(reply);
  if(validation){setNotice(validation);return;}
  if(!userId||inFlight.current)return;
  inFlight.current=true;setBusy(true);setNotice('');
  try{
   const s=supabaseBrowser();
   const {error:insertError}=await s.from('community_comments')
    .insert({post_id:postId,author_id:userId,body:reply.trim()});
   if(insertError)throw insertError;
   setReply('');
   setNotice('Your reply was published. It may take a moment to appear.');
   const result=await s.from('community_comments')
    .select('id,post_id,body,created_at').eq('post_id',postId)
    .order('created_at',{ascending:true}).limit(100);
   if(result.error){setNotice('Your reply was published, but refreshing failed. Use Refresh discussion to load it.');}
   else setComments(result.data||[]);
  }catch{setNotice('Could not publish your reply. Check the connection and try again.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function react(kind:SocialReactionKind){
  if(!userId||inFlight.current)return;
  inFlight.current=true;setBusy(true);setNotice('');
  try{
   const s=supabaseBrowser();
   const current=reaction?.my_reaction||null;
   const result=socialReactionIsActive(current,kind)
    ? await s.from('community_post_reactions').delete().eq('post_id',postId).eq('user_id',userId)
    : current
     ? await s.from('community_post_reactions').update({reaction:kind}).eq('post_id',postId).eq('user_id',userId)
     : await s.from('community_post_reactions').insert({post_id:postId,user_id:userId,reaction:kind});
   if(result.error)throw result.error;
   const refreshed=await s.rpc('community_reactions_for_posts',{p_post_ids:[postId]});
   if(refreshed.error){
    setNotice('Your reaction was saved, but its count could not refresh. Select Refresh discussion.');
    return;
   }
   const row=((refreshed.data||[]) as SocialReactionSummary[]).find(item=>item.post_id===postId);
   setReaction(row||null);
  }catch{setNotice('Could not update your reaction. Please retry.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function toggleSave(){
  if(!userId||inFlight.current)return;
  inFlight.current=true;setBusy(true);setNotice('');
  try{
   if(saved){
    const result=await supabaseBrowser().from('social_saved_posts').delete()
     .eq('post_id',postId).eq('user_id',userId).select('post_id').maybeSingle();
    if(result.error)throw result.error;
    setSaved(false);
    setNotice(result.data?'Removed from your private saved posts.':'The post was already removed from your saved list.');
   }else{
    const result=await supabaseBrowser().from('social_saved_posts').insert({post_id:postId,user_id:userId});
    if(result.error)throw result.error;
    setSaved(true);
    setNotice('Saved privately to your account. This does not affect rankings or post popularity.');
   }
  }catch{setNotice('Could not update saved posts. Please refresh this discussion and retry.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function report(event:FormEvent){
  event.preventDefault();
  const validation=socialReportError(reportCategory,reportDetails);
  if(validation){setNotice(validation);return;}
  if(!userId||reporting||inFlight.current)return;
  inFlight.current=true;setReporting(true);setNotice('');
  try{
   const result=await supabaseBrowser().from('community_reports').insert({
    post_id:postId,reporter_id:userId,category:reportCategory,
    explanation:reportDetails.trim()||'Flagged by a community member for moderator review'
   });
   if(result.error)throw result.error;
   setReportOpen(false);setReportDetails('');
   setNotice('Report submitted for moderator review.');
  }catch{setNotice('Could not submit the report. Please retry.');}
  finally{inFlight.current=false;setReporting(false);}
 }
 return <section aria-label="Post discussion" style={{marginTop:12}}>
  <button type="button" className="btn secondary" aria-expanded={expanded}
    ref={discussionToggle} aria-controls={'discussion-'+postId} onClick={()=>{void toggle();}}>
   {expanded?'Hide discussion':'Read and reply'}
  </button>
  {expanded&&<div id={'discussion-'+postId} style={{marginTop:12}}>
   {loading?<p role="status">Loading discussion…</p>:error?<div role="alert"><p>{error}</p><button className="btn secondary" type="button" onClick={()=>{discussionToggle.current?.focus();void readDiscussion();}}>Retry discussion</button></div>:<>
    <div className="social-hub-shortcuts" aria-label="Post reactions">
     <button type="button" className="btn secondary" disabled={busy||reporting}
      aria-pressed={socialReactionIsActive(reaction?.my_reaction||null,'like')}
      onClick={()=>{void react('like');}}>Like ({reaction?.likes??0})</button>
     <button type="button" className="btn secondary" disabled={busy||reporting}
      aria-pressed={socialReactionIsActive(reaction?.my_reaction||null,'support')}
      onClick={()=>{void react('support');}}>Support ({reaction?.supports??0})</button>
     <button type="button" className="btn secondary" disabled={busy||reporting}
      aria-pressed={saved} onClick={()=>{void toggleSave();}}>{saved?'Remove saved post':'Save post privately'}</button>
     <button type="button" className="btn secondary" disabled={busy||reporting}
      aria-expanded={reportOpen} onClick={()=>{setReportOpen(v=>!v);setNotice('');}}>
      {reportOpen?'Cancel report':'Report post'}
     </button>
     <button type="button" className="btn secondary" disabled={busy||reporting}
      onClick={()=>{void readDiscussion();}}>Refresh discussion</button>
    </div>
    {reportOpen&&<form className="form card" aria-label="Report this community post" onSubmit={report} style={{marginBottom:14}}>
      <h4>Report this post</h4>
      <p className="muted-note">Your report is sent to moderators. Reporting does not automatically remove a post or affect professional approval.</p>
      <label>Reason
       <select value={reportCategory} disabled={reporting} onChange={event=>setReportCategory(event.target.value as SocialReportCategory)}>
        {SOCIAL_REPORT_CATEGORIES.map(kind=><option key={kind} value={kind}>{kind==='privacy'?'Private information':kind==='abuse'?'Abusive content':kind==='spam'?'Spam':'Other concern'}</option>)}
       </select>
      </label>
      <label>Additional details (optional)
       <textarea maxLength={1200} value={reportDetails} disabled={reporting}
        onChange={event=>setReportDetails(event.target.value)} placeholder="Describe what needs moderator review without repeating private information."/>
      </label>
      <button type="submit" className="btn" disabled={reporting||busy||Boolean(socialReportError(reportCategory,reportDetails))}>{reporting?'Submitting report…':'Submit report'}</button>
     </form>}
    <h4>Replies</h4>
    {comments.length===0?<p className="muted-note">No replies yet.</p>:comments.map(item=>
     <div className="social-discussion-comment" key={item.id}>
      <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{item.body}</p>
      <small className="muted-note">{readablePostDate(item.created_at)}</small>
     </div>)}
    {comments.length===100&&<p className="muted-note">Showing the earliest 100 replies. Visit the full community page for further discussion.</p>}
    <form className="form" onSubmit={submitReply} style={{marginTop:14}}>
     <label>Reply to the neighbourhood discussion
      <textarea minLength={2} maxLength={1500} required value={reply} disabled={busy}
       onChange={event=>setReply(event.target.value)} placeholder="Share useful, respectful advice…"/>
     </label>
     <button type="submit" className="btn" disabled={busy||reporting||Boolean(socialReplyError(reply))}>
      {busy?'Saving…':'Publish reply'}
     </button>
    </form>
   </>}
   {notice&&<p className="notice" role="status">{notice}</p>}
  </div>}
 </section>;
}
