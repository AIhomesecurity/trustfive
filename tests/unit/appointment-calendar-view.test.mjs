import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appointmentCalendarDateKey,
  appointmentCalendarDays,
  groupAppointmentsByCalendarDay,
  shiftAppointmentCalendarDate,
} from '../../lib/appointment-calendar-view.ts';

test('calendar keys use the selected timezone across a UTC date boundary', () => {
  assert.equal(appointmentCalendarDateKey('2026-11-28T00:30:00.000Z', 'Europe/London'), '2026-11-28');
  assert.equal(appointmentCalendarDateKey('2026-11-28T00:30:00.000Z', 'America/Los_Angeles'), '2026-11-27');
});

test('day, three-day, week and agenda ranges use local calendar dates and Monday weeks', () => {
  assert.deepEqual(appointmentCalendarDays('2026-11-25', 'day'), ['2026-11-25']);
  assert.deepEqual(appointmentCalendarDays('2026-11-25', 'three-day'), ['2026-11-25', '2026-11-26', '2026-11-27']);
  assert.deepEqual(appointmentCalendarDays('2026-11-25', 'week'), [
    '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29',
  ]);
  assert.equal(appointmentCalendarDays('2026-11-25', 'agenda').length, 30);
  assert.equal(shiftAppointmentCalendarDate('2026-12-31', 1), '2027-01-01');
});

test('grouping keeps empty days visible and orders appointments chronologically', () => {
  const records = [
    { booking_id: 'later', starts_at: '2026-11-25T14:00:00Z', ends_at: '2026-11-25T15:00:00Z', timezone_name: 'Europe/London', status: 'confirmed' },
    { booking_id: 'earlier', starts_at: '2026-11-25T09:00:00Z', ends_at: '2026-11-25T10:00:00Z', timezone_name: 'Europe/London', status: 'proposed' },
  ];
  const grouped = groupAppointmentsByCalendarDay(records, '2026-11-25', 'three-day', 'Europe/London');
  assert.deepEqual(grouped.map(day => day.appointments.map(item => item.booking_id)), [['earlier', 'later'], [], []]);
});