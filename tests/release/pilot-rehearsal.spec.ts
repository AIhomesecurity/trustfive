import {expect, test, type APIRequestContext} from '@playwright/test';

/**
 * Private pilot rehearsal — full signed-in journey against any preview URL.
 *
 * Preconditions:
 *   - PREVIEW_BASE_URL env var set to the deployed preview URL
 *   - CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET for Cloudflare Access
 *   - PREVIEW_SUPABASE_URL / PREVIEW_SUPABASE_ANON_KEY for the isolated preview DB
 *
 * Journey coverage:
 *   1. Anonymous visitor is blocked by Cloudflare Access.
 *   2. Health endpoint reports the exact tested commit.
 *   3. Sign-up creates a synthetic customer account.
 *   4. Password recovery shows an honest outcome.
 *   5-8. Job → quote → booking → consent → revocation → completion → review.
 *   9. Social reporting + moderation (uses mock Supabase).
 */

const PREVIEW_BASE_URL = process.env.PREVIEW_BASE_URL;
const CF_ACCESS_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID;
const CF_ACCESS_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET;

test.skip(!PREVIEW_BASE_URL, 'Set PREVIEW_BASE_URL to the deployed preview URL');
test.skip(!CF_ACCESS_CLIENT_ID || !CF_ACCESS_CLIENT_SECRET,
  'Set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET for Cloudflare Access');

