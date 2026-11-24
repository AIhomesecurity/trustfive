import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {checkPreviewIsolation} from './check-preview-isolation.mjs';

export const ALLOWED_PREVIEW_WORKER = 'trustfive-preview';
export const ALLOWED_PREVIEW_HOSTNAME = 'https://preview.trustfive.co.uk';
export const ALLOWED_SOURCE_KIND = 'reviewed_commit';

const FULL_SHA_RE = /^[a-f0-9]{40}$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeHostname(value) {
  if (!isNonEmptyString(value)) return '';
  return value.trim().replace(/\/+$/, '');
}

export function validateReviewEvidence(reviewEvidence) {
  if (!reviewEvidence || typeof reviewEvidence !== 'object' || Array.isArray(reviewEvidence)) {
    return 'Missing reviewed passing test evidence record';
  }
  if (!isNonEmptyString(reviewEvidence.reviewedBy)) {
    return 'Review evidence must name an independent reviewer';
  }
  if (reviewEvidence.testsPassed !== true) {
    return 'Review evidence must confirm application and browser tests passed';
  }
  if (reviewEvidence.databaseReplayPassed !== true) {
    return 'Review evidence must confirm disposable database replay passed';
  }
  if (reviewEvidence.ciStatus !== 'passed') {
    return 'Review evidence must confirm exact-head CI status is "passed"';
  }
  return null;
}

export async function evaluatePreviewDeployGate(options) {
  const {
    destinationWorker,
    destinationHostname,
    sourceKind,
    commitSha,
    buildSha = commitSha,
    workingTreeClean,
    reviewEvidence,
    previewSupabaseUrl,
    productionSupabaseUrl,
    workerRuntimeSupabaseUrl,
    assetDirectory,
    execute = false,
    authorized = false,
    previewAccessConfigured = false,
    cloudflareTokenPresent = false,
  } = options ?? {};

  const reasons = [];
  const worker = isNonEmptyString(destinationWorker) ? destinationWorker.trim() : '';
  const hostname = normalizeHostname(destinationHostname);

  if (worker !== ALLOWED_PREVIEW_WORKER) {
    reasons.push(
      `Destination Worker must explicitly be "${ALLOWED_PREVIEW_WORKER}" (production or unspecified Workers are blocked).`
    );
  }

  if (hostname !== ALLOWED_PREVIEW_HOSTNAME) {
    reasons.push(
      `Destination hostname must explicitly be "${ALLOWED_PREVIEW_HOSTNAME}" (production, workers.dev, or unspecified hosts are blocked).`
    );
  }

  if (sourceKind !== ALLOWED_SOURCE_KIND) {
    reasons.push(
      `Deployment source must be "${ALLOWED_SOURCE_KIND}"; raw model output or unreviewed patches cannot be deployed.`
    );
  }

  if (!FULL_SHA_RE.test(commitSha ?? '')) {
    reasons.push('Candidate commit SHA must be a full 40-character lowercase Git SHA.');
  } else if (buildSha !== commitSha) {
    reasons.push('Embedded TRUSTFIVE_BUILD_SHA must exactly match the candidate commit SHA.');
  }

  if (workingTreeClean !== true) {
    reasons.push('Working tree must be clean before preview deployment.');
  }

  const evidenceError = validateReviewEvidence(reviewEvidence);
  if (evidenceError) {
    reasons.push(evidenceError);
  }

  let isolationVerified = false;
  if (assetDirectory) {
    try {
      await checkPreviewIsolation({
        previewUrl: previewSupabaseUrl,
        productionUrl: productionSupabaseUrl,
        runtimeUrl: workerRuntimeSupabaseUrl,
        assetDirectory,
      });
      isolationVerified = true;
    } catch (error) {
      reasons.push(error instanceof Error ? error.message : 'Preview database isolation check failed.');
    }
  } else {
    reasons.push('Browser asset directory is required to verify isolated preview Supabase bindings.');
  }

  if (execute) {
    if (authorized !== true) {
      reasons.push('Live preview deployment requires explicit TRUSTFIVE_AUTHORIZED_PREVIEW_DEPLOY=1 authorization.');
    }
    if (previewAccessConfigured !== true) {
      reasons.push('Protected preview Cloudflare Access verification credentials must be configured before deployment.');
    }
    if (cloudflareTokenPresent !== true) {
      reasons.push('Cloudflare preview deployment token is not configured.');
    }
  }

  const ok = reasons.length === 0;
  return {
    ok,
    mode: ok ? (execute ? 'authorized_execute' : 'dry_run_passed') : 'blocked',
    destinationWorker: worker || null,
    destinationHostname: hostname || null,
    commitSha: FULL_SHA_RE.test(commitSha ?? '') ? commitSha : null,
    sourceKind: isNonEmptyString(sourceKind) ? sourceKind.trim() : null,
    isolationVerified,
    deployCommand:
      ok
        ? ['npx', 'vinext-cloudflare', 'deploy', '--name', ALLOWED_PREVIEW_WORKER]
        : null,
    reasons,
  };
}

