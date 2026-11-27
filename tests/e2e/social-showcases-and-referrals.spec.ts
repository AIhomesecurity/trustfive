import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test,type Page} from '@playwright/test';
import {assessSocialPostSafety} from '../../lib/social-safety';
import {
  buildCustomerReferralHref,
  calculateReferralSplit,
  parseReferralCodeParam,
  validateTradeReferralDraft,
} from '../../lib/trade-referrals';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';
const proUser = {id: 'aaaaaaaa-0000-4000-8000-000000000195', aud: 'authenticated'};
const areaA = {id: '11111111-1111-4111-8111-111111111101', area_name: 'Didsbury', city: 'Manchester'};
const tradeCctv = {id: '22222222-2222-4222-8222-222222222201', name: 'CCTV Installation', slug: 'cctv-installation'};
const showcaseId = '33333333-3333-4333-8333-333333333301';
const approvedAppId = '44444444-4444-4444-8444-444444444401';
const referralId = '55555555-5555-4555-8555-555555555501';

async function signIn(page: Page, user: {id: string; aud: string}) {
  const session = {
    access_token: user.id,
    refresh_token: 'synthetic-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
  await page.context().addCookies([
    {
      name: 'sb-127-auth-token',
      value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
      url: app,
    },
  ]);
}

test.describe('TrustFive Social anti-bypass & trade referral unit contracts', () => {
  test('hard-blocks UK mobiles, landlines, spelled digits, domains, emails, WhatsApp and full postcodes', () => {
    const blockedSamples = [
      'Call me on 07860 244 274 for a quick quote.',
      'Ring zero seven eight six zero two four four two seven four.',
      'Check out my site at adicommunications.co.uk today.',
      'Visit https://example.com for cheap deals.',
      'Send drawings to quotes@mytrade.uk anytime.',
      'Message me on WhatsApp to save fees.',
      'Meet outside M20 2WS at 9am tomorrow.',
    ];
    for (const sample of blockedSamples) {
      const result = assessSocialPostSafety(sample);
      expect(result.blockingError, `Expected block for: ${sample}`).not.toBeNull();
    }

    const clean = assessSocialPostSafety(
      'Finished a four-camera PoE installation on a Victorian terrace in Didsbury with neat conduit routing.'
    );
    expect(clean.blockingError).toBeNull();
    expect(clean.privacyWarnings).toHaveLength(0);
  });

  test('calculates transparent illustrative splits, enforces caps and builds safe customer referral links', () => {
    const split = calculateReferralSplit({
      jobAmountGbp: 1000,
      referrerShareBps: 500,
      platformShareBps: 300,
    });
    expect(split).toEqual({
      jobAmountGbp: 1000,
      referrerShareBps: 500,
      platformShareBps: 300,
      receivingProShareBps: 9200,
      referrerGbp: 50,
      platformGbp: 30,
      receivingProGbp: 920,
    });

    // Clamps any out-of-range share values safely to <=10% referrer and <=5% platform.
    const clamped = calculateReferralSplit({
      jobAmountGbp: 500,
      referrerShareBps: 2500,
      platformShareBps: 1500,
    });
    expect(clamped.referrerShareBps).toBe(1000);
    expect(clamped.platformShareBps).toBe(500);
    expect(clamped.receivingProShareBps).toBe(8500);

    expect(
      validateTradeReferralDraft({
        userId: proUser.id,
        areaId: areaA.id,
        targetTradeId: tradeCctv.id,
        summary: 'Call 07700 900123 for a CCTV swap in Didsbury.',
        referrerShareBps: 500,
      })
    ).toContain('Do not include customer phone numbers');

    expect(
      validateTradeReferralDraft({
        userId: proUser.id,
        areaId: areaA.id,
        targetTradeId: tradeCctv.id,
        summary: 'Customer needs a four-camera PoE CCTV upgrade after our electrical rewire in Didsbury.',
        referrerShareBps: 500,
      })
    ).toBeNull();

    const href = buildCustomerReferralHref({
      tradeSlug: 'cctv-installation',
      areaId: areaA.id,
      referralCode: 'TF-ABC1234567',
    });
    expect(href).toBe(
      `/jobs?trade=cctv-installation&area=${areaA.id}&ref=TF-ABC1234567`
    );
    expect(parseReferralCodeParam('?trade=cctv-installation&ref=TF-ABC1234567')).toBe('TF-ABC1234567');
    expect(parseReferralCodeParam('?ref=<script>alert(1)</script>')).toBe('');
  });
});

test.describe('TrustFive Social showcases feed, trade referrals and Jobs disclosure banner', () => {
  test('renders Showcases tab, Trade Referral split estimator & creation, and Jobs referral disclosure cleanly on desktop and 360px mobile', async ({
    browser,
  }) => {
    test.skip(
      process.env.NEXT_PUBLIC_SUPABASE_URL !== backend,
      'Requires the isolated loopback application build.'
    );
    test.setTimeout(60000);

    const storedReferrals: Array<Record<string, unknown>> = [];
    let referralPostAttempts = 0;

    const fixture = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', backend);
      const id = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
      const reply = (status: number, data: unknown) => {
        response.writeHead(status, {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          'content-type': 'application/json',
        });
        response.end(status === 204 ? '' : JSON.stringify(data));
      };

      if (request.method === 'OPTIONS') return reply(204, null);
      if (id !== proUser.id) return reply(401, {message: 'Synthetic session required'});
      if (url.pathname === '/auth/v1/user') return reply(200, {id, aud: 'authenticated'});

      const leaf = url.pathname.split('/').pop() ?? '';
      if (leaf === 'service_areas') return reply(200, [areaA]);
      if (leaf === 'trades') return reply(200, [tradeCctv]);
      if (leaf === 'completed_work_showcases') {
        return reply(200, [
          {
            id: showcaseId,
            application_id: approvedAppId,
            title: 'Four-camera 4K PoE installation on Victorian stone gable',
            summary:
              'Completed clean external conduit run with weatherproof junction boxes and indoor NVR setup in Didsbury.',
            status: 'published',
            created_at: '2026-11-25T10:30:00Z',
          },
        ]);
      }
      if (leaf === 'social_trade_referrals') {
        if (request.method === 'POST') {
          referralPostAttempts += 1;
          let raw = '';
          for await (const chunk of request) raw += chunk;
          const payload = JSON.parse(raw);
          const created = {
            id: referralId,
            referrer_id: proUser.id,
            area_id: payload.area_id,
            target_trade_id: payload.target_trade_id,
            recommended_application_id: null,
            summary: payload.summary,
            referral_code: 'TF-9876543210',
            referrer_share_bps: payload.referrer_share_bps ?? 500,
            platform_share_bps: payload.platform_share_bps ?? 300,
            settlement_mode: 'pilot_ledger_only',
            status: 'open',
            created_at: '2026-11-26T12:00:00Z',
          };
          storedReferrals.unshift(created);
          return reply(201, created);
        }
        return reply(200, storedReferrals);
      }
      if (leaf === 'customer_quotes') return reply(200, []);
      if (leaf === 'jobs') return reply(200, []);
      return reply(200, []);
    });

    for (let attempt = 0; ; attempt++) {
      try {
        await once(fixture.listen(54321, '127.0.0.1'), 'listening');
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || attempt >= 80) throw error;
        await delay(250);
      }
    }

    const desktop = await browser.newPage({viewport: {width: 1280, height: 900}});
    const mobile = await browser.newPage({
      viewport: {width: 360, height: 740},
      isMobile: true,
      hasTouch: true,
    });

    try {
      await signIn(desktop, proUser);
      await signIn(mobile, proUser);

      // 1. Showcases tab displays published installer work and links cleanly in-app.
      await desktop.goto(`${app}/community/social?tab=showcases`);
      const showcases = desktop.getByTestId('social-showcases-feed');
      await expect(showcases).toContainText('Four-camera 4K PoE installation on Victorian stone gable');
      await expect(
        showcases.getByRole('link', {name: /Ask a question or comment/i})
      ).toHaveAttribute('href', `/business/${approvedAppId}/work/${showcaseId}`);

      // 2. Trade tab renders referral split calculator (£800 default -> £736 / £40 / £24), blocks off-platform contact details, and creates a referral link.
      await desktop.goto(`${app}/community/social?tab=trade`);
      const referralsSection = desktop.getByTestId('social-trade-referrals');
      await expect(referralsSection).toContainText('Recommend approved trades');
      const splitSummary = referralsSection.getByTestId('referral-split-summary');
      await expect(splitSummary).toContainText('£736');
      await expect(splitSummary).toContainText('£40');
      await expect(splitSummary).toContainText('£24');

      await referralsSection.getByLabel('Trade needed').selectOption(tradeCctv.id);
      await referralsSection.getByLabel('Local area').selectOption(areaA.id);
      await referralsSection
        .getByLabel(/Work summary/i)
        .fill('Call 07700 900123 or visit mytrade.co.uk to take this CCTV job.');
      await referralsSection.getByRole('button', {name: 'Create customer-consented referral link'}).click();
      await expect(referralsSection.getByRole('alert')).toContainText('Do not include customer phone numbers');
      expect(referralPostAttempts).toBe(0);

      await referralsSection
        .getByLabel(/Work summary/i)
        .fill('Homeowner wants a four-camera PoE CCTV upgrade after our electrical consumer-unit work in Didsbury.');
      await referralsSection.getByRole('button', {name: 'Create customer-consented referral link'}).click();
      expect(referralPostAttempts).toBe(1);
      await expect(referralsSection).toContainText('TF-9876543210');
      await expect(referralsSection).toContainText('pilot ledger');

      // 3. Homeowner landing on /jobs via referral link sees honest UK disclosure notice.
      await mobile.goto(`${app}/jobs?trade=cctv-installation&area=${areaA.id}&ref=TF-9876543210`);
      const disclosure = mobile.getByTestId('trade-referral-disclosure');
      await expect(disclosure).toContainText('TF-9876543210');
      await expect(disclosure).toContainText('no extra fee for homeowners');

      // 4. Mobile 360px layout check on Showcases and Trade tabs (zero horizontal overflow).
      await mobile.goto(`${app}/community/social?tab=showcases`);
      await expect(mobile.getByTestId('social-showcases-feed')).toBeVisible();
      const showcasesOverflow = await mobile.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(showcasesOverflow).toBeLessThanOrEqual(0);

      await mobile.goto(`${app}/community/social?tab=trade`);
      await expect(mobile.getByTestId('social-trade-referrals')).toBeVisible();
      const tradeOverflow = await mobile.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(tradeOverflow).toBeLessThanOrEqual(0);
    } finally {
      await desktop.close();
      await mobile.close();
      await new Promise<void>(resolve => fixture.close(() => resolve()));
    }
  });
});
