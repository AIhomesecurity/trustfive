import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {validatePreview} from '../../scripts/release/validate-preview.mjs';

const PREVIEW_ORIGIN = 'https://preview.trustfive.co.uk';

function sanitizeText(value, secrets) {
  if (typeof value !== 'string') return '';
  for (const secret of secrets.filter(Boolean)) value = value.replaceAll(secret, '[REDACTED]');
  return value
    .replace(/[?#].*$/g, '')
    .replace(/[a-f0-9]{32,}/gi, '[REDACTED_HASH_OR_TOKEN]')
    .replace(/bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .trim();
}

function parseCliArgs() {
  const expectedSha = process.argv[2];
  if (!expectedSha || !/^[a-f0-9]{40}$/.test(expectedSha)) {
    throw new Error('Usage: node tests/release/protected-preview-browser-smoke.mjs <EXPECTED_40_CHAR_COMMIT_SHA>');
  }
  return expectedSha;
}

function readEnvCredentials() {
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing CF_ACCESS_CLIENT_ID or CF_ACCESS_CLIENT_SECRET in environment');
  }
  return {clientId, clientSecret};
}

export async function runProtectedPreviewBrowserSmoke({
  expectedSha,
  clientId,
  clientSecret,
  previewOrigin = PREVIEW_ORIGIN,
  browserLauncher = chromium,
  customValidator = validatePreview,
} = {}) {
  const targetOrigin = previewOrigin.replace(/\/+$/, '');
  if (targetOrigin !== PREVIEW_ORIGIN) throw new Error('Unexpected protected preview origin');

  // 1. Verify exact SHA and Access via validate-preview first
  await customValidator({
    origin: targetOrigin,
    clientId,
    clientSecret,
    expectedSha,
  });

  // 2. Launch fresh Chromium browser and context
  let browser = null;
  let context = null;
  let requestFailed = false;

  try {
    browser = await browserLauncher.launch({headless: true});
    context = await browser.newContext({serviceWorkers: 'block'});

    // Enforce strict scoped route interception:
    // Only requests matching the exact allowed preview origin/host receive the Access service headers.
    // Any request escaping the allowed hostname must immediately abort or fail.
    await context.route('**/*', async (route) => {
      const request = route.request();
      let requestUrl;
      try {
        requestUrl = new URL(request.url());
      } catch {
        await route.abort('failed');
        return;
      }

      if (requestUrl.origin !== targetOrigin) {
        // Disallow hostname escapes from receiving credentials or loading unexpected domains
        await route.abort('accessdenied');
        return;
      }

      // Handle one upstream response at a time. Do not forward Access credentials across redirects.
      let response;
      try {
        response = await route.fetch({
        maxRedirects: 0,
        headers: {
          ...request.headers(),
          'CF-Access-Client-Id': clientId,
          'CF-Access-Client-Secret': clientSecret,
        },
        });
        const location = response.headers().location;
        if (response.status() >= 300 && response.status() < 400 && location) {
          const redirect = URL.parse(location, requestUrl);
          if (!redirect || redirect.origin !== targetOrigin) {
            await route.abort('accessdenied');
            return;
          }
        }
        await route.fulfill({response});
      } catch {
        requestFailed = true;
        await route.abort('failed').catch(() => {});
      } finally {
        await response?.dispose().catch(() => {});
      }
    });

    const page = await context.newPage();

    // Helper to navigate and verify response/landing properties safely without leaking secrets
    async function visitRoute({path, expectedPath, expectedStatus = 200, checkNextParam = null}) {
      let landing = new URL(path, targetOrigin);
      // Playwright routes only the first URL of a browser redirect. Check each HTTP
      // hop ourselves and then open the final document in a signed-out browser.
      for (let hops = 0; ; hops++) {
        if (landing.origin !== targetOrigin || hops > 5) throw new Error('Unsafe preview navigation');
        const upstream = await fetch(landing, {
          redirect: 'manual',
          signal: AbortSignal.timeout(8000),
          headers: {'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret},
        });
        const location = upstream.headers.get('location');
        await upstream.body?.cancel();
        if (upstream.status < 300 || upstream.status >= 400) {
          if (upstream.status !== expectedStatus) throw new Error('Unexpected preview HTTP status');
          break;
        }
        if (!location) throw new Error('Preview redirect did not specify a destination');
        landing = new URL(location, landing);
      }
      const response = await page.goto(landing.href, {waitUntil: 'domcontentloaded', timeout: 15000});

      if (!response) {
        throw new Error(`Failed to load route ${path}: no response returned`);
      }

      const status = response.status();
      if (status !== expectedStatus) {
        throw new Error(`Unexpected status ${status} for ${path} (expected ${expectedStatus})`);
      }

      const currentUrl = new URL(page.url());
      if (currentUrl.origin !== targetOrigin) {
        throw new Error('Browser left protected origin while opening ' + path + ' with scheme ' + currentUrl.protocol);
      }

      if (expectedPath && currentUrl.pathname !== expectedPath) {
        throw new Error(`Unexpected path redirect for ${path}: landed on ${currentUrl.pathname} instead of ${expectedPath}`);
      }

      if (checkNextParam !== null) {
        const nextParam = currentUrl.searchParams.get('next');
        if (nextParam !== checkNextParam) {
          throw new Error('Unexpected sign-in return path');
        }
      }

      return {status, pathname: currentUrl.pathname};
    }

    // 1. Signed-out home: loads successfully at root
    await visitRoute({path: '/', expectedPath: '/', expectedStatus: 200});

    // 2. Account page: loads /account
    await visitRoute({path: '/account', expectedPath: '/account', expectedStatus: 200});

    // 3. Jobs return path: anonymous visit to /jobs?trade=cctv-installation redirects to /account?next=/jobs?trade=cctv-installation
    const jobsReturnDestination = '/jobs?trade=cctv-installation';
    await visitRoute({
      path: jobsReturnDestination,
      expectedPath: '/account',
      expectedStatus: 200,
      checkNextParam: jobsReturnDestination,
    });

    // 4. Bookings: anonymous visit to /bookings redirects to /account?next=/bookings
    await visitRoute({
      path: '/bookings',
      expectedPath: '/account',
      expectedStatus: 200,
      checkNextParam: '/bookings',
    });

    // 5. Community: anonymous visit to /community redirects to /account?next=/community
    await visitRoute({
      path: '/community',
      expectedPath: '/account',
      expectedStatus: 200,
      checkNextParam: '/community',
    });

    if (requestFailed) throw new Error('A scoped preview request failed');
    return {
      success: true,
      origin: targetOrigin,
      commitSha: expectedSha,
      routesVerified: ['/', '/account', jobsReturnDestination, '/bookings', '/community'],
    };
  } finally {
    if (context) {
      await context.unrouteAll({behavior: 'wait'}).catch(() => {});
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// CLI Execution Entrypoint
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const expectedSha = parseCliArgs();
    const {clientId, clientSecret} = readEnvCredentials();

    const result = await runProtectedPreviewBrowserSmoke({
      expectedSha,
      clientId,
      clientSecret,
    });

    console.log(`Protected preview browser smoke passed for commit: ${result.commitSha}`);
    console.log(`Verified routes: ${result.routesVerified.join(', ')}`);
  } catch (error) {
    const safeMessage = sanitizeText(error instanceof Error ? error.message : String(error), [process.env.CF_ACCESS_CLIENT_ID, process.env.CF_ACCESS_CLIENT_SECRET]);
    console.error(`Protected preview browser smoke failed: ${safeMessage}`);
    process.exitCode = 1;
  }
}
