import {once} from 'node:events';
import {createServer} from 'node:http';
import {expect, test} from '@playwright/test';

const backend = 'http://127.0.0.1:54321';
const quote = 'bbbbbbbb-0000-4000-8000-000000000041';
const primaryToken = 'synthetic-primary-token';
const strangerToken = 'synthetic-stranger-token';
const primaryUser = {id: 'aaaaaaaa-0000-4000-8000-000000000041', aud: 'authenticated'};
const strangerUser = {id: 'aaaaaaaa-0000-4000-8000-000000000042', aud: 'authenticated'};
const messageBody = 'Please confirm the Thursday appointment slot.';

test('failed read shows an error until retry, then one message is delivered only to the quote participant', async ({browser, baseURL}) => {
  test.skip(process.env.NEXT_PUBLIC_SUPABASE_URL !== backend, 'Requires the loopback build');

  let failedReads = 0;
  let successfulReads = 0;
  let strangerReads = 0;
  const inserts: Array<{quote_id: string; author_id: string; body: string}> = [];
  const messages: Array<{id: string; quote_id: string; author_id: string; body: string; created_at: string}> = [];

  const tokenFor = (request: {headers: {authorization?: string}}): string =>
    request.headers.authorization?.replace(/^Bearer\s+/, '') ?? '';
  const primary = (request: {headers: {authorization?: string}}): boolean => tokenFor(request) === primaryToken;

  const fixture = createServer((request, response) => {
    const url = new URL(request.url ?? '/', backend);
    const path = url.pathname;
    const token = tokenFor(request);
    const isThread = request.method === 'GET' && path === '/rest/v1/quote_messages';

    if (isThread && token === strangerToken) strangerReads += 1;
    // The installed PostgREST client retries 503 GETs automatically. Use a
    // non-retryable 500 so this fixture exercises the explicit UI retry path.
    const failed = isThread && primary(request) && failedReads++ === 0;
    const status = request.method === 'OPTIONS' ? 204 : failed ? 500 : 200;

    let body: unknown;
    if (path === '/auth/v1/user') {
      body = token === strangerToken ? strangerUser : primaryUser;
    } else if (path === '/rest/v1/rpc/customer_quotes') {
      body = primary(request)
        ? [{quote_id: quote, job_id: 'synthetic-job', business_name: 'Synthetic trades', amount_pence: 10000, status: 'accepted'}]
        : [];
    } else if (path === '/rest/v1/rpc/professional_quotes') {
      body = [];
    } else if (isThread && token === strangerToken) {
      body = [];
    } else if (isThread && failed) {
      body = {message: 'Synthetic read failure'};
    } else if (isThread) {
      successfulReads += 1;
      body = messages;
    } else if (request.method === 'POST' && path === '/rest/v1/quote_messages') {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          quote_id: string; author_id: string; body: string;
        };
        inserts.push(parsed);
        const created = {
          id: `message-${inserts.length}`,
          quote_id: parsed.quote_id,
          author_id: parsed.author_id,
          body: parsed.body,
          created_at: new Date().toISOString(),
        };
        messages.push(created);
        response.writeHead(200, {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'content-type': 'application/json',
        });
        response.end(JSON.stringify([created]));
      });
      return;
    } else {
      body = [];
    }

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
    const session = (token: string, user: {id: string; aud: string}) => ({
      access_token: token,
      refresh_token: `${token}-refresh`,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user,
    });
    const cookie = (token: string, user: {id: string; aud: string}) => ({
      name: 'sb-127-auth-token',
      url: baseURL!,
      value: 'base64-' + Buffer.from(JSON.stringify(session(token, user))).toString('base64url'),
    });

    const participant = await browser.newContext({baseURL});
    await participant.addCookies([cookie(primaryToken, primaryUser)]);
    const page = await participant.newPage();
    await page.goto('/messages?quote=' + quote);

    const conversation = page.getByRole('region', {name: 'Selected conversation'});
    const error = conversation.getByRole('alert');
    await expect(error).toContainText('Unable to load this conversation');
    await expect(conversation.getByText('No messages yet.', {exact: false})).toHaveCount(0);
    expect(failedReads).toBe(1);

    await conversation.getByRole('button', {name: 'Refresh messages'}).click();
    await expect(error).toHaveCount(0);
    await expect(conversation.getByText('No messages yet.', {exact: false})).toBeVisible();
    expect(successfulReads).toBe(1);

    await conversation.getByLabel('Write a message').fill(messageBody);
    await conversation.getByRole('button', {name: 'Send message'}).click();
    await expect(conversation.getByText(messageBody)).toBeVisible();
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({quote_id: quote, author_id: primaryUser.id, body: messageBody});

    await page.reload();
    await expect(conversation.getByText(messageBody)).toBeVisible();
    await expect(conversation.getByText(messageBody)).toHaveCount(1);
    expect(inserts).toHaveLength(1);

    const stranger = await browser.newContext({baseURL});
    await stranger.addCookies([cookie(strangerToken, strangerUser)]);
    const strangerPage = await stranger.newPage();
    await strangerPage.goto('/messages?quote=' + quote);
    await expect(strangerPage.getByText('That conversation is not available to your account.', {exact: false})).toBeVisible();
    await expect(strangerPage.getByText('Synthetic trades')).toHaveCount(0);
    await expect(strangerPage.getByText(messageBody)).toHaveCount(0);
    expect(strangerReads).toBe(0);
    await stranger.close();
    await participant.close();
  } finally {
    const closed = once(fixture, 'close');
    fixture.close();
    fixture.closeAllConnections();
    await closed;
  }
});
