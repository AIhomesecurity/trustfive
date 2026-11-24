'use client';

import {useState, type FormEvent} from 'react';
import Link from 'next/link';
import {supabaseBrowser} from '../lib/supabase';
import {showcaseWriteError, type ShowcaseQuestion} from '../lib/completed-work';

export default function ShowcaseConversation({projectId, returnPath, conversation, unavailable}: {
 projectId: string; returnPath: string; conversation: ShowcaseQuestion[]; unavailable: boolean;
}) {
 const [body, setBody] = useState('');
 const [notice, setNotice] = useState('');
 const [needsSignIn, setNeedsSignIn] = useState(false);
 const [busy, setBusy] = useState(false);

 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setBusy(true);
  setNotice('');
  try {
   const db = supabaseBrowser();
   const {data: {user}, error: authError} = await db.auth.getUser();
   if (!user) {
    setNeedsSignIn(true);
    setNotice('Sign in to send your comment.');
    return;
   }
   if (authError) throw authError;
   const {error} = await db.from('completed_work_questions').insert({showcase_id: projectId, body: body.trim()});
   if (error) {
    setNotice(showcaseWriteError(error, 'Your comment could not be submitted. Try again.'));
    return;
   }
   setBody('');
   setNotice('Comment submitted for moderation. It will appear here if approved.');
  } catch {
   setNotice('Your comment could not be submitted. Try again.');
  } finally {
   setBusy(false);
  }
 }

 return <section className="card" aria-labelledby="conversation-heading">
  <h2 id="conversation-heading">Questions about this project</h2>
  {unavailable ? <p role="alert">Comments could not load.</p> : !conversation.length ? <p>No published comments yet.</p> :
   <ul className="list">{conversation.map(post => <li key={post.id}>
    <strong>{post.from_business ? 'Business reply' : 'Community comment'}</strong>
    <p style={{whiteSpace:'pre-wrap'}}>{post.body}</p>
   </li>)}</ul>}
  <form className="form" onSubmit={submit}>
   <label>Ask about the work or reply
    <textarea value={body} onChange={event => setBody(event.target.value)} required minLength={5} maxLength={800}/>
   </label>
   <p className="muted-note">Comments are public after review. Use the job form for quotes and keep contact details and addresses private.</p>
   <button className="btn secondary" disabled={busy}>Send for review</button>
  </form>
  <p role="status">{notice}</p>
  {needsSignIn && <Link href={'/account?next=' + encodeURIComponent(returnPath)}>Sign in to comment</Link>}
 </section>;
}
