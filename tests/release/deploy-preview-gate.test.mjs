import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {
  ALLOWED_PREVIEW_DOMAIN,
  ALLOWED_PREVIEW_HOSTNAME,
  ALLOWED_PREVIEW_WORKER,
  ALLOWED_SOURCE_KIND,
  evaluatePreviewDeployGate,
  resolveCloudflareCliBin,
  runPreviewDeployGate,
  validateProtectedPreviewEvidence,
  verifyPrebuiltWorkerArtifact,
} from '../../scripts/release/deploy-preview-gate.mjs';

const previewUrl = 'https://' + 'a'.repeat(20) + '.supabase.co';
const productionUrl = 'https://' + 'b'.repeat(20) + '.supabase.co';
const foreignUrl = 'https://' + 'c'.repeat(20) + '.supabase.co';
const commitSha = '1'.repeat(40);
const staleCommitSha = '2'.repeat(40);
const fixedNow = Date.parse('2026-11-24T19:00:00.000Z');

const passingReview = {
  reviewedBy: 'Release Lead',
  commitSha,
  testsPassed: true,
  databaseReplayPassed: true,
  ciStatus: 'passed',
};

const genuineProtectedPreviewEvidence = {
  worker: ALLOWED_PREVIEW_WORKER,
  hostname: ALLOWED_PREVIEW_HOSTNAME,
  candidateCommitSha: commitSha,
  verifiedBy: 'scripts/release/validate-preview.mjs',
  verifiedAt: '2026-11-24T18:30:00.000Z',
  anonymousProbe: {
    url: `${ALLOWED_PREVIEW_HOSTNAME}/api/health`,
    status: 403,
  },
  accessPolicy: {
    applicationHostname: ALLOWED_PREVIEW_DOMAIN,
    applicationId: 'access-app-preview-trustfive',
    serviceTokenAuthorized: true,
  },
  alternateUrlsDisabled: true,
};

function makeValidWorkerConfig(overrides = {}) {
  return {
    name: ALLOWED_PREVIEW_WORKER,
    compatibilityDate: '2026-11-22',
    workersDev: false,
    previewUrls: false,
    domains: [
      {
        hostname: ALLOWED_PREVIEW_DOMAIN,
        production: true,
        previews: false,
      },
    ],
    assets: {
      htmlHandling: 'none',
      notFoundHandling: 'none',
      runWorkerFirst: ['/*', '!/_next/static/*', '!/*/_next/static/*'],
    },
    env: {
      ASSETS: {type: 'assets'},
    },
    manifest: {
      type: 'partial',
      mainModule: 'index.mjs',
      modules: {},
    },
    ...overrides,
  };
}

