'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {supabaseBrowser} from '../lib/supabase';

const publicLinks=[
 {href:'/services',label:'Find a professional'},
 {href:'/post-job',label:'Post a job'}
];
const exploreLinks=[
 {href:'/coverage',label:'UK coverage'},
 {href:'/cost-guides',label:'UK cost guides'},
 {href:'/waitlist',label:'Applicant directory'},
 {href:'/professional/apply',label:'For professionals'}
];
const customerWorkspaceLinks=[
 {href:'/jobs',label:'My jobs'},
 {href:'/bookings',label:'My bookings'},
 {href:'/ideabooks',label:'Project Ideabooks'},
 {href:'/messages',label:'Messages'},
 {href:'/notifications',label:'Notifications'}
];
const professionalWorkspaceLinks=[
 {href:'/professional/apply',label:'Applications and approval'},
 {href:'/quotes',label:'Leads and quotes'},
 {href:'/professional/business',label:'Business profile'},
 {href:'/schedule',label:'Appointments'},
 {href:'/messages',label:'Messages'},
 {href:'/notifications',label:'Notifications'}
];
const customerCommunityLinks=[
 {href:'/community/social',label:'Neighbourhood feed'},
 {href:'/community/groups',label:'Groups'},
 {href:'/community/events',label:'Events'},
 {href:'/community/social?tab=advice',label:'Advice'},
 {href:'/community/social?tab=saved',label:'Saved posts'}
];
const professionalCommunityLinks=[
 {href:'/community/social',label:'Neighbourhood feed'},
 {href:'/community/social?tab=trade',label:'Trade network and referrals'},
 {href:'/community/social?tab=showcases',label:'Work showcases'},
 {href:'/community/groups',label:'Groups'},
 {href:'/community/events',label:'Events'},
 {href:'/community/social?tab=saved',label:'Saved posts'}
];

type HeaderAccount={status:'checking'|'signed-out'|'signed-in';name:string;role:'customer'|'professional'};

function accountName(user:{email?:string;user_metadata?:Record<string,unknown>}):string{
 const fullName=user.user_metadata?.full_name;
 if(typeof fullName==='string'&&fullName.trim())return fullName.trim();
 return user.email?.split('@')[0]||'Your account';
}

function initials(name:string):string{
 return name.trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'TF';
}