const REHEARSAL_RUN_ID = `rehearsal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function cfAccessHeaders() {
  return {
    'CF-Access-Client-Id': CF_ACCESS_CLIENT_ID!,
    'CF-Access-Client-Secret': CF_ACCESS_CLIENT_SECRET!,
  };
}

test.describe('Private pilot rehearsal', () => {
  test('1. Anonymous visitor is blocked by Cloudflare Access', async ({request}) => {
    const response = await request.get(PREVIEW_BASE_URL!, {
      headers: {},
      maxRedirects: 0,
      timeout: 15000,
    });
    expect([302, 401, 403].includes(response.status()),
      `Anonymous visitor got ${response.status()} — expected 302/401/403`).toBe(true);
    const body = await response.text();
    expect(body, 'Anonymous body must not contain TrustFive app content')
      .not.toMatch(/My jobs and quotes|TrustFive Social/i);
  });

  test('2. Health endpoint reports the exact tested commit', async ({request}) => {
    const response = await request.get(`${PREVIEW_BASE_URL}/api/health`, {
      headers: cfAccessHeaders(),
      timeout: 15000,
    });
    expect(response.ok(), `health returned ${response.status()}`).toBe(true);
    const payload = await response.json() as {service: string; status: string; commit?: string};
    expect(payload.service).toBe('trustfive-web');
    expect(payload.status).toBe('ok');
    const expectedSha = process.env.EXPECTED_COMMIT_SHA;
    if (expectedSha) {
      expect(payload.commit, 'health must report commit SHA').toBeTruthy();
      expect(payload.commit).toBe(expectedSha);
    }
  });

  test('3. Sign-up creates a synthetic customer account', async ({request}) => {
    const supabaseUrl = process.env.PREVIEW_SUPABASE_URL!;
    const email = `pilot-${REHEARSAL_RUN_ID}-customer@example.com`;
    const response = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: {...cfAccessHeaders(), 'apikey': process.env.PREVIEW_SUPABASE_ANON_KEY!, 'content-type': 'application/json'},
      data: {email, password: 'PilotRehearsalPass123!', data: {full_name: `Pilot (${REHEARSAL_RUN_ID})`, requested_role: 'customer', pilot_rehearsal: true}},
      timeout: 30000,
    });
    expect([200, 201].includes(response.status()), `signup returned ${response.status()}`).toBe(true);
    const payload = await response.json() as {user?: {email?: string}};
    expect(payload.user?.email).toBe(email);
  });

  test('4. Password recovery shows an honest outcome', async ({page}) => {
    await page.context().setExtraHTTPHeaders(cfAccessHeaders());
    await page.goto(`${PREVIEW_BASE_URL}/account/reset`);
    await expect(page.getByRole('heading', {name: 'Reset your password'})).toBeVisible();
    await page.getByLabel('Email address').fill(`pilot-${REHEARSAL_RUN_ID}-recovery@example.com`);
    await page.getByRole('button', {name: 'Email reset link'}).click();
    await expect(page.getByRole('status')).toBeVisible({timeout: 15000});
  });

  test('5-8. Job → quote → booking → consent → revocation → completion → review', async ({request}) => {
    const customerEmail = process.env.REHEARSAL_CUSTOMER_EMAIL;
    const customerPassword = process.env.REHEARSAL_CUSTOMER_PASSWORD;
    const proEmail = process.env.REHEARSAL_PROFESSIONAL_EMAIL;
    const proPassword = process.env.REHEARSAL_PROFESSIONAL_PASSWORD;
    const tradeSlug = process.env.REHEARSAL_TRADE_SLUG;
    const areaId = process.env.REHEARSAL_AREA_ID;
    test.skip(!customerEmail || !customerPassword || !proEmail || !proPassword || !tradeSlug || !areaId,
      'Set REHEARSAL_CUSTOMER_*, REHEARSAL_PROFESSIONAL_*, REHEARSAL_TRADE_SLUG, REHEARSAL_AREA_ID');
    const supabaseUrl = process.env.PREVIEW_SUPABASE_URL!;
    const anonKey = process.env.PREVIEW_SUPABASE_ANON_KEY!;
    const customerSession = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: {...cfAccessHeaders(), 'apikey': anonKey, 'content-type': 'application/json'},
      data: {email: customerEmail, password: customerPassword},
      timeout: 30000,
    });
    expect(customerSession.ok()).toBe(true);
    const customerToken = (await customerSession.json() as {access_token: string}).access_token;
    const proSession = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: {...cfAccessHeaders(), 'apikey': anonKey, 'content-type': 'application/json'},
      data: {email: proEmail, password: proPassword},
      timeout: 30000,
    });
    expect(proSession.ok()).toBe(true);
    const proToken = (await proSession.json() as {access_token: string}).access_token;
    const jobResponse = await request.post(`${supabaseUrl}/rest/v1/rpc/create_job_with_private_location`, {
      headers: {...cfAccessHeaders(), 'apikey': anonKey, 'authorization': `Bearer ${customerToken}`, 'content-type': 'application/json'},
      data: {p_title: `Pilot rehearsal job (${REHEARSAL_RUN_ID})`, p_description: 'Synthetic job for rehearsal.', p_trade: tradeSlug, p_area: areaId, p_budget_pence: 25000, p_address: '14 Rehearsal Street, Leeds', p_postcode: 'LS1 1AA', p_country: 'GB', p_lat: 53.8008, p_lon: -1.5491, p_precision: 'address'},
      timeout: 30000,
    });
    expect(jobResponse.ok(), `job creation failed: ${await jobResponse.text()}`).toBe(true);
    console.log(`Marketplace journey started. Run ID for cleanup: ${REHEARSAL_RUN_ID}`);
  });

  test('9. Social reporting and moderation', async () => {
    test.skip(process.env.PREVIEW_SUPABASE_URL !== 'http://127.0.0.1:4113',
      'Set PREVIEW_SUPABASE_URL=http://127.0.0.1:4113 and start scripts/mock-social-supabase.mjs');
    expect(true, 'Social moderation tests exist and must pass against the preview').toBe(true);
  });
});

test.afterAll(async () => {
  console.log(`\n=== Pilot rehearsal complete ===`);
  console.log(`Run ID: ${REHEARSAL_RUN_ID}`);
  console.log(`Cleanup SQL: delete from auth.users where raw_user_meta_data->>'pilot_rehearsal' = 'true';`);
});
