'use client';
import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import ShowcaseEditor from '../../../components/showcase-editor';
import {supabaseBrowser} from '../../../lib/supabase';
type Application={id:string;business_name:string|null;status:string};
type Page={application_id:string;display_name:string;description:string;status:string;review_note:string|null};
export default function BusinessPageEditor(){
 const [userId,setUserId]=useState(''),[applications,setApplications]=useState<Application[]>([]);
 const [pages,setPages]=useState<Page[]>([]);
 const [selected,setSelected]=useState(''),[name,setName]=useState(''),[description,setDescription]=useState('');
 const [notice,setNotice]=useState('Loading your business applications…'),[busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true),[loadFailed,setLoadFailed]=useState(false);
 const [loadAttempt,setLoadAttempt]=useState(0);
 const current=pages.find(p=>p.application_id===selected);
 async function refresh(){
  const s=supabaseBrowser();const [a,p]=await Promise.all([
   s.from('professional_applications').select('id,business_name,status').order('submitted_at',{ascending:false}),
   s.from('professional_business_pages').select('application_id,display_name,description,status,review_note')
  ]);
  if(a.error)throw a.error;if(p.error)throw p.error;
  setApplications(a.data||[]);setPages(p.data||[]);
 }
 useEffect(()=>{(async()=>{try{
  const {data:{user},error}=await supabaseBrowser().auth.getUser();
  if(error)throw error;if(!user){setNotice('Sign in to manage your professional page.');return;}
  setUserId(user.id);await refresh();setNotice('');
 }catch{setLoadFailed(true);setNotice('');}
 finally{setLoading(false);}})()},[loadAttempt]);
 function choose(id:string){
  setSelected(id);const p=pages.find(v=>v.application_id===id);
  const a=applications.find(v=>v.id===id);
  setName(p?.display_name||a?.business_name||'');
  setDescription(p?.description||'');
 }
 async function save(e:FormEvent){e.preventDefault();if(!selected||busy)return;setBusy(true);setNotice('');
  try{
   const data={display_name:name.trim(),description:description.trim(),
    website_url:null,public_phone:null};
   const s=supabaseBrowser();
   const result=current?
    await s.from('professional_business_pages').update(data).eq('application_id',selected):
    await s.from('professional_business_pages').insert({
     application_id:selected,owner_id:userId,status:'draft',...data
    });
   if(result.error){if(result.error.code==='23514')throw Error('Check the length and remove contact details or external links from the business page.');throw result.error;}
   const savedDraft:Page={application_id:selected,status:'draft',review_note:current?.review_note??null,...data};
   setPages(previous=>[...previous.filter(page=>page.application_id!==selected),savedDraft]);
   try{
    await refresh();
    setNotice('Draft saved privately. Submit it for independent review when ready.');
   }catch{
    setNotice('Draft saved privately. The business page list could not refresh.');
   }
  }catch(e){setNotice(e instanceof Error?e.message:'Unable to save business draft');}
  finally{setBusy(false);}
 }
 async function submit(){if(!selected||busy||current?.status!=='draft')return;setBusy(true);setNotice('');
  try{
   const {error}=await supabaseBrowser().rpc('submit_business_page',{p_application:selected});
   if(error)throw error;
   setPages(previous=>previous.map(page=>page.application_id===selected?{...page,status:'submitted'}:page));
   const submitted='Business page submitted for independent moderation. It is not public yet.';
   try{
    await refresh();
    setNotice(submitted);
   }catch{
    setNotice(submitted+' The business page list could not refresh.');
   }
  }catch(e){setNotice(e instanceof Error?e.message:'Unable to submit page');}
  finally{setBusy(false);}
 }
 return <main className="container">
  <div className="page-heading"><span className="eyebrow">Professional business centre</span><h1>My business page</h1>
   <p className="subtle">Build a professional profile. Publishing requires separate administrator approval and an active verified TrustFive place.</p></div>
  {notice&&<p role="status" className="notice">{notice}</p>}
  {!loading&&(loadFailed?<div role="alert" className="notice error">
   <p>Could not load your business applications and pages.</p>
   <button className="btn secondary" type="button" onClick={()=>{setLoadFailed(false);setLoading(true);setNotice('Loading your business applications…');setLoadAttempt(attempt=>attempt+1);}}>Retry loading business pages</button>
  </div>:!userId?<Link href="/account?next=%2Fprofessional%2Fbusiness" className="btn">Sign in</Link>:<div className="two-col">
   <section className="card"><h2>Edit business page</h2>
    <label>My professional application<select value={selected} onChange={e=>choose(e.target.value)}>
     <option value="">Select an application</option>
     {applications.map(a=><option value={a.id} key={a.id}>{a.business_name||'Professional'} — {a.status}</option>)}
    </select></label>
    {applications.length===0&&<p style={{marginTop:15}}><Link className="btn secondary" href="/professional/apply">Apply as a professional</Link></p>}
    {selected&&<>
     <p style={{marginTop:16}}><span className="pill">{current?.status||'New draft'}</span></p>
     {current?.review_note&&<div className="notice"><strong>Reviewer notes:</strong> {current.review_note}</div>}
     {(!current||current.status==='draft')?<form className="form" onSubmit={save}>
      <label>Business name<input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Public description<textarea required minLength={30} maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
      <p className="muted-note">The name and description become publicly visible after approval. Keep phone numbers, addresses, emails and external links out of your profile.</p>
      <button className="btn" type="submit" disabled={busy}>Save private draft</button>
     </form>:<p className="subtle">This page is under review or published. To request changes, contact TrustFive support.</p>}
     {current?.status==='draft'&&<p style={{marginTop:16}}><button className="btn secondary" disabled={busy} onClick={submit}>Submit for review</button></p>}
     {current?.status==='published'&&<p style={{marginTop:16}}><Link className="btn" href={'/business/'+current.application_id}>View public business page</Link></p>}
    </>}
   </section>
   {current?.status==='published'&&<ShowcaseEditor key={current.application_id} applicationId={current.application_id}/>}
   <section className="card"><h2>Independent public approval</h2>
    <p>Saving your description does not create an approved professional listing. TrustFive reviews the submitted content and checks your active verification status before publishing.</p>
    <p style={{marginTop:18}}>The optional £19.99/month business software membership does not affect approval or public ranking.</p>
    <p style={{marginTop:20}}><Link href="/professional/apply">View professional applications →</Link></p>
   </section>
  </div>)}
 </main>;
}