async function createPrebuiltArtifactFixture(t, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'trustfive-deploy-gate-'));
  t.after(() => rm(root, {recursive: true, force: true}));

  const v1Dir = join(root, '.cloudflare', 'output', 'v1');
  const defaultWorkerDir = join(v1Dir, 'workers', 'default');
  const bundleDir = join(defaultWorkerDir, 'bundle');
  const bundleChunksDir = join(bundleDir, '_next', 'static');
  const assetsDir = join(defaultWorkerDir, 'assets');
  const assetChunksDir = join(assetsDir, '_next', 'static');

  await mkdir(bundleChunksDir, {recursive: true});
  await mkdir(assetChunksDir, {recursive: true});

  const rootConfig = overrides.rootConfig ?? {
    producer: {name: '@cloudflare/vite-plugin', version: '2.0.0-rc.3'},
    buildContext: {isPreview: false, mode: 'production'},
  };
  await writeFile(join(v1Dir, 'config.json'), JSON.stringify(rootConfig), 'utf8');

  const workerConfig =
    overrides.workerConfig !== undefined ? overrides.workerConfig : makeValidWorkerConfig();
  await writeFile(
    join(defaultWorkerDir, 'worker.config.json'),
    JSON.stringify(workerConfig),
    'utf8'
  );

  const mainSource = overrides.mainSource ?? 'export default { fetch() { return new Response("ok"); } };';
  await writeFile(join(bundleDir, 'index.mjs'), mainSource, 'utf8');

  const healthSource =
    overrides.healthSource !== undefined
      ? overrides.healthSource
      : `export async function GET(){let t=\`${commitSha}\`;return Response.json({service:\`trustfive-web\`,status:\`ok\`,...(t?{commitSha:t}:{})});}`;
  if (healthSource !== null) {
    await writeFile(join(bundleChunksDir, 'route-health.mjs'), healthSource, 'utf8');
  }

  const readySource =
    overrides.readySource !== undefined
      ? overrides.readySource
      : `export async function GET(){return fetch(\`${previewUrl}/rest/v1/trades\`);}`;
  if (readySource !== null) {
    await writeFile(join(bundleChunksDir, 'route-ready.mjs'), readySource, 'utf8');
  }

  const assetSource =
    overrides.assetSource !== undefined ? overrides.assetSource : `const url="${previewUrl}/rest/v1";`;
  await writeFile(join(assetChunksDir, 'bundle.js'), assetSource, 'utf8');

  if (overrides.extraVersionDir) {
    await mkdir(join(root, '.cloudflare', 'output', overrides.extraVersionDir), {recursive: true});
  }
  if (overrides.extraWorkerDir) {
    await mkdir(join(v1Dir, 'workers', overrides.extraWorkerDir), {recursive: true});
  }
  if (overrides.extraContainerDir) {
    await mkdir(join(v1Dir, 'containers', overrides.extraContainerDir), {recursive: true});
  }

  return {root, v1Dir, defaultWorkerDir, bundleDir, assetsDir};
}

function makeBaseOptions(fixture, overrides = {}) {
  return {
    destinationWorker: ALLOWED_PREVIEW_WORKER,
    destinationHostname: ALLOWED_PREVIEW_HOSTNAME,
    sourceKind: ALLOWED_SOURCE_KIND,
    commitSha,
    buildSha: commitSha,
    workingTreeClean: true,
    reviewEvidence: passingReview,
    protectedPreviewEvidence: genuineProtectedPreviewEvidence,
    previewSupabaseUrl: previewUrl,
    productionSupabaseUrl: productionUrl,
    workerRuntimeSupabaseUrl: previewUrl,
    buildOutputRoot: fixture.root,
    assetDirectory: fixture.assetsDir,
    now: fixedNow,
    execute: false,
    ...overrides,
  };
}

test('passes dry-run only for explicit protected preview Worker, verified prebuilt artifact and isolated assets', async t => {
  const fixture = await createPrebuiltArtifactFixture(t);
  let deployCalled = false;
  const result = await runPreviewDeployGate(
    makeBaseOptions(fixture, {protectedPreviewEvidence: null, execute: false}),
    async () => {
      deployCalled = true;
    }
  );

  assert.equal(result.ok, true, result.reasons.join('; '));
  assert.equal(result.mode, 'dry_run_passed');
  assert.equal(result.deployed, false);
  assert.equal(deployCalled, false);
  assert.equal(result.destinationWorker, ALLOWED_PREVIEW_WORKER);
  assert.equal(result.destinationHostname, ALLOWED_PREVIEW_HOSTNAME);
  assert.equal(result.isolationVerified, true);
  assert.equal(result.workerConfigVerified, true);
  assert.equal(result.artifactVerified, true);
  assert.match(result.artifactDigest ?? '', /^[a-f0-9]{64}$/);
  assert.ok(Array.isArray(result.deployCommand));
  assert.equal(result.deployCommand[0], process.execPath);
  assert.equal(result.deployCommand[1], resolveCloudflareCliBin());
  assert.deepEqual(result.deployCommand.slice(2), [
    'deploy',
    '--prebuilt',
    '--mode',
    'production',
    '--worker',
    ALLOWED_PREVIEW_WORKER,
    '--no-provision',
    '--tag',
    commitSha,
  ]);
  assert.equal(
    result.deployCommand.some(part => part.includes('vinext-cloudflare')),
    false
  );
});

