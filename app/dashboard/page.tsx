'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../lib/supabase';

type Profile={full_name:string|null;requested_role:string};
type Job={id:string;title:string;status:string;created_at:string;budget_pence:number|null};
type Booking={id:string;job_id:string;customer_id:string;professional_id:string;status:string;created_at:string};
type Application={id:string;status:string;submitted_at:string};
type Notification={id:string;title:string;target_path:string;created_at:string;read_at:string|null};
type DashboardData={profile:Profile|null;jobs:Job[];bookings:Booking[];applications:Application[];notifications:Notification[];warnings:string[]};
const initialData:DashboardData={profile:null,jobs:[],bookings:[],applications:[],notifications:[],warnings:[]};

const customerLinks=[
 {icon:'🔎',name:'Find a professional',description:'Compare approved professionals near you',href:'/services'},
 {icon:'📋',name:'Post a job',description:'Get quotes from eligible local trades',href:'/jobs'},
 {icon:'📌',name:'Project Ideabooks',description:'Save showcases, track room budgets & build job briefs',href:'/ideabooks'},
 {icon:'💷',name:'UK Cost Guides',description:'Check indicative UK job ranges across 20 trades',href:'/cost-guides'},
 {icon:'📅',name:'My bookings',description:'Manage work, address sharing and reviews',href:'/bookings'},
 {icon:'💬',name:'Messages',description:'Discuss quotes and your bookings',href:'/messages'}
];
const professionalLinks=[
 {icon:'🛡️',name:'Applications and approval',description:'Apply for one of five local trade places',href:'/professional/apply'},
 {icon:'💷',name:'Leads & itemised quotes',description:'Respond with Labour/Materials/VAT quotes & CSV export',href:'/quotes'},
 {icon:'🏢',name:'Business profile & showcases',description:'Publish completed-work portfolios to TrustFive Social',href:'/professional/business'},
 {icon:'🤝',name:'Trade-to-trade referrals',description:'Recommend approved trades via customer-consented links',href:'/community/social?tab=trade'},
 {icon:'🗓️',name:'Appointments & calendar',description:'Propose times and export .ics reminders',href:'/schedule'},
 {icon:'💬',name:'Messages',description:'Reply to customer quote enquiries',href:'/messages'}
];
const customerCommunityLinks=[
 {icon:'🏘️',name:'Neighbourhood feed',description:'Ask neighbours, share updates and find local recommendations',href:'/community/social'},
 {icon:'👥',name:'Groups',description:'Join interest and neighbourhood groups',href:'/community/groups'},
 {icon:'📆',name:'Events',description:'Find neighbourhood activities and manage RSVPs',href:'/community/events'},
 {icon:'💡',name:'Advice',description:'Ask local questions about home projects and services',href:'/community/social?tab=advice'},
 {icon:'🔖',name:'Saved posts',description:'Return to discussions and advice you saved',href:'/community/social?tab=saved'}
];
const professionalCommunityLinks=[
 {icon:'🏘️',name:'Neighbourhood feed',description:'Join local conversations and share practical updates',href:'/community/social'},
 {icon:'🤝',name:'Trade network',description:'Build professional connections and make safe referrals',href:'/community/social?tab=trade'},
 {icon:'🛠️',name:'Work showcases',description:'Share completed work after independent approval',href:'/community/social?tab=showcases'},
 {icon:'👥',name:'Groups',description:'Join local and specialist trade groups',href:'/community/groups'},
 {icon:'📆',name:'Events',description:'Find and organise local activities',href:'/community/events'},
 {icon:'🔖',name:'Saved posts',description:'Return to discussions and advice you saved',href:'/community/social?tab=saved'}
];
const safeNotificationPaths=new Set(['/jobs','/bookings','/messages','/professional/apply','/notifications']);

