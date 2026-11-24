import type {SocialEventRsvp,SocialEventSummary} from './social-events';

export type EventReminderItem = {
  event: SocialEventSummary;
  status: 'going' | 'interested';
  countdownLabel: string;
};

export function describeEventCountdown(
  startsAt: string,
  endsAt: string,
  now: Date = new Date()
): string {
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 'Date unavailable';
  }
  const nowMs = now.getTime();
  if (nowMs >= endMs) return 'Event ended';
  if (nowMs >= startMs) return 'Happening now';
  const diffMinutes = Math.round((startMs - nowMs) / 60000);
  if (diffMinutes < 60) {
    return diffMinutes <= 1 ? 'Starts in 1 minute' : `Starts in ${diffMinutes} minutes`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? 'Starts in 1 hour' : `Starts in ${diffHours} hours`;
  }
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return 'Starts tomorrow';
  return `Starts in ${diffDays} days`;
}

export function upcomingRsvpReminders(
  events: readonly SocialEventSummary[],
  responses: readonly SocialEventRsvp[],
  now: Date = new Date()
): EventReminderItem[] {
  const nowMs = now.getTime();
  const rsvpByEvent = new Map<string, 'going' | 'interested'>();
  for (const r of responses) {
    if (r.status === 'going' || r.status === 'interested') {
      rsvpByEvent.set(r.event_id, r.status);
    }
  }
  return events
    .filter(ev => {
      const status = rsvpByEvent.get(ev.id);
      const endMs = Date.parse(ev.ends_at);
      const startMs = Date.parse(ev.starts_at);
      return Boolean(status) && Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > nowMs;
    })
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .map(ev => ({
      event: ev,
      status: rsvpByEvent.get(ev.id)!,
      countdownLabel: describeEventCountdown(ev.starts_at, ev.ends_at, now),
    }));
}

export function sanitizeIcsText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsUtc(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '19700101T000000Z';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Generates an RFC 5545 calendar reminder containing only public event fields
 * (title, description, public venue label and timestamps) with a 60-minute alarm.
 */
export function buildEventIcsCalendar(
  event: Pick<SocialEventSummary, 'id' | 'title' | 'description' | 'venue_label' | 'starts_at' | 'ends_at'>,
  rsvpStatus: 'going' | 'interested'
): string {
  const uid = `${event.id.replace(/[^a-zA-Z0-9-]/g, '')}@trustfive.local`;
  const summary = sanitizeIcsText(event.title);
  const location = sanitizeIcsText(event.venue_label);
  const description = sanitizeIcsText(
    `${event.description}\n\nTrustFive Social RSVP: ${rsvpStatus === 'going' ? 'Going' : 'Interested'}`
  );
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TrustFive//Social Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtc(event.starts_at)}`,
    `DTSTART:${formatIcsUtc(event.starts_at)}`,
    `DTEND:${formatIcsUtc(event.ends_at)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${summary}`,
    'TRIGGER:-PT60M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function buildEventIcsDataUri(
  event: Pick<SocialEventSummary, 'id' | 'title' | 'description' | 'venue_label' | 'starts_at' | 'ends_at'>,
  rsvpStatus: 'going' | 'interested'
): string {
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(buildEventIcsCalendar(event, rsvpStatus));
}
