'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../lib/supabase';
import {readablePostDate,type SocialArea,type SocialPostSummary} from '../lib/social-discovery';
import {socialPageBounds,socialPageRows} from '../lib/social-feed-paging';
import {SOCIAL_ADVICE_TOPICS,socialQuestionBody,socialQuestionSearchPattern} from '../lib/social-advice';
import {buildSocialPostHref,getAreaDraft,setAreaDraft} from '../lib/social-feed-url';
import {clearScopedDraft,loadScopedDraft,saveScopedDraft} from '../lib/social-draft-storage';
import {assessSocialPostSafety,classifySocialWriteError} from '../lib/social-safety';
import SocialDiscussion from './social-discussion';

/**
 * Real Q&A built on existing authorised community posts. Topic headings are
 * literal post text, not an authenticated expert badge or typed DB category.
 */
export default function SocialAdviceBoard({userId,areas}:{userId:string;areas:SocialArea[]}){
 const [postArea,setPostArea]=useState(''),[topic,setTopic]=useState<string>('CCTV & security');
 const [draftsByArea,setDraftsByArea]=useState<Record<string,string>>({});
 const [restoredArea,setRestoredArea]=useState('');
 const [filterArea,setFilterArea]=useState(''),[filterTopic,setFilterTopic]=useState('all'),[page,setPage]=useState(0),[refresh,setRefresh]=useState(0);
 const [rows,setRows]=useState<SocialPostSummary[]>([]),[hasMore,setHasMore]=useState(false);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[noticeIsError,setNoticeIsError]=useState(false),[sending,setSending]=useState(false);
 const sendingRef=useRef(false);
 const areaSelectRef=useRef<HTMLSelectElement>(null);
 const questionInputRef=useRef<HTMLTextAreaElement>(null);
 const browseHeadingRef=useRef<HTMLHeadingElement>(null);

 const question=getAreaDraft(draftsByArea,postArea);
 const safety=assessSocialPostSafety(question);

 function selectPostArea(nextArea:string){
  setPostArea(nextArea);
  setNotice('');
  setNoticeIsError(false);
  if(!nextArea||!userId){setRestoredArea('');return;}
  const existing=getAreaDraft(draftsByArea,nextArea);
  if(!existing){
   const recovered=loadScopedDraft(userId,'advice',nextArea);
   if(recovered){
    setDraftsByArea(prev=>setAreaDraft(prev,nextArea,recovered));
    setRestoredArea(nextArea);
    return;
   }
  }
  setRestoredArea('');
 }

 function updateQuestion(value:string){
  if(!postArea)return;
  setDraftsByArea(prev=>setAreaDraft(prev,postArea,value));
  saveScopedDraft(userId,'advice',postArea,value);
  if(restoredArea===postArea)setRestoredArea('');
  if(notice){setNotice('');setNoticeIsError(false);}
 }

 function focusQuestionComposer(){
  if(postArea)questionInputRef.current?.focus();
  else areaSelectRef.current?.focus();
 }

 useEffect(()=>{
  if(!userId){setLoading(false);return;}
  let active=true;
  (async()=>{
   setLoading(true);setError('');
   try{
    const pattern=socialQuestionSearchPattern(filterTopic);
    if(!pattern)throw Error('Invalid category');
    const bounds=socialPageBounds(page);
    let request=supabaseBrowser().from('community_posts')
     .select('id,area_id,body,visibility,created_at')
     .eq('visibility','published')
     .ilike('body',pattern).order('created_at',{ascending:false})
     .order('id',{ascending:true}).range(bounds.from,bounds.to);
    if(filterArea)request=request.eq('area_id',filterArea);
    const {data,error:readError}=await request;
    if(readError)throw readError;
    if(!active)return;
    const selection=socialPageRows((data||[]) as SocialPostSummary[]);
    setRows(selection.items);setHasMore(selection.hasMore);
   }catch{if(active){setRows([]);setHasMore(false);setError('Questions could not be loaded. Please retry.');}}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[userId,filterArea,filterTopic,page,refresh]);

 async function ask(event:FormEvent){
  event.preventDefault();
  if(sendingRef.current||!userId)return;
  const targetArea=postArea;
  const body=socialQuestionBody(topic,question);
  if(!body||!areas.some(area=>area.id===targetArea)){
   setNoticeIsError(true);
   setNotice('Choose an available neighbourhood and write a question of at least 8 characters.');
   return;
  }
  if(safety.blockingError){
   setNoticeIsError(true);
   setNotice(safety.blockingError);
   return;
  }
  sendingRef.current=true;setSending(true);setNotice('');setNoticeIsError(false);
  try{
   const result=await supabaseBrowser().from('community_posts').insert({
    author_id:userId,area_id:targetArea,body,visibility:'published'
   });
   if(result.error)throw result.error;
   setDraftsByArea(prev=>setAreaDraft(prev,targetArea,''));
   clearScopedDraft(userId,'advice',targetArea);
   setRestoredArea('');
   setFilterTopic(topic);setFilterArea(targetArea);setPage(0);setRefresh(v=>v+1);
   setNoticeIsError(false);
   setNotice('Your question was published to the neighbourhood. Do not repost if refreshing takes longer.');
  }catch(err){
   setNoticeIsError(true);
   setNotice(classifySocialWriteError(err,'Your question could not be published — your draft is preserved above so you can retry safely.'));
  }
  finally{sendingRef.current=false;setSending(false);}
 }

 const preview=socialQuestionBody(topic,question);
 const hasQuestionFilters=Boolean(filterArea||filterTopic!=='all'||page>0);
 const adviceReturnHref='/community/social?tab=advice';

 return <section aria-labelledby="social-advice-title" className="social-advice-board">
  <h2 id="social-advice-title">Questions &amp; Advice</h2>
  <p className="subtle">Ask real neighbours about trades and home care using TrustFive&apos;s existing signed-in community. Topic headings are part of your post text, not independently verified classifications. Replies are community advice, not certified inspections.</p>
  {!userId?<p role="status" className="card">Sign in to ask or read community advice.</p>:<>
   <section className="card social-composer-card" aria-labelledby="social-question-heading">
    <h3 id="social-question-heading" className="social-card-title">Ask your neighbours</h3>
    <p className="muted-note" style={{margin:'0 0 12px'}}>Question drafts stay separate per neighbourhood and recover automatically if your browser reloads.</p>
    <form className="form" onSubmit={ask}>
     <label>Topic<select required value={topic} disabled={sending} onChange={event=>setTopic(event.target.value)}>
      {SOCIAL_ADVICE_TOPICS.map(item=><option key={item} value={item}>{item}</option>)}
     </select></label>
     <label>Neighbourhood<select ref={areaSelectRef} required value={postArea} disabled={sending||!areas.length} onChange={event=>selectPostArea(event.target.value)}>
      <option value="">Choose neighbourhood</option>
      {areas.map(item=><option key={item.id} value={item.id}>{item.area_name}, {item.city}</option>)}
     </select></label>
     <label>Your question<textarea ref={questionInputRef} required minLength={8} maxLength={2900} value={question} disabled={sending||!postArea}
       placeholder={postArea?'What would you like to know? Avoid private addresses and contact details.':'Choose a neighbourhood above to start writing your question…'}
       onChange={event=>updateQuestion(event.target.value)} aria-describedby="social-advice-note"/></label>
     {restoredArea===postArea&&postArea&&<p role="status" className="muted-note" style={{margin:0}}>Draft recovered for your selected neighbourhood.</p>}
     <p className="muted-note" id="social-advice-note">Your question will be published with the heading “Question about {topic}:” and visible to signed-in community members. Never include private customer jobs, addresses or personal contact details.</p>
     <button type="submit" className="btn" disabled={sending||!areas.some(item=>item.id===postArea)||!preview}>{sending?'Publishing question…':'Publish question'}</button>
    </form>
    {notice&&<p role={noticeIsError?'alert':'status'} className={noticeIsError?'notice error':'notice'}>{notice}</p>}
   </section>
   <section aria-label="Community questions" style={{marginTop:18}}>
    <h3 ref={browseHeadingRef} tabIndex={-1}>Browse published questions</h3>
    <div className="card social-hub-filters">
     <label>Topic<select value={filterTopic} onChange={event=>{setFilterTopic(event.target.value);setPage(0);}}>
      <option value="all">All question topics</option>
      {SOCIAL_ADVICE_TOPICS.map(item=><option key={item} value={item}>{item}</option>)}
     </select></label>
     <label>Neighbourhood<select value={filterArea} onChange={event=>{setFilterArea(event.target.value);setPage(0);}}>
      <option value="">All available areas</option>
      {areas.map(item=><option key={item.id} value={item.id}>{item.area_name}, {item.city}</option>)}
     </select></label>
     <button type="button" className="btn secondary" onClick={()=>setRefresh(v=>v+1)}>Refresh questions</button>
    </div>
    {loading?<p role="status" className="card">Loading real questions…</p>:error?<div className="card" role="alert"><p>{error}</p><button type="button" className="btn secondary" onClick={()=>{browseHeadingRef.current?.focus();setRefresh(v=>v+1);}}>Try again</button></div>:<>
     <p className="muted-note" role="status">Page {page+1}: {rows.length} published {rows.length===1?'question':'questions'}.</p>
     <div className="list">
      {rows.length===0&&<div className="card" role="status">
       <p style={{margin:'0 0 12px'}}>No published questions match these filters. You can ask the first one.</p>
       <div className="social-hub-shortcuts" style={{margin:0}}>
        <button type="button" className="btn" onClick={focusQuestionComposer}>Ask the first question</button>
        {hasQuestionFilters&&<button type="button" className="btn secondary" onClick={()=>{setFilterArea('');setFilterTopic('all');setPage(0);}}>Show all questions</button>}
       </div>
      </div>}
      {rows.map(item=><article key={item.id} className="card social-post-card is-question">
       <div className="social-post-meta">
        <div className="social-post-badges">
         <span className="pill">{areas.find(area=>area.id===item.area_id)?.area_name||'Community area'}</span>
         <span className="social-kind-badge is-question">? Question</span>
        </div>
        <time className="muted-note social-post-time" dateTime={item.created_at}>{readablePostDate(item.created_at)}</time>
       </div>
       <p className="social-post-body">{item.body}</p>
       <div className="social-post-footer">
        <SocialDiscussion postId={item.id} userId={userId}/>
        <div className="social-post-permalink-wrap">
         <Link className="btn secondary social-post-permalink" href={buildSocialPostHref(item.id,adviceReturnHref)}>Open question discussion</Link>
        </div>
       </div>
      </article>)}
     </div>
     <nav aria-label="Question pages" className="social-hub-shortcuts">
      <button type="button" className="btn secondary" disabled={!page} onClick={()=>setPage(v=>Math.max(0,v-1))}>Previous questions</button>
      <button type="button" className="btn secondary" disabled={!hasMore||page>=500} onClick={()=>setPage(v=>v+1)}>Next questions</button>
     </nav>
    </>}
   </section>
  </>}
 </section>;
}
