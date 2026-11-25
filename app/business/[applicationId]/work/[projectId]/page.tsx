import {cache} from 'react';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import ShowcaseConversation from '../../../../../components/showcase-conversation';
import {publicShowcaseClient, questionFields, showcaseFields, showcaseJobHref, type Showcase, type ShowcaseBusiness} from '../../../../../lib/completed-work';

export const dynamic = 'force-dynamic';
type Params = {applicationId: string; projectId: string};
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

const getShowcase = cache(async (applicationId: string, projectId: string) => {
 if (!uuid.test(applicationId) || !uuid.test(projectId)) notFound();
 const db = publicShowcaseClient();
 const [business, project] = await Promise.all([
  db.rpc('public_showcase_business', {p_application: applicationId}).maybeSingle<ShowcaseBusiness>(),
  db.from('completed_work_showcases').select(showcaseFields).eq('application_id', applicationId)
   .eq('id', projectId).eq('status', 'published').maybeSingle<Showcase>(),
 ]);
 if (business.error || project.error) throw new Error('Completed work is temporarily unavailable');
 if (!business.data || !project.data) notFound();
 return {business: business.data, project: project.data};
});

export async function generateMetadata({params}: {params: Promise<Params>}): Promise<Metadata> {
 const {applicationId, projectId} = await params;
 const {business, project} = await getShowcase(applicationId, projectId);
 return {title: project.title + ' | ' + business.display_name, description: project.summary.slice(0, 155)};
}

export default async function CompletedWorkPage({params}: {params: Promise<Params>}) {
 const {applicationId, projectId} = await params;
 const {business, project} = await getShowcase(applicationId, projectId);
 const {data, error} = await publicShowcaseClient().from('completed_work_questions').select(questionFields)
  .eq('showcase_id', projectId).eq('status', 'published').order('created_at').limit(100);

 return <main className="container" style={{maxWidth: 920}}>
  <div className="page-heading">
   <span className="eyebrow">Installer showcase</span>
   <h1>{project.title}</h1>
   <Link href={'/business/' + applicationId}>{business.display_name}</Link>
  </div>
  <article className="card"><p style={{whiteSpace:'pre-wrap'}}>{project.summary}</p></article>
  <section className="card" aria-labelledby="similar-job-heading">
   <h2 id="similar-job-heading">Need work like this?</h2>
   <p>Your request goes to eligible professionals in your trade and area.</p>
   <Link className="btn" href={showcaseJobHref(business)}>Post a similar job</Link>
  </section>
  <ShowcaseConversation projectId={projectId} returnPath={'/business/' + applicationId + '/work/' + projectId}
   conversation={data ?? []} unavailable={Boolean(error)}/>
 </main>;
}
