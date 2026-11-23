import assert from 'node:assert/strict';
import {createServer} from 'node:http';

const backend = 'http://127.0.0.1:54321';
const port = process.argv[2] ?? '3007';
assert.ok(['3007', '3008'].includes(port), 'Expected the local Next.js or Worker fixture port');
const app = 'http://127.0.0.1:' + port;
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, backend);

const user = {id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', aud: 'authenticated'};
const accessToken = 'synthetic-release-smoke-token';
const session = {
  access_token: accessToken,
  refresh_token: 'synthetic-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: 'bearer',
  user,
};
const cookie = 'sb-127-auth-token=base64-' + Buffer.from(JSON.stringify(session)).toString('base64url');
let verified = 0;
const fixture = createServer((request, response) => {
  const authorized = request.url === '/auth/v1/user' && request.headers.authorization === 'Bearer ' + accessToken;
  if (authorized) verified++;
  response.writeHead(authorized ? 200 : 401, {'content-type': 'application/json'});
  response.end(JSON.stringify(authorized ? user : {message: 'Synthetic session required'}));
});

await new Promise((resolve, reject) => {
  fixture.once('error', reject);
  fixture.listen(54321, '127.0.0.1', resolve);
});
try {
  const destination = '/jobs?trade=cctv-installation';
  const anonymous = await fetch(app + destination, {redirect: 'manual'});
  assert.equal(anonymous.status, 307);
  assert.equal(new URL(anonymous.headers.get('location'), app).searchParams.get('next'), destination);

  const signedIn = await fetch(app + destination, {headers: {cookie}, redirect: 'manual'});
  assert.equal(signedIn.status, 200);
  assert.match(await signedIn.text(), /My jobs and quotes/);

  const account = await fetch(app + '/account?next=' + encodeURIComponent(destination), {
    headers: {cookie},
    redirect: 'manual',
  });
  assert.equal(account.status, 307);
  const target = new URL(account.headers.get('location'), app);
  assert.ok([app, 'http://localhost:' + port].includes(target.origin));
  assert.equal(target.pathname + target.search, destination);
  assert.ok(verified >= 2, 'Expected server middleware to verify both signed-in requests');
  console.log('Synthetic session passed protected route and account-return checks');
} finally {
  await new Promise((resolve, reject) => fixture.close(error => error ? reject(error) : resolve()));
}
