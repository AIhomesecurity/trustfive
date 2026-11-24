import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  ALLOWED_PREVIEW_DOMAIN,
  ALLOWED_PREVIEW_HOSTNAME,
  ALLOWED_PREVIEW_WORKER,
  ALLOWED_SOURCE_KIND,
  evaluatePreviewDeployGate,
} from '../../scripts/release/deploy-preview-gate.mjs';

const previewUrl = 'https://' + 'a'.repeat(20) + '.supabase.co';
const productionUrl = 'https://' + 'b'.repeat(20) + '.supabase.co';
const commitSha = '1'.repeat(40);
const fixedNow = Date.parse('2026-11-24T19:00:00.000Z');

const passingReview = {reviewedBy: 'Release Lead', commitSha, testsPassed: true, databaseReplayPassed: true, ciStatus: 'passed'};
const genuineProtectedPreviewEvidence = {
  worker: ALLOWED_PREVIEW_WORKER, hostname: ALLOWED_PREVIEW_HOSTNAME, candidateCommitSha: commitSha,
  verifiedBy: 'scripts/release/validate-preview.mjs', verifiedAt: '2026-11-24T18:30:00.000Z',
  anonymousProbe: {url: `${ALLOWED_PREVIEW_HOSTNAME}/api/health`, status: 403},
  accessPolicy: {applicationHostname: ALLOWED_PREVIEW_DOMAIN, applicationId: 'access-app-preview-trustfive', serviceTokenAuthorized: true},
  alternateUrlsDisabled: true,
};

function makeValidWorkerConfig(overrides = {}) {
  return {
    name: ALLOWED_PREVIEW_WORKER, compatibilityDate: '2026-11-22', workersDev: false, previewUrls: false,
    domains: [{hostname: ALLOWED_PREVIEW_DOMAIN, production: true, previews: false}],
    assets: {htmlHandling: 'none', notFoundHandling: 'none', runWorkerFirst: ['/*', '!/_next/static/*', '!/*/_next/static/*']},
    env: {ASSETS: {type: 'assets'}},
    manifest: {type: 'partial', mainModule: 'index.mjs', modules: {}},
    ...overrides,
  };
}

async function createValidFixture(t, workerConfigOverrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'trustfive-secret-gap-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const v1Dir = join(root, '.cloudflare', 'output', 'v1');
  const defaultWorkerDir = join(v1Dir, 'workers', 'default');
  const bundleDir = join(defaultWorkerDir, 'bundle');
  const bundleChunksDir = join(bundleDir, '_next', 'static');
  const assetsDir = join(defaultWorkerDir, 'assets');
  const assetChunksDir = join(assetsDir, '_next', 'static');
  await mkdir(bundleChunksDir, {recursive: true});
  await mkdir(assetChunksDir, {recursive: true});
  await writeFile(join(v1Dir, 'config.json'), JSON.stringify({producer: {name: '@cloudflare/vite-plugin', version: '2.0.0-rc.3'}, buildContext: {isPreview: false, mode: 'production'}}), 'utf8');
  await writeFile(join(defaultWorkerDir, 'worker.config.json'), JSON.stringify(makeValidWorkerConfig(workerConfigOverrides)), 'utf8');
  await writeFile(join(bundleDir, 'index.mjs'), 'export default { fetch() { return new Response("ok"); } };', 'utf8');
  await writeFile(join(bundleChunksDir, 'route-health.mjs'), `export async function GET(){let t=\`${commitSha}\`;return Response.json({service:\`trustfive-web\`,status:\`ok\`,...(t?{commitSha:t}:{})});}`, 'utf8');
  await writeFile(join(bundleChunksDir, 'route-ready.mjs'), `export async function GET(){return fetch(\`${previewUrl}/rest/v1/trades\`);}`, 'utf8');
  await writeFile(join(assetChunksDir, 'bundle.js'), `const url="${previewUrl}/rest/v1";`, 'utf8');
  return {root, v1Dir, defaultWorkerDir, bundleDir, assetsDir};
}

function makeBaseOptions(fixture, overrides = {}) {
  return {
    destinationWorker: ALLOWED_PREVIEW_WORKER, destinationHostname: ALLOWED_PREVIEW_HOSTNAME,
    sourceKind: ALLOWED_SOURCE_KIND, commitSha, buildSha: commitSha, workingTreeClean: true,
    reviewEvidence: passingReview, protectedPreviewEvidence: genuineProtectedPreviewEvidence,
    previewSupabaseUrl: previewUrl, productionSupabaseUrl: productionUrl, workerRuntimeSupabaseUrl: previewUrl,
    buildOutputRoot: fixture.root, assetDirectory: fixture.assetsDir, now: fixedNow, execute: false, ...overrides,
  };
}

