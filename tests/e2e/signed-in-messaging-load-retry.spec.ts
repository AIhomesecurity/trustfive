import {once} from 'node:events';
import {createServer} from 'node:http';
import {expect, test} from '@playwright/test';

const backend = 'http://127.0.0.1:54321';
const user = {id: 'aaaaaaaa-0000-4000-8000-000000000041', aud: 'authenticated'};
const quote = 'bbbbbbbb-0000-4000-8000-000000000041';

test('a failed message read shows an error until an empty retry succeeds', async ({page, baseURL}) => {
  test.skip(process.env.NEXT_PUBLIC_SUPABASE_URL !== backend, 'Requires the loopback build');
  let reads = 0;
  const fixture = createServer((request, response) => {
    const path = new URL(request.url ?? '/', backend).pathname;
    const isThread = request.method === 'GET' && path === '/rest/v1/quote_messages';
    const failed = isThread && ++reads === 1;
    const status = request.method === 'OPTIONS' ? 204 : failed ? 503 : 200;
    const body = path === '/auth/v1/user' ? user : path === '/rest/v1/rpc/customer_quotes'
      ? [{quote_id: quote, job_id: 'synthetic-job', business_name: 'Synthetic trades', amount_pence: 10000, status: 'pending'}]
      : failed ? {message: 'Synthetic read failure'} : [];
    response.writeHead(status, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'content-type': 'application/json',
    });
    response.end(status === 204 ? undefined : JSON.stringify(body));
  });
  await once(fixture.listen(54321, '127.0.0.1'), 'listening');
  try {
    const session = {access_token: 'synthetic-token', refresh_token: 'synthetic-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user};
    await page.context().addCookies([{name: 'sb-127-auth-token', url: baseURL!,
      value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')}]);
    await page.goto('/messages?quote=' + quote);
    const conversation = page.getByRole('region', {name: 'Selected conversation'});
    const error = conversation.getByRole('alert');
    const empty = conversation.getByText('No messages yet.', {exact: false});
    await expect(error).toContainText('Unable to load this conversation');
    await expect(empty).toHaveCount(0);
    await conversation.getByRole('button', {name: 'Refresh messages'}).click();
    await expect(error).toHaveCount(0);
    await expect(empty).toBeVisible();
    expect(reads).toBe(2);
  } finally {
    const closed = once(fixture, 'close');
    fixture.close();
    fixture.closeAllConnections();
    await closed;
  }
});