test('--execute deploys only the exact verified prebuilt artifact using the installed Cloudflare CLI without rebuilding', async t => {
  const fixture = await createPrebuiltArtifactFixture(t);
  const invocations = [];

  const result = await runPreviewDeployGate(
    makeBaseOptions(fixture, {
      execute: true,
      authorized: true,
      previewAccessConfigured: true,
      cloudflareTokenPresent: true,
    }),
    async payload => {
      invocations.push(payload);
    }
  );

  assert.equal(result.ok, true, result.reasons.join('; '));
  assert.equal(result.mode, 'authorized_execute');
  assert.equal(result.deployed, true);
  assert.equal(result.protectedPreviewVerified, true);
  assert.equal(invocations.length, 1);
  assert.equal(invocations[0].worker, ALLOWED_PREVIEW_WORKER);
  assert.equal(invocations[0].hostname, ALLOWED_PREVIEW_HOSTNAME);
  assert.equal(invocations[0].commitSha, commitSha);
  assert.equal(invocations[0].artifactDigest, result.artifactDigest);
  assert.equal(invocations[0].buildOutputRoot, fixture.root);
  assert.deepEqual(invocations[0].command.slice(2), [
    'deploy',
    '--prebuilt',
    '--mode',
    'production',
    '--worker',
    ALLOWED_PREVIEW_WORKER,
    '--no-provision',
    '--tag',
    commitSha,
  ]);
  assert.equal(
    invocations[0].command.some(part => part.includes('vinext-cloudflare')),
    false
  );
});

test('fails on stale or mismatched prebuilt artifacts (wrong SHA, missing SHA, wrong asset dir, loopback/prod bundle, digest drift)', async t => {
  const staleShaFixture = await createPrebuiltArtifactFixture(t, {
    healthSource: `export async function GET(){let t=\`${staleCommitSha}\`;return Response.json({service:\`trustfive-web\`,status:\`ok\`,commitSha:t});}`,
  });
  const staleShaDecision = await evaluatePreviewDeployGate(makeBaseOptions(staleShaFixture));
  assert.equal(staleShaDecision.ok, false);
  assert.equal(staleShaDecision.artifactVerified, false);
  assert.match(staleShaDecision.reasons.join('\n'), /stale or mismatched/i);

  const missingShaFixture = await createPrebuiltArtifactFixture(t, {
    healthSource: 'export async function GET(){let t="";return Response.json({service:"trustfive-web",status:"ok",commitSha:t});}',
  });
  const missingShaDecision = await evaluatePreviewDeployGate(makeBaseOptions(missingShaFixture));
  assert.equal(missingShaDecision.ok, false);
  assert.match(missingShaDecision.reasons.join('\n'), /missing an embedded 40-character TRUSTFIVE_BUILD_SHA/i);

  const missingHealthFixture = await createPrebuiltArtifactFixture(t, {healthSource: null});
  const missingHealthDecision = await evaluatePreviewDeployGate(makeBaseOptions(missingHealthFixture));
  assert.equal(missingHealthDecision.ok, false);
  assert.match(missingHealthDecision.reasons.join('\n'), /\/api\/health/i);

  const validFixture = await createPrebuiltArtifactFixture(t);
  const separateAssetDir = await mkdtemp(join(tmpdir(), 'trustfive-other-assets-'));
  t.after(() => rm(separateAssetDir, {recursive: true, force: true}));
  await mkdir(join(separateAssetDir, '_next', 'static'), {recursive: true});
  await writeFile(join(separateAssetDir, '_next', 'static', 'bundle.js'), `const url="${previewUrl}";`, 'utf8');
  const mismatchedAssetDirDecision = await evaluatePreviewDeployGate(
    makeBaseOptions(validFixture, {assetDirectory: separateAssetDir})
  );
  assert.equal(mismatchedAssetDirDecision.ok, false);
  assert.match(mismatchedAssetDirDecision.reasons.join('\n'), /must match the prebuilt Build Output assets directory/i);

  const loopbackBundleFixture = await createPrebuiltArtifactFixture(t, {
    readySource: 'export async function GET(){return fetch("http://127.0.0.1:54321/rest/v1/trades");}',
  });
  const loopbackDecision = await evaluatePreviewDeployGate(makeBaseOptions(loopbackBundleFixture));
  assert.equal(loopbackDecision.ok, false);
  assert.match(loopbackDecision.reasons.join('\n'), /loopback Supabase/i);

  const prodBundleFixture = await createPrebuiltArtifactFixture(t, {
    readySource: `export async function GET(){return fetch("${productionUrl}/rest/v1/trades");}`,
  });
  const prodBundleDecision = await evaluatePreviewDeployGate(makeBaseOptions(prodBundleFixture));
  assert.equal(prodBundleDecision.ok, false);
  assert.match(prodBundleDecision.reasons.join('\n'), /production Supabase project URL/i);

  const digestMismatchDecision = await evaluatePreviewDeployGate(
    makeBaseOptions(validFixture, {expectedArtifactDigest: 'f'.repeat(64)})
  );
  assert.equal(digestMismatchDecision.ok, false);
  assert.match(digestMismatchDecision.reasons.join('\n'), /digest does not match/i);

  const staleReviewDecision = await evaluatePreviewDeployGate(
    makeBaseOptions(validFixture, {
      reviewEvidence: {...passingReview, commitSha: staleCommitSha},
    })
  );
  assert.equal(staleReviewDecision.ok, false);
  assert.match(staleReviewDecision.reasons.join('\n'), /Review evidence commitSha/i);

  const multiVersionFixture = await createPrebuiltArtifactFixture(t, {extraVersionDir: 'v2'});
  const multiVersionDecision = await evaluatePreviewDeployGate(makeBaseOptions(multiVersionFixture));
  assert.equal(multiVersionDecision.ok, false);
  assert.match(multiVersionDecision.reasons.join('\n'), /strictly one "v1" directory/i);

  const emptyRoot = await mkdtemp(join(tmpdir(), 'trustfive-no-output-'));
  t.after(() => rm(emptyRoot, {recursive: true, force: true}));
  const missingOutputDecision = await evaluatePreviewDeployGate(
    makeBaseOptions(validFixture, {buildOutputRoot: emptyRoot, assetDirectory: undefined})
  );
  assert.equal(missingOutputDecision.ok, false);
  assert.match(missingOutputDecision.reasons.join('\n'), /Missing prebuilt Cloudflare Build Output/i);
});

