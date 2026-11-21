'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';

type Readiness={
 catalogueTrades:number;configuredAreas:number;reviewedTerritories:number;
 verifiedActiveAllocations:number;verifiedProfessionalLocations:number;
 customerJobs:number;confirmedBookings:number;completedBookings:number;
 publishedVerifiedReviews:number;gateSummary:string;
};
const checks:[
 keyof Omit<Readiness,'gateSummary'>,
 string,string
][]=[
 ['catalogueTrades','Trade categories','Defined services can be searched'],
 ['configuredAreas','Configured areas','Local areas are defined but are not necessarily verified'],
 ['reviewedTerritories','Independently reviewed territory polygons','Human-reviewed non-overlapping geographic boundaries'],
 ['verifiedActiveAllocations','Independently approved professional slots','Verified, actively allocated trade/area professionals'],
 ['verifiedProfessionalLocations','Professionals with verified service locations','Separate reviewed operating addresses for distance-based search'],
 ['customerJobs','Recorded customer jobs','Data exists, not proof of customer journey acceptance'],
 ['confirmedBookings','Recorded bookings','Data exists, not proof of acceptance tests'],
 ['completedBookings','Completed bookings','Real customer-confirmed completion records'],
 ['publishedVerifiedReviews','Published verified-booking reviews','Reviews based on completed eligible bookings']
];
export default function AdminReadiness(){
 const [loading,setLoading]=useState(true);
 const [data,setData]=useState<Readiness|null>(null);
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const s=supabaseBrowser();
    const {data:admin,error:adminError}=await s.rpc('is_trustfive_admin');
    if(adminError)throw adminError;
    if(!admin)throw Error('Only TrustFive administrators may view operational readiness.');
    const {data:result,error}=await s.rpc('trustfive_admin_launch_readiness');
    if(error)throw error;
    if(active)setData(result as Readiness);
   }catch(error){
    if(active)setNotice(error instanceof Error?error.message:'Could not load staging readiness');
   }finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[]);
 return <main className="container" style={{maxWidth:880}}>
  <div className="page-heading">
   <span className="eyebrow">Restricted launch evidence</span>
   <h1>TrustFive readiness dashboard</h1>
   <p className="subtle">Counts are read from the connected database, not sample profiles. They indicate outstanding work; they do not certify security, legal compliance or a production release.</p>
   <p><Link href="/admin">Back to admin</Link> · <Link href="/admin/territories">Review verified territories</Link></p>
  </div>
  {loading&&<p className="notice" role="status">Checking admin access and live database records…</p>}
  {notice&&<p className="notice" role="alert">{notice}</p>}
  {data&&<section className="card">
   <h2>Verified operating evidence</h2>
   <div className="list">{checks.map(([key,label,description])=><div key={key} style={{borderBottom:'1px solid #e2ece5',padding:'12px 0'}}>
    <strong>{label}: {data[key].toLocaleString('en-GB')}</strong>
    <p className="muted-note">{description}</p>
   </div>)}</div>
   <h3>Launch approval remains a separate step</h3>
   <p>{data.gateSummary}</p>
   <p className="notice">No count or successful build automatically authorises real payments, real approvals, production deployment or worldwide launch. Record actual authorised customer/professional staging acceptance and operational sign-offs separately.</p>
   <p><Link href="/admin/territories">Review a genuine local territory boundary →</Link></p>
  </section>}
 </main>;
}
