'use client';

import { useState } from 'react';
import Link from 'next/link';
import { bookingHistoryHref } from '../lib/workflow-links';
import {
  appointmentCalendarDateKey,
  appointmentCalendarDays,
  groupAppointmentsByCalendarDay,
  shiftAppointmentCalendarDate,
  type AppointmentCalendarRecord,
  type AppointmentCalendarView,
} from '../lib/appointment-calendar-view';

type AgendaBooking = { id: string; customer_id: string; professional_id: string; status: string };
type Props = {
  bookings: readonly AgendaBooking[];
  appointments: readonly AppointmentCalendarRecord[];
  timezone: string;
};

const viewOptions: Array<{ value: AppointmentCalendarView; label: string }> = [
  { value: 'agenda', label: 'Agenda' },
  { value: 'day', label: 'Day' },
  { value: 'three-day', label: '3 days' },
  { value: 'week', label: 'Week' },
];

function headingForDate(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function timeForAppointment(appointment: AppointmentCalendarRecord, timezone: string): string {
  const safeTimezone = appointment.timezone_name || timezone || 'UTC';
  try {
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: safeTimezone,
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    return `${time.format(new Date(appointment.starts_at))}–${time.format(new Date(appointment.ends_at))}`;
  } catch {
    return 'Time unavailable';
  }
}

function statusLabel(status: string): string {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'proposed') return 'Awaiting confirmation';
  if (status === 'cancelled') return 'Cancelled';
  return 'Needs attention';
}

export default function AppointmentAgenda({ bookings, appointments, timezone }: Props) {
  const [view, setView] = useState<AppointmentCalendarView>('day');
  const [selectedDate, setSelectedDate] = useState(
    () => appointmentCalendarDateKey(new Date(), timezone) || new Date().toISOString().slice(0, 10)
  );
  const days = appointmentCalendarDays(selectedDate, view);
  const groups = groupAppointmentsByCalendarDay(appointments, selectedDate, view, timezone);
  const shownGroups = view === 'agenda' ? groups.filter(group => group.appointments.length > 0) : groups;
  const bookingsById = new Map(bookings.map(booking => [booking.id, booking]));
  const shift = view === 'three-day' ? 3 : view === 'week' ? 7 : 1;
  const periodLabel = view === 'agenda'
    ? `Next 30 days · from ${headingForDate(days[0])}`
    : days.length === 1
      ? headingForDate(days[0])
      : `${headingForDate(days[0])} – ${headingForDate(days[days.length - 1])}`;

  return (
    <section className="schedule-agenda card" aria-labelledby="schedule-agenda-title">
      <div className="schedule-agenda-heading">
        <div>
          <span className="eyebrow">Your working day</span>
          <h2 id="schedule-agenda-title">Appointments</h2>
          <p className="muted-note">Calendar dates follow {timezone}; each appointment keeps its agreed time zone.</p>
        </div>
        <span className="schedule-agenda-count" aria-live="polite">
          {groups.reduce((count, group) => count + group.appointments.length, 0)} in view
        </span>
      </div>

      <div className="schedule-agenda-toolbar">
        <div className="schedule-view-switch" role="group" aria-label="Calendar view">
          {viewOptions.map(option => (
            <button
              className={view === option.value ? 'is-active' : ''}
              type="button"
              key={option.value}
              aria-pressed={view === option.value}
              onClick={() => setView(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="schedule-date-controls" aria-label="Choose schedule date">
          <button
            className="btn secondary"
            type="button"
            aria-label={`Previous ${view === 'week' ? 'week' : view === 'three-day' ? 'three days' : 'day'}`}
            onClick={() => setSelectedDate(date => shiftAppointmentCalendarDate(date, -shift))}
          >
            ‹
          </button>
          <label>
            <span className="sr-only">Schedule date</span>
            <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} />
          </label>
          <button
            className="btn secondary"
            type="button"
            aria-label={`Next ${view === 'week' ? 'week' : view === 'three-day' ? 'three days' : 'day'}`}
            onClick={() => setSelectedDate(date => shiftAppointmentCalendarDate(date, shift))}
          >
            ›
          </button>
          <button
            className="btn secondary schedule-today"
            type="button"
            onClick={() => setSelectedDate(appointmentCalendarDateKey(new Date(), timezone) || selectedDate)}
          >
            Today
          </button>
        </div>
      </div>

      <p className="schedule-period" aria-live="polite">{periodLabel}</p>

      {shownGroups.length === 0 ? (
        <div className="schedule-empty" role="status">
          <strong>No scheduled appointments in this period</strong>
          <span>When a customer and professional agree a job time, it will appear here.</span>
        </div>
      ) : (
        <div className="schedule-days">
          {shownGroups.map(group => (
            <section className="schedule-day" key={group.dateKey} aria-label={headingForDate(group.dateKey)}>
              <h3>{headingForDate(group.dateKey)}</h3>
              {group.appointments.length === 0 ? (
                <p className="schedule-clear-day">No appointments</p>
              ) : (
                <ol>
                  {group.appointments.map(appointment => {
                    const booking = bookingsById.get(appointment.booking_id);
                    if (!booking) return null;
                    return (
                      <li className="schedule-event" key={appointment.booking_id}>
                        <div className="schedule-event-time-wrap">
                          <time className="schedule-event-time">{timeForAppointment(appointment, timezone)}</time>
                          <span className="schedule-event-zone">{appointment.timezone_name}</span>
                        </div>
                        <div className="schedule-event-main">
                          <strong>Booking #{booking.id.slice(0, 8)}</strong>
                          <span className={`schedule-event-status status-${appointment.status}`}>
                            {statusLabel(appointment.status)}
                          </span>
                        </div>
                        <Link className="schedule-event-link" href={bookingHistoryHref(booking.id)}>
                          Job details <span aria-hidden="true">→</span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}