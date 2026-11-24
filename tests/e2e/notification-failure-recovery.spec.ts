import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test} from '@playwright/test';
import {classifyNotificationReadFailure} from '../../lib/notification-delivery';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';
const userId = 'aaaaaaaa-0000-4000-8000-000000000061';
const notifA = 'bbbbbbbb-0000-4000-8000-000000000061';
const notifB = 'bbbbbbbb-0000-4000-8000-000000000062';

test('classifies stale/missing notification read failures separately from transient outages', () => {
  expect(classifyNotificationReadFailure(new Error('Notification not found')).kind).toBe('already_resolved');
  expect(classifyNotificationReadFailure(new Error('503 service unavailable')).kind).toBe('transient');
  expect(classifyNotificationReadFailure({message: 'Already read'}).kind).toBe('already_resolved');
});

test.use({viewport: {width: 360, height: 800}, isMobile: true, hasTouch: true});

test('360px notifications inbox preserves loaded items on refresh failure and recovers per-item mark-read errors', async ({page}) => {
  test.skip(process.env.NEXT_PUBLIC_SUPABASE_URL !== backend, 'Requires the isolated loopback application build.');

  let failNextFetch = false;
  let failFirstMarkA = true;
  const rows = [
    {
      id: notifA,
      kind: 'appointment_proposed',
      title: 'Appointment time proposed',
      body: 'The professional proposed Tuesday 10:00–11:00.',
      target_path: '/schedule',
      created_at: '2026-11-24T12:00:00Z',
      read_at: null as string | null,
    },
    {
      id: notifB,
      kind: 'new_message',
      title: 'New quote message',
      body: 'A message arrived in your private quote thread.',
      target_path: '/messages',
      created_at: '2026-11-24T11:30:00Z',
      read_at: null as string | null,
    },
  ];

  const fixture = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', backend);
    const actor = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const reply = (status: number, data: unknown) => {
      res.writeHead(status, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'content-type': 'application/json',
      });
      res.end(status === 204 ? '' : JSON.stringify(data));
    };
    if (req.method === 'OPTIONS') return reply(204, null);
    if (actor !== userId) return reply(401, {message: 'Synthetic session required'});

    let raw = '';
    if (req.method === 'POST') {
      for await (const chunk of req) raw += chunk;
    }

    switch (url.pathname) {
      case '/auth/v1/user':
        return reply(200, {id: userId, aud: 'authenticated'});
      case '/rest/v1/account_notifications':
        if (failNextFetch) {
          return reply(500, {message: 'Synthetic refresh interruption'});
        }
        return reply(200, rows);
      case '/rest/v1/rpc/mark_notification_read': {
        const {p_notification} = JSON.parse(raw);
        if (p_notification === notifA && failFirstMarkA) {
          return reply(500, {message: 'Synthetic mark-read outage'});
        }
        if (p_notification === notifB) {
          // Simulate another device already marking notifB read before this click.
          rows[1].read_at = '2026-11-24T12:05:00Z';
          return reply(200, false);
        }
        const match = rows.find(r => r.id === p_notification);
        if (!match) return reply(200, false);
        match.read_at = '2026-11-24T12:06:00Z';
        return reply(200, true);
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
      access_token: userId,
      refresh_token: 'synthetic-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: {id: userId, aud: 'authenticated'},
    };
    await page.context().addCookies([
      {
        name: 'sb-127-auth-token',
        value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
        url: app,
      },
    ]);

    await page.goto('/notifications');
    await expect(page.getByText('Appointment time proposed')).toBeVisible();
    await expect(page.getByText('New quote message')).toBeVisible();

    // Refresh fails -> inline alert appears and is focused, while BOTH previously loaded notifications remain visible.
    failNextFetch = true;
    await page.getByRole('button', {name: 'Refresh notifications'}).click();
    const refreshAlert = page.locator('main').getByRole('alert');
    await expect(refreshAlert).toContainText('previously loaded items remain visible');
    await expect(refreshAlert).toBeFocused();
    await expect(page.getByText('Appointment time proposed')).toBeVisible();
    await expect(page.getByText('New quote message')).toBeVisible();

    // Retry refresh recovers cleanly.
    failNextFetch = false;
    await page.getByRole('button', {name: 'Retry refresh'}).click();
    await expect(refreshAlert).toHaveCount(0);

    // Mark notifA read fails -> per-item recovery hint appears; retry succeeds.
    const cardA = page.getByRole('article').filter({hasText: 'Appointment time proposed'});
    await cardA.getByRole('button', {name: 'Mark as read'}).click();
    await expect(cardA).toContainText('Last attempt did not save — try marking as read again.');
    failFirstMarkA = false;
    await cardA.getByRole('button', {name: 'Mark as read'}).click();
    await expect(page.getByText('Notification marked as read.')).toBeVisible();
    await expect(cardA).not.toContainText('Last attempt did not save');

    // Mark notifB read returns false (already read elsewhere) -> honest status & inbox resyncs to 0 unread.
    const cardB = page.getByRole('article').filter({hasText: 'New quote message'});
    await cardB.getByRole('button', {name: 'Mark as read'}).click();
    await expect(page.getByText('This notification was already read or is no longer available.')).toBeVisible();
    await expect(page.getByRole('button', {name: /Unread 0/})).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  } finally {
    await new Promise<void>((resolve, reject) => {
      fixture.close(error => (error ? reject(error) : resolve()));
      fixture.closeAllConnections();
    });
  }
});