const SYNTHETIC_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZmVyZW5jZSI6ImFhYWFhYWFhYWFhYWFhYWFhYWFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.synthetic-signature-for-regression-test-only';

test('rejects text binding named SUPABASE_SERVICE_ROLE_KEY with JWT value', async t => {
  const fixture = await createValidFixture(t, {env: {ASSETS: {type: 'assets'}, SUPABASE_SERVICE_ROLE_KEY: {type: 'text', value: SYNTHETIC_JWT}}});
  const decision = await evaluatePreviewDeployGate(makeBaseOptions(fixture));
  assert.equal(decision.ok, false, 'Gate must reject SUPABASE_SERVICE_ROLE_KEY as a text binding');
  assert.match(decision.reasons.join('\n'), /secret.*binding type/i);
});

test('rejects text binding named STRIPE_SECRET_KEY with test-mode key value', async t => {
  const fixture = await createValidFixture(t, {env: {ASSETS: {type: 'assets'}, STRIPE_SECRET_KEY: {type: 'text', value: 'sk_test_51FakeTestKeyValue12345678901234567890'}}});
  const decision = await evaluatePreviewDeployGate(makeBaseOptions(fixture));
  assert.equal(decision.ok, false, 'Gate must reject STRIPE_SECRET_KEY as a text binding');
  assert.match(decision.reasons.join('\n'), /secret.*binding type/i);
});

test('rejects all secret-like text binding names', async t => {
  const cases = [
    {name: 'SUPABASE_SERVICE_ROLE_KEY', value: SYNTHETIC_JWT},
    {name: 'STRIPE_SECRET_KEY', value: 'sk_test_51FakeTestKeyValue12345678901234567890'},
    {name: 'SUPABASE_ANON_KEY', value: 'eyJhbGciOiJIUzI1NiJ9.synthetic'},
    {name: 'CF_ACCESS_CLIENT_SECRET', value: 'access-secret-value'},
    {name: 'DATABASE_PASSWORD', value: 'super-secret-password'},
    {name: 'API_TOKEN', value: 'tok_aBcDeFgHiJkLmNoP'},
    {name: 'PRIVATE_KEY', value: '-----BEGIN PRIVATE KEY-----\nfake'},
    {name: 'SERVICE_CREDENTIAL', value: 'cred_abc123'},
  ];
  for (const tc of cases) {
    const fixture = await createValidFixture(t, {env: {ASSETS: {type: 'assets'}, [tc.name]: {type: 'text', value: tc.value}}});
    const decision = await evaluatePreviewDeployGate(makeBaseOptions(fixture));
    assert.equal(decision.ok, false, `Gate must reject text binding "${tc.name}"`);
    assert.match(decision.reasons.join('\n'), /secret.*binding type/i, `Rejection reason for "${tc.name}" must mention secret binding type`);
  }
});

test('allows secret TYPE bindings with secret-like names (correct pattern)', async t => {
  const fixture = await createValidFixture(t, {env: {ASSETS: {type: 'assets'}, SUPABASE_SERVICE_ROLE_KEY: {type: 'secret'}, STRIPE_SECRET_KEY: {type: 'secret'}, CF_ACCESS_CLIENT_SECRET: {type: 'secret'}}});
  const decision = await evaluatePreviewDeployGate(makeBaseOptions(fixture));
  assert.equal(decision.ok, true, 'Secret TYPE bindings should be allowed even with secret-like names.');
});

test('allows non-secret text bindings (NEXT_PUBLIC_SUPABASE_URL, TRUSTFIVE_BUILD_SHA, etc.)', async t => {
  const fixture = await createValidFixture(t, {env: {ASSETS: {type: 'assets'}, NEXT_PUBLIC_SUPABASE_URL: {type: 'text', value: previewUrl}, TRUSTFIVE_BUILD_SHA: {type: 'text', value: commitSha}, APP_NAME: {type: 'text', value: 'TrustFive'}}});
  const decision = await evaluatePreviewDeployGate(makeBaseOptions(fixture));
  assert.equal(decision.ok, true, 'Non-secret text bindings should be allowed.');
});
