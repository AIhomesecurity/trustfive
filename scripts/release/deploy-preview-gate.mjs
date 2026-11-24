import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {lstat, readdir, readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkPreviewIsolation} from './check-preview-isolation.mjs';

export const ALLOWED_PREVIEW_WORKER = 'trustfive-preview';
export const ALLOWED_PREVIEW_HOSTNAME = 'https://preview.trustfive.co.uk';
export const ALLOWED_PREVIEW_DOMAIN = 'preview.trustfive.co.uk';
export const ALLOWED_SOURCE_KIND = 'reviewed_commit';
export const DEFAULT_PROTECTED_PREVIEW_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const FULL_SHA_RE = /^[a-f0-9]{40}$/;
const COMPAT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUPABASE_ORIGIN_RE = /https?:\/\/[a-z]{20}\.supabase\.co(?![a-z0-9.%-])/gi;
const LOCAL_SUPABASE_RE = /https?:\/\/(?:127\.0\.0\.1|localhost):54321(?![0-9])/i;
const LIVE_STRIPE_OR_SECRET_RE = /\b(?:sk_live_|pk_live_|rk_live_|whsec_)[A-Za-z0-9_]+/;
const HEALTH_SHA_LITERAL_RE = /['"`]([a-f0-9]{40})['"`]/g;
const ALLOWED_ENV_BINDING_TYPES = new Set(['assets', 'text', 'secret', 'version-metadata']);
const FORBIDDEN_EVIDENCE_KEYS = new Set([
  'clientsecret',
  'cfaccessclientsecret',
  'apitoken',
  'cloudflareapitoken',
  'secret',
  'token',
  'password',
  'authorization',
]);
const SECRET_LIKE_BINDING_NAME_RE = /(?:^|_)(SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL|PRIVATE)(?:_|$)/i;
const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeHostname(value) {
  if (!isNonEmptyString(value)) return '';
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

function normalizeSupabaseOrigin(value) {
  if (!isNonEmptyString(value)) return '';
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

function resolveInside(baseDir, relativePath) {
  const base = resolve(baseDir);
  const candidate = resolve(base, relativePath);
  if (candidate === base || !candidate.startsWith(base + sep)) {
    return null;
  }
  return candidate;
}

async function readJsonFile(filePath, label) {
  let raw;
  try {
    const stats = await lstat(filePath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`${label} must be a regular file.`);
    }
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && error.message.endsWith('must be a regular file.')) {
      throw error;
    }
    throw new Error(`Missing prebuilt ${label}.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Prebuilt ${label} is not valid JSON.`);
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`Prebuilt ${label} must be a JSON object.`);
  }
  return {parsed, raw};
}

