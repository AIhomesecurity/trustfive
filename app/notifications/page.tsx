'use client';
import {useEffect,useRef,useState} from 'react';
import {createNotificationReadGate} from '../../lib/notification-read-gate';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import {safeNotificationTarget} from '../../lib/notification-target';
type Notification={id:string;kind:string;title:string;body:string;target_path:string;created_at:string;read_at:string|null};
export default function Notifications(){
 const [items,setItems]=useState<Notification[]>([]);
 const [signedIn,setSignedIn]=useState(false);
 const [checkingAccount,setCheckingAccount]=useState(true);
 const [notice,setNotice]=useState('Loading your notifications…');
 const [busy,setBusy]=useState('');
 const readGate=useRef(createNotificationReadGate());
 async function reload(){
  const {data,error}=await supabaseBrowser().from('account_notifications')
    .select('id,kind,title,body,target_path,created_at,read_at')
    .order('created_at',{ascending:false}).limit(75);
  if(error)throw error;
  setItems(data||[]);
 }
 useEffect(()=>{(async()=>{
  try{
   const {data:{user},error}=await supabaseBrowser().auth.getUser();
   if(error)throw error;
   if(!user){setNotice('Sign in to see your private notifications.');return;}
   setSignedIn(true);await reload();setNotice('');
  }catch(error){setNotice(error instanceof Error?error.message:'Unable to load notifications');}
  finally{setCheckingAccount(false);}
 })()},[]);
 async function markRead(id:string){
  await readGate.current.run(async()=>{
   setBusy(id);
   try{
    const {data,error}=await supabaseBrowser().rpc('mark_notification_read',{p_notification:id});
    if(error)throw error;
    if(data!==true)throw Error('Notification not found');
    await reload();setNotice('');
   }catch(error){setNotice(error instanceof Error?error.message:'Unable to mark notification as read');}
   finally{setBusy('');}
  });
 }
 return <main className="container">
  <div className="page-heading"><span className="eyebrow">Private account activity</span><h1>Notifications</h1>
  <p className="subtle">Keep track of quotes, bookings, messages and professional vacancy offers.</p></div>
  {notice&&<p className="notice" role="status">{notice}</p>}
  {checkingAccount?<p role="status" aria-live="polite">Checking your account…</p>:
   !signedIn?<Link className="btn" href="/account">Sign in</Link>:
   <section className="list" aria-label="Your notifications">
   {items.length===0&&!notice&&<div className="card"><h2>All caught up</h2><p>New account activity will appear here.</p></div>}
   {items.map(item=><article className="card" key={item.id}>
    <span className="pill">{item.read_at?'Read':'New'}</span>
    <h2 style={{margin:'8px 0'}}>{item.title}</h2><p>{item.body}</p>
    <p className="muted-note" style={{marginTop:9}}>{new Date(item.created_at).toLocaleString('en-GB')}</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:15}}>
     {safeNotificationTarget(item.target_path)&&<Link className="btn secondary" href={safeNotificationTarget(item.target_path)!}>View details</Link>}
     {!item.read_at&&<button type="button" disabled={busy!==''} className="btn secondary" onClick={()=>markRead(item.id)}>
       {busy===item.id?'Saving…':'Mark as read'}</button>}
    </div>
   </article>)}
   </section>}
  <p className="muted-note" style={{marginTop:25}}>These are in-app notifications. Email, mobile push and real-time delivery are not yet enabled.</p>
 </main>;
}
