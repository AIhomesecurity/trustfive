'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import NotificationInboxControls from '../../components/notification-inbox-controls';
import {filterInbox,unreadInboxCount,type InboxItem,type InboxFilter,type InboxCategory} from '../../lib/notification-inbox';
import {safeNotificationTarget} from '../../lib/notification-target';
export default function Notifications(){
 const [items,setItems]=useState<InboxItem[]>([]);
 const [signedIn,setSignedIn]=useState(false);
 const [checkingAccount,setCheckingAccount]=useState(true);
 const [notice,setNotice]=useState('Loading your notifications…');
 const [busy,setBusy]=useState('');
 const [filter,setFilter]=useState<InboxFilter>('all');
 const [category,setCategory]=useState<InboxCategory>('all');
 const [search,setSearch]=useState('');
 const visibleItems=filterInbox(items,filter,category,search);
 function resetFilters(){setFilter('all');setCategory('all');setSearch('');}
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
  if(busy)return;
  setBusy(id);
  try{
   const {data,error}=await supabaseBrowser().rpc('mark_notification_read',{p_notification:id});
   if(error)throw error;
   if(data!==true)throw Error('Notification not found');
   await reload();setNotice('');
  }catch(error){setNotice(error instanceof Error?error.message:'Unable to mark notification as read');}
  finally{setBusy('');}
 }
 return <main className="container">
  <div className="page-heading"><span className="eyebrow">Private account activity</span><h1>Notifications</h1>
  <p className="subtle">Keep track of quotes, bookings, messages and professional vacancy offers.</p></div>
  {notice&&<p className="notice" role="status">{notice}</p>}
  {checkingAccount?<p role="status" aria-live="polite">Checking your account…</p>:
   !signedIn?<Link className="btn" href="/account">Sign in</Link>:
   <section className="list" aria-label="Your notifications">
   {items.length===0&&!notice&&<div className="card"><h2>All caught up</h2><p>New account activity will appear here.</p></div>}
   {items.length>0&&<NotificationInboxControls filter={filter} category={category} search={search}
    unreadCount={unreadInboxCount(items)} onFilterChange={setFilter} onCategoryChange={setCategory}
    onSearchChange={setSearch} onReset={resetFilters}/>}
   {items.length>0&&visibleItems.length===0&&<p className="card" role="status">No recent notifications match these filters.</p>}
   {visibleItems.map(item=>{
    const target=safeNotificationTarget(item.target_path);
    return <article className="card" key={item.id}>
    <span className="pill">{item.read_at?'Read':'New'}</span>
    <h2 style={{margin:'8px 0'}}>{item.title}</h2><p>{item.body}</p>
    <p className="muted-note" style={{marginTop:9}}>{new Date(item.created_at).toLocaleString('en-GB')}</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:15}}>
     {target&&<Link className="btn secondary" href={target}>View details</Link>}
     {!item.read_at&&<button type="button" disabled={busy!==''} className="btn secondary" onClick={()=>markRead(item.id)}>
       {busy===item.id?'Saving…':'Mark as read'}</button>}
    </div>
   </article>;})}
   </section>}
  <p className="muted-note" style={{marginTop:25}}>These are in-app notifications. Email, mobile push and real-time delivery are not yet enabled.</p>
 </main>;
}