async function collectRegularFiles(directory, files = []) {
  const entries = await readdir(directory, {withFileTypes: true});
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    const stats = await lstat(fullPath);
    if (stats.isSymbolicLink()) {
      throw new Error(`Prebuilt artifact must not contain symlinks: ${entry.name}`);
    }
    if (stats.isDirectory()) {
      await collectRegularFiles(fullPath, files);
    } else if (stats.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function computeArtifactDigest({v1Dir, configJsonPath, workerConfigPath, bundleDir, assetsDir}) {
  const hash = createHash('sha256');
  const allFiles = [
    configJsonPath,
    workerConfigPath,
    ...(await collectRegularFiles(bundleDir)),
    ...(await collectRegularFiles(assetsDir)),
  ];
  const uniqueSorted = [...new Set(allFiles.map(file => resolve(file)))].sort((a, b) => a.localeCompare(b));
  for (const file of uniqueSorted) {
    const rel = relative(v1Dir, file).split(sep).join('/');
    const fileHash = createHash('sha256').update(await readFile(file)).digest('hex');
    hash.update(`${rel}:${fileHash}\n`);
  }
  return hash.digest('hex');
}

function hasForbiddenSecretKeys(value) {
  if (!isPlainObject(value)) return false;
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (FORBIDDEN_EVIDENCE_KEYS.has(normalized)) return true;
    if (isPlainObject(nested) && hasForbiddenSecretKeys(nested)) return true;
    if (Array.isArray(nested) && nested.some(item => hasForbiddenSecretKeys(item))) return true;
  }
  return false;
}

export function resolveCloudflareCliBin(root = process.cwd()) {
  const candidates = [join(resolve(root), 'package.json'), import.meta.url];
  for (const anchor of candidates) {
    try {
      const req = createRequire(anchor);
      const packageJsonPath = req.resolve('cf/package.json');
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.cf;
      if (isNonEmptyString(bin)) {
        return resolve(dirname(packageJsonPath), bin);
      }
    } catch {
      // Try next resolution anchor.
    }
  }
  throw new Error('Installed Cloudflare CLI package ("cf") could not be resolved.');
}

export function buildPrebuiltCloudflareDeployCommand({
  cfBinPath,
  worker = ALLOWED_PREVIEW_WORKER,
  commitSha,
  nodeExecutable = process.execPath,
}) {
  if (!isNonEmptyString(cfBinPath)) {
    throw new Error('Cloudflare CLI binary path is required.');
  }
  if (worker !== ALLOWED_PREVIEW_WORKER) {
    throw new Error(`Only "${ALLOWED_PREVIEW_WORKER}" may be deployed via the preview gate.`);
  }
  if (!FULL_SHA_RE.test(commitSha ?? '')) {
    throw new Error('Candidate commit SHA must be a full 40-character lowercase Git SHA.');
  }
  return [
    nodeExecutable,
    cfBinPath,
    'deploy',
    '--prebuilt',
    '--mode',
    'production',
    '--worker',
    worker,
    '--no-provision',
    '--tag',
    commitSha,
  ];
}

export function validateReviewEvidence(reviewEvidence, expectedCommitSha) {
  if (!isPlainObject(reviewEvidence)) {
    return 'Missing reviewed passing test evidence record';
  }
  if (hasForbiddenSecretKeys(reviewEvidence)) {
    return 'Review evidence must not contain secret or token fields';
  }
  if (!isNonEmptyString(reviewEvidence.reviewedBy)) {
    return 'Review evidence must name an independent reviewer';
  }
  if (FULL_SHA_RE.test(expectedCommitSha ?? '')) {
    if (!FULL_SHA_RE.test(reviewEvidence.commitSha ?? '') || reviewEvidence.commitSha !== expectedCommitSha) {
      return 'Review evidence commitSha must exactly match the candidate commit SHA';
    }
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

export function validateProtectedPreviewEvidence(
  evidence,
  {
    expectedWorker = ALLOWED_PREVIEW_WORKER,
    expectedHostname = ALLOWED_PREVIEW_HOSTNAME,
    expectedDomain = ALLOWED_PREVIEW_DOMAIN,
    expectedCommitSha,
    now = Date.now(),
    maxAgeMs = DEFAULT_PROTECTED_PREVIEW_MAX_AGE_MS,
  } = {}
) {
  const reasons = [];

  if (!isPlainObject(evidence)) {
    return ['Genuine protected-preview evidence record is required before --execute.'];
  }

  if (hasForbiddenSecretKeys(evidence)) {
    reasons.push('Protected-preview evidence must not include credentials, tokens, or secrets.');
  }

  if (evidence.worker !== expectedWorker) {
    reasons.push(`Protected-preview evidence worker must be "${expectedWorker}".`);
  }

  if (normalizeHostname(evidence.hostname) !== normalizeHostname(expectedHostname)) {
    reasons.push(`Protected-preview evidence hostname must be "${expectedHostname}".`);
  }

  if (
    !FULL_SHA_RE.test(evidence.candidateCommitSha ?? '') ||
    (FULL_SHA_RE.test(expectedCommitSha ?? '') && evidence.candidateCommitSha !== expectedCommitSha)
  ) {
    reasons.push('Protected-preview evidence candidateCommitSha must match the candidate commit SHA.');
  }

  if (!isNonEmptyString(evidence.verifiedBy)) {
    reasons.push('Protected-preview evidence must record who/what verified Cloudflare Access protection.');
  }

  const verifiedAtMs = isNonEmptyString(evidence.verifiedAt) ? Date.parse(evidence.verifiedAt) : Number.NaN;
  if (!Number.isFinite(verifiedAtMs)) {
    reasons.push('Protected-preview evidence must include a valid ISO-8601 verifiedAt timestamp.');
  } else {
    if (verifiedAtMs > now + FUTURE_CLOCK_SKEW_MS) {
      reasons.push('Protected-preview evidence verifiedAt timestamp cannot be in the future.');
    }
    if (now - verifiedAtMs > maxAgeMs) {
      reasons.push('Protected-preview evidence is stale and must be re-verified before --execute.');
    }
  }

  const probe = evidence.anonymousProbe;
  if (!isPlainObject(probe)) {
    reasons.push('Protected-preview evidence must include anonymousProbe proof of Cloudflare Access denial.');
  } else {
    let parsedUrl = null;
    try {
      parsedUrl = new URL(probe.url);
    } catch {
      parsedUrl = null;
    }
    if (!parsedUrl || parsedUrl.origin.toLowerCase() !== normalizeHostname(expectedHostname)) {
      reasons.push(`Protected-preview anonymousProbe.url must target "${expectedHostname}".`);
    }

    const status = probe.status;
    if (status === 403) {
      // Explicit Access denial.
    } else if (Number.isInteger(status) && status >= 300 && status < 400) {
      let redirect = null;
      try {
        redirect = new URL(probe.location);
      } catch {
        redirect = null;
      }
      if (
        !redirect ||
        redirect.protocol !== 'https:' ||
        !redirect.hostname.toLowerCase().endsWith('.cloudflareaccess.com')
      ) {
        reasons.push(
          'Protected-preview anonymousProbe 3xx redirect must point to an HTTPS *.cloudflareaccess.com login URL.'
        );
      }
    } else {
      reasons.push(
        'Protected-preview anonymousProbe must prove anonymous access is denied (HTTP 403 or HTTPS *.cloudflareaccess.com redirect).'
      );
    }
  }

  const policy = evidence.accessPolicy;
  if (!isPlainObject(policy)) {
    reasons.push('Protected-preview evidence must include Cloudflare Access accessPolicy proof.');
  } else {
    if (normalizeHostname(policy.applicationHostname) !== expectedDomain.toLowerCase()) {
      reasons.push(`Protected-preview accessPolicy.applicationHostname must be "${expectedDomain}".`);
    }
    if (!isNonEmptyString(policy.applicationId)) {
      reasons.push('Protected-preview accessPolicy.applicationId must be recorded.');
    }
    if (policy.serviceTokenAuthorized !== true) {
      reasons.push('Protected-preview accessPolicy must confirm scoped service token authorization.');
    }
  }

  if (evidence.alternateUrlsDisabled !== true) {
    reasons.push('Protected-preview evidence must confirm alternate workers.dev and preview URLs are disabled.');
  }

  return reasons;
}

export async function verifyPrebuiltWorkerArtifact({
  buildOutputRoot,
  assetDirectory,
  expectedWorker = ALLOWED_PREVIEW_WORKER,
  expectedDomain = ALLOWED_PREVIEW_DOMAIN,
  expectedCommitSha,
  expectedArtifactDigest,
  previewSupabaseUrl,
  productionSupabaseUrl,
  workerRuntimeSupabaseUrl,
}) {
  const reasons = [];
  const rootDir = resolve(buildOutputRoot ?? process.cwd());
  const outputRoot = join(rootDir, '.cloudflare', 'output');

  let versionEntries;
  try {
    versionEntries = await readdir(outputRoot, {withFileTypes: true});
  } catch {
    return {
      ok: false,
      isolationVerified: false,
      workerConfigVerified: false,
      artifactDigest: null,
      embeddedCommitShas: [],
      workerConfigPath: null,
      assetsDir: null,
      bundleDir: null,
      reasons: ['Missing prebuilt Cloudflare Build Output directory (.cloudflare/output/v1). Run npm run build:vinext first.'],
    };
  }

  const versionNames = versionEntries.map(entry => entry.name);
  if (versionNames.length !== 1 || versionNames[0] !== 'v1' || !versionEntries[0].isDirectory()) {
    reasons.push('Prebuilt .cloudflare/output must contain strictly one "v1" directory.');
    return {
      ok: false,
      isolationVerified: false,
      workerConfigVerified: false,
      artifactDigest: null,
      embeddedCommitShas: [],
      workerConfigPath: null,
      assetsDir: null,
      bundleDir: null,
      reasons,
    };
  }

  const v1Dir = join(outputRoot, 'v1');
  const configJsonPath = join(v1Dir, 'config.json');
  const workersDir = join(v1Dir, 'workers');
  const defaultWorkerDir = join(workersDir, 'default');
  const workerConfigPath = join(defaultWorkerDir, 'worker.config.json');
  const bundleDir = join(defaultWorkerDir, 'bundle');
  const assetsDir = join(defaultWorkerDir, 'assets');
  const containersDir = join(v1Dir, 'containers');

  // 1. Validate root config.json
  try {
    const {parsed: rootConfig} = await readJsonFile(configJsonPath, 'config.json');
    const buildContext = rootConfig.buildContext;
    if (!isPlainObject(buildContext)) {
      reasons.push('Prebuilt config.json is missing buildContext metadata.');
    } else {
      if (buildContext.isPreview !== false) {
        reasons.push(
          'Prebuilt config.json has buildContext.isPreview enabled; Cloudflare Preview builds can expose public preview URLs and are blocked.'
        );
      }
      if (buildContext.mode !== 'production') {
        reasons.push(`Prebuilt config.json buildContext.mode must be "production" (got "${buildContext.mode ?? ''}").`);
      }
    }
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : 'Unable to read prebuilt config.json.');
  }

  // 2. Reject unexpected containers or extra workers
  try {
    const containerEntries = await readdir(containersDir);
    if (containerEntries.length > 0) {
      reasons.push('Prebuilt output must not contain undeclared Cloudflare Containers.');
    }
  } catch {
    // Absence of containers/ is expected.
  }

  try {
    const workerEntries = await readdir(workersDir, {withFileTypes: true});
    const workerDirs = workerEntries.filter(entry => entry.isDirectory()).map(entry => entry.name);
    if (workerDirs.length !== 1 || workerDirs[0] !== 'default') {
      reasons.push('Prebuilt output must contain strictly the single "default" Worker directory.');
    }
  } catch {
    reasons.push('Missing prebuilt .cloudflare/output/v1/workers/default directory.');
  }

  // 3. Validate generated worker.config.json (target, bindings, URL exposure)
  let workerConfig = null;
  let workerConfigVerified = false;
  try {
    const {parsed} = await readJsonFile(workerConfigPath, 'worker.config.json');
    workerConfig = parsed;
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : 'Unable to read prebuilt worker.config.json.');
  }

  const configReasonsStart = reasons.length;
  const normalizedPreviewSupabase = normalizeSupabaseOrigin(previewSupabaseUrl);
  const normalizedProductionSupabase = normalizeSupabaseOrigin(productionSupabaseUrl);

  if (workerConfig) {
    // Target checks
    if (workerConfig.name !== expectedWorker) {
      reasons.push(
        `Generated worker.config.json target name must be "${expectedWorker}" (got "${workerConfig.name ?? ''}").`
      );
    }

    if (!isNonEmptyString(workerConfig.compatibilityDate) || !COMPAT_DATE_RE.test(workerConfig.compatibilityDate)) {
      reasons.push('Generated worker.config.json must specify a valid YYYY-MM-DD compatibilityDate.');
    }

    // URL exposure checks (fail closed on omitted or enabled public URLs)
    if (workerConfig.workersDev !== false) {
      reasons.push(
        'Generated worker.config.json must explicitly set workersDev: false to prevent public *.workers.dev URL exposure.'
      );
    }

    if (workerConfig.previewUrls !== false) {
      reasons.push(
        'Generated worker.config.json must explicitly set previewUrls: false to prevent public Worker preview URL exposure.'
      );
    }

    if (!Array.isArray(workerConfig.domains) || workerConfig.domains.length !== 1) {
      reasons.push(
        `Generated worker.config.json must declare exactly one protected custom domain ("${expectedDomain}").`
      );
    } else {
      const domainEntry = workerConfig.domains[0];
      if (typeof domainEntry === 'string') {
        if (normalizeHostname(domainEntry) !== expectedDomain.toLowerCase()) {
          reasons.push(
            `Generated worker.config.json custom domain must be "${expectedDomain}" (got "${domainEntry}").`
          );
        }
      } else if (isPlainObject(domainEntry)) {
        if (normalizeHostname(domainEntry.hostname) !== expectedDomain.toLowerCase()) {
          reasons.push(
            `Generated worker.config.json custom domain hostname must be "${expectedDomain}" (got "${domainEntry.hostname ?? ''}").`
          );
        }
        if (domainEntry.production !== true) {
          reasons.push('Generated worker.config.json custom domain must enable traffic on the protected preview hostname.');
        }
        if (domainEntry.previews !== false) {
          reasons.push(
            'Generated worker.config.json custom domain must set previews: false to prevent public preview subdomain exposure.'
          );
        }
      } else {
        reasons.push('Generated worker.config.json domains entry is invalid.');
      }
    }

    if (Array.isArray(workerConfig.triggers)) {
      const fetchTriggers = workerConfig.triggers.filter(trigger => isPlainObject(trigger) && trigger.type === 'fetch');
      if (fetchTriggers.length > 0) {
        reasons.push(
          'Generated worker.config.json must not declare fetch route triggers that can expose alternate public URLs.'
        );
      }
    }

    if (isPlainObject(workerConfig.access) && workerConfig.access.dev !== undefined) {
      reasons.push('Generated worker.config.json must not include local access.dev mock identity configuration.');
    }

    if (workerConfig.unsafe !== undefined) {
      reasons.push('Generated worker.config.json must not declare unsafe metadata or binding overrides.');
    }

    if (Array.isArray(workerConfig.tailConsumers) && workerConfig.tailConsumers.length > 0) {
      reasons.push('Generated worker.config.json must not attach undeclared tailConsumers.');
    }

    if (isPlainObject(workerConfig.exports) && Object.keys(workerConfig.exports).length > 0) {
      reasons.push('Generated worker.config.json must not declare unexpected Worker/Durable Object/Workflow exports.');
    }

    // Assets & bindings checks
    if (!isPlainObject(workerConfig.assets)) {
      reasons.push('Generated worker.config.json must include assets routing configuration.');
    } else {
      if (workerConfig.assets.htmlHandling !== 'none' || workerConfig.assets.notFoundHandling !== 'none') {
        reasons.push('Generated worker.config.json assets must set htmlHandling: "none" and notFoundHandling: "none".');
      }
      const runWorkerFirst = workerConfig.assets.runWorkerFirst;
      const validRunWorkerFirst =
        runWorkerFirst === true ||
        (Array.isArray(runWorkerFirst) &&
          runWorkerFirst.length > 0 &&
          runWorkerFirst.every(rule => isNonEmptyString(rule)));
      if (!validRunWorkerFirst) {
        reasons.push('Generated worker.config.json assets.runWorkerFirst must route application requests through the Worker.');
      }
    }

    if (!isPlainObject(workerConfig.env)) {
      reasons.push('Generated worker.config.json must declare an env bindings object.');
    } else {
      const assetsBinding = workerConfig.env.ASSETS;
      if (!isPlainObject(assetsBinding) || assetsBinding.type !== 'assets') {
        reasons.push('Generated worker.config.json must bind ASSETS with { type: "assets" }.');
      }

      for (const [bindingName, binding] of Object.entries(workerConfig.env)) {
        if (!isPlainObject(binding) || !isNonEmptyString(binding.type)) {
          reasons.push(`Generated worker.config.json binding "${bindingName}" is malformed.`);
          continue;
        }
        if (!ALLOWED_ENV_BINDING_TYPES.has(binding.type)) {
          reasons.push(
            `Generated worker.config.json binding "${bindingName}" uses disallowed type "${binding.type}" for protected preview.`
          );
          continue;
        }
        if (binding.type === 'assets' && bindingName !== 'ASSETS') {
          reasons.push(`Unexpected assets binding "${bindingName}" in generated worker.config.json.`);
          continue;
        }
        if (binding.type === 'text') {
          const textValue = typeof binding.value === 'string' ? binding.value : '';
          if (SECRET_LIKE_BINDING_NAME_RE.test(bindingName)) {
            reasons.push(
              `Generated worker.config.json text binding "${bindingName}" has a secret-like name and must use the "secret" binding type, not "text".`
            );
          }
          if (LIVE_STRIPE_OR_SECRET_RE.test(textValue)) {
            reasons.push(
              `Generated worker.config.json text binding "${bindingName}" must not contain live Stripe keys or webhook secrets.`
            );
          }
          if (LOCAL_SUPABASE_RE.test(textValue)) {
            reasons.push(
              `Generated worker.config.json text binding "${bindingName}" must not point to local loopback Supabase.`
            );
          }
          const matchedOrigins = [...textValue.matchAll(SUPABASE_ORIGIN_RE)].map(match =>
            normalizeSupabaseOrigin(match[0])
          );
          for (const origin of matchedOrigins) {
            if (normalizedProductionSupabase && origin === normalizedProductionSupabase) {
              reasons.push(
                `Generated worker.config.json text binding "${bindingName}" references the production Supabase project.`
              );
            } else if (normalizedPreviewSupabase && origin !== normalizedPreviewSupabase) {
              reasons.push(
                `Generated worker.config.json text binding "${bindingName}" references an unexpected Supabase origin.`
              );
            }
          }
          if (bindingName === 'NEXT_PUBLIC_SUPABASE_URL' || bindingName === 'SUPABASE_URL') {
            if (!normalizedPreviewSupabase || normalizeSupabaseOrigin(textValue) !== normalizedPreviewSupabase) {
              reasons.push(
                `Generated worker.config.json binding "${bindingName}" must match the isolated preview Supabase URL.`
              );
            }
          }
          if (bindingName === 'TRUSTFIVE_BUILD_SHA' && FULL_SHA_RE.test(expectedCommitSha ?? '')) {
            if (textValue !== expectedCommitSha) {
              reasons.push(
                'Generated worker.config.json TRUSTFIVE_BUILD_SHA binding does not match the candidate commit SHA.'
              );
            }
          }
        }
      }
    }

    // Main module check
    const mainModule = workerConfig.manifest?.mainModule;
    if (!isNonEmptyString(mainModule)) {
      reasons.push('Generated worker.config.json manifest.mainModule is missing.');
    } else {
      const resolvedMain = resolveInside(bundleDir, mainModule);
      if (!resolvedMain) {
        reasons.push('Generated worker.config.json manifest.mainModule escapes the bundle directory.');
      } else {
        try {
          const mainStats = await lstat(resolvedMain);
          if (mainStats.isSymbolicLink() || !mainStats.isFile()) {
            reasons.push(`Prebuilt Worker main module "${mainModule}" is not a regular file.`);
          }
        } catch {
          reasons.push(`Prebuilt Worker main module "${mainModule}" is missing from bundle/.`);
        }
      }
    }

    workerConfigVerified = reasons.length === configReasonsStart;
  }

  // 4. Verify asset directory alignment (cannot verify one directory and deploy another)
  if (assetDirectory && resolve(assetDirectory) !== resolve(assetsDir)) {
    reasons.push(
      'Asset directory must match the prebuilt Build Output assets directory (.cloudflare/output/v1/workers/default/assets) so only the verified artifact is deployed.'
    );
  }

  // 5. Verify browser asset isolation on the actual prebuilt assetsDir
  let isolationVerified = false;
  try {
    const assetsStat = await lstat(assetsDir);
    if (assetsStat.isSymbolicLink() || !assetsStat.isDirectory()) {
      reasons.push('Prebuilt Worker assets directory is missing or invalid.');
    } else {
      await checkPreviewIsolation({
        previewUrl: previewSupabaseUrl,
        productionUrl: productionSupabaseUrl,
        runtimeUrl: workerRuntimeSupabaseUrl,
        assetDirectory: assetsDir,
      });
      isolationVerified = true;
    }
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : 'Preview database isolation check failed.');
  }

  // 6. Verify prebuilt Worker server bundle freshness (embedded commit SHA) and backend isolation
  const embeddedCommitShas = new Set();
  let healthModuleFound = false;
  let bundleFiles = [];
  try {
    bundleFiles = await collectRegularFiles(bundleDir);
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : 'Prebuilt Worker bundle directory is missing or invalid.');
  }

  const bundleSupabaseOrigins = new Set();
  let bundleHasLocalSupabase = false;

  for (const file of bundleFiles) {
    if (!/\.(?:js|mjs)$/.test(file)) continue;
    const source = await readFile(file, 'utf8');

    if (LOCAL_SUPABASE_RE.test(source)) {
      bundleHasLocalSupabase = true;
    }
    for (const [origin] of source.matchAll(SUPABASE_ORIGIN_RE)) {
      bundleSupabaseOrigins.add(origin);
    }

    if (source.includes('trustfive-web') && source.includes('commitSha')) {
      healthModuleFound = true;
      for (const match of source.matchAll(HEALTH_SHA_LITERAL_RE)) {
        embeddedCommitShas.add(match[1]);
      }
    }
  }

  if (bundleHasLocalSupabase) {
    reasons.push(
      'Prebuilt Worker server bundle references local loopback Supabase (127.0.0.1/localhost:54321); rebuild with isolated preview Supabase credentials.'
    );
  }

  if (bundleSupabaseOrigins.size > 0) {
    for (const origin of bundleSupabaseOrigins) {
      if (!origin.startsWith('https://')) {
        reasons.push('Prebuilt Worker server bundle contains an insecure HTTP Supabase URL.');
        isolationVerified = false;
      } else if (normalizedProductionSupabase && normalizeSupabaseOrigin(origin) === normalizedProductionSupabase) {
        reasons.push('Prebuilt Worker server bundle contains the production Supabase project URL.');
        isolationVerified = false;
      } else if (normalizedPreviewSupabase && normalizeSupabaseOrigin(origin) !== normalizedPreviewSupabase) {
        reasons.push('Prebuilt Worker server bundle contains an unexpected Supabase project origin.');
        isolationVerified = false;
      }
    }
  }

  if (!healthModuleFound) {
    reasons.push(
      'Prebuilt Worker bundle does not contain the /api/health release-identity handler; artifact is incomplete or stale.'
    );
  } else if (embeddedCommitShas.size === 0) {
    reasons.push(
      'Prebuilt Worker bundle is missing an embedded 40-character TRUSTFIVE_BUILD_SHA; rebuild with TRUSTFIVE_BUILD_SHA set to the candidate commit.'
    );
  } else if (FULL_SHA_RE.test(expectedCommitSha ?? '')) {
    if (embeddedCommitShas.size !== 1 || !embeddedCommitShas.has(expectedCommitSha)) {
      reasons.push(
        `Prebuilt Worker bundle is stale or mismatched: embedded commit SHA (${[...embeddedCommitShas].join(', ')}) does not match candidate commit ${expectedCommitSha}.`
      );
    }
  }

  // 7. Compute deterministic SHA-256 digest of the exact prebuilt artifact
  let artifactDigest = null;
  if (bundleFiles.length > 0) {
    try {
      artifactDigest = await computeArtifactDigest({
        v1Dir,
        configJsonPath,
        workerConfigPath,
        bundleDir,
        assetsDir,
      });
    } catch (error) {
      if (reasons.length === 0) {
        reasons.push(error instanceof Error ? error.message : 'Unable to fingerprint prebuilt artifact.');
      }
    }
  }

  if (expectedArtifactDigest) {
    if (!artifactDigest || artifactDigest !== expectedArtifactDigest) {
      reasons.push('Prebuilt artifact digest does not match expected verified digest (stale or modified artifact).');
    }
  }

  return {
    ok: reasons.length === 0,
    isolationVerified,
    workerConfigVerified,
    artifactDigest,
    embeddedCommitShas: [...embeddedCommitShas],
    workerConfigPath,
    assetsDir,
    bundleDir,
    reasons,
  };
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
    protectedPreviewEvidence,
    previewSupabaseUrl,
    productionSupabaseUrl,
    workerRuntimeSupabaseUrl,
    buildOutputRoot = process.cwd(),
    assetDirectory,
    expectedArtifactDigest,
    ciOverrideWorkerName = process.env.CLOUDFLARE_CI_OVERRIDE_WORKER_NAME,
    cfBinPath,
    now = Date.now(),
    protectedPreviewMaxAgeMs = DEFAULT_PROTECTED_PREVIEW_MAX_AGE_MS,
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

  if (isNonEmptyString(ciOverrideWorkerName) && ciOverrideWorkerName.trim() !== ALLOWED_PREVIEW_WORKER) {
    reasons.push(
      `CLOUDFLARE_CI_OVERRIDE_WORKER_NAME ("${ciOverrideWorkerName.trim()}") would override the Worker target away from "${ALLOWED_PREVIEW_WORKER}".`
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

  const evidenceError = validateReviewEvidence(reviewEvidence, commitSha);
  if (evidenceError) {
    reasons.push(evidenceError);
  }

  const artifact = await verifyPrebuiltWorkerArtifact({
    buildOutputRoot,
    assetDirectory,
    expectedWorker: ALLOWED_PREVIEW_WORKER,
    expectedDomain: ALLOWED_PREVIEW_DOMAIN,
    expectedCommitSha: commitSha,
    expectedArtifactDigest,
    previewSupabaseUrl,
    productionSupabaseUrl,
    workerRuntimeSupabaseUrl,
  });
  reasons.push(...artifact.reasons);

  let resolvedCfBin = null;
  try {
    resolvedCfBin = isNonEmptyString(cfBinPath) ? cfBinPath.trim() : resolveCloudflareCliBin(buildOutputRoot);
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : 'Installed Cloudflare CLI could not be resolved.');
  }

  const protectedPreviewReasons = validateProtectedPreviewEvidence(protectedPreviewEvidence, {
    expectedWorker: ALLOWED_PREVIEW_WORKER,
    expectedHostname: ALLOWED_PREVIEW_HOSTNAME,
    expectedDomain: ALLOWED_PREVIEW_DOMAIN,
    expectedCommitSha: commitSha,
    now,
    maxAgeMs: protectedPreviewMaxAgeMs,
  });
  const protectedPreviewVerified = protectedPreviewReasons.length === 0;

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
    reasons.push(...protectedPreviewReasons);
  }

  const ok = reasons.length === 0;
  const deployCommand =
    ok && resolvedCfBin && FULL_SHA_RE.test(commitSha ?? '')
      ? buildPrebuiltCloudflareDeployCommand({
          cfBinPath: resolvedCfBin,
          worker: ALLOWED_PREVIEW_WORKER,
          commitSha,
        })
      : null;

  return {
    ok,
    mode: ok ? (execute ? 'authorized_execute' : 'dry_run_passed') : 'blocked',
    destinationWorker: worker || null,
    destinationHostname: hostname || null,
    commitSha: FULL_SHA_RE.test(commitSha ?? '') ? commitSha : null,
    sourceKind: isNonEmptyString(sourceKind) ? sourceKind.trim() : null,
    isolationVerified: artifact.isolationVerified,
    workerConfigVerified: artifact.workerConfigVerified,
    artifactVerified: artifact.ok,
    artifactDigest: artifact.artifactDigest,
    protectedPreviewVerified,
    deployCommand,
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

  // Re-verify exact prebuilt artifact digest immediately before invoking deploy
  // to prevent TOCTOU drift between verification and upload.
  const recheck = await verifyPrebuiltWorkerArtifact({
    buildOutputRoot: options.buildOutputRoot ?? process.cwd(),
    assetDirectory: options.assetDirectory,
    expectedWorker: ALLOWED_PREVIEW_WORKER,
    expectedDomain: ALLOWED_PREVIEW_DOMAIN,
    expectedCommitSha: decision.commitSha,
    expectedArtifactDigest: decision.artifactDigest,
    previewSupabaseUrl: options.previewSupabaseUrl,
    productionSupabaseUrl: options.productionSupabaseUrl,
    workerRuntimeSupabaseUrl: options.workerRuntimeSupabaseUrl,
  });
  if (!recheck.ok || recheck.artifactDigest !== decision.artifactDigest) {
    return {
      ...decision,
      ok: false,
      mode: 'blocked',
      artifactVerified: false,
      deployed: false,
      reasons: [
        'Prebuilt artifact changed between verification and --execute; aborting deployment.',
        ...recheck.reasons,
      ],
    };
  }

  await execDeploy({
    worker: ALLOWED_PREVIEW_WORKER,
    hostname: ALLOWED_PREVIEW_HOSTNAME,
    commitSha: decision.commitSha,
    artifactDigest: decision.artifactDigest,
    buildOutputRoot: resolve(options.buildOutputRoot ?? process.cwd()),
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
    buildOutputRoot: process.env.TRUSTFIVE_BUILD_OUTPUT_ROOT || process.cwd(),
    assetDirectory: process.env.TRUSTFIVE_PREVIEW_ASSETS_DIR || '',
    expectedArtifactDigest: process.env.TRUSTFIVE_EXPECTED_ARTIFACT_DIGEST || '',
    evidenceFile: process.env.TRUSTFIVE_REVIEW_EVIDENCE_FILE || '',
    protectedPreviewEvidenceFile: process.env.TRUSTFIVE_PROTECTED_PREVIEW_EVIDENCE_FILE || '',
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
    else if (arg === '--build-output-root' && argv[i + 1]) parsed.buildOutputRoot = argv[++i];
    else if (arg === '--assets' && argv[i + 1]) parsed.assetDirectory = argv[++i];
    else if (arg === '--expected-artifact-digest' && argv[i + 1]) parsed.expectedArtifactDigest = argv[++i];
    else if (arg === '--evidence' && argv[i + 1]) parsed.evidenceFile = argv[++i];
    else if (arg === '--protected-preview-evidence' && argv[i + 1]) {
      parsed.protectedPreviewEvidenceFile = argv[++i];
    } else throw new Error(`Unknown or incomplete flag: ${arg}`);
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

function readJsonArgFile(filePath, label) {
  if (!isNonEmptyString(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    throw new Error(`Unable to read or parse ${label} JSON file.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const cli = parseCliArgs(process.argv.slice(2));
    const git = readGitState();
    const reviewEvidence = readJsonArgFile(cli.evidenceFile, 'review evidence');
    const protectedPreviewEvidence = readJsonArgFile(
      cli.protectedPreviewEvidenceFile,
      'protected-preview evidence'
    );

    const result = await runPreviewDeployGate(
      {
        destinationWorker: cli.worker,
        destinationHostname: cli.hostname,
        sourceKind: cli.sourceKind,
        commitSha: cli.commitSha || git.head,
        buildSha: process.env.TRUSTFIVE_BUILD_SHA || cli.commitSha || git.head,
        workingTreeClean: git.workingTreeClean,
        reviewEvidence,
        protectedPreviewEvidence,
        previewSupabaseUrl: process.env.PREVIEW_SUPABASE_URL,
        productionSupabaseUrl: process.env.PRODUCTION_SUPABASE_URL,
        workerRuntimeSupabaseUrl: process.env.WORKER_RUNTIME_SUPABASE_URL,
        buildOutputRoot: cli.buildOutputRoot,
        assetDirectory: cli.assetDirectory || undefined,
        expectedArtifactDigest: cli.expectedArtifactDigest || undefined,
        execute: cli.execute,
        authorized: process.env.TRUSTFIVE_AUTHORIZED_PREVIEW_DEPLOY === '1',
        previewAccessConfigured: Boolean(
          process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET
        ),
        cloudflareTokenPresent: Boolean(process.env.CLOUDFLARE_API_TOKEN),
      },
      async ({buildOutputRoot, command}) => {
        const sanitizedEnv = {...process.env};
        delete sanitizedEnv.CLOUDFLARE_CI_OVERRIDE_WORKER_NAME;
        execFileSync(command[0], command.slice(1), {
          cwd: buildOutputRoot,
          stdio: 'inherit',
          env: sanitizedEnv,
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
