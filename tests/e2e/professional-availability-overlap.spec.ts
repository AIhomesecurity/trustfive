import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test} from '@playwright/test';
import {
  buildAvailabilityBusyWindows,
  findOverlappingAppointments,
  type ScheduledAppointment,
} from '../../lib/appointment-schedule';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';
const proId = 'aaaaaaaa-0000-4000-8000-000000000041';
const customerA = 'aaaaaaaa-0000-4000-8000-000000000042';
const customerB = 'aaaaaaaa-0000-4000-8000-000000000043';
const bookingA = 'bbbbbbbb-0000-4000-8000-000000000041';
const bookingB = 'bbbbbbbb-0000-4000-8000-000000000042';
const token = 'synthetic-pro-availability-token';

test.describe('Professional availability overlap helpers', () => {
  const bookings = [
    {id: bookingA, professional_id: proId, status: 'booked'},
    {id: bookingB, professional_id: proId, status: 'booked'},
    {id: 'cancelled-booking', professional_id: proId, status: 'cancelled'},
  ];

  const confirmedA: ScheduledAppointment = {
    booking_id: bookingA,
    proposed_by: customerA,
    starts_at: '2030-07-01T10:00:00.000Z',
    ends_at: '2030-07-01T11:00:00.000Z',
    timezone_name: 'Europe/London',
    status: 'confirmed',
  };

  test('blocks overlapping windows and allows adjacent half-open slots', () => {
    expect(
      findOverlappingAppointments(
        {bookingId: bookingB, startIso: '2030-07-01T10:30:00.000Z', endIso: '2030-07-01T11:30:00.000Z'},
        [confirmedA],
        bookings,
        proId
      )
    ).toHaveLength(1);

    // Adjacent [10:00, 11:00) and [11:00, 12:00) must be allowed.
    expect(
      findOverlappingAppointments(
        {bookingId: bookingB, startIso: '2030-07-01T11:00:00.000Z', endIso: '2030-07-01T12:00:00.000Z'},
        [confirmedA],
        bookings,
        proId
      )
    ).toHaveLength(0);

    // Rescheduling the same booking is not a self-conflict.
    expect(
      findOverlappingAppointments(
        {bookingId: bookingA, startIso: '2030-07-01T10:15:00.000Z', endIso: '2030-07-01T10:45:00.000Z'},
        [confirmedA],
        bookings,
        proId
      )
    ).toHaveLength(0);
  });

  test('builds sorted upcoming busy windows and ignores past or cancelled appointments', () => {
    const busy = buildAvailabilityBusyWindows(
      [
        {...confirmedA, booking_id: bookingB, starts_at: '2030-07-02T09:00:00.000Z', ends_at: '2030-07-02T10:00:00.000Z'},
        confirmedA,
        {...confirmedA, booking_id: 'cancelled-booking', status: 'cancelled'},
      ],
      bookings,
      proId,
      Date.parse('2030-07-01T00:00:00.000Z')
    );
    expect(busy.map(w => w.bookingId)).toEqual([bookingA, bookingB]);
    expect(busy[0].formattedWindow).toContain('Europe/London');
  });
});

test.use({viewport: {width: 360, height: 800}, isMobile: true, hasTouch: true});

