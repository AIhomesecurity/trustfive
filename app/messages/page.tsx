'use client';
import {FormEvent,useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {authorisedQuoteSelection,quoteMessagesHref} from '../../lib/workflow-links';

type Thread={quote_id:string;job_id:string;label:string;amount_pence:number;status:string};
type Message={id:string;quote_id:string;author_id:string;body:string;created_at:string};
type CustomerQuote={quote_id:string;job_id:string;business_name:string;amount_pence:number;status:string};
type ProfessionalQuote={quote_id:string;job_id:string;job_title:string;amount_pence:number;status:string};

export default function Messages(){
 const [userId,setUserId]=useState('');
 const [threads,setThreads]=useState<Thread[]>([]);
 const [selected,setSelected]=useState('');
 const [messages,setMessages]=useState<Message[]>([]);
 const [body,setBody]=useState('');
 const [busy,setBusy]=useState(false);
 const [checking,setChecking]=useState(true);
 const [threadLoading,setThreadLoading]=useState(false);
 const [messagesLoading,setMessagesLoading]=useState(false);
 const [notice,setNotice]=useState('');
 const [filter,setFilter]=useState('');
 const selectedRequest=useRef(0);
 const selectedRef=useRef('');
 const authorisedIds=useRef<string[]>([]);

 const loadMessages=useCallback(async(quoteId:string)=>{
  const request=++selectedRequest.current;
  setMessagesLoading(true);
  try{
   const {data,error}=await supabaseBrowser().from('quote_messages')
    .select('id,quote_id,author_id,body,created_at')
    .eq('quote_id',quoteId).order('created_at',{ascending:true}).limit(100);
   if(error)throw error;
   if(request===selectedRequest.current)setMessages(data||[]);
  }catch(e){
   if(request===selectedRequest.current){setMessages([]);setNotice(e instanceof Error?e.message:'Unable to load this conversation');}
  }finally{if(request===selectedRequest.current)setMessagesLoading(false);}
 },[]);

 const select=useCallback(async(id:string)=>{
  // The URL is an untrusted navigation hint. Never query a quote which is not
  // present in this signed-in account's authorised customer/pro list.
  if(!authorisedIds.current.includes(id)){setNotice('That conversation is not available to this account.');return;}
  selectedRef.current=id;
  setSelected(id);setMessages([]);setNotice('');
  const url=quoteMessagesHref(id);
  if(window.location.pathname+window.location.search!==url)window.history.replaceState(null,'',url);
  await loadMessages(id);
 },[loadMessages]);

 const loadThreads=useCallback(async()=>{
  setThreadLoading(true);
  try{
   const s=supabaseBrowser();
   const [cust,pro]=await Promise.all([s.rpc('customer_quotes'),s.rpc('professional_quotes')]);
   if(cust.error)throw cust.error;
   if(pro.error)throw pro.error;
   const both:Thread[]=[
    ...((cust.data||[]) as CustomerQuote[]).map(q=>({quote_id:q.quote_id,job_id:q.job_id,label:q.business_name,amount_pence:q.amount_pence,status:q.status})),
    ...((pro.data||[]) as ProfessionalQuote[]).map(q=>({quote_id:q.quote_id,job_id:q.job_id,label:q.job_title,amount_pence:q.amount_pence,status:q.status}))
   ];
   // An account may appear in both roles; never duplicate the same quote.
   const unique=[...new Map(both.map(t=>[t.quote_id,t])).values()];
   authorisedIds.current=unique.map(t=>t.quote_id);
   setThreads(unique);
   const requested=new URLSearchParams(window.location.search).get('quote');
   const next=authorisedQuoteSelection(requested,authorisedIds.current)||
    authorisedQuoteSelection(selectedRef.current,authorisedIds.current);
   if(next){await select(next);}
   else{
    selectedRequest.current+=1;
    selectedRef.current='';setSelected('');setMessages([]);setMessagesLoading(false);
    if(requested){setNotice('That conversation is not available to your account. Choose one of your conversations below.');}
   }
  }catch(e){setNotice(e instanceof Error?e.message:'Unable to load conversations');}
  finally{setThreadLoading(false);}
 },[select]);

 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const {data:{user},error}=await supabaseBrowser().auth.getUser();
    if(error)throw error;
    if(!active)return;
    if(!user){setNotice('Sign in to view your messages.');return;}
    setUserId(user.id);await loadThreads();
   }catch(e){if(active)setNotice(e instanceof Error?e.message:'Unable to load conversations');}
   finally{if(active)setChecking(false);}
  })();
  return()=>{active=false;selectedRequest.current+=1;};
 },[loadThreads]);

 async function submit(e:FormEvent){
  e.preventDefault();
  const quoteId=selectedRef.current;
  if(!quoteId||busy||!authorisedIds.current.includes(quoteId))return;
  const text=body.trim();
  if(!text){setNotice('Write a message before sending.');return;}
  setBusy(true);setNotice('');
  try{
   const {error}=await supabaseBrowser().from('quote_messages').insert({quote_id:quoteId,author_id:userId,body:text});
   if(error)throw error;
   setBody('');
   if(quoteId===selectedRef.current)await loadMessages(quoteId);
   setNotice('Message saved. Automatic email and push delivery are not yet enabled.');
  }catch(error){setNotice(error instanceof Error?error.message:'Unable to send message');}
  finally{setBusy(false);}
 }
 const active=threads.find(t=>t.quote_id===selected);
 const visible=threads.filter(t=>t.label.toLowerCase().includes(filter.trim().toLowerCase())||t.status.toLowerCase().includes(filter.trim().toLowerCase()));
 return <main className="container">
  <div className="page-heading"><span className="eyebrow">Private quote conversations</span>
   <h1>TrustFive Messages</h1>
   <p className="subtle">Message the customer or approved professional connected to your quote. A link to a conversation never grants access to another person&apos;s messages.</p>
  </div>
  {notice&&<p role="status" className="notice">{notice}</p>}
  {checking?<p role="status" className="notice">Checking your account and loading conversations…</p>:
   !userId?<Link className="btn" href="/account?next=%2Fmessages">Sign in to view messages</Link>:
   <div className="two-col marketplace-messages">
    <section className="card" aria-label="Your conversations">
     <div className="conversation-heading"><h2>Conversations</h2><button type="button" className="btn secondary" disabled={threadLoading} onClick={()=>void loadThreads()}>{threadLoading?'Refreshing…':'Refresh'}</button></div>
     {threads.length>4&&<label className="conversation-search-label">Search your conversations
      <input type="search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Job, business or status"/>
     </label>}
     <div className="list" role="list">
      {threadLoading&&<p role="status" className="muted-note">Loading your quote conversations…</p>}
      {!threadLoading&&threads.length===0?<p>No quotes or conversations yet. <Link href="/jobs">Review your jobs</Link> or <Link href="/quotes">professional leads</Link>.</p>:
       visible.length===0?<p className="muted-note">No conversations match your search.</p>:
       visible.map(t=><button type="button" key={t.quote_id} className="conversation-choice" onClick={()=>void select(t.quote_id)} aria-current={selected===t.quote_id?'true':undefined}>
        <strong>{t.label}</strong><small>£{(t.amount_pence/100).toFixed(2)} · {t.status}</small><span aria-hidden="true">→</span>
       </button>)}
     </div>
    </section>
    <section className="card" aria-label="Selected conversation">
     <div className="conversation-heading"><h2>{active?active.label:'Select a conversation'}</h2>
      {active&&<button type="button" className="btn secondary" disabled={messagesLoading||busy} onClick={()=>void loadMessages(active.quote_id)}>Refresh messages</button>}
     </div>
     {active&&<>
      <p className="muted-note">Quote £{(active.amount_pence/100).toFixed(2)} · {active.status} · Only quote participants have access</p>
      <div className="conversation-messages" aria-live="polite" aria-busy={messagesLoading}>
       {messagesLoading?<p role="status">Loading messages…</p>:
        messages.length===0?<p className="subtle">No messages yet. Start a private conversation about your quote.</p>:
        messages.map(m=><article className={m.author_id===userId?'conversation-bubble mine':'conversation-bubble'} key={m.id}>
         <strong>{m.author_id===userId?'You':'Other participant'}</strong>
         <p>{m.body}</p>
         <small>{new Date(m.created_at).toLocaleString('en-GB')}</small>
        </article>)}
      </div>
      <form className="form" onSubmit={submit} style={{marginTop:18}}>
       <label>Write a message<textarea required minLength={1} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Ask a question about the quote, schedule or agreed work…"/></label>
       <div className="conversation-actions"><button className="btn" disabled={busy||messagesLoading||!body.trim()} type="submit">{busy?'Sending…':'Send message'}</button>
        <Link href="/bookings" className="btn secondary">My bookings</Link>
       </div>
      </form>
      <p className="muted-note">Do not share full private job-site addresses in chat. Use the booking&apos;s separate address-sharing permission.</p>
     </>}
    </section>
   </div>}
 </main>;
}
