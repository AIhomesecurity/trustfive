import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test,type Page} from '@playwright/test';
import {
  buildEventIcsCalendar,
  describeEventCountdown,
  sanitizeIcsText,
  upcomingRsvpReminders,
} from '../../lib/social-event-reminders';
import {
  countUnreadNotifications,
  filterAccountNotifications,
  NOTIFICATION_DELIVERY_CHANNELS,
  notificationDeliveryLabel,
} from '../../lib/notification-delivery';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';
const user = {id: 'aaaaaaaa-0000-4000-8000-000000000091', aud: 'authenticated'};
const areaA = {id: '11111111-1111-4111-8111-111111111101', area_name: 'Didsbury', city: 'Manchester'};
const eventId = '44444444-4444-4444-8444-444444444401';
const notif1 = '55555555-5555-4555-8555-555555555501';
const notif2 = '55555555-5555-4555-8555-555555555502';

async function signIn(page: Page) {
  const session = {
    access_token: user.id,
    refresh_token: 'synthetic-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
  await page.context().addCookies([
    {
      name: 'sb-127-auth-token',
      value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
      url: app,
    },
  ]);
}

test.describe('Slice 3 event reminders and notification delivery unit tests', () => {
  test('computes deterministic countdown labels and generates RFC 5545 .ics calendar reminders', () => {
    const now = new Date('2026-11-24T12:00:00Z');
    const event = {
      id: eventId,
      area_id: areaA.id,
      title: 'Didsbury Tool Library, Repair Café',
      description: 'Bring small appliances; public volunteers available.',
      venue_label: 'Didsbury Library Hall, M20',
      starts_at: '2026-11-25T14:00:00Z',
      ends_at: '2026-11-25T16:30:00Z',
    };

    expect(describeEventCountdown('2026-11-24T12:30:00Z', '2026-11-24T13:30:00Z', now)).toBe(
      'Starts in 30 minutes'
    );
    expect(describeEventCountdown('2026-11-24T16:00:00Z', '2026-11-24T18:00:00Z', now)).toBe(
      'Starts in 4 hours'
    );
    expect(describeEventCountdown(event.starts_at, event.ends_at, now)).toBe('Starts tomorrow');
    expect(sanitizeIcsText('A, B; C\nD')).toBe('A\\, B\\; C\\nD');

    const reminders = upcomingRsvpReminders([event], [{event_id: eventId, status: 'going'}], now);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].countdownLabel).toBe('Starts tomorrow');

    const ics = buildEventIcsCalendar(event, 'going');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Didsbury Tool Library\\, Repair Café');
    expect(ics).toContain('LOCATION:Didsbury Library Hall\\, M20');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT60M');
    expect(ics).toContain('END:VCALENDAR');
  });

  test('reports honest notification delivery channels and filters inbox rows', () => {
    expect(NOTIFICATION_DELIVERY_CHANNELS.find(c => c.id === 'in_app')?.enabled).toBe(true);
    expect(NOTIFICATION_DELIVERY_CHANNELS.find(c => c.id === 'email')?.enabled).toBe(false);
    expect(NOTIFICATION_DELIVERY_CHANNELS.find(c => c.id === 'push')?.enabled).toBe(false);

    const rows = [
      {id: notif1, read_at: null},
      {id: notif2, read_at: '2026-11-24T09:00:00Z'},
    ];
    expect(countUnreadNotifications(rows)).toBe(1);
    expect(filterAccountNotifications(rows, 'unread')).toHaveLength(1);
    expect(filterAccountNotifications(rows, 'read')).toHaveLength(1);
    expect(notificationDeliveryLabel(rows[0])).toBe('Delivered in app · Unread');
    expect(notificationDeliveryLabel(rows[1])).toBe('Read in app');
  });
});

