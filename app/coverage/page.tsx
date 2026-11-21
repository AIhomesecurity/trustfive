'use client';
import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import AddressSearch,{type SelectedLocation} from '../../components/address-search';
import {ukPostcodeLookupKind} from '../../lib/uk-postcode-lookup';
import {supabaseBrowser} from '../../lib/supabase';

type Trade={id:string;name:string};
type Request={id:string;outcode:string;requested_role:string;status:string;created_at:string};
type Role='customer'|'professional';

/** Public nationwide discovery, authenticated demand registration. No coverage
 * requests create active territories, vetted business slots or public listings. */
function outcodeFromSelection(site:SelectedLocation|null):string{
 if(!site)return '';
 const source=site.postcode||site.label;
 const code=source.trim().split(/[\s,]/)[0].toUpperCase();
 return ukPostcodeLookupKind(code)==='outcode'?code:'';
}

export default function UKCoverage(){
 const [site,setSite]=useState<SelectedLocation|null>(null);
 const [role,setRole]=useState<Role>('customer');
 const [trade,setTrade]=useState('');
 const [trades,setTrades]=useState<Trade[]>([]);
 const [requests,setRequests]=useState<Request[]>([]);
 const [signedIn,setSignedIn]=useState(false);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [locationVersion,setLocationVersion]=useState(0);
 const outcode=outcodeFromSelection(site);
 async function loadRequests(){
  const {data,error}=await supabaseBrowser().from('uk_area_interest_requests')
   .select('id,outcode,requested_role,status,created_at').order('created_at',{ascending:false}).limit(50);
  if(error)throw error;
  setRequests(data||[]);
 }
 useEffect(()=>{let active=true;(async()=>{
  try{
   const s=supabaseBrowser();
   const [u,t]=await Promise.all([
    s.auth.getUser(),s.from('trades').select('id,name').order('name')
   ]);
   if(t.error)throw t.error;
   if(!active)return;
   setTrades(t.data||[]);
   if(u.error)throw u.error;
   setSignedIn(Boolean(u.data.user));
   if(u.data.user)await loadRequests();
  }catch(e){if(active)setNotice(e instanceof Error?e.message:'Unable to load coverage requests');}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false};},[]);
 async function submit(event:FormEvent){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setNotice('');
  try{
   if(!outcode)throw Error('Choose a UK full postcode or postcode district from the suggestions.');
   if(role==='professional'&&!trade)throw Error('Choose the trade you would offer.');
   const {data:{user},error:authError}=await supabaseBrowser().auth.getUser();
   if(authError||!user)throw Error('Sign in to register your area.');
   const {error}=await supabaseBrowser().from('uk_area_interest_requests').insert({
    user_id:user.id,outcode,requested_role:role,trade_id:role==='professional'?trade:null,
    status:'pending'
   });
   if(error)throw error;
   await loadRequests();
   setNotice('Your UK coverage request is registered as pending. This is not a professional application, approved territory or guarantee of service.');
   setSite(null);setLocationVersion(n=>n+1);
  }catch(e){const message=e instanceof Error?e.message:'Could not register this area';
   setNotice(/duplicate key|uk_area_interest_unique_request/i.test(message)?
    'You have already registered interest in this postcode district and trade.':message);
  }finally{setBusy(false);}
 }
 return <main className="container" style={{maxWidth:860}}>
  <div className="page-heading">
   <span className="eyebrow">United Kingdom · Nationwide expansion</span>
   <h1>Find or request TrustFive coverage anywhere in the UK</h1>
   <p className="subtle">Search using any UK postcode or district, including England, Scotland, Wales and Northern Ireland. A searchable area is not necessarily an approved TrustFive territory. Professional places open only after independent boundary and vetting reviews.</p>
   <p><Link href="/services">Search nearby approved professionals</Link> · <Link href="/how-it-works">How the five-place rule works</Link></p>
  </div>
  <section className="card">
   <h2>Register interest in your area</h2>
   <p>Can&apos;t see local vetted professionals? Tell us which UK postcode district needs coverage. We store the postcode district only, not your full property address.</p>
   <form className="form" onSubmit={submit}>
    <AddressSearch key={locationVersion} onSelect={setSite}/>
    {site&&<p className="muted-note" role="status">Area to register: <strong>{outcode||'Choose a full postcode or postcode district'}</strong>. This is a request, not a verified operating boundary.</p>}
    <label>I am interested as
     <select value={role} onChange={e=>setRole(e.target.value as Role)}>
      <option value="customer">A customer looking for local help</option>
      <option value="professional">A professional wanting to apply locally</option>
     </select>
    </label>
    {role==='professional'&&<label>Trade or service
     <select required value={trade} onChange={e=>setTrade(e.target.value)}>
      <option value="">Choose a trade</option>
      {trades.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
     </select>
    </label>}
    {!loading&&!signedIn&&<p className="notice">Sign in before registering. <Link href="/account?next=%2Fcoverage">Go to your account</Link>.</p>}
    <button className="btn" type="submit" disabled={busy||loading||!signedIn||!outcode||(role==='professional'&&!trade)}>
     {busy?'Registering…':'Register pending area interest'}
    </button>
    {notice&&<p className="notice" role="status">{notice}</p>}
   </form>
  </section>
  {signedIn&&<section className="card" style={{marginTop:24}}>
   <h2>Your UK coverage requests</h2>
   {!requests.length?<p>No requests yet.</p>:<ul>
    {requests.map(item=><li key={item.id}>
     <strong>{item.outcode}</strong> · {item.requested_role} · {item.status}
     <span className="muted-note"> · {new Date(item.created_at).toLocaleDateString('en-GB')}</span>
    </li>)}
   </ul>}
   <p className="muted-note">Requests do not approve tradespeople or automatically create five-slot territories. Eligibility, professional verification and surveyed boundaries are reviewed independently.</p>
  </section>}
 </main>;
}
