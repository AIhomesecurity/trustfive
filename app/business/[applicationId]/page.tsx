import Link from 'next/link';
import {publicShowcaseClient, showcaseFields, showcaseJobHref, type Showcase, type ShowcaseBusiness} from '../../../lib/completed-work';
import {summarizeReviewDistribution} from '../../../lib/tradesman-utilities';
import ShareBusinessLink from '../../../components/share-business-link';

export const dynamic = 'force-dynamic';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default async function PublicBusinessPage({params}: {params: Promise<{applicationId: string}>}) {
 const {applicationId} = await params;
 let business: ShowcaseBusiness | null = null;
 let projects: Showcase[] = [];
 let loadError = false;
 if (uuid.test(applicationId)) {
  try {
   const db = publicShowcaseClient();
   const profile = await db.rpc('public_showcase_business', {p_application: applicationId, p_include_reviews: true}).maybeSingle<ShowcaseBusiness>();
   const work = profile.data && await db.from('completed_work_showcases').select(showcaseFields)
    .eq('application_id', applicationId).eq('status', 'published').order('created_at', {ascending:false}).limit(24);
   business = profile.data;
   projects = (work && work.data) || [];
   loadError = Boolean(profile.error || (work && work.error));
  } catch {
   loadError = true;
  }
 }

 const reviewSummary = business ? summarizeReviewDistribution(business.verified_reviews) : null;

 return <main className="container" style={{maxWidth: 920}}>
  <div className="page-heading">
   <span className="eyebrow">Local professionals</span>
   <h1>{business?.display_name || 'Professional business page'}</h1>
   <p className="subtle"><Link href="/services">← Find TrustFive professionals</Link></p>
  </div>
  {loadError && <p className="notice" role="alert">Some business information could not load. Please refresh and try again.</p>}
  {!business && !loadError && <p className="notice">This professional has no published business page.</p>}
  {business && <>
   <div className="two-col">
    <section className="card">
     <span className="pill">TrustFive-approved business page</span>
     <h2 style={{marginTop:10}}>About this business</h2>
     {business.description && <p style={{whiteSpace:'pre-wrap'}}>{business.description}</p>}
     <p className="muted-note" style={{marginTop:12}}>
      Independently approved within TrustFive&apos;s five-place local network. Approval and search order cannot be purchased.{' '}
      <Link className="service-view-all" href="/how-it-works">See our 6-stage vetting charter →</Link>
     </p>
     <ShareBusinessLink businessName={business.display_name}/>
    </section>
    <section className="card">
     <h2>Need a quote?</h2>
     <p>Share your job with eligible TrustFive professionals in your trade and area — zero per-lead fees or cold-call spam.</p>
     <div style={{display:'grid',gap:10,marginTop:14}}>
      <Link className="btn" href={showcaseJobHref(business)}>Post a job on TrustFive</Link>
      <Link className="btn secondary" href="/cost-guides">Check UK cost guides</Link>
     </div>
    </section>
   </div>
   <section className="list" aria-labelledby="work-heading" style={{marginTop:24}}>
    <h2 id="work-heading">Completed work ({projects.length})</h2>
    {!projects.length && !loadError && <p>No published projects yet.</p>}
    {projects.map(project => <article className="card" key={project.id}>
     <span className="pill">Installer showcase</span>
     <h3><Link href={'/business/' + applicationId + '/work/' + project.id}>{project.title}</Link></h3>
     <p>{project.summary.slice(0, 180)}{project.summary.length > 180 ? '…' : ''}</p>
    </article>)}
   </section>
   <section className="list" aria-labelledby="reviews-heading" style={{marginTop:24}}>
    <h2 id="reviews-heading">Recent verified TrustFive reviews</h2>
    {reviewSummary && reviewSummary.total > 0 && (
     <div className="card" aria-label="Verified booking review breakdown">
      <p style={{margin:'0 0 6px'}}>
       <strong>{reviewSummary.average} out of 5</strong> across <strong>{reviewSummary.total}</strong> completed TrustFive booking {reviewSummary.total === 1 ? 'review' : 'reviews'}
      </p>
      <div className="tf-review-dist">
       {reviewSummary.buckets.map(bucket => (
        <div className="tf-review-bar-row" key={bucket.stars}>
         <span>{bucket.stars} star</span>
         <div className="tf-review-track" aria-hidden="true"><div className="tf-review-fill" style={{width: `${bucket.percent}%`}}/></div>
         <span>{bucket.count}</span>
        </div>
       ))}
      </div>
     </div>
    )}
    {!business.verified_reviews.length && <p>No verified booking reviews yet.</p>}
    {business.verified_reviews.map((review, index) => <article className="card" key={index}>
     <strong>{review.stars} out of 5</strong> · <time dateTime={review.date}>{review.date}</time>
     <p>{review.body ?? 'Review text withheld for privacy.'}</p>
    </article>)}
   </section>
  </>}
 </main>;
}
