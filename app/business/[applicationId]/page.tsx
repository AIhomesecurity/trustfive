'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {supabaseBrowser} from '../../../lib/supabase';
type BusinessPage={application_id:string;display_name:string;description:string;website_url:string|null;public_phone:string|null;status:string};
export default function PublicBusinessPage(){
 const params=useParams<{applicationId:string}>();
 const [business,setBusiness]=useState<BusinessPage|null>(null);
 const [notice,setNotice]=useState('Loading business page…');
 useEffect(()=>{let active=true;(async()=>{try{
  if(!params.applicationId)throw Error('Business page not found');
  const {data,error}=await supabaseBrowser().from('professional_business_pages')
   .select('application_id,display_name,description,website_url,public_phone,status')
   .eq('application_id',params.applicationId).maybeSingle();
  if(error)throw error;
  if(!active)return;setBusiness(data);
  setNotice(data?'':'This professional has no published business page at the moment.');
 }catch(e){if(active)setNotice(e instanceof Error?e.message:'Business page unavailable');}})();
 return()=>{active=false};},[params.applicationId]);
 return <main className="container" style={{maxWidth:920}}>
  <div className="page-heading"><span className="eyebrow">Local professionals</span><h1>{business?.display_name||'Professional business page'}</h1>
   <p className="subtle"><Link href="/services">← Find more TrustFive professionals</Link></p></div>
  {notice&&<p className="notice" role="status">{notice}</p>}
  {business&&<div className="two-col">
   <section className="card">
    <span className="pill">{business.status==='published'?'TrustFive-approved business page':'Private preview — not published'}</span>
    <h2 style={{marginTop:18}}>About this business</h2>
    <p style={{whiteSpace:'pre-wrap'}}>{business.description}</p>
    {business.website_url?.startsWith('https://')&&<p style={{marginTop:20}}><a className="btn secondary" href={business.website_url} target="_blank" rel="noopener noreferrer nofollow">Visit business website</a></p>}
    {business.public_phone&&<p style={{marginTop:15}}><strong>Public business phone:</strong> {business.public_phone}</p>}
   </section>
   <section className="card"><h2>Need a quote?</h2>
    <p>Post a job in your local trade and service area. Only independently approved professionals are eligible to receive matching leads.</p>
    <p style={{marginTop:18}}><Link className="btn" href="/jobs">Post a job request</Link></p>
    <p className="muted-note" style={{marginTop:15}}>Professional approval and business-page publication are separate review decisions. Payments cannot buy TrustFive selection.</p>
   </section>
  </div>}
 </main>;
}
