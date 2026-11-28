export type AppointmentCalendarView = 'day' | 'three-day' | 'week' | 'agenda';

export type AppointmentCalendarRecord = {
  booking_id: string;
  starts_at: string;
  ends_at: string;
  timezone_name: string;
  status: string;
};

export type AppointmentCalendarDay<T> = {
  dateKey: string;
  appointments: T[];
};

function safeTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return 'UTC';
  }
}

export function appointmentCalendarDateKey(instant: string | Date, timezone: string): string | null {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: safeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function parseDateKey(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new RangeError('Use a valid calendar date.');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== dateKey) throw new RangeError('Use a valid calendar date.');
  return date;
}

export function shiftAppointmentCalendarDate(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function appointmentCalendarDays(
  selectedDate: string,
  view: AppointmentCalendarView
): string[] {
  const selected = parseDateKey(selectedDate);
  if (view === 'week') {
    const mondayOffset = (selected.getUTCDay() + 6) % 7;
    selected.setUTCDate(selected.getUTCDate() - mondayOffset);
    return Array.from({ length: 7 }, (_, index) => shiftAppointmentCalendarDate(selected.toISOString().slice(0, 10), index));
  }
  const length = view === 'three-day' ? 3 : view === 'agenda' ? 30 : 1;
  return Array.from({ length }, (_, index) => shiftAppointmentCalendarDate(selectedDate, index));
}

export function groupAppointmentsByCalendarDay<T extends AppointmentCalendarRecord>(
  appointments: readonly T[],
  selectedDate: string,
  view: AppointmentCalendarView,
  timezone: string
): AppointmentCalendarDay<T>[] {
  const days = appointmentCalendarDays(selectedDate, view);
  const itemsByDay = new Map(days.map(dateKey => [dateKey, [] as T[]]));
  for (const appointment of appointments) {
    const dateKey = appointmentCalendarDateKey(appointment.starts_at, timezone);
    const bucket = dateKey ? itemsByDay.get(dateKey) : undefined;
    if (bucket) bucket.push(appointment);
  }
  return days.map(dateKey => ({
    dateKey,
    appointments: (itemsByDay.get(dateKey) || []).sort(
      (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()
    ),
  }));
}