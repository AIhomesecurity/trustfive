import Link from 'next/link';

export default function SiteHeader(){
 return <header className="topbar">
  <div className="container topbar-inner">
   <Link href="/" aria-label="TrustFive home"><img className="logo" src="/trustfive-logo.svg" alt="TrustFive"/></Link>
   <nav className="nav primary-nav" aria-label="Main navigation">
    <Link href="/services">Find a professional</Link>
    <Link href="/jobs">Post a job</Link>
    <Link href="/community">Community</Link>
    <Link href="/professional/apply">For professionals</Link>
    <details className="nav-more">
     <summary>My TrustFive</summary>
     <div className="nav-menu">
      <Link href="/dashboard">My dashboard</Link>
      <Link href="/messages">Messages</Link>
      <Link href="/notifications">Notifications</Link>
      <Link href="/schedule">Appointments</Link>
      <Link href="/billing">Business tools</Link>
     </div>
    </details>
    <Link className="btn nav-account" href="/account">Sign in / Join</Link>
   </nav>
  </div>
 </header>;
}
