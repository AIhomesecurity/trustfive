'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

const mainLinks=[
 {href:'/services',label:'Find a professional'},
 {href:'/post-job',label:'Post a job'},
 {href:'/community',label:'Community'}
];
const exploreLinks=[
 {href:'/coverage',label:'UK coverage'},
 {href:'/cost-guides',label:'UK cost guides'},
 {href:'/waitlist',label:'Applicant directory'},
 {href:'/professional/apply',label:'For professionals'}
];
const accountLinks=[
 {href:'/dashboard',label:'My dashboard'},
 {href:'/ideabooks',label:'Project Ideabooks'},
 {href:'/messages',label:'Messages'},
 {href:'/notifications',label:'Notifications'},
 {href:'/bookings',label:'Bookings'},
 {href:'/schedule',label:'Appointments'},
 {href:'/billing',label:'Business tools'}
];

export default function SiteHeader(){
 const [mobileOpen,setMobileOpen]=useState(false);
 const pathname=usePathname();
 useEffect(()=>setMobileOpen(false),[pathname]);
 const linkProps=(href:string)=>({'aria-current':pathname===href?'page':undefined as 'page'|undefined});
 return <header className="topbar">
  <div className="container topbar-inner">
   <Link href="/" aria-label="TrustFive home" onClick={()=>setMobileOpen(false)}><img className="logo" src="/trustfive-logo.svg" alt="TrustFive"/></Link>
   <nav className="nav primary-nav" aria-label="Main navigation">
    {mainLinks.map(link=><Link key={link.href} href={link.href} {...linkProps(link.href)}>{link.label}</Link>)}
    <details className="nav-more">
     <summary>Explore</summary>
     <div className="nav-menu">
      <span className="nav-menu-label">More from TrustFive</span>
      {exploreLinks.map(link=><Link href={link.href} key={link.href} {...linkProps(link.href)}>{link.label}</Link>)}
      <span className="nav-menu-label">Your TrustFive</span>
      {accountLinks.map(link=><Link href={link.href} key={link.href} {...linkProps(link.href)}>{link.label}</Link>)}
     </div>
    </details>
    <Link className="nav-login" href="/account?mode=signin" {...linkProps('/account')}>Log in</Link>
    <Link className="btn nav-account" href="/account?role=professional&next=%2Fprofessional%2Fapply">Sign up as a tradesperson</Link>
   </nav>
   <button type="button" className="mobile-menu-toggle" aria-expanded={mobileOpen} aria-controls="trustfive-mobile-navigation" aria-label={mobileOpen?'Close navigation menu':'Open navigation menu'} onClick={()=>setMobileOpen(value=>!value)}>
    <span aria-hidden="true">{mobileOpen?'✕':'☰'}</span><span>{mobileOpen?'Close':'Menu'}</span>
   </button>
  </div>
  <nav id="trustfive-mobile-navigation" className="mobile-navigation" hidden={!mobileOpen} aria-label="Mobile navigation">
   <div className="container mobile-navigation-inner">
    <p className="mobile-navigation-label">Start here</p>
    {mainLinks.map(link=><Link href={link.href} key={link.href} onClick={()=>setMobileOpen(false)} {...linkProps(link.href)}>{link.label}<span aria-hidden="true">→</span></Link>)}
    <p className="mobile-navigation-label">More from TrustFive</p>
    {exploreLinks.map(link=><Link href={link.href} key={link.href} onClick={()=>setMobileOpen(false)} {...linkProps(link.href)}>{link.label}<span aria-hidden="true">→</span></Link>)}
    <p className="mobile-navigation-label">Your TrustFive</p>
    {accountLinks.map(link=><Link href={link.href} key={link.href} onClick={()=>setMobileOpen(false)} {...linkProps(link.href)}>{link.label}<span aria-hidden="true">→</span></Link>)}
    <Link className="btn secondary" href="/account?mode=signin" onClick={()=>setMobileOpen(false)}>Log in</Link>
    <Link className="btn" href="/account?role=professional&next=%2Fprofessional%2Fapply" onClick={()=>setMobileOpen(false)}>Sign up as a tradesperson</Link>
   </div>
  </nav>
 </header>;
}
