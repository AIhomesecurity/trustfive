'use client';

import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../../../lib/supabase';
import {questionFields, showcaseFields, type Showcase, type ShowcaseQuestion} from '../../../lib/completed-work';

type Question = ShowcaseQuestion & {showcase_id: string};
type QueueItem = {
 id: string;
 table: 'completed_work_showcases' | 'completed_work_questions';
 heading: string;
 content: string;
 status: Showcase['status'];
};

export default function ShowcaseModerationPage() {
 const [queue, setQueue] = useState<QueueItem[]>([]);
 const [allowed, setAllowed] = useState(false);
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState('');
 const [notice, setNotice] = useState('');

 const load = useCallback(async () => {
  setLoading(true);
  try {
   const db = supabaseBrowser();
   const access = await db.rpc('is_trustfive_admin');
   if (access.error) throw access.error;
   setAllowed(access.data === true);
   if (!access.data) return;
   const [projects, questions] = await Promise.all([
    db.from('completed_work_showcases').select(showcaseFields).in('status',['pending','published'])
     .order('status').order('created_at', {ascending:false}).limit(100),
    db.from('completed_work_questions').select(questionFields + ',showcase_id').in('status',['pending','published'])
     .order('status').order('created_at', {ascending:false}).limit(100),
   ]);
   if (projects.error || questions.error) throw Error('Queue unavailable');
   setQueue([
    ...(projects.data as Showcase[]).map(project => ({
     id: project.id, table:'completed_work_showcases' as const, heading:project.title, content:project.summary, status:project.status,
    })),
    ...(questions.data as unknown as Question[]).map(question => ({
     id: question.id, table:'completed_work_questions' as const,
     heading: (question.from_business ? 'Business reply' : 'Community comment') + ' · ' + question.showcase_id,
     content:question.body, status:question.status,
    })),
   ]);
  } catch {
   setNotice('The showcase moderation queue could not load.');
  } finally {
   setLoading(false);
  }
 }, []);

 useEffect(() => { void load(); }, [load]);

 async function review(item: QueueItem, status: 'published' | 'hidden') {
  setBusy(item.id);
  setNotice('');
  try {
   const {data, error} = await supabaseBrowser().from(item.table).update({status}).eq('id',item.id).select('id').maybeSingle();
   if (error || !data) throw error ?? Error('Item unavailable');
   setQueue(items => items.flatMap(entry => entry.id !== item.id ? [entry] : status === 'hidden' ? [] : [{...entry,status}]));
   setNotice(status === 'published' ? 'Published.' : 'Hidden.');
  } catch {
   setNotice('The review action could not be saved. The item is still in the queue.');
  } finally {
   setBusy('');
  }
 }

 return <main className="container">
  <div className="page-heading">
   <h1>Review project showcases</h1>
   <Link href="/admin">← Admin dashboard</Link>
  </div>
  <p role="status">{notice}</p>
  {loading ? <p>Loading moderation queue…</p> : !allowed ? <p>Administrator access required.</p> : <>
   <p>Check that posts describe completed work or ask about it. Keep addresses, contact details and quote requests unpublished.</p>
   <button className="btn secondary" onClick={() => {setNotice('');void load();}}>Refresh queue</button>
   <section className="list" aria-label="Showcase moderation queue">
    {!queue.length && <p>No items to review.</p>}
    {queue.map(item => <article className="card" key={item.id}>
     <span className="pill">{item.status === 'pending' ? 'Awaiting review' : 'Published'}</span>
     <h2>{item.heading}</h2>
     <p style={{whiteSpace:'pre-wrap'}}>{item.content}</p>
     {item.status === 'pending' && <button className="btn" disabled={Boolean(busy)} onClick={() => void review(item,'published')}>Publish</button>}
     {' '}
     <button className="btn secondary" disabled={Boolean(busy)} onClick={() => void review(item,'hidden')}>Hide</button>
    </article>)}
   </section>
  </>}
 </main>;
}