test.describe('Slice 3 mobile event RSVP, reminders and notification delivery states', () => {
  test.use({viewport: {width: 360, height: 740}, isMobile: true, hasTouch: true});

  test('360px resident RSVPs, exports calendar reminder, cancels RSVP with failure recovery, and manages notifications delivery states', async ({
    page,
  }) => {
    test.skip(
      process.env.NEXT_PUBLIC_SUPABASE_URL !== backend,
      'Requires the isolated loopback application build.'
    );
    test.setTimeout(60000);
    page.setDefaultTimeout(10000);

    const futureStart = new Date(Date.now() + 26 * 3600 * 1000).toISOString();
    const futureEnd = new Date(Date.now() + 28 * 3600 * 1000).toISOString();
    const eventRow = {
      id: eventId,
      area_id: areaA.id,
      title: 'Didsbury Saturday Repair Café',
      description: 'Bring household lamps, kettles or small tools to fix with local volunteers.',
      venue_label: 'Didsbury Public Library Hall',
      starts_at: futureStart,
      ends_at: futureEnd,
    };

    let currentRsvp: 'going' | 'interested' | null = null;
    let failNextCancel = true;
    let failNotificationsLoad = true;
    let failNextMarkRead = true;
    const notifications = [
      {
        id: notif1,
        kind: 'new_quote',
        title: 'New quote received',
        body: 'An approved professional has sent a quote for your job.',
        target_path: '/jobs',
        created_at: '2026-11-24T11:00:00Z',
        read_at: null as string | null,
      },
      {
        id: notif2,
        kind: 'job_completed',
        title: 'Job confirmed complete',
        body: 'Your completed booking record is archived.',
        target_path: '/bookings',
        created_at: '2026-11-23T15:00:00Z',
        read_at: '2026-11-23T16:00:00Z',
      },
    ];

    const fixture = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', backend);
      const id = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
      const reply = (status: number, data: unknown) => {
        response.writeHead(status, {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
          'content-type': 'application/json',
        });
        response.end(status === 204 ? '' : JSON.stringify(data));
      };

      if (request.method === 'OPTIONS') return reply(204, null);
      if (id !== user.id) return reply(401, {message: 'Synthetic session required'});
      if (url.pathname === '/auth/v1/user') return reply(200, user);

      const leaf = url.pathname.split('/').pop() ?? '';
      if (leaf === 'service_areas') return reply(200, [areaA]);
      if (leaf === 'community_events') return reply(200, [eventRow]);
      if (leaf === 'community_event_rsvps') {
        return reply(200, currentRsvp ? [{event_id: eventId, status: currentRsvp}] : []);
      }

      if (leaf === 'set_event_response' && request.method === 'POST') {
        let raw = '';
        for await (const chunk of request) raw += chunk;
        const body = JSON.parse(raw);
        if (body.p_status === 'none' && failNextCancel) {
          failNextCancel = false;
          return reply(500, {message: 'Synthetic RSVP cancel outage'});
        }
        currentRsvp = body.p_status === 'none' ? null : body.p_status;
        return reply(200, null);
      }

      if (leaf === 'account_notifications') {
        if (failNotificationsLoad) {
          return reply(500, {message: 'Synthetic notifications read outage'});
        }
        return reply(200, notifications);
      }

      if (leaf === 'mark_notification_read' && request.method === 'POST') {
        let raw = '';
        for await (const chunk of request) raw += chunk;
        const body = JSON.parse(raw);
        if (failNextMarkRead) {
          failNextMarkRead = false;
          return reply(500, {message: 'Synthetic mark read error'});
        }
        const row = notifications.find(n => n.id === body.p_notification);
        if (!row) return reply(200, false);
        row.read_at = '2026-11-24T12:05:00Z';
        return reply(200, true);
      }

      return reply(200, []);
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
      await signIn(page);

      // 1. Events tab: RSVP Going -> reminders strip & .ics calendar link appear -> Interested -> failed Cancel -> retry Cancel.
      await page.goto('/community/social?tab=events');
      const eventCard = page.getByRole('article').filter({hasText: 'Didsbury Saturday Repair Café'});
      await expect(eventCard).toBeVisible();
      await expect(page.getByTestId('social-event-reminders')).toHaveCount(0);

      await eventCard.getByRole('button', {name: 'Going'}).click();
      await expect(eventCard.getByText('Your response: Going')).toBeVisible();

      const reminderPanel = page.getByTestId('social-event-reminders');
      await expect(reminderPanel).toBeVisible();
      await expect(reminderPanel).toContainText('Upcoming event reminders (1)');
      await expect(reminderPanel).toContainText('automated email, SMS and mobile push reminders are not yet enabled');
      const icsHref = await reminderPanel
        .getByRole('link', {name: 'Save calendar reminder (.ics)'})
        .getAttribute('href');
      expect(decodeURIComponent(icsHref ?? '')).toContain('BEGIN:VALARM');
      expect(decodeURIComponent(icsHref ?? '')).toContain('Didsbury Public Library Hall');

      // Switch to Interested.
      await eventCard.getByRole('button', {name: 'Interested'}).click();
      await expect(eventCard.getByText('Your response: Interested')).toBeVisible();

      // First cancel attempt fails -> focused alert, RSVP preserved.
      await eventCard.getByRole('button', {name: 'Cancel RSVP'}).click();
      await expect(page.getByRole('region', {name: 'Community events'}).getByRole('alert')).toContainText(
        'Your RSVP could not be changed'
      );
      await expect(reminderPanel).toBeVisible();

      // Retry Cancel RSVP -> succeeds and clears reminders strip.
      await eventCard.getByRole('button', {name: 'Cancel RSVP'}).click();
      await expect(page.getByText('Your RSVP was cancelled.')).toBeVisible();
      await expect(page.getByTestId('social-event-reminders')).toHaveCount(0);

      const eventsOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(eventsOverflow).toBeLessThanOrEqual(0);

      // 2. Notifications page: initial load error retry, honest delivery status, Unread/Read filters, mark-read recovery.
      await page.goto('/notifications');
      const deliveryBar = page.getByTestId('notification-delivery-status');
      await expect(deliveryBar).toContainText('In-app inbox: Active');
      await expect(deliveryBar).toContainText('Email: Not yet enabled');
      await expect(deliveryBar).toContainText('Mobile push: Not yet enabled');

      const retryBtn = page.getByRole('button', {name: 'Retry loading notifications'});
      await expect(retryBtn).toBeVisible();
      failNotificationsLoad = false;
      await retryBtn.press('Enter');
      await expect(page.getByRole('heading', {name: 'Notifications'})).toBeFocused();
      await expect(page.getByText('New quote received')).toBeVisible();
      await expect(page.getByText('Delivered in app · Unread')).toBeVisible();

      // Filter to Unread -> 1 item; Read -> 1 item; back to All -> 2 items.
      await page.getByRole('button', {name: /Unread 1/}).click();
      await expect(page.getByRole('article')).toHaveCount(1);
      await page.getByRole('button', {name: /Read 1/}).click();
      await expect(page.getByRole('article')).toHaveCount(1);
      await expect(page.getByText('Job confirmed complete')).toBeVisible();
      await page.getByRole('button', {name: /All 2/}).click();
      await expect(page.getByRole('article')).toHaveCount(2);

      // Failed mark-as-read shows focused alert; retry succeeds and updates unread count to 0.
      const unreadCard = page.getByRole('article').filter({hasText: 'New quote received'});
      await unreadCard.getByRole('button', {name: 'Mark as read'}).click();
      const markAlert = page.locator('main').getByRole('alert');
      await expect(markAlert).toContainText('Unable to mark notification as read');
      await expect(markAlert).toBeFocused();

      await unreadCard.getByRole('button', {name: 'Mark as read'}).click();
      await expect(page.getByText('Notification marked as read.')).toBeVisible();
      await expect(page.getByRole('button', {name: /Unread 0/})).toBeVisible();

      const notifOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(notifOverflow).toBeLessThanOrEqual(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        fixture.close(error => (error ? reject(error) : resolve()));
        fixture.closeAllConnections();
      });
    }
  });
});
