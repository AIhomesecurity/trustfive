import Link from 'next/link';
import type {Metadata} from 'next';

export const metadata:Metadata={
 title:'How TrustFive works | Find independently approved local professionals',
 description:'Find out how TrustFive selects up to five professionals per trade and area, and how customers can request quotes, book jobs and leave genuine reviews.'
};

const steps=[
 {number:'01',title:'Choose the work you need',body:'Browse trade categories and the local areas currently supported, or describe your project in a job request.'},
 {number:'02',title:'Review approved local professionals',body:'Compare independent quality scores, business information and reviews attached to completed TrustFive bookings. Only eligible, active professionals appear in our approved directory.'},
 {number:'03',title:'Agree the details together',body:'Request quotes, discuss requirements and accept a suitable offer. Keep booking arrangements and messages together in your TrustFive account.'},
 {number:'04',title:'Share your experience',body:'After a qualifying completed booking, leave feedback to help future customers make informed decisions.'}
];
const questions=[
 {q:'Does TrustFive always show exactly five professionals?',a:'No. Five is the maximum number of active approved professionals in each trade and defined local area, not a promise that five are available. We show fewer if fewer businesses qualify.'},
 {q:'Can professionals buy their position?',a:'No. Membership or payment does not decide approval, quality scores, order in the waiting list or directory placement.'},
 {q:'What if no approved professionals are available in my area?',a:'The directory will say so. You can explore another available area or post a job request, but a response is not guaranteed until suitable professionals are active.'},
 {q:'Are tradespeople employees of TrustFive?',a:'No. The professionals are independent businesses. Check the scope, price, insurance, qualifications and other project requirements before agreeing to work.'},
 {q:'Are payments or jobs guaranteed?',a:'No. TrustFive does not currently promise an insured workmanship guarantee, escrow or payment protection. Agree the terms of work with the professional and use the available complaint process if needed.'}
];

export default function HowItWorks(){
 return <main>
  <section className="guide-hero"><div className="container guide-hero-inner">
   <div className="eyebrow">The TrustFive difference</div><h1>Less searching. More confidence.</h1>
   <p>We bring customers and independently approved professionals together through a simpler, more transparent local network.</p>
   <div className="guide-actions"><Link className="btn" href="/services">Find a professional</Link><Link className="btn secondary" href="/jobs">Post a job</Link></div>
  </div></section>
  <section className="container section"><div className="eyebrow">From discovery to completed work</div>
   <h2>How it works for customers</h2>
   <div className="guide-step-grid">{steps.map(step=><article key={step.number} className="guide-step"><span>{step.number}</span><h3>{step.title}</h3><p>{step.body}</p></article>)}</div>
  </section>
  <section className="guide-trust-section"><div className="container section"><div className="eyebrow">Trust is earned</div><h2>What the five-place rule actually means</h2>
   <div className="guide-trust-grid"><div><p>Each trade has up to <strong>five independently approved active places in each defined local area</strong>. This limit is enforced in the database, not simply printed on profiles.</p><p>Professionals apply, must meet suitability standards and remain subject to complaints and fair review. Qualified applicants may join a waiting list if all places are occupied.</p></div>
   <div className="guide-principles"><p><strong>✓ Approval is earned, not purchased.</strong></p><p><strong>✓ Genuine completed-job reviews.</strong></p><p><strong>✓ No invented listings or ratings.</strong></p><p><strong>✓ Complaints and appeals are investigated fairly.</strong></p></div></div>
  </div></section>
  <section className="container section"><div className="eyebrow">Questions answered</div><h2>Frequently asked questions</h2>
   <div className="guide-faq">{questions.map(x=><details key={x.q}><summary>{x.q}</summary><p>{x.a}</p></details>)}</div>
   <div className="guide-bottom"><h2>Ready to get started?</h2><p>Search your local area, or tell us what needs doing.</p><div className="guide-actions"><Link href="/services" className="btn">Browse trusted trades</Link><Link href="/professional/apply" className="btn secondary">Apply as a professional</Link></div></div>
  </section>
 </main>;
}
