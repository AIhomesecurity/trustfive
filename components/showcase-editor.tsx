'use client';

import {useEffect, useState, type FormEvent} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../lib/supabase';
import {showcaseFields, showcaseWriteError, type Showcase} from '../lib/completed-work';

export default function ShowcaseEditor({applicationId}: {applicationId: string}) {
 const [projects, setProjects] = useState<Showcase[]>([]);
 const [title, setTitle] = useState('');
 const [summary, setSummary] = useState('');
 const [notice, setNotice] = useState('');
 const [busy, setBusy] = useState(false);

 useEffect(() => {
  let active = true;
  async function load() {
   try {
    const result = await supabaseBrowser().from('completed_work_showcases').select(showcaseFields)
     .eq('application_id', applicationId).order('created_at', {ascending:false}).limit(50);
    if (!active) return;
    if (result.error) throw result.error;
    setProjects(result.data ?? []);
   } catch {
    if (active) setNotice('Your projects could not load.');
   }
  }
  void load();
  return () => { active = false; };
 }, [applicationId]);

 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setBusy(true);
  setNotice('');
  try {
   const {data, error} = await supabaseBrowser().from('completed_work_showcases')
    .insert({application_id: applicationId, title: title.trim(), summary: summary.trim()})
    .select(showcaseFields).single<Showcase>();
   if (error) {
    setNotice(showcaseWriteError(error, 'Your project could not be submitted.'));
    return;
   }
   setProjects(items => [data, ...items]);
   setTitle('');
   setSummary('');
   setNotice('Project submitted for independent review.');
  } catch {
   setNotice('Your project could not be submitted.');
  } finally {
   setBusy(false);
  }
 }

 return <section className="card" aria-labelledby="showcase-editor-heading">
  <h2 id="showcase-editor-heading">Showcase completed work</h2>
  <form className="form" onSubmit={submit}>
   <label>Project title<input required minLength={5} maxLength={100} value={title} onChange={event => setTitle(event.target.value)}/></label>
   <label>What you did<textarea required minLength={30} maxLength={2400} value={summary} onChange={event => setSummary(event.target.value)}/></label>
   <p className="muted-note">Describe the work in general terms. Keep customer names, addresses, contact details and links private.</p>
   <button className="btn" disabled={busy}>Submit project for review</button>
  </form>
  <p role="status">{notice}</p>
  {!!projects.length && <ul className="list">{projects.map(project => <li key={project.id}>
   {project.status === 'published'
    ? <Link href={'/business/' + applicationId + '/work/' + project.id}>{project.title}</Link>
    : project.title} · {project.status === 'pending' ? 'Awaiting review' : project.status}
  </li>)}</ul>}
 </section>;
}