test('fails on wrong generated Worker target, CI worker override, and unsafe bindings', async t => {
  for (const wrongName of ['', 'trustfive', 'trustfive-prod', 'trustfive-staging']) {
    const fixture = await createPrebuiltArtifactFixture(t, {
      workerConfig: makeValidWorkerConfig({name: wrongName}),
    });
    const decision = await evaluatePreviewDeployGate(makeBaseOptions(fixture));
    assert.equal(decision.ok, false);
    assert.equal(decision.workerConfigVerified, false);
    assert.match(decision.reasons.join('\n'), /worker\.config\.json target name must be "trustfive-preview"/);
  }

  const validFixture = await createPrebuiltArtifactFixture(t);
  for (const worker of ['', 'trustfive', 'trustfive-prod', 'trustfive-staging']) {
    const decision = await evaluatePreviewDeployGate(makeBaseOptions(validFixture, {destinationWorker: worker}));
    assert.equal(decision.ok, false);
    assert.match(decision.reasons.join('\n'), /trustfive-preview/);
  }
  for (const hostname of ['', 'https://trustfive.co.uk', 'https://trustfive-preview.example.workers.dev']) {
    const decision = await evaluatePreviewDeployGate(
      makeBaseOptions(validFixture, {destinationHostname: hostname})
    );
    assert.equal(decision.ok, false);
    assert.match(decision.reasons.join('\n'), /preview\.trustfive\.co\.uk/);
  }

  const ciOverrideDecision = await evaluatePreviewDeployGate(
    makeBaseOptions(validFixture, {ciOverrideWorkerName: 'trustfive'})
  );
  assert.equal(ciOverrideDecision.ok, false);
  assert.match(ciOverrideDecision.reasons.join('\n'), /CLOUDFLARE_CI_OVERRIDE_WORKER_NAME/);

  const extraWorkerFixture = await createPrebuiltArtifactFixture(t, {extraWorkerDir: 'prod'});
  const extraWorkerDecision = await evaluatePreviewDeployGate(makeBaseOptions(extraWorkerFixture));
  assert.equal(extraWorkerDecision.ok, false);
  assert.match(extraWorkerDecision.reasons.join('\n'), /single "default" Worker directory/);

  const containerFixture = await createPrebuiltArtifactFixture(t, {extraContainerDir: 'unexpected'});
  const containerDecision = await evaluatePreviewDeployGate(makeBaseOptions(containerFixture));
  assert.equal(containerDecision.ok, false);
  assert.match(containerDecision.reasons.join('\n'), /Containers/);

  const badBindingsCases = [
    {
      label: 'missing ASSETS binding',
      env: {},
      pattern: /bind ASSETS/,
    },
    {
      label: 'disallowed D1 binding',
      env: {ASSETS: {type: 'assets'}, DB: {type: 'd1', id: 'prod-db'}},
      pattern: /disallowed type "d1"/,
    },
    {
      label: 'disallowed service worker binding',
      env: {ASSETS: {type: 'assets'}, PROD_API: {type: 'worker', worker: 'trustfive'}},
      pattern: /disallowed type "worker"/,
    },
    {
      label: 'production Supabase URL in text binding',
      env: {
        ASSETS: {type: 'assets'},
        NEXT_PUBLIC_SUPABASE_URL: {type: 'text', value: productionUrl},
      },
      pattern: /production Supabase project/,
    },
    {
      label: 'foreign Supabase URL in text binding',
      env: {
        ASSETS: {type: 'assets'},
        NEXT_PUBLIC_SUPABASE_URL: {type: 'text', value: foreignUrl},
      },
      pattern: /unexpected Supabase origin/,
    },
    {
      label: 'live Stripe key in text binding',
      env: {
        ASSETS: {type: 'assets'},
        STRIPE_KEY: {type: 'text', value: 'sk_live_51FakeSecretValue12345'},
      },
      pattern: /live Stripe keys/,
    },
    {
      label: 'mismatched TRUSTFIVE_BUILD_SHA text binding',
      env: {
        ASSETS: {type: 'assets'},
        TRUSTFIVE_BUILD_SHA: {type: 'text', value: staleCommitSha},
      },
      pattern: /TRUSTFIVE_BUILD_SHA binding/,
    },
  ];

  for (const testCase of badBindingsCases) {
    const fixture = await createPrebuiltArtifactFixture(t, {
      workerConfig: makeValidWorkerConfig({env: testCase.env}),
    });
    const decision = await evaluatePreviewDeployGate(makeBaseOptions(fixture));
    assert.equal(decision.ok, false, `Expected failure for ${testCase.label}`);
    assert.match(decision.reasons.join('\n'), testCase.pattern);
  }

  const unsafeFixture = await createPrebuiltArtifactFixture(t, {
    workerConfig: makeValidWorkerConfig({unsafe: {metadata: {workers_dev: true}}}),
  });
  const unsafeDecision = await evaluatePreviewDeployGate(makeBaseOptions(unsafeFixture));
  assert.equal(unsafeDecision.ok, false);
  assert.match(unsafeDecision.reasons.join('\n'), /unsafe metadata/i);
});