test('360px professional sees confirmed busy windows, is blocked from overlapping proposals, and can propose an adjacent slot', async ({page}) => {
  test.skip(process.env.NEXT_PUBLIC_SUPABASE_URL !== backend, 'Requires the isolated loopback application build.');
  const futureDate = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const confirmedStart = `${futureDate}T10:00:00.000Z`;
  const confirmedEnd = `${futureDate}T11:00:00.000Z`;

  let proposalsSubmitted = 0;
  let appointments: ScheduledAppointment[] = [
    {
      booking_id: bookingA,
      proposed_by: customerA,
      starts_at: confirmedStart,
      ends_at: confirmedEnd,
      timezone_name: 'Europe/London',
      status: 'confirmed',
    },
    {
      booking_id: bookingB,
      proposed_by: customerB,
      starts_at: `${futureDate}T10:30:00.000Z`,
      ends_at: `${futureDate}T11:30:00.000Z`,
      timezone_name: 'Europe/London',
      status: 'proposed',
    },
  ];

  const fixture = createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', backend).pathname;
    const reply = (status: number, data: unknown) => {
      res.writeHead(status, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
        'content-type': 'application/json',
      });
      res.end(status === 204 ? '' : JSON.stringify(data));
    };
    if (req.method === 'OPTIONS') return reply(204, null);
    if (req.headers.authorization !== 'Bearer ' + token) return reply(401, {message: 'Synthetic session required'});
    switch (path) {
      case '/auth/v1/user':
        return reply(200, {id: proId, aud: 'authenticated'});
      case '/rest/v1/job_bookings':
        return reply(200, [
          {id: bookingA, customer_id: customerA, professional_id: proId, status: 'booked'},
          {id: bookingB, customer_id: customerB, professional_id: proId, status: 'booked'},
        ]);
      case '/rest/v1/booking_appointments':
        return reply(200, appointments);
      case '/rest/v1/rpc/propose_booking_appointment': {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw);
        proposalsSubmitted += 1;
        appointments = [
          appointments[0],
          {
            booking_id: body.p_booking,
            proposed_by: proId,
            starts_at: body.p_start,
            ends_at: body.p_end,
            timezone_name: body.p_timezone,
            status: 'proposed',
          },
        ];
        return reply(200, null);
      }
      default:
        return reply(200, []);
    }
  });

  for (let attempt = 0; ; attempt++) {
    try {
      await once(fixture.listen(54321, '127.0.0.1'), 'listening');
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || attempt >= 80) throw error;
      await delay(250);
    }
  }

  try {
    const session = {
      access_token: token,
      refresh_token: 'synthetic-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: {id: proId, aud: 'authenticated'},
    };
    await page.context().addCookies([
      {
        name: 'sb-127-auth-token',
        value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
        url: app,
      },
    ]);

    await page.goto('/schedule');
    await expect(page.getByRole('heading', {name: 'Your confirmed busy windows'})).toBeVisible();
    await expect(page.getByRole('region', {name: 'Confirmed busy windows'})).toContainText(`Booking #${bookingA.slice(0, 8)}`);

    // Conflicting incoming proposal on bookingB cannot be accepted blindly.
    const bookingBCard = page.locator(`#booking-${bookingB}`);
    await expect(bookingBCard.getByRole('alert')).toContainText(`Conflicts with your confirmed appointment for booking #${bookingA.slice(0, 8)}`);
    await expect(bookingBCard.getByRole('button', {name: 'Accept proposed time'})).toBeDisabled();

    // Proposing an overlapping slot for bookingB is blocked locally with focus on the alert.
    await page.getByLabel('Booking').selectOption(bookingB);
    const localStartConflict = new Date(Date.parse(confirmedStart) + 15 * 60000);
    const localEndConflict = new Date(Date.parse(confirmedEnd) + 15 * 60000);
    const toLocalInput = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    await page.getByLabel('Start date and time').fill(toLocalInput(localStartConflict));
    await page.getByLabel('End date and time').fill(toLocalInput(localEndConflict));
    await page.getByLabel('IANA time zone').fill('Europe/London');
    await page.getByRole('button', {name: 'Propose appointment'}).click();
    await expect(page.getByRole('alert').filter({hasText: 'overlaps your confirmed appointment'})).toBeFocused();
    expect(proposalsSubmitted).toBe(0);

    // Adjacent non-overlapping slot succeeds cleanly.
    const adjacentStart = new Date(Date.parse(confirmedEnd));
    const adjacentEnd = new Date(Date.parse(confirmedEnd) + 60 * 60000);
    await page.getByLabel('Start date and time').fill(toLocalInput(adjacentStart));
    await page.getByLabel('End date and time').fill(toLocalInput(adjacentEnd));
    await page.getByRole('button', {name: 'Propose appointment'}).click();
    await expect(page.getByText('Appointment time proposed in Europe/London.')).toBeVisible();
    expect(proposalsSubmitted).toBe(1);

    // Verify 360px mobile layout has zero horizontal overflow.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  } finally {
    await new Promise<void>((resolve, reject) => {
      fixture.close(error => (error ? reject(error) : resolve()));
      fixture.closeAllConnections();
    });
  }
});
