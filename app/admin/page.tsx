'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';
import GroupPostModeration from '../../components/group-post-moderation';
import AddressSearch,{type SelectedLocation} from '../../components/address-search';
type Application={id:string;business_name:string|null;status:string;experience_years:number|null;about:string|null;submitted_at:string;trade_id:string;area_id:string};
type Offer={id:string;application_id:string;status:string;expires_at:string};
type Report={id:string;post_id:string;category:string;created_at:string};
type Trade={id:string;name:string};type Area={id:string;area_name:string;city:string};
type VerificationSub={application_id:string;insurance_provider:string;insurance_policy_ref:string;insurance_expires_on:string;trade_body:string|null;registration_number:string|null;qualification_summary:string;verification_status:string;reviewer_note:string|null};
const criteria=[['satisfaction',30],['workmanship',25],['reliability',15],['compliance',15],['communication',10],['complaint_history',5]] as const;
type Criterion=typeof criteria[number][0];
export default function Admin(){
 const [admin,setAdmin]=useState(false),[loading,setLoading]=useState(true),[applications,setApplications]=useState<Application[]>([]);
 const [offers,setOffers]=useState<Offer[]>([]),[reports,setReports]=useState<Report[]>([]),[trades,setTrades]=useState<Trade[]>([]),[areas,setAreas]=useState<Area[]>([]);
 const [verifications,setVerifications]=useState<VerificationSub[]>([]);
 const [selected,setSelected]=useState(''),[trade,setTrade]=useState(''),[area,setArea]=useState(''),[checked,setChecked]=useState(false);
 const [scores,setScores]=useState<Record<Criterion,string>>({satisfaction:'',workmanship:'',reliability:'',compliance:'',communication:'',complaint_history:''});
 const [suspendAppId,setSuspendAppId]=useState(''),[suspendReason,setSuspendReason]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [coverageApp,setCoverageApp]=useState(''),[coveragePoint,setCoveragePoint]=useState<SelectedLocation|null>(null);
 const [coverageRadius,setCoverageRadius]=useState('25'),[coverageEvidence,setCoverageEvidence]=useState('');
 const [reportCategoryFilter,setReportCategoryFilter]=useState('all');
 const [confirmHideReportId,setConfirmHideReportId]=useState<string|null>(null);
 async function refresh(){
  const s=supabaseBrowser();const r=await Promise.all([
   s.from('professional_applications').select('id,business_name,status,experience_years,about,submitted_at,trade_id,area_id').order('submitted_at',{ascending:false}).limit(150),
   s.from('vacancy_offers').select('id,application_id,status,expires_at').order('offered_at',{ascending:false}).limit(100),
   s.from('community_reports').select('id,post_id,category,created_at').eq('status','pending').order('created_at',{ascending:false}).limit(50),
   s.from('trades').select('id,name').order('name'),
   s.from('service_areas').select('id,area_name,city').order('city'),
   s.from('professional_verification_submissions').select('application_id,insurance_provider,insurance_policy_ref,insurance_expires_on,trade_body,registration_number,qualification_summary,verification_status,reviewer_note').order('updated_at',{ascending:false}).limit(150)]);
  for(const item of r)if(item.error)throw item.error;
  setApplications(r[0].data||[]);setOffers(r[1].data||[]);setReports(r[2].data||[]);setTrades(r[3].data||[]);setAreas(r[4].data||[]);setVerifications((r[5].data||[]) as VerificationSub[]);
 }
 useEffect(()=>{(async()=>{try{const s=supabaseBrowser();const {data,error}=await s.rpc('is_trustfive_admin');if(error)throw error;setAdmin(Boolean(data));if(data)await refresh()}catch(e){setMessage(e instanceof Error?e.message:'Unable to verify admin access')}finally{setLoading(false)}})()},[]);
 async function perform(action:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');try{await action();await refresh()}catch(e){setMessage(e instanceof Error?e.message:'Action failed')}finally{setBusy(false)}}
 const total=criteria.reduce((sum,[name])=>sum+Number(scores[name]||0),0);
 async function review(verified:boolean){await perform(async()=>{if(!selected)throw Error('Choose an application');if(!checked)throw Error('Confirm you completed all external checks first');if(criteria.some(([name,max])=>scores[name]===''||!Number.isInteger(Number(scores[name]))||Number(scores[name])<0||Number(scores[name])>max))throw Error('Enter all six scores within their allowed ranges');const params={p_application:selected,p_verified:verified,p_satisfaction:Number(scores.satisfaction),p_workmanship:Number(scores.workmanship),p_reliability:Number(scores.reliability),p_compliance:Number(scores.compliance),p_communication:Number(scores.communication),p_complaint_history:Number(scores.complaint_history)};const {error}=await supabaseBrowser().rpc('review_professional_application',params);if(error)throw error;setMessage(verified?'Assessment saved. Candidate is eligible (waiting list until offered/activated).':'Application marked rejected following independent review.');setChecked(false)})}
 async function reviewVerification(applicationId:string,status:'under_review'|'verified'|'needs_more_info'|'rejected'){await perform(async()=>{const {error}=await supabaseBrowser().rpc('review_professional_verification',{p_application:applicationId,p_status:status,p_reviewer_note:null});if(error)throw error;setMessage('Verification submission status updated to '+status.replace(/_/g,' ')+'.')})}
 async function suspendProfessional(){await perform(async()=>{if(!suspendAppId)throw Error('Choose an application to suspend');if(suspendReason.trim().length<15)throw Error('Provide an evidence-based reason (at least 15 characters)');const {error}=await supabaseBrowser().rpc('suspend_professional_application',{p_application:suspendAppId,p_reason:suspendReason.trim()});if(error)throw error;setSuspendAppId('');setSuspendReason('');setMessage('Professional suspended, any active slot vacated, and audit event recorded.')})}
 async function offerNext(){await perform(async()=>{if(!trade||!area)throw Error('Select trade and area');const {error}=await supabaseBrowser().rpc('offer_next_professional',{p_trade:trade,p_area:area});if(error)throw error;setMessage('Offer sent into the applicant account. No email notification has been configured yet.')})}
 async function activate(applicationId:string){await perform(async()=>{const {error}=await supabaseBrowser().rpc('activate_professional',{p_application:applicationId});if(error)throw error;setMessage('Professional activated in one of the five slots.')})}
 async function verifyCoverage(){await perform(async()=>{
  if(!coverageApp||!coveragePoint)throw Error('Select an approved application and an address');
  if(!Number.isInteger(Number(coverageRadius))||Number(coverageRadius)<1||Number(coverageRadius)>200)
    throw Error('Enter a service radius between 1 and 200 km');
  if(coverageEvidence.trim().length<20)throw Error('Document the evidence supporting this service area');
  const {error}=await supabaseBrowser().rpc('verify_professional_service_location',{
   p_application:coverageApp,p_lat:coveragePoint.latitude,p_lon:coveragePoint.longitude,
   p_radius_km:Number(coverageRadius),p_verification_note:coverageEvidence.trim()
  });
  if(error)throw error;
  setMessage('Verified service coverage saved. Customer searches may now rank this approved professional by approximate distance.');
  setCoverageEvidence('');
 })}
 async function moderate(postId:string){await perform(async()=>{const {error}=await supabaseBrowser().rpc('moderate_community_post',{p_post:postId,p_visibility:'hidden'});if(error)throw error;setConfirmHideReportId(null);setMessage('Post hidden. Resolving the report status row requires a coordinated moderation RPC.')})}
 const selectedVerification=verifications.find(v=>v.application_id===selected);
 const visibleCommunityReports=reportCategoryFilter==='all'?reports:reports.filter(r=>r.category===reportCategoryFilter);
 return <main className="container"><div className="page-heading"><span className="eyebrow">Restricted operations</span><h1>TrustFive admin</h1><p className="subtle">Protected by server-side database authorization, not a visual admin flag. <Link href="/admin/complaints">Review complaints and appeals →</Link> · <Link href="/admin/business">Review business pages →</Link> · <Link href="/admin/territories">Review territory boundaries →</Link> · <Link href="/admin/readiness">Check launch readiness →</Link> · <Link href="/admin/release">Review legal and payment signoffs →</Link></p></div>{loading&&<p>Verifying access…</p>}{message&&<p className="notice" role="status">{message}</p>}
 {!loading&&!admin&&<div className="card"><h2>Access restricted</h2><p>Only a database-authorised TrustFive administrator may review applicants or manage slots.</p><p><Link href="/profile">Back to my profile</Link></p></div>}
 {admin&&<><div className="grid" style={{marginBottom:26}}><div className="card"><h3>{applications.filter(x=>x.status==='pending'||x.status==='under_review').length}</h3><p>Pending / under review</p></div><div className="card"><h3>{applications.filter(x=>x.status==='suspended').length}</h3><p>Suspended applications</p></div><div className="card"><h3>{offers.filter(x=>x.status==='accepted').length}</h3><p>Accepted vacancy offers</p></div><div className="card"><h3>{reports.length}</h3><p>Post reports requiring review</p></div></div>
 <section className="card" style={{marginBottom:24}}><h2>Human verification and quality review</h2><p className="muted-note">Only mark an applicant verified after checking identity, relevant licensing, current insurance and original evidence independently.</p><div className="form"><label>Application<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose applicant</option>{applications.filter(a=>a.status==='pending'||a.status==='under_review').map(a=><option value={a.id} key={a.id}>{a.business_name||'Unnamed business'} · {a.status}</option>)}</select></label>{selected&&<p className="notice">{applications.find(a=>a.id===selected)?.about||'No details provided'}</p>}{selectedVerification&&<div className="notice"><strong>Private verification submission ({selectedVerification.verification_status}):</strong> Insurance: {selectedVerification.insurance_provider} ({selectedVerification.insurance_policy_ref}, expires {selectedVerification.insurance_expires_on}){selectedVerification.trade_body?` · ${selectedVerification.trade_body} ${selectedVerification.registration_number||''}`:''}<p style={{marginTop:6}}>{selectedVerification.qualification_summary}</p><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}><button type="button" className="btn secondary" disabled={busy} onClick={()=>void reviewVerification(selected,'under_review')}>Mark under review</button><button type="button" className="btn secondary" disabled={busy} onClick={()=>void reviewVerification(selected,'verified')}>Confirm verification evidence</button><button type="button" className="btn secondary" disabled={busy} onClick={()=>void reviewVerification(selected,'needs_more_info')}>Request more info</button></div></div>}<div className="form-grid">{criteria.map(([name,max])=><label key={name}>{name.replace('_',' ')} (0–{max})<input type="number" min="0" max={max} value={scores[name]} onChange={e=>setScores({...scores,[name]:e.target.value})}/></label>)}</div><p>Assessment total: <strong>{total}/100</strong> (minimum 70, compliance at least 10)</p><label style={{display:'flex',gap:10,alignItems:'start'}}><input style={{width:18,marginTop:3}} type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/> I confirm independent checks are complete and evidence has been reviewed.</label><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="btn" type="button" disabled={busy||!checked} onClick={()=>void review(true)}>Mark eligible following review</button><button className="btn secondary" type="button" disabled={busy||!checked} onClick={()=>void review(false)}>Reject application</button></div></div></section>
 <section className="card" style={{marginBottom:24}}><h2>Fill a vacancy fairly</h2><p className="subtle">The engine selects the highest-rated eligible waiting-list applicant; application date breaks ties. It will not exceed five slots.</p><div className="form-grid"><label>Trade<select value={trade} onChange={e=>setTrade(e.target.value)}><option value="">Choose trade</option>{trades.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Area<select value={area} onChange={e=>setArea(e.target.value)}><option value="">Choose area</option>{areas.map(a=><option key={a.id} value={a.id}>{a.area_name}, {a.city}</option>)}</select></label></div><p><button className="btn" onClick={offerNext} disabled={busy}>Offer next eligible applicant</button></p><h3>Accepted offers awaiting activation</h3>{offers.filter(o=>o.status==='accepted').length===0?<p className="subtle">No accepted offers.</p>:offers.filter(o=>o.status==='accepted').map(o=><div className="notice" key={o.id}><p>Application: {applications.find(a=>a.id===o.application_id)?.business_name||o.application_id}</p><p>Offer expires {new Date(o.expires_at).toLocaleString('en-GB')}</p><button className="btn" onClick={()=>activate(o.application_id)} disabled={busy}>Activate after final review</button></div>)}</section>
 <section className="card" style={{marginBottom:24}}><h2>Suspend professional &amp; vacate slot</h2><p className="subtle">Suspending removes any active five-slot allocation, expires open offers, marks the application suspended, and frees capacity for the next eligible waiting-list applicant.</p><div className="form"><label>Application to suspend<select value={suspendAppId} onChange={e=>setSuspendAppId(e.target.value)}><option value="">Select application</option>{applications.filter(a=>a.status!=='suspended'&&a.status!=='withdrawn').map(a=><option key={a.id} value={a.id}>{a.business_name||'Unnamed business'} · {a.status}</option>)}</select></label><label>Evidence-based suspension reason (min 15 chars)<textarea minLength={15} maxLength={500} value={suspendReason} onChange={e=>setSuspendReason(e.target.value)} placeholder="State verified compliance, insurance or conduct findings"/></label><button type="button" className="btn secondary" disabled={busy||!suspendAppId||suspendReason.trim().length<15} onClick={()=>void suspendProfessional()}>Suspend professional</button></div></section>
 <section className="card" style={{marginBottom:24}}>
  <h2>Verify professional coverage for nearby searches</h2>
  <p className="subtle">Only independently approved active professionals can be added. Verify their operating address and real service radius before saving. These coordinates and evidence notes are never exposed through public search.</p>
  <div className="form">
   <label>Approved professional
    <select value={coverageApp} onChange={e=>setCoverageApp(e.target.value)}>
     <option value="">Select an active approved business</option>
     {applications.filter(a=>a.status==='eligible').map(a=><option key={a.id} value={a.id}>{a.business_name||'Unnamed business'}</option>)}
    </select>
   </label>
   <AddressSearch onSelect={setCoveragePoint}/>
   <label>Verified service radius (kilometres)
    <input type="number" min="1" max="200" step="1" value={coverageRadius} onChange={e=>setCoverageRadius(e.target.value)}/>
   </label>
   <label>Verification evidence and reviewer notes (private)
    <textarea minLength={20} maxLength={500} value={coverageEvidence} onChange={e=>setCoverageEvidence(e.target.value)}
      placeholder="State how the professional location and service radius were independently verified."/>
   </label>
   <button type="button" className="btn" disabled={busy||!coverageApp||!coveragePoint||coverageEvidence.trim().length<20} onClick={verifyCoverage}>Save verified coverage</button>
  </div>
 </section>
 <section className="card" aria-labelledby="community-reports-heading">
  <h2 id="community-reports-heading">Community reports</h2>
  <p className="muted-note">Neighbourhood post reports queued for moderator review. Hiding sets the post visibility to hidden via auditable RPC; dismissing report rows requires a coordinated database RPC matching group moderation.</p>
  {reports.length>0&&<div className="social-hub-shortcuts">
   <label style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:14,fontWeight:700}}>
    Category
    <select aria-label="Filter community reports by category" value={reportCategoryFilter} disabled={busy}
     onChange={e=>{setReportCategoryFilter(e.target.value);setConfirmHideReportId(null);}}>
     <option value="all">All categories ({reports.length})</option>
     {(['spam','abuse','privacy','other'] as const).map(cat=><option key={cat} value={cat}>{cat} ({reports.filter(r=>r.category===cat).length})</option>)}
    </select>
   </label>
  </div>}
  {reports.length===0?<p className="subtle">No outstanding reports.</p>
   :visibleCommunityReports.length===0?<p className="muted-note">No pending community reports match the selected category.</p>
   :visibleCommunityReports.map(r=><article className="notice" key={r.id}>
    <p style={{margin:'0 0 6px'}}><strong>Report: {r.category}</strong> · {new Date(r.created_at).toLocaleString('en-GB')}</p>
    <p className="muted-note" style={{margin:'0 0 10px'}}>Post ID: {r.post_id}</p>
    {confirmHideReportId===r.id?<div role="group" aria-label="Confirm hiding reported post" className="social-hub-shortcuts" style={{margin:0}}
      onKeyDown={event=>{if(event.key==='Escape'&&!busy){event.preventDefault();setConfirmHideReportId(null);}}}>
     <button type="button" className="btn" disabled={busy} onClick={()=>void moderate(r.post_id)}>Confirm hide community post</button>
     <button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmHideReportId(null)}>Cancel</button>
    </div>:<button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmHideReportId(r.id)}>Hide reported post pending investigation</button>}
   </article>)}
 </section>
 <GroupPostModeration/></>}</main>;
}