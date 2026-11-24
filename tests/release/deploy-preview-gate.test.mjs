import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {
  ALLOWED_PREVIEW_HOSTNAME,
  ALLOWED_PREVIEW_WORKER,
  ALLOWED_SOURCE_KIND,
  evaluatePreviewDeployGate,
  runPreviewDeployGate,
} from '../../scripts/release/deploy-preview-gate.mjs';

const previewUrl = 'https://' + 'a'.repeat(20) + '.supabase.co';
const productionUrl = 'https://' + 'b'.repeat(20) + '.supabase.co';
const commitSha = '1'.repeat(40);
const passingReview = {
  reviewedBy: 'Release Lead',
  testsPassed: true,
  databaseReplayPassed: true,
  ciStatus: 'passed',
};

async function createAssetFixture(t, content = `const url="${previewUrl}/rest/v1";`) {
  const dir = await mkdtemp(join(tmpdir(), 'trustfive-deploy-gate-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const chunks = join(dir, '_next', 'static');
  await mkdir(chunks, {recursive: true});
  await writeFile(join(chunks, 'bundle.js'), content, 'utf8');
  return dir;
}

test('passes dry-run only for explicit protected preview Worker, clean reviewed commit and isolated assets', async t => {
  const assetDirectory = await createAssetFixture(t);
  let deployCalled = false;
  const result = await runPreviewDeployGate(
    {
      destinationWorker: ALLOWED_PREVIEW_WORKER,
      destinationHostname: ALLOWED_PREVIEW_HOSTNAME,
      sourceKind: ALLOWED_SOURCE_KIND,
      commitSha,
      buildSha: commitSha,
      workingTreeClean: true,
      reviewEvidence: passingReview,
      previewSupabaseUrl: previewUrl,
      productionSupabaseUrl: productionUrl,
      workerRuntimeSupabaseUrl: previewUrl,
      assetDirectory,
      execute: false,
    },
    async () => {
      deployCalled = true;
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'dry_run_passed');
  assert.equal(result.deployed, false);
  assert.equal(deployCalled, false);
  assert.equal(result.destinationWorker, 'trustfive-preview');
  assert.equal(result.destinationHostname, 'https://preview.trustfive.co.uk');
  assert.equal(result.isolationVerified, true);
});

test('blocks production Worker, production hostname, workers.dev and unspecified destinations', async t => {
  const assetDirectory = await createAssetFixture(t);
  const base = {
    destinationWorker: ALLOWED_PREVIEW_WORKER,
    destinationHostname: ALLOWED_PREVIEW_HOSTNAME,
    sourceKind: ALLOWED_SOURCE_KIND,
    commitSha,
    workingTreeClean: true,
    reviewEvidence: passingReview,
    previewSupabaseUrl: previewUrl,
    productionSupabaseUrl: productionUrl,
    workerRuntimeSupabaseUrl: previewUrl,
    assetDirectory,
  };

  for (const worker of ['', 'trustfive', 'trustfive-prod', 'trustfive-staging']) {
    const decision = await evaluatePreviewDeployGate({...base, destinationWorker: worker});
    assert.equal(decision.ok, false);
    assert.equal(decision.mode, 'blocked');
    assert.match(decision.reasons.join('\n'), /trustfive-preview/);
  }

  for (const hostname of ['', 'https://trustfive.co.uk', 'https://trustfive-preview.example.workers.dev']) {
    const decision = await evaluatePreviewDeployGate({...base, destinationHostname: hostname});
    assert.equal(decision.ok, false);
    assert.match(decision.reasons.join('\n'), /preview\.trustfive\.co\.uk/);
  }
});

test('blocks raw model output, unreviewed patches, dirty trees, failed evidence and shared Supabase projects', async t => {
  const assetDirectory = await createAssetFixture(t);
  const base = {
    destinationWorker: ALLOWED_PREVIEW_WORKER,
    destinationHostname: ALLOWED_PREVIEW_HOSTNAME,
    sourceKind: ALLOWED_SOURCE_KIND,
    commitSha,
    workingTreeClean: true,
    reviewEvidence: passingReview,
    previewSupabaseUrl: previewUrl,
    productionSupabaseUrl: productionUrl,
    workerRuntimeSupabaseUrl: previewUrl,
    assetDirectory,
  };

  for (const sourceKind of ['raw_model_output', 'unreviewed_ollama', 'unreviewed_patch', '']) {
    const decision = await evaluatePreviewDeployGate({...base, sourceKind});
    assert.equal(decision.ok, false);
    assert.match(decision.reasons.join('\n'), /raw model output/i);
  }

  const dirty = await evaluatePreviewDeployGate({...base, workingTreeClean: false});
  assert.equal(dirty.ok, false);
  assert.match(dirty.reasons.join('\n'), /clean/i);

  const unverified = await evaluatePreviewDeployGate({
    ...base,
    reviewEvidence: {...passingReview, databaseReplayPassed: false},
  });
  assert.equal(unverified.ok, false);
  assert.match(unverified.reasons.join('\n'), /database replay/i);

  const sharedDb = await evaluatePreviewDeployGate({
    ...base,
    productionSupabaseUrl: previewUrl,
  });
  assert.equal(sharedDb.ok, false);
  assert.equal(sharedDb.isolationVerified, false);

  const leakedProdAssets = await createAssetFixture(t, `const url="${productionUrl}/rest/v1";`);
  const badAssets = await evaluatePreviewDeployGate({...base, assetDirectory: leakedProdAssets});
  assert.equal(badAssets.ok, false);
  assert.equal(badAssets.isolationVerified, false);
});

test('blocks --execute unless explicit authorization and protected preview credentials are present and never echoes secrets', async t => {
  const assetDirectory = await createAssetFixture(t);
  const decision = await evaluatePreviewDeployGate({
    destinationWorker: ALLOWED_PREVIEW_WORKER,
    destinationHostname: ALLOWED_PREVIEW_HOSTNAME,
    sourceKind: ALLOWED_SOURCE_KIND,
    commitSha,
    workingTreeClean: true,
    reviewEvidence: passingReview,
    previewSupabaseUrl: previewUrl,
    productionSupabaseUrl: productionUrl,
    workerRuntimeSupabaseUrl: previewUrl,
    assetDirectory,
    execute: true,
    authorized: false,
    previewAccessConfigured: false,
    cloudflareTokenPresent: false,
  });
  assert.equal(decision.ok, false);
  assert.match(decision.reasons.join('\n'), /TRUSTFIVE_AUTHORIZED_PREVIEW_DEPLOY=1/);

  const entry = fileURLToPath(new URL('../../scripts/release/deploy-preview-gate.mjs', import.meta.url));
  const cli = spawnSync(
    process.execPath,
    [entry, '--dry-run', '--worker', 'trustfive', '--hostname', 'https://trustfive.co.uk', '--source-kind', 'raw_model_output', '--assets', assetDirectory],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: 'cf-secret-token-should-not-leak',
        CF_ACCESS_CLIENT_SECRET: 'access-secret-should-not-leak',
      },
    }
  );
  assert.equal(cli.status, 1);
  assert.doesNotMatch(cli.stdout + cli.stderr, /cf-secret-token-should-not-leak|access-secret-should-not-leak/);
});