test('fails on accidental public URL exposure (workersDev, previewUrls, domains, fetch triggers, preview build context)', async t => {
  const omittedWorkersDev = makeValidWorkerConfig();
  delete omittedWorkersDev.workersDev;

  const omittedPreviewUrls = makeValidWorkerConfig();
  delete omittedPreviewUrls.previewUrls;

  const omittedDomains = makeValidWorkerConfig();
  delete omittedDomains.domains;

  const exposureCases = [
    {
      label: 'workersDev enabled',
      workerConfig: makeValidWorkerConfig({workersDev: true}),
      pattern: /workersDev: false/,
    },
    {
      label: 'workersDev omitted (defaults to public workers.dev)',
      workerConfig: omittedWorkersDev,
      pattern: /workersDev: false/,
    },
    {
      label: 'previewUrls enabled',
      workerConfig: makeValidWorkerConfig({previewUrls: true}),
      pattern: /previewUrls: false/,
    },
    {
      label: 'previewUrls omitted',
      workerConfig: omittedPreviewUrls,
      pattern: /previewUrls: false/,
    },
    {
      label: 'domains omitted',
      workerConfig: omittedDomains,
      pattern: /exactly one protected custom domain/,
    },
    {
      label: 'production custom domain attached',
      workerConfig: makeValidWorkerConfig({domains: ['trustfive.co.uk']}),
      pattern: /custom domain must be "preview\.trustfive\.co\.uk"/,
    },
    {
      label: 'multiple domains attached',
      workerConfig: makeValidWorkerConfig({
        domains: ['preview.trustfive.co.uk', 'trustfive.co.uk'],
      }),
      pattern: /exactly one protected custom domain/,
    },
    {
      label: 'domain previews subdomains enabled',
      workerConfig: makeValidWorkerConfig({
        domains: [{hostname: ALLOWED_PREVIEW_DOMAIN, production: true, previews: true}],
      }),
      pattern: /previews: false/,
    },
    {
      label: 'fetch route trigger exposing public route',
      workerConfig: makeValidWorkerConfig({
        triggers: [{type: 'fetch', pattern: 'trustfive.co.uk/*', zone: 'trustfive.co.uk'}],
      }),
      pattern: /fetch route triggers/,
    },
    {
      label: 'local access.dev mock identity leaked into build',
      workerConfig: makeValidWorkerConfig({
        access: {dev: {aud: 'local-mock-aud'}},
      }),
      pattern: /access\.dev/,
    },
  ];

  for (const testCase of exposureCases) {
    const fixture = await createPrebuiltArtifactFixture(t, {
      workerConfig: testCase.workerConfig,
    });
    const decision = await evaluatePreviewDeployGate(makeBaseOptions(fixture));
    assert.equal(decision.ok, false, `Expected failure for ${testCase.label}`);
    assert.equal(decision.workerConfigVerified, false, `workerConfigVerified should be false for ${testCase.label}`);
    assert.match(decision.reasons.join('\n'), testCase.pattern);
  }

  const cfPreviewBuildFixture = await createPrebuiltArtifactFixture(t, {
    rootConfig: {
      producer: {name: '@cloudflare/vite-plugin', version: '2.0.0-rc.3'},
      buildContext: {isPreview: true, mode: 'production'},
    },
  });
  const cfPreviewBuildDecision = await evaluatePreviewDeployGate(makeBaseOptions(cfPreviewBuildFixture));
  assert.equal(cfPreviewBuildDecision.ok, false);
  assert.match(cfPreviewBuildDecision.reasons.join('\n'), /buildContext\.isPreview/);
});