function readableStatus(status:string){
 const labels:Record<string,string>={open:'Open for quotes',draft:'Draft',booked:'Booked',completed:'Completed',cancelled:'Cancelled',awaiting_customer:'Waiting for customer confirmation',pending:'Awaiting review',under_review:'Under review',eligible:'Eligible',rejected:'Not approved',withdrawn:'Withdrawn'};
 return labels[status]||status.replace(/_/g,' ');
}
function formatDate(value:string){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'Date unavailable':date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
function ActionCard({icon,name,description,href}:{icon:string;name:string;description:string;href:string}){
 return <Link href={href} className="card dashboard-action"><span className="dashboard-action-icon" aria-hidden="true">{icon}</span><span><strong>{name}</strong><small>{description}</small></span><span className="dashboard-action-arrow" aria-hidden="true">→</span></Link>;
}

export default function Dashboard(){
 const [userId,setUserId]=useState('');
 const [checkingAccount,setCheckingAccount]=useState(true);
 const [loading,setLoading]=useState(false);
 const [loadError,setLoadError]=useState('');
 const [data,setData]=useState<DashboardData>(initialData);
 const [activeView,setActiveView]=useState<'customer'|'professional'>('customer');

 const load=useCallback(async(id:string)=>{
  setLoading(true);setLoadError('');
  try{
   const s=supabaseBrowser();
   // Explicitly scope queries to this account in addition to the database's RLS rules.
   const settled=await Promise.allSettled([
    s.from('profiles').select('full_name,requested_role').eq('id',id).maybeSingle(),
    s.from('jobs').select('id,title,status,created_at,budget_pence').eq('customer_id',id).order('created_at',{ascending:false}).limit(40),
    s.from('job_bookings').select('id,job_id,customer_id,professional_id,status,created_at').or('customer_id.eq.'+id+',professional_id.eq.'+id).order('created_at',{ascending:false}).limit(40),
    s.from('professional_applications').select('id,status,submitted_at').eq('user_id',id).order('submitted_at',{ascending:false}).limit(30),
    s.from('account_notifications').select('id,title,target_path,created_at,read_at').is('read_at',null).order('created_at',{ascending:false}).limit(8)
   ]);
   const labels=['Profile','Jobs','Bookings','Professional applications','Notifications'];
   const warnings:string[]=[];
   // A failed optional panel must not hide the rest of the customer's account.
   const unpack=(index:number):unknown=>{
    const result=settled[index];
    if(result.status==='rejected'){warnings.push(labels[index]+' temporarily unavailable');return null;}
    if(result.value.error){warnings.push(labels[index]+' temporarily unavailable');return null;}
    return result.value.data;
   };
   const profile=unpack(0) as Profile|null;
   const jobs=(unpack(1) as Job[]|null)||[];
   const bookings=(unpack(2) as Booking[]|null)||[];
   const applications=(unpack(3) as Application[]|null)||[];
   const notifications=(unpack(4) as Notification[]|null)||[];
   setData({profile,jobs,bookings,applications,notifications,warnings});
   if(profile?.requested_role==='professional')setActiveView('professional');
  }catch(e){
   setLoadError(e instanceof Error?e.message:'Unable to load your account. Try again.');
  }finally{setLoading(false);}
 },[]);

 useEffect(()=>{
  let mounted=true;
  (async()=>{
   try{
    const {data:{user},error}=await supabaseBrowser().auth.getUser();
    if(error)throw error;
    if(!mounted)return;
    if(user){setUserId(user.id);await load(user.id);}
   }catch(e){
    if(mounted)setLoadError(e instanceof Error?e.message:'Unable to check your account.');
   }finally{if(mounted)setCheckingAccount(false);}
  })();
  return()=>{mounted=false;};
 },[load]);

 const customerBookings=data.bookings.filter(b=>b.customer_id===userId);
 const professionalBookings=data.bookings.filter(b=>b.professional_id===userId);
 const currentBookings=activeView==='customer'?customerBookings:professionalBookings;
 const openJobs=data.jobs.filter(j=>j.status==='open').length;
 const bookedJobs=data.jobs.filter(j=>j.status==='booked').length;
 const activeBookings=currentBookings.filter(b=>b.status!=='completed'&&b.status!=='cancelled').length;
 const pendingApplications=data.applications.filter(a=>a.status==='pending'||a.status==='under_review').length;
 const incompleteBookings=customerBookings.filter(b=>b.status==='awaiting_customer').length;
 const quickAction=activeView==='professional'
  ?data.applications.length===0?{title:'Get started as a TrustFive professional',body:'Apply for independent assessment. Paying never guarantees one of the five places.',href:'/professional/apply',cta:'Start an application'}
  :{title:'Ready for your next customer?',body:'See qualifying job opportunities and manage quotes from your professional centre.',href:'/quotes',cta:'Explore matching leads'}
  :incompleteBookings>0?{title:'A job needs your confirmation',body:'Review the professional’s completion update before confirming the work.',href:'/bookings',cta:'Review bookings'}
  :openJobs>0?{title:'Your job is open for quotes',body:'Check any responses from approved professionals, or send a message.',href:'/jobs',cta:'Review quotes'}
  :{title:'Need help with a job?',body:'Find trusted local professionals or describe the work to request quotes.',href:'/services',cta:'Find local help'};

 return <main className="container dashboard-page">
  <div className="page-heading dashboard-heading">
   <div><span className="eyebrow">Your personal TrustFive workspace</span>
    <h1>{data.profile?'Hello, '+(data.profile.full_name?.trim()||'neighbour'):'Your TrustFive dashboard'}</h1>
    <p className="subtle">Jobs, professionals and neighbourhood activity — organised in one place.</p>
   </div>
   {userId&&<button type="button" className="btn secondary" onClick={()=>void load(userId)} disabled={loading} aria-label="Refresh dashboard information">{loading?'Refreshing…':'↻ Refresh'}</button>}
  </div>
  {checkingAccount?<div className="card" role="status" aria-live="polite">Checking your account securely…</div>:
   !userId?<section className="card dashboard-signin"><h2>Welcome to TrustFive</h2><p>Sign in to see your personal jobs, upcoming bookings, notifications and neighbourhood.</p><Link className="btn" href="/account?next=%2Fdashboard">Sign in or create an account</Link></section>:
   <>
    {loading&&<p role="status" className="muted-note">Updating your latest account activity…</p>}
    {loadError&&<div role="alert" className="notice error">Some account information could not load. {loadError} <button type="button" className="btn secondary" onClick={()=>void load(userId)}>Try again</button></div>}
    {data.warnings.length>0&&<div role="status" className="notice">Some information is temporarily unavailable: {data.warnings.join(', ')}. You can still use the links below.</div>}
    <div className="dashboard-view-tabs" role="group" aria-label="Dashboard perspective">
     <button type="button" className={activeView==='customer'?'dashboard-tab active':'dashboard-tab'} aria-pressed={activeView==='customer'} onClick={()=>setActiveView('customer')}>🏠 Homeowner</button>
     <button type="button" className={activeView==='professional'?'dashboard-tab active':'dashboard-tab'} aria-pressed={activeView==='professional'} onClick={()=>setActiveView('professional')}>🧰 Professional</button>
     <Link className="dashboard-notification-link" href="/notifications">🔔 Notifications {data.notifications.length>0&&<span className="dashboard-unread">{data.notifications.length}{data.notifications.length===8?'+':''} unread</span>}</Link>
    </div>
    <section aria-labelledby="dashboard-overview"><h2 id="dashboard-overview" className="dashboard-section-title">Your overview</h2>
     <div className="dashboard-stat-grid">
      {activeView==='customer'?<>
       <Link href="/jobs" className="card dashboard-stat"><strong>{data.jobs.length}</strong><span>Recent job requests</span><small>{openJobs} open · {bookedJobs} booked</small></Link>
       <Link href="/bookings" className="card dashboard-stat"><strong>{customerBookings.length}</strong><span>Customer bookings</span><small>{activeBookings} active</small></Link>
       <Link href="/notifications" className="card dashboard-stat"><strong>{data.notifications.length}{data.notifications.length===8?'+':''}</strong><span>Unread notifications</span><small>Quotes, jobs and messages</small></Link>
      </>:<>
       <Link href="/professional/apply" className="card dashboard-stat"><strong>{data.applications.length}</strong><span>Trade applications</span><small>{pendingApplications} awaiting decision</small></Link>
       <Link href="/bookings" className="card dashboard-stat"><strong>{professionalBookings.length}</strong><span>Professional bookings</span><small>{activeBookings} active</small></Link>
       <Link href="/notifications" className="card dashboard-stat"><strong>{data.notifications.length}{data.notifications.length===8?'+':''}</strong><span>Unread notifications</span><small>Check for vacancy offers</small></Link>
      </>}
     </div>
    </section>
    <section aria-labelledby="dashboard-next-step" className="dashboard-next-panel">
     <div><span className="eyebrow">Suggested next step</span><h2 id="dashboard-next-step">{quickAction.title}</h2><p>{quickAction.body}</p></div>
     <Link className="btn" href={quickAction.href}>{quickAction.cta} →</Link>
    </section>
    <div className="dashboard-columns">
     <section aria-labelledby="dashboard-activity"><div className="dashboard-section-heading"><h2 id="dashboard-activity">Recent activity</h2><Link href={activeView==='customer'?'/jobs':'/bookings'}>View all →</Link></div>
      <div className="dashboard-activity-list">
       {activeView==='customer'?data.jobs.slice(0,5).map(job=><Link key={job.id} href="/jobs" className="dashboard-activity-row"><span aria-hidden="true">📋</span><span><strong>{job.title}</strong><small>{formatDate(job.created_at)}</small></span><span className="pill">{readableStatus(job.status)}</span></Link>):
       currentBookings.slice(0,5).map(booking=><Link key={booking.id} href="/bookings" className="dashboard-activity-row"><span aria-hidden="true">📅</span><span><strong>Booking #{booking.id.slice(0,8)}</strong><small>{formatDate(booking.created_at)}</small></span><span className="pill">{readableStatus(booking.status)}</span></Link>)}
       {(activeView==='customer'?data.jobs:currentBookings).length===0&&<div className="card dashboard-empty"><p>{activeView==='customer'?'Your jobs will appear here once you post your first request.':'Your professional bookings will appear here after a quote is accepted.'}</p><Link href={activeView==='customer'?'/jobs':'/quotes'}>{activeView==='customer'?'Post your first job':'Visit leads and quotes'} →</Link></div>}
      </div>
     </section>
     <section aria-labelledby="dashboard-updates"><div className="dashboard-section-heading"><h2 id="dashboard-updates">Needs your attention</h2><Link href="/notifications">All notifications →</Link></div>
      <div className="dashboard-activity-list">
       {data.notifications.slice(0,4).map(n=><Link key={n.id} className="dashboard-activity-row" href={safeNotificationPaths.has(n.target_path)?n.target_path:'/notifications'}><span aria-hidden="true">🔔</span><span><strong>{n.title}</strong><small>{formatDate(n.created_at)} · Unread</small></span><span className="dashboard-action-arrow" aria-hidden="true">→</span></Link>)}
       {data.notifications.length===0&&<div className="card dashboard-empty"><p>No unread updates. New activity will appear here.</p><Link href="/notifications">Open notifications →</Link></div>}
      </div>
     </section>
    </div>
    <section aria-labelledby="dashboard-primary-actions" className="dashboard-actions-section">
     <div className="dashboard-section-heading"><h2 id="dashboard-primary-actions">{activeView==='customer'?'Get things done':'Professional tools'}</h2></div>
     <div className="dashboard-action-grid">{(activeView==='customer'?customerLinks:professionalLinks).map(link=><ActionCard key={link.href} {...link}/>)}</div>
    </section>
    <section aria-labelledby="dashboard-community" className="dashboard-actions-section">
     <div className="dashboard-section-heading"><h2 id="dashboard-community">{activeView==='customer'?'Your neighbourhood':'Your community and trade network'}</h2></div>
     <div className="dashboard-action-grid">{(activeView==='customer'?customerCommunityLinks:professionalCommunityLinks).map(link=><ActionCard key={link.href} {...link}/>)}</div>
    </section>
    <div className="dashboard-bottom-links"><Link href="/profile">⚙️ Profile and settings</Link><Link href="/schedule">🗓️ Appointments</Link><Link href="/support/complaints">🛡️ Trust and support</Link><Link href="/how-it-works">How independent selection works</Link></div>
    <p className="muted-note dashboard-footnote">Status figures are private to your signed-in account and reflect available records. A professional application is not an approval. Never share private customer addresses outside the booking consent flow.</p>
   </>}
 </main>;
}
