'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
type Membership={subscription_status:string;updated_at:string};
export default function Billing(){
 const [signedIn,setSignedIn]=useState(false),[professional,setProfessional]=useState(false);
 const [membership,setMembership]=useState<Membership|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('Loading your membership details…');
 useEffect(()=>{(async()=>{try{
  const s=supabaseBrowser();
  const {data:{user},error}=await s.auth.getUser();
  if(error)throw error;
  if(!user){setNotice('Sign in to manage optional professional membership.');return;}
  setSignedIn(true);
  const [p,m]=await Promise.all([
   s.from('profiles').select('requested_role').eq('id',user.id).single(),
   s.from('business_memberships').select('subscription_status,updated_at').eq('user_id',user.id).maybeSingle()
  ]);
  if(p.error)throw p.error;if(m.error)throw m.error;
  setProfessional(p.data.requested_role==='professional');
  setMembership(m.data||null);
  setNotice('');
 }catch(e){setNotice(e instanceof Error?e.message:'Unable to load membership. Check database migrations.');}})()},[]);
 async function checkout(){
  if(busy)return;setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/billing/checkout',{method:'POST',credentials:'same-origin'});
   const payload=await response.json() as {url?:string;error?:string};
   if(!response.ok||!payload.url)throw Error(payload.error||'Checkout unavailable');
   const destination=new URL(payload.url);
   if(destination.protocol!=='https:'||!destination.hostname.endsWith('.stripe.com'))
    throw Error('Unrecognised checkout destination');
   location.assign(payload.url);
  }catch(e){setNotice(e instanceof Error?e.message:'Checkout is unavailable in this environment');}
  finally{setBusy(false);}
 }
 const active=['active','trialing'].includes(membership?.subscription_status||'');
 return <main className="container" style={{maxWidth:840}}>
  <div className="page-heading"><span className="eyebrow">Professional software</span><h1>TrustFive Business Membership</h1>
   <p className="subtle">Optional business tools. You do not need to pay to apply for one of the five approved professional places.</p></div>
  {notice&&<p className="notice" role="status">{notice}</p>}
  <div className="two-col">
   <section className="card">
    <span className="pill">Optional membership</span>
    <h2 style={{fontSize:38,margin:'18px 0 8px'}}>£19.99 <span style={{fontSize:16,fontWeight:400}}>per month</span></h2>
    <p>Business software membership is entirely separate from verification, professional rankings and waiting-list priority.</p>
    <p style={{marginTop:20}}><strong>Payment integration:</strong> test mode only. No live Stripe payment can be processed by this implementation.</p>
    {!signedIn?<p style={{marginTop:20}}><Link href="/account?next=%2Fbilling" className="btn">Sign in</Link></p>:
     !professional?<p style={{marginTop:20}}><Link href="/professional/apply" className="btn secondary">Apply as a professional</Link></p>:
     active?<div className="notice">Membership status: <strong>{membership?.subscription_status}</strong>. Billing portal and cancellations are not yet available in-app.</div>:
     <div style={{marginTop:20}}>
      <button className="btn" disabled={busy} onClick={checkout}>{busy?'Checking configuration…':'Open Stripe test checkout'}</button>
      <p className="muted-note">Checkout remains unavailable until the project's Stripe test keys, GBP price and webhook endpoint are configured.</p>
     </div>}
   </section>
   <section className="card"><h2>Membership and professional approval are separate</h2>
    <p><strong>Free professional application:</strong> verification, independent assessment and fair waiting-list selection.</p>
    <p style={{marginTop:18}}><strong>Paid software membership:</strong> optional business tools. It does not purchase a verified profile, ranking or a TrustFive slot.</p>
    <p style={{marginTop:18}}><strong>Your status:</strong> {membership?.subscription_status||'No test subscription recorded'}</p>
    <p style={{marginTop:18}} className="muted-note">Live pricing, billing terms, VAT treatment, refunds, cancellations and subscription management require final review before launch.</p>
   </section>
  </div>
 </main>;
}