test('blocks --execute without genuine protected-preview evidence and accepts valid Access redirect or 403 proof', async t => {
  const fixture = await createPrebuiltArtifactFixture(t);
  const executeBase = makeBaseOptions(fixture, {
    execute: true,
    authorized: true,
    previewAccessConfigured: true,
    cloudflareTokenPresent: true,
  });

  // Missing protected-preview evidence even when Access env vars are present
  const missingEvidence = await runPreviewDeployGate({...executeBase, protectedPreviewEvidence: null}, async () => {
    throw new Error('Must not deploy without genuine protected-preview evidence');
  });
  assert.equal(missingEvidence.ok, false);
  assert.equal(missingEvidence.deployed, false);
  assert.equal(missingEvidence.protectedPreviewVerified, false);
  assert.match(missingEvidence.reasons.join('\n'), /Genuine protected-preview evidence/i);

  const badEvidenceCases = [
    {
      label: 'public 200 OK anonymous response',
      evidence: {
        ...genuineProtectedPreviewEvidence,
        anonymousProbe: {url: `${ALLOWED_PREVIEW_HOSTNAME}/api/health`, status: 200},
      },
      pattern: /anonymous access is denied/i,
    },
    {
      label: 'redirect to non-Cloudflare Access domain',
      evidence: {
        ...genuineProtectedPreviewEvidence,
        anonymousProbe: {
          url: `${ALLOWED_PREVIEW_HOSTNAME}/api/health`,
          status: 302,
          location: 'https://example.com/login',
        },
      },
      pattern: /cloudflareaccess\.com/,
    },
    {
      label: 'insecure HTTP redirect to cloudflareaccess.com',
      evidence: {
        ...genuineProtectedPreviewEvidence,
        anonymousProbe: {
          url: `${ALLOWED_PREVIEW_HOSTNAME}/api/health`,
          status: 302,
          location: 'http://team.cloudflareaccess.com/login',
        },
      },
      pattern: /cloudflareaccess\.com/,
    },
    {
      label: 'probe against wrong origin',
      evidence: {
        ...genuineProtectedPreviewEvidence,
        anonymousProbe: {url: 'https://trustfive.co.uk/api/health', status: 403},
      },
      pattern: /anonymousProbe\.url must target/,
    },
    {
      label: 'alternate URLs not confirmed disabled',
      evidence: {
        ...genuineProtectedPreviewEvidence,
        alternateUrlsDisabled: false,
      },
      pattern: /alternate workers\.dev and preview URLs are disabled/i,
    },
    {
      label: 'stale protected-preview evidence (>24h old)',
      evidence: {
        ...genuineProtectedPreviewEvidence,
        verifiedAt: '2026-11-22T18:00:00.000Z',
      },
      pattern: /stale/i,
    },
    {
      label: 'mismatched candidateCommitSha in protected-preview evidence',
      evidence: {
        ...genuineProtectedPreviewEvidence,
        candidateCommitSha: staleCommitSha,
      },
      pattern: /candidateCommitSha/,
    },
    {
      label: 'unscoped Access policy hostname',
      evidence: {
        ...genuineProtectedPreviewEvidence,
        accessPolicy: {
          applicationHostname: 'trustfive.co.uk',
          applicationId: 'access-app-prod',
          serviceTokenAuthorized: true,
        },
      },
      pattern: /accessPolicy\.applicationHostname/,
    },
    {
      label: 'service token not authorized',
      evidence: {
        ...genuineProtectedPreviewEvidence,
        accessPolicy: {
          ...genuineProtectedPreviewEvidence.accessPolicy,
          serviceTokenAuthorized: false,
        },
      },
      pattern: /service token authorization/i,
    },
    {
      label: 'embedded secret field inside evidence JSON',
      evidence: {
        ...genuineProtectedPreviewEvidence,
        clientSecret: 'must-never-be-in-evidence',
      },
      pattern: /must not include credentials, tokens, or secrets/i,
    },
  ];

  for (const testCase of badEvidenceCases) {
    const decision = await evaluatePreviewDeployGate({
      ...executeBase,
      protectedPreviewEvidence: testCase.evidence,
    });
    assert.equal(decision.ok, false, `Expected failure for ${testCase.label}`);
    assert.equal(decision.protectedPreviewVerified, false);
    assert.match(decision.reasons.join('\n'), testCase.pattern);
  }

  // Valid HTTPS *.cloudflareaccess.com redirect proof is accepted
  const redirectReasons = validateProtectedPreviewEvidence(
    {
      ...genuineProtectedPreviewEvidence,
      anonymousProbe: {
        url: `${ALLOWED_PREVIEW_HOSTNAME}/api/health`,
        status: 302,
        location: 'https://trustfive.cloudflareaccess.com/cdn-cgi/access/login/preview.trustfive.co.uk',
      },
    },
    {expectedCommitSha: commitSha, now: fixedNow}
  );
  assert.deepEqual(redirectReasons, []);
});

