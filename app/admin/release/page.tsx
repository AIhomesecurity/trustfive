'use client';
import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';

type Area={country_code:string;city:string};
type Gate='legal_terms'|'privacy'|'payments'|'security'|'operational_support'|'authenticated_acceptance';
type ReleaseStatus={
 countryCode:string;reviewedTerritories:number;verifiedProfessionalsWithServiceLocations:number;
 humanApprovals:number;missingApprovals:Gate[];
 eligibleForHumanReleaseReview:boolean;productionAutomaticallyEnabled:boolean;
};
const names:Record<Gate,string>={
 legal_terms:'Independent legal terms review',
 privacy:'Independent data-protection review',
 payments:'Payment services and Stripe review',
 security:'Production security review',
 operational_support:'Customer support and incident operations',
 authenticated_acceptance:'Real authorised staging user acceptance'
};
const gateNames=Object.keys(names) as Gate[];
export default function ReleaseEvidence(){
 const [loading,setLoading]=useState(true),[admin,setAdmin]=useState(false);
 const [countries,setCountries]=useState<string[]>([]),[country,setCountry]=useState('');
 const [gate,setGate]=useState<Gate>('legal_terms'),[approved,setApproved]=useState(false);
 const [reviewer,setReviewer]=useState(''),[evidence,setEvidence]=useState('');
 const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
 const [status,setStatus]=useState<ReleaseStatus|null>(null),[notice,setNotice]=useState('');
 async function reload(code:string){
  if(!code){setStatus(null);return;}
  const {data,error}=await supabaseBrowser().rpc('trustfive_admin_country_release_gate',{p_country:code});
  if(error)throw error;setStatus(data as ReleaseStatus);
 }
 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const s=supabaseBrowser(),{data:allowed,error}=await s.rpc('is_trustfive_admin');
    if(error)throw error;
    if(!active)return;
    if(!allowed){setNotice('Only authorised TrustFive administrators may view release evidence.');return;}
    setAdmin(true);
    const areas=await s.from('service_areas').select('country_code,city').order('country_code');
    if(areas.error)throw areas.error;
    if(!active)return;
    const codes=[...new Set(((areas.data||[]) as Area[]).map(x=>x.country_code))].sort();
    setCountries(codes);setCountry(codes[0]||'');
    if(codes[0]){
     const result=await s.rpc('trustfive_admin_country_release_gate',{p_country:codes[0]});
     if(result.error)throw result.error;
     if(active)setStatus(result.data as ReleaseStatus);
    }
   }catch(error){if(active)setNotice(error instanceof Error?error.message:'Unable to load launch evidence');}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[]);
 async function submit(event:FormEvent){
  event.preventDefault();if(busy||!admin)return;
  setBusy(true);setNotice('');
  try{
   if(!country||!gate||!countries.includes(country))throw Error('Choose a configured country and release gate');
   if(!confirmed)throw Error('Confirm the evidence and reviewer represent a real completed independent review');
   if(evidence.trim().length<30||evidence.trim().length>1000)throw Error('Enter a safe evidence reference between 30 and 1000 characters');
   if(reviewer.trim().length<3||reviewer.trim().length>120)throw Error('Enter the real reviewer name (3–120 characters)');
   const {error}=await supabaseBrowser().rpc('record_country_release_signoff',{
    p_country:country,p_gate:gate,p_approved:approved,
    p_evidence_reference:evidence.trim(),p_reviewer_name:reviewer.trim()
   });
   if(error)throw error;
   await reload(country);
   setEvidence('');setReviewer('');setConfirmed(false);setApproved(false);
   setNotice('Human decision recorded in the private audit history. This does not deploy TrustFive or enable live payments.');
  }catch(error){setNotice(error instanceof Error?error.message:'Could not record release review');}
  finally{setBusy(false);}
 }
 return <main className="container" style={{maxWidth:900}}>
  <div className="page-heading">
   <span className="eyebrow">Restricted launch controls</span>
   <h1>Country launch evidence and approvals</h1>
   <p className="subtle">Only record an approval after an actual qualified reviewer has independently completed their review. Do not use sample evidence, false names or unverified consent.</p>
   <p><Link href="/admin/readiness">Readiness counts</Link> · <Link href="/admin/territories">Territory review</Link> · <Link href="/admin">Administration</Link></p>
  </div>
  {notice&&<p className="notice" role="status">{notice}</p>}
  {loading?<p className="notice" role="status">Checking administrator access and release evidence…</p>:
   !admin?<section className="card"><h2>Access restricted</h2><p>Release decisions require an authorised TrustFive administrator and genuine independent review evidence.</p></section>:
   <div className="two-col">
    <section className="card">
     <h2>Release position</h2>
     <label>Country
      <select value={country} onChange={e=>{const value=e.target.value;setCountry(value);setConfirmed(false);setStatus(null);void reload(value).catch(error=>setNotice(error instanceof Error?error.message:'Could not load release status'));}}>
       {countries.map(code=><option key={code} value={code}>{code}</option>)}
      </select>
     </label>
     {status&&<>
      <p role="status" className="notice"><strong>{status.eligibleForHumanReleaseReview?'Eligible for final owner review':'Release blocked'}</strong>. Even an eligible report never authorises deployment by itself.</p>
      <p><strong>{status.reviewedTerritories}</strong> reviewed territory boundaries</p>
      <p><strong>{status.verifiedProfessionalsWithServiceLocations}</strong> vetted professional service locations</p>
      <p><strong>{status.humanApprovals}</strong> of 6 independent human gates approved</p>
      <h3>Missing approvals</h3>
      {status.missingApprovals.length===0?<p>None recorded as missing. Final owner production approval is still separate.</p>:
       <ul>{status.missingApprovals.map(item=><li key={item}>{names[item]||item}</li>)}</ul>}
      <p className="muted-note">Production automatically enabled: No. Reviews and revocations leave a private audit trail.</p>
     </>}
    </section>
    <section className="card">
     <h2>Record a genuine reviewer decision</h2>
     <p className="muted-note">A valid evidence reference might identify a signed document held privately, a reviewer and its version. Never paste secret keys, customer addresses or personal identity documents here.</p>
     <form className="form" onSubmit={submit}>
      <label>Independent review area
       <select required value={gate} onChange={e=>{setGate(e.target.value as Gate);setConfirmed(false);}}>
        {gateNames.map(g=><option key={g} value={g}>{names[g]}</option>)}
       </select>
      </label>
      <label>Actual decision
       <select value={approved?'approved':'revoked'} onChange={e=>{setApproved(e.target.value==='approved');setConfirmed(false);}}>
        <option value="revoked">Not approved / revoke an earlier approval</option>
        <option value="approved">Approved after independently completed review</option>
       </select>
      </label>
      <label>Real independent reviewer
       <input required minLength={3} maxLength={120} value={reviewer} onChange={e=>{setReviewer(e.target.value);setConfirmed(false);}} placeholder="Qualified reviewer's name"/>
      </label>
      <label>Private evidence reference, source and review date
       <textarea required minLength={30} maxLength={1000} rows={5} value={evidence}
        onChange={e=>{setEvidence(e.target.value);setConfirmed(false);}}
        placeholder="Versioned document reference, independent source, reviewer and date — no confidential document contents"/>
      </label>
      <label style={{display:'flex',gap:10,alignItems:'start'}}>
       <input type="checkbox" style={{width:18,marginTop:4}} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
       I confirm this is an actual human review outcome, not a coding-agent assumption or test fixture.
      </label>
      <button className="btn" type="submit" disabled={!confirmed||busy||!country}>{busy?'Recording…':'Record reviewed decision'}</button>
     </form>
    </section>
   </div>}
 </main>;
}
