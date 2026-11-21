'use client';
import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import AddressSearch,{type SelectedLocation} from '../../components/address-search';
import {jobAddressLabel} from '../../lib/job-address';
import {parseJobBudgetPence} from '../../lib/job-budget';
import {meaningfulJobTextLength} from '../../lib/job-text';
import {jobPublishBlocker} from '../../lib/job-publish-readiness';
import TradeQuickPick from '../../components/trade-quick-pick';
import {canConfirmJobQuote} from '../../lib/quote-confirmation';
import {quoteMessagesHref} from '../../lib/workflow-links';
type Trade={id:string;name:string;slug:string};type Area={id:string;area_name:string;city:string};
type Job={id:string;title:string;description:string;status:string;created_at:string;budget_pence:number|null};
type Quote={quote_id:string;job_id:string;business_name:string;amount_pence:number;message:string;status:string};
export default function Jobs(){
 const [jobs,setJobs]=useState<Job[]>([]),[quotes,setQuotes]=useState<Quote[]>([]),[trades,setTrades]=useState<Trade[]>([]),[areas,setAreas]=useState<Area[]>([]);
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[trade,setTrade]=useState(''),[area,setArea]=useState(''),[budget,setBudget]=useState('');
 const [userId,setUserId]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[initialLoading,setInitialLoading]=useState(true);
 const [confirmQuoteId,setConfirmQuoteId]=useState<string|null>(null);
 const [site,setSite]=useState<SelectedLocation|null>(null),[checkedSite,setCheckedSite]=useState<SelectedLocation|null>(null),[addressVersion,setAddressVersion]=useState(0);
 const [manualProperty,setManualProperty]=useState('');
 const [territoryRetry,setTerritoryRetry]=useState(0),[territoryFailed,setTerritoryFailed]=useState(false);
 const [territoryVerified,setTerritoryVerified]=useState(false),[territoryChecking,setTerritoryChecking]=useState(false),[territoryNotice,setTerritoryNotice]=useState(''),[manualFallbackAllowed,setManualFallbackAllowed]=useState(false);
 const publishBlocker=jobPublishBlocker({title,description,trade,site,manualProperty,area,budget,busy,territoryChecking,checkedSite,territoryVerified,manualFallbackAllowed});

 async function refresh(){const s=supabaseBrowser();const [j,q]=await Promise.all([s.from('jobs').select('id,title,description,status,created_at,budget_pence').order('created_at',{ascending:false}).limit(100),s.rpc('customer_quotes')]);if(j.error)throw j.error;if(q.error)throw q.error;setJobs(j.data||[]);setQuotes(q.data||[])}
 useEffect(()=>{(async()=>{try{const s=supabaseBrowser();const [u,t,a]=await Promise.all([s.auth.getUser(),s.from('trades').select('id,name,slug').order('name'),s.from('service_areas').select('id,area_name,city').order('city')]);if(!u.data.user){setMessage('Sign in to post and manage jobs.');return}setUserId(u.data.user.id);if(t.error)throw t.error;if(a.error)throw a.error;setTrades(t.data||[]);setAreas(a.data||[]);
 const params=new URLSearchParams(window.location.search);
 const requestedTrade=params.get('trade')||'';
 const requestedArea=params.get('area')||'';
 const matchedTrade=(t.data||[]).find(item=>item.slug===requestedTrade);
 if(matchedTrade)setTrade(matchedTrade.id);
 if((a.data||[]).some(item=>item.id===requestedArea))setArea(requestedArea);
 await refresh()}catch(e){setMessage(e instanceof Error?e.message:'Could not load jobs')}finally{setInitialLoading(false)}})()},[]);
 useEffect(()=>{
  let active=true;
  if(!site){setCheckedSite(null);setTerritoryFailed(false);setTerritoryVerified(false);setManualFallbackAllowed(false);setTerritoryNotice('');setTerritoryChecking(false);setArea('');return;}
  setCheckedSite(null);setTerritoryFailed(false);setTerritoryChecking(true);setTerritoryVerified(false);setManualFallbackAllowed(false);setTerritoryNotice('Checking verified TrustFive territory coverage…');setArea('');
  (async()=>{
   try{
    const {data,error}=await supabaseBrowser().rpc('resolve_trustfive_territory',{
     p_country:site.country,p_lat:site.latitude,p_lon:site.longitude
    });
    if(!active)return;
    if(error)throw error;
    if(data&&areas.some(a=>a.id===data)){
     setArea(data);setCheckedSite(site);setTerritoryVerified(true);setManualFallbackAllowed(false);
     setTerritoryNotice('Verified territory selected automatically from your address.');
    }else{
     const coverage=await supabaseBrowser().rpc('has_verified_trustfive_territories',{p_country:site.country});
     if(!active)return;
     if(coverage.error)throw coverage.error;
     if(coverage.data){
      setManualFallbackAllowed(false);
      setTerritoryNotice('This address is outside currently verified TrustFive territory boundaries. Job posting is not available here yet; please check back when local coverage expands.');
     }else{
      setManualFallbackAllowed(true);setCheckedSite(site);
      setTerritoryNotice('There are no reviewed TrustFive boundaries for this country yet. You may temporarily select a territory manually; we cannot independently verify that it matches your address.');
     }
    }
   }catch{
    if(active){setTerritoryFailed(true);setManualFallbackAllowed(false);setTerritoryNotice('Territory verification is unavailable. For your protection, job publishing is paused until it can be checked.');}
   }finally{if(active)setTerritoryChecking(false);}
  })();
  return()=>{active=false;};
 },[site,areas,territoryRetry]);
 async function submit(e:FormEvent){e.preventDefault();if(!userId||busy)return;
  // Revalidate on submit as well as disabling the button. Keyboard, scripted
  // submits and state changes must not bypass the current address/trade checks.
  if(publishBlocker){setMessage(publishBlocker);return;}
  setBusy(true);setMessage('');
  try{
   if(meaningfulJobTextLength(title)<5)throw Error('Enter a job title with at least 5 meaningful characters');
   if(meaningfulJobTextLength(description)<15)throw Error('Describe the work in at least 15 meaningful characters');
   if(!site)throw Error('Select your job-site address from the suggestions first');
   const privateAddress=jobAddressLabel(site,manualProperty);
   if(territoryChecking||checkedSite!==site)throw Error('Wait for territory verification of your current address to finish');
   if(!territoryVerified&&!manualFallbackAllowed)throw Error('This address is not currently eligible for posting, or territory verification is unavailable');
   const amount=parseJobBudgetPence(budget);
   const {error}=await supabaseBrowser().rpc('create_job_with_private_location',{
    p_title:title.trim(),p_description:description.trim(),p_trade:trade,p_area:area,p_budget_pence:amount,
    p_address:privateAddress,p_postcode:site.postcode,p_country:site.country,
    p_lat:site.latitude,p_lon:site.longitude,p_precision:site.precision
   });
   if(error)throw error;
   // The database has already committed the job. A subsequent list-refresh
   // failure must not imply publishing failed or encourage a duplicate post.
   setTitle('');setDescription('');setBudget('');setSite(null);setCheckedSite(null);setManualProperty('');setTerritoryVerified(false);setAddressVersion(v=>v+1);
   try{
    await refresh();
    setMessage('Job published. Your selected address is stored privately and is not shown in public job descriptions. Only eligible approved professionals covering your service territory can view the brief.');
   }catch{
    setMessage('Job published successfully, but your job list could not be refreshed. Reload this page to see it before posting again.');
   }
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to save')}
  finally{setBusy(false)}
 }
 async function accept(quoteId:string){
  if(busy||confirmQuoteId!==quoteId)return;
  // Recheck the current in-memory state before invoking the separately
  // authorisation-checked database booking function.
  if(!canConfirmJobQuote(quoteId,quotes,jobs)){setConfirmQuoteId(null);setMessage('This quote can no longer be accepted. Refresh your jobs and try again.');return;}
  setBusy(true);setMessage('');
  try{
   const {error}=await supabaseBrowser().rpc('accept_job_quote',{p_quote:quoteId});
   if(error)throw error;
   setConfirmQuoteId(null);
   // Booking is committed independently of the customer list refresh.
   try{
    await refresh();
    setMessage('Quote accepted and booking recorded. No payment has been taken. Agree appointment and address-sharing details through your booking and messages.');
   }catch{
    setMessage('Booking recorded successfully, but the list could not be refreshed. Reload your bookings before attempting another confirmation. No payment has been taken.');
   }
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to accept quote')}
  finally{setBusy(false)}
 }
 return <main className="container"><div className="page-heading"><span className="eyebrow">Customer marketplace</span><h1>My jobs and quotes</h1><p className="subtle">Post a job and compare quotes from approved professionals. Quotes and bookings are saved in your account.</p></div>{message&&<p className="notice" role="status">{message}</p>}{initialLoading?<p className="notice" role="status" aria-live="polite">Checking your account and loading jobs…</p>:!userId?<Link className="btn" href={'/account?next='+encodeURIComponent(typeof window==='undefined'?'/jobs':window.location.pathname+window.location.search)}>Sign in / create account</Link>:<div className="two-col"><section className="card"><h2>Post a job</h2><form className="form" onSubmit={submit}><label>Job title<input required minLength={5} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Fix leaking kitchen tap"/></label><label>What needs doing?<textarea required minLength={15} maxLength={3000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the work, access and materials. Do not include private contact details."/></label><TradeQuickPick trades={trades} value={trade} onChange={setTrade}/><label>Trade<select required value={trade} onChange={e=>setTrade(e.target.value)}><option value="">Choose a service</option>{trades.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label><AddressSearch key={addressVersion} onSelect={point=>{setCheckedSite(null);setArea('');setTerritoryVerified(false);setManualFallbackAllowed(false);setSite(point);setManualProperty('');}}/>{site?.precision==='postcode'&&<label>House number/name and street (private, required)<input required minLength={5} maxLength={100} autoComplete="address-line1" value={manualProperty} onChange={e=>setManualProperty(e.target.value)} placeholder="e.g. 14 High Street" aria-describedby="postcode-location-note"/><span id="postcode-location-note" className="muted-note">We will store this with your postcode as your private job address. The map position remains the approximate postcode centre, not your property&apos;s exact coordinates.</span></label>}<label>TrustFive service territory {territoryVerified?'(verified automatically)':'(temporary manual selection)'}<select required disabled={territoryVerified||territoryChecking||!manualFallbackAllowed} value={area} onChange={e=>setArea(e.target.value)}><option value="">Choose an area</option>{areas.map(a=><option value={a.id} key={a.id}>{a.area_name}, {a.city}</option>)}</select></label>{site&&territoryNotice&&<div className={territoryFailed?'notice error':'notice'} role="status" aria-live="polite"><p>{territoryNotice}</p>{territoryFailed&&<button type="button" className="btn secondary" disabled={territoryChecking} onClick={()=>setTerritoryRetry(v=>v+1)}>Retry territory verification</button>}</div>}<label>Estimated budget (£; optional)<input type="number" min="0" max="10000000" step="0.01" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="250"/></label><button disabled={Boolean(publishBlocker)} aria-describedby="job-publish-guidance" className="btn" type="submit">{busy?'Saving…':'Publish job request'}</button><p id="job-publish-guidance" className="muted-note" aria-live="polite">{publishBlocker||"Your job request is ready to publish."}</p></form><p style={{marginTop:18}} className="muted-note">Choose your property from the address suggestions. If only a postcode is available, enter your house number/name and street separately. The postcode-centre coordinates remain approximate. Your selected address is stored privately; do not repeat it in your public description. Where verified territory boundaries exist, the correct territory is chosen automatically and cannot be overridden. Addresses outside reviewed boundaries cannot be manually assigned to another area. Only countries without any reviewed boundaries offer an explicitly unverified manual fallback.</p></section><section><h2>Your job requests</h2><div className="list">{jobs.length===0?<div className="card">You haven&apos;t posted any jobs yet.</div>:jobs.map(j=><article className="card" key={j.id}><span className="pill">{j.status}</span><h3 style={{marginTop:10}}>{j.title}</h3><p>{j.description}</p>{j.budget_pence!==null&&<p style={{marginTop:10}}>Budget estimate: £{(j.budget_pence/100).toFixed(2)}</p>}<p className="muted-note" style={{marginTop:8}}>{new Date(j.created_at).toLocaleDateString('en-GB')}</p>{quotes.filter(q=>q.job_id===j.id).map(q=><div key={q.quote_id} className="notice"><span className="pill">{q.status} quote</span><h3>{q.business_name}</h3><p><strong>£{(q.amount_pence/100).toFixed(2)}</strong></p><p>{q.message}</p><p style={{marginTop:12}}><Link href={quoteMessagesHref(q.quote_id)}>Message this professional →</Link></p>{j.status==='open'&&q.status==='pending'&&
   (confirmQuoteId===q.quote_id?
    <div className="quote-confirmation" role="group" aria-label={'Confirm quote from '+q.business_name}>
     <h4>Confirm this booking?</h4>
     <p>You are choosing <strong>{q.business_name}</strong> for <strong>£{(q.amount_pence/100).toFixed(2)}</strong> for “{j.title}”.</p>
     <p className="muted-note">Confirming creates a TrustFive booking. No payment is collected here. Agree the work, timing and terms with the professional. Your exact job address stays private unless you separately choose to share it for the booking.</p>
     <div className="quote-confirmation-actions">
      <button type="button" className="btn" disabled={busy} onClick={()=>void accept(q.quote_id)}>{busy?'Confirming…':'Confirm and create booking'}</button>
      <button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmQuoteId(null)}>Cancel</button>
     </div>
    </div>:
    <button type="button" disabled={busy} className="btn" onClick={()=>{setConfirmQuoteId(q.quote_id);setMessage('');}}>Review and accept quote</button>)}</div>)}{j.status==='booked'&&<p style={{marginTop:12}}><Link href="/bookings">Manage confirmed booking →</Link></p>}</article>)}</div></section></div>}</main>;
}