export default function SiteHeader(){
 const [mobileOpen,setMobileOpen]=useState(false);
 const [account,setAccount]=useState<HeaderAccount>({status:'checking',name:'',role:'customer'});
 const pathname=usePathname();
 useEffect(()=>setMobileOpen(false),[pathname]);

 useEffect(()=>{
  let active=true;
  let revision=0;
  const client=supabaseBrowser();
  const applyUser=(user:{id:string;email?:string;user_metadata?:Record<string,unknown>}|null)=>{
   const request=++revision;
   if(!user){setAccount({status:'signed-out',name:'',role:'customer'});return;}
   const fallbackName=accountName(user);
   const metadataRole=user.user_metadata?.requested_role==='professional'?'professional':'customer';
   setAccount({status:'signed-in',name:fallbackName,role:metadataRole});
   // Load the account's current role and display name outside the auth callback.
   void Promise.resolve().then(()=>client.from('profiles').select('full_name,requested_role').eq('id',user.id).maybeSingle()).then(({data})=>{
    if(!active||request!==revision)return;
    setAccount({
     status:'signed-in',
     name:data?.full_name?.trim()||fallbackName,
     role:data?.requested_role==='professional'?'professional':metadataRole
    });
   }).catch(()=>{});
  };
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>applyUser(session?.user||null));
  void client.auth.getUser().then(({data,error})=>{
   if(active&&revision===0)applyUser(error?null:data.user||null);
  }).catch(()=>{if(active&&revision===0)setAccount({status:'signed-out',name:'',role:'customer'});});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);

 const linkProps=(href:string)=>({'aria-current':pathname===href?'page':undefined as 'page'|undefined});
 async function signOut(){
  await supabaseBrowser().auth.signOut();
  window.location.assign('/account?mode=signin&next=%2Fdashboard');
 }
 const workspaceLinks=account.role==='professional'?professionalWorkspaceLinks:customerWorkspaceLinks;
 const communityLinks=account.role==='professional'?professionalCommunityLinks:customerCommunityLinks;

 return <header className="topbar">
  <div className="container topbar-inner">
   <Link href="/" aria-label="TrustFive home" onClick={()=>setMobileOpen(false)}><img className="logo" src="/trustfive-logo.svg" alt="TrustFive"/></Link>
   <nav className="nav primary-nav" aria-label="Main navigation">
    {publicLinks.map(link=><Link key={link.href} href={link.href} {...linkProps(link.href)}>{link.label}</Link>)}
    <details className="nav-more" onToggle={(event)=>{const menu=event.currentTarget;if(menu.open){menu.parentElement?.querySelectorAll<HTMLDetailsElement>('details.nav-more[open]').forEach((sibling)=>{if(sibling!==menu)sibling.open=false;});}}} onMouseLeave={(event)=>{event.currentTarget.open=false;}} onBlur={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))event.currentTarget.open=false;}}>
     <summary>Explore</summary>
     <div className="nav-menu">
      <span className="nav-menu-label">More from TrustFive</span>
      {exploreLinks.map(link=><Link href={link.href} key={link.href} {...linkProps(link.href)}>{link.label}</Link>)}
     </div>
    </details>
    {account.status==='checking'?<span className="nav-account-loading" aria-label="Checking account"/>:account.status==='signed-in'?<details className="nav-more account-menu" onToggle={(event)=>{const menu=event.currentTarget;if(menu.open){menu.parentElement?.querySelectorAll<HTMLDetailsElement>('details.nav-more[open]').forEach((sibling)=>{if(sibling!==menu)sibling.open=false;});}}} onMouseLeave={(event)=>{event.currentTarget.open=false;}} onBlur={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))event.currentTarget.open=false;}}>
     <summary aria-label="Open account menu">
      <span className="account-avatar" aria-hidden="true">{initials(account.name)}</span>
      <span className="account-summary-copy"><strong>{account.name}</strong><small>{account.role==='professional'?'Business account':'Customer account'}</small></span>
     </summary>
     <div className="nav-menu account-dropdown">
      <div className="account-dropdown-identity"><span className="account-avatar" aria-hidden="true">{initials(account.name)}</span><span><strong>{account.name}</strong><small>{account.role==='professional'?'Professional workspace':'Your TrustFive account'}</small></span></div>
      <Link className="account-menu-dashboard" href="/dashboard" {...linkProps('/dashboard')}>My dashboard <span aria-hidden="true">→</span></Link>
      <span className="nav-menu-label">{account.role==='professional'?'Business workspace':'Customer workspace'}</span>
      {workspaceLinks.map(link=><Link href={link.href} key={link.href} {...linkProps(link.href)}>{link.label}</Link>)}
      <span className="nav-menu-label">Community</span>
      {communityLinks.map(link=><Link href={link.href} key={link.href} {...linkProps(link.href)}>{link.label}</Link>)}
      <span className="nav-menu-label">Account</span>
      <Link href="/profile" {...linkProps('/profile')}>Profile and settings</Link>
      <button type="button" className="account-signout" onClick={()=>void signOut()}>Sign out</button>
     </div>
    </details>:<>
     <Link className="nav-login" href="/account?mode=signin&next=%2Fdashboard" {...linkProps('/account')}>Log in</Link>
     <Link className="btn nav-account" href="/account?role=professional&next=%2Fdashboard">Sign up as a tradesperson</Link>
    </>}
   </nav>
   <button type="button" className="mobile-menu-toggle" aria-expanded={mobileOpen} aria-controls="trustfive-mobile-navigation" aria-label={mobileOpen?'Close navigation menu':'Open navigation menu'} onClick={()=>setMobileOpen(value=>!value)}>
    <span aria-hidden="true">{mobileOpen?'✕':'☰'}</span><span>{mobileOpen?'Close':'Menu'}</span>
   </button>
  </div>
  <nav id="trustfive-mobile-navigation" className="mobile-navigation" hidden={!mobileOpen} aria-label="Mobile navigation">
   <div className="container mobile-navigation-inner">
    <p className="mobile-navigation-label">Start here</p>
    {publicLinks.map(link=><Link href={link.href} key={link.href} onClick={()=>setMobileOpen(false)} {...linkProps(link.href)}>{link.label}<span aria-hidden="true">→</span></Link>)}
    <p className="mobile-navigation-label">More from TrustFive</p>
    {exploreLinks.map(link=><Link href={link.href} key={link.href} onClick={()=>setMobileOpen(false)} {...linkProps(link.href)}>{link.label}<span aria-hidden="true">→</span></Link>)}
    {account.status==='signed-in'?<details className="mobile-account-menu">
     <summary><span className="account-avatar" aria-hidden="true">{initials(account.name)}</span><span>{account.name}<small>{account.role==='professional'?'Business account':'Customer account'}</small></span></summary>
     <div className="mobile-account-links">
      <Link href="/dashboard" onClick={()=>setMobileOpen(false)}>My dashboard <span aria-hidden="true">→</span></Link>
      <p className="mobile-navigation-label">{account.role==='professional'?'Business workspace':'Customer workspace'}</p>
      {workspaceLinks.map(link=><Link href={link.href} key={link.href} onClick={()=>setMobileOpen(false)}>{link.label}<span aria-hidden="true">→</span></Link>)}
      <p className="mobile-navigation-label">Community</p>
      {communityLinks.map(link=><Link href={link.href} key={link.href} onClick={()=>setMobileOpen(false)}>{link.label}<span aria-hidden="true">→</span></Link>)}
      <Link href="/profile" onClick={()=>setMobileOpen(false)}>Profile and settings <span aria-hidden="true">→</span></Link>
      <button type="button" onClick={()=>{setMobileOpen(false);void signOut();}}>Sign out</button>
     </div>
    </details>:account.status==='checking'?<p className="muted-note" role="status">Checking your account…</p>:<>
     <Link className="btn secondary" href="/account?mode=signin&next=%2Fdashboard" onClick={()=>setMobileOpen(false)}>Log in</Link>
     <Link className="btn" href="/account?role=professional&next=%2Fdashboard" onClick={()=>setMobileOpen(false)}>Sign up as a tradesperson</Link>
    </>}
   </div>
  </nav>
 </header>;
}
