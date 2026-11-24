import Link from 'next/link';
import {publicShowcaseClient, showcaseFields, showcaseJobHref, type Showcase, type ShowcaseBusiness} from '../../../lib/completed-work';

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
     <h2>About this business</h2>
     {business.description && <p style={{whiteSpace:'pre-wrap'}}>{business.description}</p>}
    </section>
    <section className="card">
     <h2>Need a quote?</h2>
     <p>Share your job with eligible TrustFive professionals in your trade and area.</p>
     <Link className="btn" href={showcaseJobHref(business)}>Post a job on TrustFive</Link>
    </section>
   </div>
   <section className="list" aria-labelledby="work-heading">
    <h2 id="work-heading">Completed work</h2>
    {!projects.length && !loadError && <p>No published projects yet.</p>}
    {projects.map(project => <article className="card" key={project.id}>
     <span className="pill">Installer showcase</span>
     <h3><Link href={'/business/' + applicationId + '/work/' + project.id}>{project.title}</Link></h3>
     <p>{project.summary.slice(0, 180)}{project.summary.length > 180 ? '…' : ''}</p>
    </article>)}
   </section>
   <section className="list" aria-labelledby="reviews-heading">
    <h2 id="reviews-heading">Recent verified TrustFive reviews</h2>
    {!business.verified_reviews.length && <p>No verified booking reviews yet.</p>}
    {business.verified_reviews.map((review, index) => <article className="card" key={index}>
     <strong>{review.stars} out of 5</strong> · <time dateTime={review.date}>{review.date}</time>
     <p>{review.body ?? 'Review text withheld for privacy.'}</p>
    </article>)}
   </section>
  </>}
 </main>;
}