test('blocks raw model output, dirty trees, failed evidence, shared Supabase projects and never echoes secrets in CLI', async t => {
  const fixture = await createPrebuiltArtifactFixture(t);
  const base = makeBaseOptions(fixture);

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

  const leakedProdFixture = await createPrebuiltArtifactFixture(t, {
    assetSource: `const url="${productionUrl}/rest/v1";`,
  });
  const badAssets = await evaluatePreviewDeployGate(makeBaseOptions(leakedProdFixture));
  assert.equal(badAssets.ok, false);
  assert.equal(badAssets.isolationVerified, false);

  const entry = fileURLToPath(new URL('../../scripts/release/deploy-preview-gate.mjs', import.meta.url));
  const cli = spawnSync(
    process.execPath,
    [
      entry,
      '--dry-run',
      '--worker',
      'trustfive',
      '--hostname',
      'https://trustfive.co.uk',
      '--source-kind',
      'raw_model_output',
      '--build-output-root',
      fixture.root,
      '--assets',
      fixture.assetsDir,
    ],
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

test('verifies digest changes immediately if prebuilt artifact is modified on disk', async t => {
  const fixture = await createPrebuiltArtifactFixture(t);
  const first = await verifyPrebuiltWorkerArtifact({
    buildOutputRoot: fixture.root,
    assetDirectory: fixture.assetsDir,
    expectedCommitSha: commitSha,
    previewSupabaseUrl: previewUrl,
    productionSupabaseUrl: productionUrl,
    workerRuntimeSupabaseUrl: previewUrl,
  });
  assert.equal(first.ok, true);
  assert.ok(first.artifactDigest);

  await writeFile(join(fixture.bundleDir, 'index.mjs'), 'export default { fetch() { return new Response("tampered"); } };', 'utf8');

  const second = await verifyPrebuiltWorkerArtifact({
    buildOutputRoot: fixture.root,
    assetDirectory: fixture.assetsDir,
    expectedCommitSha: commitSha,
    expectedArtifactDigest: first.artifactDigest,
    previewSupabaseUrl: previewUrl,
    productionSupabaseUrl: productionUrl,
    workerRuntimeSupabaseUrl: previewUrl,
  });
  assert.equal(second.ok, false);
  assert.notEqual(second.artifactDigest, first.artifactDigest);
  assert.match(second.reasons.join('\n'), /digest does not match/i);

  let deployCalled = false;
  const blockedExecute = await runPreviewDeployGate(
    makeBaseOptions(fixture, {
      expectedArtifactDigest: first.artifactDigest,
      execute: true,
      authorized: true,
      previewAccessConfigured: true,
      cloudflareTokenPresent: true,
    }),
    async () => {
      deployCalled = true;
    }
  );
  assert.equal(blockedExecute.ok, false);
  assert.equal(blockedExecute.deployed, false);
  assert.equal(deployCalled, false);
  assert.match(blockedExecute.reasons.join('\n'), /digest does not match/i);

  const reviewFile = join(fixture.root, 'review.json');
  await writeFile(reviewFile, JSON.stringify(passingReview), 'utf8');
  const entry = fileURLToPath(new URL('../../scripts/release/deploy-preview-gate.mjs', import.meta.url));
  const cliExecuteWithoutProtectedEvidence = spawnSync(
    process.execPath,
    [
      entry,
      '--execute',
      '--worker',
      ALLOWED_PREVIEW_WORKER,
      '--hostname',
      ALLOWED_PREVIEW_HOSTNAME,
      '--source-kind',
      ALLOWED_SOURCE_KIND,
      '--commit',
      commitSha,
      '--build-output-root',
      fixture.root,
      '--evidence',
      reviewFile,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        TRUSTFIVE_AUTHORIZED_PREVIEW_DEPLOY: '1',
        PREVIEW_SUPABASE_URL: previewUrl,
        PRODUCTION_SUPABASE_URL: productionUrl,
        WORKER_RUNTIME_SUPABASE_URL: previewUrl,
        CLOUDFLARE_API_TOKEN: 'cf-execute-secret-should-not-leak',
        CF_ACCESS_CLIENT_ID: 'access-id-fixture',
        CF_ACCESS_CLIENT_SECRET: 'access-execute-secret-should-not-leak',
      },
    }
  );
  assert.equal(cliExecuteWithoutProtectedEvidence.status, 1);
  assert.match(cliExecuteWithoutProtectedEvidence.stdout, /Genuine protected-preview evidence/i);
  assert.doesNotMatch(
    cliExecuteWithoutProtectedEvidence.stdout + cliExecuteWithoutProtectedEvidence.stderr,
    /cf-execute-secret-should-not-leak|access-execute-secret-should-not-leak/
  );
});