export async function runPreviewDeployGate(options, execDeploy) {
  const decision = await evaluatePreviewDeployGate(options);
  if (!decision.ok) {
    return {...decision, deployed: false};
  }
  if (!options.execute) {
    return {...decision, deployed: false};
  }
  if (typeof execDeploy !== 'function') {
    throw new Error('Authorized deployment executor is required for --execute mode');
  }
  await execDeploy({
    worker: ALLOWED_PREVIEW_WORKER,
    hostname: ALLOWED_PREVIEW_HOSTNAME,
    commitSha: decision.commitSha,
    command: decision.deployCommand,
  });
  return {...decision, deployed: true};
}

function parseCliArgs(argv) {
  const parsed = {
    worker: process.env.TRUSTFIVE_PREVIEW_WORKER || '',
    hostname: process.env.TRUSTFIVE_PREVIEW_HOSTNAME || '',
    sourceKind: process.env.TRUSTFIVE_DEPLOY_SOURCE_KIND || '',
    commitSha: process.env.TRUSTFIVE_BUILD_SHA || '',
    assetDirectory: process.env.TRUSTFIVE_PREVIEW_ASSETS_DIR || '.cloudflare/output/v1/workers/default/assets',
    evidenceFile: process.env.TRUSTFIVE_REVIEW_EVIDENCE_FILE || '',
    execute: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') parsed.execute = false;
    else if (arg === '--execute') parsed.execute = true;
    else if (arg === '--worker' && argv[i + 1]) parsed.worker = argv[++i];
    else if (arg === '--hostname' && argv[i + 1]) parsed.hostname = argv[++i];
    else if (arg === '--source-kind' && argv[i + 1]) parsed.sourceKind = argv[++i];
    else if (arg === '--commit' && argv[i + 1]) parsed.commitSha = argv[++i];
    else if (arg === '--assets' && argv[i + 1]) parsed.assetDirectory = argv[++i];
    else if (arg === '--evidence' && argv[i + 1]) parsed.evidenceFile = argv[++i];
    else throw new Error(`Unknown or incomplete flag: ${arg}`);
  }
  return parsed;
}

function readGitState() {
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
    const porcelain = execFileSync('git', ['status', '--porcelain'], {encoding: 'utf8'}).trim();
    return {head, workingTreeClean: porcelain.length === 0};
  } catch {
    return {head: '', workingTreeClean: false};
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const cli = parseCliArgs(process.argv.slice(2));
    const git = readGitState();
    let reviewEvidence = null;
    if (cli.evidenceFile) {
      reviewEvidence = JSON.parse(readFileSync(cli.evidenceFile, 'utf8'));
    }

    const result = await runPreviewDeployGate(
      {
        destinationWorker: cli.worker,
        destinationHostname: cli.hostname,
        sourceKind: cli.sourceKind,
        commitSha: cli.commitSha || git.head,
        buildSha: process.env.TRUSTFIVE_BUILD_SHA || cli.commitSha || git.head,
        workingTreeClean: git.workingTreeClean,
        reviewEvidence,
        previewSupabaseUrl: process.env.PREVIEW_SUPABASE_URL,
        productionSupabaseUrl: process.env.PRODUCTION_SUPABASE_URL,
        workerRuntimeSupabaseUrl: process.env.WORKER_RUNTIME_SUPABASE_URL,
        assetDirectory: cli.assetDirectory,
        execute: cli.execute,
        authorized: process.env.TRUSTFIVE_AUTHORIZED_PREVIEW_DEPLOY === '1',
        previewAccessConfigured: Boolean(
          process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET
        ),
        cloudflareTokenPresent: Boolean(process.env.CLOUDFLARE_API_TOKEN),
      },
      async ({worker, commitSha}) => {
        execFileSync('npx', ['vinext-cloudflare', 'deploy'], {
          stdio: 'inherit',
          env: {
            ...process.env,
            TRUSTFIVE_CLOUDFLARE_WORKER: worker,
            TRUSTFIVE_BUILD_SHA: commitSha,
          },
        });
      }
    );

    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Preview deploy gate failed');
    process.exitCode = 1;
  }
}
