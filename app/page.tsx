import Link from 'next/link';

type Service = {label:string;icon:string;slug:string;description:string};
const services:Service[]=[
 {label:'Plumbing',icon:'🔧',slug:'plumbing',description:'Leaks, taps & pipework'},
 {label:'Electrical',icon:'⚡',slug:'electrical',description:'Wiring, lights & repairs'},
 {label:'Cleaning',icon:'🧼',slug:'cleaning',description:'Homes & deep cleans'},
 {label:'Handyman',icon:'🛠️',slug:'handyman',description:'Repairs & odd jobs'},
 {label:'Painting',icon:'🎨',slug:'painting',description:'Decorating & finishes'},
 {label:'Gardening',icon:'🌿',slug:'gardening',description:'Garden care & upkeep'},
 {label:'Moving',icon:'🚚',slug:'moving',description:'Removals & deliveries'},
 {label:'Furniture assembly',icon:'🪑',slug:'furniture-assembly',description:'Flat-pack & fitting'},
 {label:'Roofing',icon:'🏠',slug:'roofing',description:'Roof repairs & gutters'},
 {label:'Heating & boilers',icon:'🔥',slug:'heating',description:'Heating & servicing'},
 {label:'Carpentry',icon:'🪚',slug:'carpentry',description:'Woodwork & joinery'},
 {label:'Home security',icon:'🔒',slug:'home-security',description:'Locks, alarms & cameras'},
 {label:'Bathrooms',icon:'🚿',slug:'bathrooms',description:'Bathrooms & tiling'},
 {label:'Kitchens',icon:'🍽️',slug:'kitchens',description:'Kitchen fitting'},
 {label:'Windows & doors',icon:'🪟',slug:'windows',description:'Glazing & installations'},
 {label:'Landscaping',icon:'🌳',slug:'landscaping',description:'Patios, paving & gardens'}
];
export default function Home(){
 return <main>
  <section className="hero"><span className="hero-five" aria-hidden="true">5</span><div className="container hero-content">
   <div className="eyebrow">Trusted local professionals. Stronger communities.</div>
   <h1>Get the job done with people you can <span style={{color:'#087c46'}}>trust.</span></h1>
   <p>Find up to five independently approved professionals for each trade in your local area. Compare genuine completed-job reviews, get quotes and stay connected with your neighbourhood.</p>
   <form className="hero-service-search" action="/services" method="get" role="search">
    <label className="sr-only" htmlFor="trade-search">What do you need help with?</label>
    <span aria-hidden="true">⌕</span>
    <input id="trade-search" type="search" name="q" placeholder="What do you need help with? e.g. plumber" autoComplete="off" required/>
    <button type="submit" className="btn">Find a professional</button>
   </form>
   <div className="hero-shortcuts"><span>Popular:</span><Link href="/services?trade=plumbing">Plumbing</Link><Link href="/services?trade=electrical">Electrical</Link><Link href="/services?trade=cleaning">Cleaning</Link><Link href="/services?trade=roofing">Roofing</Link></div>
   <div className="hero-actions"><Link className="btn secondary" href="/jobs">Post a job instead</Link><Link className="hero-community-link" href="/community">Explore your local community →</Link></div>
   <p className="hero-trust-note">✓ Professional approval is earned, never purchased. Availability depends on your area.</p>
  </div></section>
  <section className="section container" aria-labelledby="services-heading">
   <div className="section-heading-row"><div><div className="eyebrow">Browse by service</div><h2 id="services-heading">What do you need help with?</h2><p className="subtle">Choose a trade to search verified professionals serving your area.</p></div><Link className="service-view-all" href="/services">View full directory →</Link></div>
   <div className="service-grid">
    {services.map(service=><Link href={'/services?trade='+encodeURIComponent(service.slug)} key={service.slug} className="service-tile">
     <span className="service-icon" aria-hidden="true">{service.icon}</span>
     <span className="service-name">{service.label}</span>
     <span className="service-description">{service.description}</span>
     <span className="service-link-hint">Find professionals <span aria-hidden="true">→</span></span>
    </Link>)}
   </div>
  </section>
  <section className="section home-how-it-works"><div className="container">
   <div className="eyebrow">Simple and transparent</div><h2>How TrustFive works</h2>
   <div className="how-grid">
    <div className="how-step"><span className="how-number">01</span><h3>Tell us what you need</h3><p>Choose a trade and local area, or describe your job.</p></div>
    <div className="how-step"><span className="how-number">02</span><h3>Choose with confidence</h3><p>Explore approved professionals, their experience and verified-job feedback.</p></div>
    <div className="how-step"><span className="how-number">03</span><h3>Arrange the work</h3><p>Request quotes, message and manage your booking in one place.</p></div>
   </div>
  </div></section>
  <section className="section container"><div className="eyebrow">More than a trades directory</div><h2>Your community and your business, connected</h2>
   <div className="home-paths">
    <div className="home-path"><span className="home-path-icon" aria-hidden="true">💬</span><h3>Local community</h3><p>Share recommendations, join groups and find out what is happening nearby.</p><Link href="/community">Explore community →</Link></div>
    <div className="home-path"><span className="home-path-icon" aria-hidden="true">🛡️</span><h3>Trusted professionals</h3><p>See approved providers, honest reviews and the five-place local network.</p><Link href="/services">Find a professional →</Link></div>
    <div className="home-path"><span className="home-path-icon" aria-hidden="true">📋</span><h3>Run your trade business</h3><p>Apply to the network and manage enquiries, quotations and jobs.</p><Link href="/professional/apply">Apply as a professional →</Link></div>
   </div>
  </section>
 </main>;
}
