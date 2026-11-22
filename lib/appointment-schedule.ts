/** Timezone-preserving appointment validation and formatting helpers.
 * Supports international IANA timezones rather than hard-coding UK-only assumptions. */

export type ScheduledAppointment = {
  booking_id: string;
  proposed_by: string;
  starts_at: string;
  ends_at: string;
  timezone_name: string;
  status: string;
};

export function isValidIanaTimezone(zone: string): boolean {
  const clean = zone.trim();
  if (clean.length < 3 || clean.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en-GB', {timeZone: clean});
    return true;
  } catch {
    return false;
  }
}

export function validateAppointmentProposal(
  input: {
    bookingId: string;
    startIso: string;
    endIso: string;
    timezoneName: string;
  },
  nowMs = Date.now()
): string | null {
  if (!input.bookingId.trim()) {
    return 'Choose an active booking before proposing an appointment.';
  }
  const startMs = new Date(input.startIso).getTime();
  const endMs = new Date(input.endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 'Enter valid start and end dates and times.';
  }
  if (startMs <= nowMs) {
    return 'Appointment start time must be in the future.';
  }
  const maxStartMs = nowMs + 365 * 24 * 60 * 60 * 1000;
  if (startMs > maxStartMs) {
    return 'Appointment start time must be within the next 365 days.';
  }
  if (endMs <= startMs) {
    return 'Appointment end time must be after the start time.';
  }
  const maxDurationMs = 14 * 24 * 60 * 60 * 1000;
  if (endMs - startMs > maxDurationMs) {
    return 'A single appointment window cannot exceed 14 days.';
  }
  if (!isValidIanaTimezone(input.timezoneName)) {
    return 'Enter a valid IANA time zone (for example Europe/London or America/New_York).';
  }
  return null;
}

/** Format an appointment start/end window explicitly in its stored IANA timezone
 * so international participants never see silent wrong-timezone conversions. */
export function formatAppointmentWindow(
  startsAt: string,
  endsAt: string,
  timezoneName: string,
  locale = 'en-GB'
): string {
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
    return 'Schedule time unavailable';
  }
  const safeZone = isValidIanaTimezone(timezoneName) ? timezoneName.trim() : 'UTC';
  const fmt = new Intl.DateTimeFormat(locale, {
    timeZone: safeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${fmt.format(startDate)} – ${fmt.format(endDate)} (${safeZone})`;
}

export function summarizeAppointments(
  appointments: ScheduledAppointment[],
  userId: string,
  nowMs = Date.now()
): {
  upcomingConfirmed: number;
  awaitingYourConfirmation: number;
  awaitingOtherParty: number;
} {
  let upcomingConfirmed = 0;
  let awaitingYourConfirmation = 0;
  let awaitingOtherParty = 0;
  for (const appt of appointments) {
    const endMs = new Date(appt.ends_at).getTime();
    if (appt.status === 'confirmed' && Number.isFinite(endMs) && endMs > nowMs) {
      upcomingConfirmed += 1;
    } else if (appt.status === 'proposed') {
      if (appt.proposed_by === userId) awaitingOtherParty += 1;
      else awaitingYourConfirmation += 1;
    }
  }
  return {upcomingConfirmed, awaitingYourConfirmation, awaitingOtherParty};
}
