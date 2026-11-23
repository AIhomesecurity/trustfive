import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validatePreview} from '../../scripts/release/validate-preview.mjs';

const sha = 'a'.repeat(40);
const options = {origin: 'https://preview.trustfive.co.uk', clientId: 'fixture-id', clientSecret: 'fixture-secret', expectedSha: sha};
const health = commitSha => Response.json({service: 'trustfive-web', status: 'ok', commitSha});

test('requires a denial followed by a credentialed health check on the same origin', async () => {
  const requests = [];
  await validatePreview({...options, fetchImpl: async (url, init) => {
    requests.push(init);
    assert.equal(url.href, options.origin + '/api/health');
    assert.equal(init.redirect, 'manual');
    return requests.length === 1 ? new Response(null, {status: 403}) : health(sha);
  }});
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers, undefined);
  assert.equal(requests[1].headers['CF-Access-Client-Secret'], options.clientSecret);
});

test('stops before sending credentials to a public preview or production', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return health(sha); };
  await assert.rejects(validatePreview({...options, origin: 'https://trustfive.co.uk', fetchImpl}), /Unexpected preview/);
  assert.equal(calls, 0);
  await assert.rejects(validatePreview({...options, fetchImpl}), /anonymous access/);
  assert.equal(calls, 1);
});

test('accepts an Access redirect and rejects missing or mismatched release identity', async () => {
  for (const reportedSha of [undefined, 'b'.repeat(40)]) {
    let calls = 0;
    await assert.rejects(validatePreview({...options, fetchImpl: async () => ++calls === 1
      ? Response.redirect('https://example.cloudflareaccess.com/login')
      : health(reportedSha)}), /release commit/);
    assert.equal(calls, 2);
  }
});


test('command fails closed with no credentials and does not print credentials', () => {
  const entry = fileURLToPath(new URL('../../scripts/release/validate-preview.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [entry, sha], {
    encoding: 'utf8',
    env: {...process.env, CF_ACCESS_CLIENT_ID: '', CF_ACCESS_CLIENT_SECRET: 'fixture-secret'},
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing credentials/);
  assert.doesNotMatch(result.stderr + result.stdout, /fixture-secret/);
});
