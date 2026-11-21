'use client';
import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';
import {verifiedTerritoryPolygon} from '../../../lib/verified-territory-polygon';

type Area={id:string;area_name:string;city:string;country_code:string};
export default function TerritoryReviews(){
 const [authorised,setAuthorised]=useState(false);
 const [checking,setChecking]=useState(true);
 const [areas,setAreas]=useState<Area[]>([]);
 const [area,setArea]=useState('');
 const [vertices,setVertices]=useState('');
 const [evidence,setEvidence]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const s=supabaseBrowser();
    const {data:isAdmin,error:accessError}=await s.rpc('is_trustfive_admin');
    if(accessError)throw accessError;
    if(!active)return;
    if(!isAdmin){setAuthorised(false);return;}
    setAuthorised(true);
    const {data,error}=await s.from('service_areas')
      .select('id,area_name,city,country_code').order('city');
    if(error)throw error;
    if(active)setAreas(data||[]);
   }catch(error){
    if(active)setMessage(error instanceof Error?error.message:'Could not load territory reviews');
   }finally{if(active)setChecking(false);}
  })();
  return()=>{active=false;};
 },[]);
 async function submit(event:FormEvent){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setMessage('');
  try{
   if(!authorised||!confirmed||!area||!areas.some(x=>x.id===area))
    throw Error('Choose a territory and confirm the independent boundary review');
   const note=evidence.trim();
   if(note.length<30||note.length>1000)
    throw Error('Explain the independent source, reviewer and evidence (30–1000 characters)');
   const polygon=verifiedTerritoryPolygon(vertices);
   const {error}=await supabaseBrowser().rpc('verify_service_territory',{
    p_area:area,p_boundary:polygon,p_evidence:note
   });
   if(error)throw error;
   setMessage('Reviewed territory boundary saved. It can now be used for exact service-area matching.');
   setVertices('');setEvidence('');setConfirmed(false);
  }catch(error){setMessage(error instanceof Error?error.message:'Boundary could not be verified');}
  finally{setBusy(false);}
 }
 return <main className="container" style={{maxWidth:780}}>
  <div className="page-heading">
   <span className="eyebrow">Restricted verification operations</span>
   <h1>Review local territory boundaries</h1>
   <p className="subtle">TrustFive&apos;s five approved trade places apply to a separately reviewed geographic territory. A city name, postcode radius or guessed boundary is not sufficient evidence.</p>
   <Link href="/admin">Back to TrustFive administration</Link>
  </div>
  {message&&<p className="notice" role="status">{message}</p>}
  {checking?<p role="status">Checking administrator permissions…</p>:
   !authorised?<section className="card"><h2>Access restricted</h2><p>Only authorised TrustFive reviewers may register independently verified local territory polygons.</p></section>:
   <section className="card">
    <h2>Human-approved boundary submission</h2>
    <p className="muted-note">Only submit coordinates transcribed from a reviewed authoritative boundary source. Coordinates are longitudes first, latitudes second, in decimal degrees. The system does not guess or create boundaries. Overlapping reviewed territories are rejected by the database.</p>
    <form className="form" onSubmit={submit}>
     <label>Existing service area
      <select required value={area} onChange={e=>{setArea(e.target.value);setConfirmed(false);}}>
       <option value="">Select a reviewed area</option>
       {areas.map(a=><option value={a.id} key={a.id}>{a.area_name}, {a.city} ({a.country_code})</option>)}
      </select>
     </label>
     <label>Surveyed boundary vertices — longitude,latitude on each line
      <textarea required rows={8} minLength={18} maxLength={1200} value={vertices}
       onChange={e=>{setVertices(e.target.value);setConfirmed(false);}}
       placeholder={'-0.14000000,51.50000000\n-0.13000000,51.50000000\n-0.13000000,51.51000000\n-0.14000000,51.51000000'}/>
     </label>
     <p className="muted-note">The example is only a syntax illustration—not an approved territory. Do not submit example coordinates or repeat the first point at the end. Each boundary requires 3–30 distinct, non-intersecting vertices.</p>
     <label>Independent evidence and reviewer notes (private)
      <textarea required minLength={30} maxLength={1000} rows={5} value={evidence}
       onChange={e=>{setEvidence(e.target.value);setConfirmed(false);}}
       placeholder="Identify the independent geographic source, review date, coverage basis and who approved this boundary."/>
     </label>
     <label style={{display:'flex',alignItems:'start',gap:12}}>
      <input type="checkbox" style={{width:18,marginTop:4}} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
      I have independently inspected the genuine territory evidence and confirm these coordinates are not synthetic or estimated.
     </label>
     <button className="btn" type="submit" disabled={busy||!confirmed||!area}>{busy?'Verifying…':'Register reviewed territory'}</button>
    </form>
    <p className="muted-note">Server-side database authorisation, evidence length checks, and the non-overlap rule apply regardless of this form. No professional is approved by registering a boundary.</p>
   </section>}
 </main>;
}
