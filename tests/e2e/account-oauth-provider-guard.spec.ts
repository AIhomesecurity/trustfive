import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test} from '@playwright/test';
import {parseAuthSettingsProviders,safeAuthCallbackError} from '../../lib/auth-providers';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';

test.describe('OAuth provider availability helpers', () => {
  test('parses Supabase /auth/v1/settings external provider flags safely', () => {
    expect(parseAuthSettingsProviders({external: {google: true, apple: false, email: true}})).toEqual({
      google: true,
      apple: false,
      checked: true,
    });
    expect(parseAuthSettingsProviders({external: {google: false, apple: false}})).toEqual({
      google: false,
      apple: false,
      checked: true,
    });
    expect(parseAuthSettingsProviders(null)).toEqual({google: false, apple: false, checked: false});
    expect(safeAuthCallbackError('?auth_error=callback_failed')).toContain('Could not complete sign-in');
    expect(safeAuthCallbackError('?auth_error=unknown')).toBe('');
  });
});

test.describe('/account live OAuth provider guard', () => {
  test('hides broken Google/Apple buttons when disabled in Supabase and renders active Google button once enabled', async ({
    browser,
  }) => {
    test.skip(
      process.env.NEXT_PUBLIC_SUPABASE_URL !== backend,
      'Requires the isolated loopback application build.'
    );
    test.setTimeout(45000);

    let googleEnabled = false;

    const fixture = createServer((request, response) => {
      const url = new URL(request.url ?? '/', backend);
      response.writeHead(200, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,OPTIONS',
        'content-type': 'application/json',
      });
      if (request.method === 'OPTIONS') {
        response.end();
        return;
      }
      if (url.pathname === '/auth/v1/settings') {
        response.end(JSON.stringify({external: {email: true, google: googleEnabled, apple: false}}));
        return;
      }
      response.end(JSON.stringify({}));
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

    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    try {
      // 1. Google disabled -> never exposes broken redirect button; explains email/password is active.
      googleEnabled = false;
      await page.goto(`${app}/account`);
      await expect(page.getByTestId('oauth-providers-unavailable')).toBeVisible();
      await expect(page.getByRole('button', {name: 'Continue with Google'})).toHaveCount(0);

      // 2. Google enabled -> Continue with Google automatically appears; Apple stays hidden.
      googleEnabled = true;
      await page.reload();
      await expect(page.getByTestId('oauth-providers-active')).toBeVisible();
      await expect(page.getByRole('button', {name: 'Continue with Google'})).toBeVisible();
      await expect(page.getByRole('button', {name: 'Continue with Apple'})).toHaveCount(0);
    } finally {
      await page.close();
      await new Promise<void>(resolve => fixture.close(() => resolve()));
    }
  });
});
