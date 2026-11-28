'use client';

import {FormEvent, useCallback, useEffect, useState} from 'react';
import {supabaseBrowser} from '../lib/supabase';

type WeeklyRow = {
  weekday: number;
  is_available: boolean;
  starts_at: string | null;
  ends_at: string | null;
  break_starts_at: string | null;
  break_ends_at: string | null;
  travel_buffer_minutes: number;
};
type TimeOffRow = {id: string; starts_at: string; ends_at: string; note: string};
type DayDraft = {enabled: boolean; start: string; end: string; breakStart: string; breakEnd: string; buffer: string};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const EMPTY_DAY = (): DayDraft => ({enabled: false, start: '09:00', end: '17:00', breakStart: '', breakEnd: '', buffer: '0'});
const EMPTY_WEEK = (): DayDraft[] => DAYS.map(() => EMPTY_DAY());

function asTime(value: string | null) { return value ? value.slice(0, 5) : ''; }
function toLocalDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'}).format(date);
}

export default function ProfessionalAvailabilitySettings() {
  const [visible, setVisible] = useState(false);
  const [week, setWeek] = useState<DayDraft[]>(EMPTY_WEEK);
  const [timeOff, setTimeOff] = useState<TimeOffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    const client = supabaseBrowser();
    const {data: {user}, error: authError} = await client.auth.getUser();
    if (authError) throw authError;
    if (!user) return;
    const [profile, weekly, off] = await Promise.all([
      client.from('profiles').select('requested_role').eq('id', user.id).maybeSingle(),
      client.from('professional_weekly_availability').select('weekday,is_available,starts_at,ends_at,break_starts_at,break_ends_at,travel_buffer_minutes').eq('professional_id', user.id),
      client.from('professional_time_off').select('id,starts_at,ends_at,note').eq('professional_id', user.id).gte('ends_at', new Date().toISOString()).order('starts_at').limit(50),
    ]);
    if (profile.error) throw profile.error;
    if (profile.data?.requested_role !== 'professional') { setVisible(false); return; }
    setVisible(true);
    if (weekly.error) throw weekly.error;
    if (off.error) throw off.error;
    const next = EMPTY_WEEK();
    for (const row of (weekly.data || []) as WeeklyRow[]) {
      const index = row.weekday === 0 ? 6 : row.weekday - 1;
      next[index] = {
        enabled: row.is_available,
        start: asTime(row.starts_at) || '09:00',
        end: asTime(row.ends_at) || '17:00',
        breakStart: asTime(row.break_starts_at),
        breakEnd: asTime(row.break_ends_at),
        buffer: String(row.travel_buffer_minutes ?? 0),
      };
    }
    setWeek(next);
    setTimeOff((off.data || []) as TimeOffRow[]);
  }, []);

  useEffect(() => {
    void refresh().catch(e => setError(e instanceof Error ? e.message : 'Could not load availability settings'))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function saveDay(event: FormEvent, index: number) {
    event.preventDefault();
    if (busy) return;
    const draft = week[index];
    if (draft.enabled && Boolean(draft.breakStart) !== Boolean(draft.breakEnd)) {
      setError('Enter both break times, or leave both blank.'); return;
    }
    setBusy(`day-${index}`); setError(''); setNotice('');
    const {error: saveError} = await supabaseBrowser().rpc('save_my_weekly_availability', {
      p_weekday: index === 6 ? 0 : index + 1,
      p_is_available: draft.enabled,
      p_starts_at: draft.enabled ? draft.start : null,
      p_ends_at: draft.enabled ? draft.end : null,
      p_break_starts_at: draft.enabled && draft.breakStart ? draft.breakStart : null,
      p_break_ends_at: draft.enabled && draft.breakEnd ? draft.breakEnd : null,
      p_travel_buffer_minutes: Number(draft.buffer),
    });
    if (saveError) setError(saveError.message);
    else setNotice(`${DAYS[index]} availability saved.`);
    setBusy('');
  }

  async function addTimeOff(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const begins = new Date(starts), finishes = new Date(ends);
    if (!Number.isFinite(begins.getTime()) || !Number.isFinite(finishes.getTime()) || finishes <= begins) {
      setError('Choose a valid start and end for the unavailable period.'); return;
    }
    setBusy('time-off'); setError(''); setNotice('');
    const {error: saveError} = await supabaseBrowser().rpc('add_my_time_off', {
      p_starts_at: begins.toISOString(), p_ends_at: finishes.toISOString(), p_note: note,
    });
    if (saveError) setError(saveError.message);
    else {
      setStarts(''); setEnds(''); setNote('');
      try { await refresh(); setNotice('Unavailable period added.'); }
      catch (e) { setError(e instanceof Error ? e.message : 'Saved, but the list could not be refreshed.'); }
    }
    setBusy('');
  }

  async function removeTimeOff(id: string) {
    if (busy) return;
    setBusy(id); setError(''); setNotice('');
    const {error: removeError} = await supabaseBrowser().rpc('remove_my_time_off', {p_time_off: id});
    if (removeError) setError(removeError.message);
    else { setTimeOff(rows => rows.filter(row => row.id !== id)); setNotice('Unavailable period removed.'); }
    setBusy('');
  }

  if (loading || !visible) return null;
  return <section className="card" aria-labelledby="professional-availability-title" style={{marginBottom: 22}}>
    <span className="eyebrow">Professional workspace</span>
    <h2 id="professional-availability-title" style={{marginTop: 4}}>Working hours and time off</h2>
    <p className="muted-note">Set your usual hours, break and travel buffer, then add leave or other unavailable periods. These settings are private to your account. Customers still need to agree each booking time with you.</p>
    {notice && <p role="status" className="notice">{notice}</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    <div className="grid" style={{gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12}}>
      {DAYS.map((day, index) => {
        const draft = week[index];
        return <form className="form card" key={day} onSubmit={event => void saveDay(event, index)}>
          <label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={draft.enabled} onChange={event => setWeek(rows => rows.map((row, i) => i === index ? {...row, enabled:event.target.checked} : row))}/><strong>{day}</strong></label>
          <fieldset disabled={!draft.enabled || Boolean(busy)} style={{border:0,padding:0,margin:0,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <label>Start<input type="time" required={draft.enabled} value={draft.start} onChange={event => setWeek(rows => rows.map((row,i)=>i===index?{...row,start:event.target.value}:row))}/></label>
            <label>Finish<input type="time" required={draft.enabled} value={draft.end} onChange={event => setWeek(rows => rows.map((row,i)=>i===index?{...row,end:event.target.value}:row))}/></label>
            <label>Break starts<input type="time" value={draft.breakStart} onChange={event => setWeek(rows => rows.map((row,i)=>i===index?{...row,breakStart:event.target.value}:row))}/></label>
            <label>Break ends<input type="time" value={draft.breakEnd} onChange={event => setWeek(rows => rows.map((row,i)=>i===index?{...row,breakEnd:event.target.value}:row))}/></label>
            <label style={{gridColumn:'1 / -1'}}>Travel buffer (minutes)<input type="number" min="0" max="240" step="5" required value={draft.buffer} onChange={event => setWeek(rows => rows.map((row,i)=>i===index?{...row,buffer:event.target.value}:row))}/></label>
          </fieldset>
          <button className="btn secondary" type="submit" disabled={Boolean(busy)}>{busy === `day-${index}` ? 'Saving…' : `Save ${day.toLowerCase()}`}</button>
        </form>;
      })}
    </div>
    <div className="two-col" style={{marginTop:20}}>
      <form className="form" onSubmit={event => void addTimeOff(event)}>
        <h3>Add time off or an unavailable period</h3>
        <label>Starts<input type="datetime-local" required value={starts} onChange={event=>setStarts(event.target.value)}/></label>
        <label>Ends<input type="datetime-local" required value={ends} onChange={event=>setEnds(event.target.value)}/></label>
        <label>Private note (optional)<input maxLength={120} value={note} onChange={event=>setNote(event.target.value)} placeholder="Annual leave, training, unavailable"/></label>
        <button className="btn" type="submit" disabled={Boolean(busy)}>{busy === 'time-off' ? 'Saving…' : 'Add unavailable time'}</button>
      </form>
      <div>
        <h3>Upcoming unavailable periods</h3>
        {timeOff.length === 0 ? <p className="muted-note">No upcoming time off saved.</p> : <ul className="list" style={{padding:0}}>
          {timeOff.map(row=><li className="card" key={row.id}>
            <strong>{toLocalDateTime(row.starts_at)} – {toLocalDateTime(row.ends_at)}</strong>
            {row.note && <p className="muted-note">{row.note}</p>}
            <button type="button" className="btn secondary" disabled={Boolean(busy)} onClick={()=>void removeTimeOff(row.id)}>{busy===row.id?'Removing…':'Remove'}</button>
          </li>)}
        </ul>}
      </div>
    </div>
  </section>;
}
