'use client';

import {FormEvent, useState} from 'react';
import {supabaseBrowser} from '../lib/supabase';

export type WaitlistPublicProfile = {
  application_id: string;
  display_name: string;
  summary: string;
  is_public: boolean;
  updated_at?: string;
};

export default function WaitlistDirectoryEditor({
  applicationId,
  initial,
  defaultName,
  defaultSummary,
  onSaved,
}: {
  applicationId: string;
  initial?: WaitlistPublicProfile;
  defaultName: string;
  defaultSummary: string;
  onSaved: (profile: WaitlistPublicProfile | null) => void;
}) {
  const [displayName, setDisplayName] = useState(initial?.display_name || defaultName);
  const [summary, setSummary] = useState(initial?.summary || defaultSummary.slice(0, 500));
  const [isPublic, setIsPublic] = useState(Boolean(initial?.is_public));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const {error} = await supabaseBrowser().rpc('set_my_waitlist_public_profile', {
        p_application: applicationId,
        p_display_name: displayName.trim(),
        p_summary: summary.trim(),
        p_is_public: isPublic,
      });
      if (error) throw error;
      onSaved(isPublic ? {application_id: applicationId, display_name: displayName.trim(), summary: summary.trim(), is_public: true} : null);
      setNotice(isPublic ? 'Your opt-in applicant profile is now public.' : 'Your profile has been removed from the public directory.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update your public profile.');
    } finally {
      setBusy(false);
    }
  }

  return <details className="waitlist-profile-editor">
    <summary>{initial?.is_public ? 'Manage public applicant profile' : 'Add an optional public profile'}</summary>
    <p className="muted-note">This profile is separate from the approved directory. It will be labelled as not yet approved. No phone, website, full postcode or home address can be published. Only reviews from completed TrustFive bookings appear.</p>
    <form className="form" onSubmit={save}>
      <label>Public display name
        <input required={isPublic} minLength={isPublic ? 2 : undefined} maxLength={100} value={displayName} onChange={event => setDisplayName(event.target.value)} />
      </label>
      <label>Short introduction
        <textarea required={isPublic} minLength={isPublic ? 30 : undefined} maxLength={500} value={summary} onChange={event => setSummary(event.target.value)} />
      </label>
      <label className="waitlist-profile-consent">
        <input type="checkbox" checked={isPublic} onChange={event => setIsPublic(event.target.checked)} />
        <span>I choose to show this business name, trade, broad area and introduction in the public applicant directory.</span>
      </label>
      {notice && <p className="muted-note" role="status">{notice}</p>}
      <button className="btn secondary" type="submit" disabled={busy}>{busy ? 'Saving…' : isPublic ? 'Save public profile' : initial?.is_public ? 'Remove from directory' : 'Save privately'}</button>
    </form>
  </details>;
}
