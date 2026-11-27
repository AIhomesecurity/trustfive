import {once} from 'node:events';
import {createServer, type IncomingMessage} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect, test} from '@playwright/test';

const backend = 'http://127.0.0.1:54321';
const baseURL = 'http://127.0.0.1:3112';
const professionalToken = 'synthetic-onboarding-professional';
const customerToken = 'synthetic-onboarding-customer';
const professionalUser = {
  id: 'aaaaaaaa-0000-4000-8000-000000000051',
  aud: 'authenticated',
};
const customerUser = {
  id: 'aaaaaaaa-0000-4000-8000-000000000052',
  aud: 'authenticated',
};
const tradeId = '11111111-0000-4000-8000-000000000051';
const areaId = '22222222-0000-4000-8000-000000000051';
const rejectedApplicationId = 'ffffffff-0000-4000-8000-000000000051';
const waitingApplicationId = 'ffffffff-0000-4000-8000-000000000052';
const activeApplicationId = 'ffffffff-0000-4000-8000-000000000053';
const offerApplicationId = 'ffffffff-0000-4000-8000-000000000054';
const offerId = '77777777-0000-4000-8000-000000000051';
const jobId = 'bbbbbbbb-0000-4000-8000-000000000051';
const availableQuoteId = 'cccccccc-0000-4000-8000-000000000051';
const rejectedQuoteId = 'cccccccc-0000-4000-8000-000000000052';
const bookingId = 'dddddddd-0000-4000-8000-000000000051';

type OnboardingRow = {
  application_id: string;
  business_name: string;
  about: string;
  experience_years: number;
  application_status: string;
  submitted_at: string;
  trade_id: string;
  trade_name: string;
  area_id: string;
  area_name: string;
  city: string;
  assessment_state: string | null;
  verification_submission_status: string | null;
  verification_reviewer_note: string | null;
  active_slot: number | null;
  active_slots_filled: number;
  latest_offer_id: string | null;
  latest_offer_status: string | null;
  latest_offer_expires_at: string | null;
  business_page_status: string | null;
};

const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

const baseRow = (applicationId: string, businessName: string): OnboardingRow => ({
  application_id: applicationId,
  business_name: businessName,
  about: 'Synthetic installation and compliance services supplied only in this rehearsal.',
  experience_years: 12,
  application_status: 'pending',
  submitted_at: '2026-11-01T09:00:00Z',
  trade_id: tradeId,
  trade_name: 'CCTV Installation',
  area_id: areaId,
  area_name: 'Manchester Central',
  city: 'Manchester',
  assessment_state: null,
  verification_submission_status: 'submitted',
  verification_reviewer_note: null,
  active_slot: null,
  active_slots_filled: 5,
  latest_offer_id: null,
  latest_offer_status: null,
  latest_offer_expires_at: null,
  business_page_status: 'published',
});

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

test('synthetic marketplace rehearsal covers honest onboarding and a recovery-safe customer journey', async ({browser}) => {
  test.skip(process.env.NEXT_PUBLIC_SUPABASE_URL !== backend, 'Requires the loopback build');
  test.setTimeout(120_000);

  let onboardingAttempts = 0;
  let onboardingRows: OnboardingRow[] = [
    {
      ...baseRow(rejectedApplicationId, 'Synthetic rejected applicant'),
      application_status: 'rejected',
      verification_reviewer_note: 'Synthetic independent rejection: insurance evidence expired.',
    },
    {
      ...baseRow(waitingApplicationId, 'Synthetic waiting-list applicant'),
      application_status: 'eligible',
      assessment_state: 'verified',
      latest_offer_status: 'expired',
      latest_offer_expires_at: past,
    },
    {
      ...baseRow(activeApplicationId, 'Synthetic active applicant'),
      application_status: 'eligible',
      assessment_state: 'verified',
      active_slot: 2,
    },
    {
      ...baseRow(offerApplicationId, 'Synthetic offer applicant'),
      application_status: 'eligible',
      assessment_state: 'verified',
      active_slots_filled: 4,
      latest_offer_id: offerId,
      latest_offer_status: 'offered',
      latest_offer_expires_at: future,
    },
  ];
  let jobStatus = 'open';
  let cancelAttempts = 0;
  let reopenAttempts = 0;
  let acceptAttempts = 0;
  let bookingCreated = 0;
  const offerResponses: Array<Record<string, unknown>> = [];
  const cancelReasons: Array<string | null> = [];

  const reply = (
    response: import('node:http').ServerResponse,
    status: number,
    data: unknown
  ): void => {
    response.writeHead(status, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'content-type': 'application/json',
    });
    response.end(status === 204 ? undefined : JSON.stringify(data));
  };

  const fixture = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', backend).pathname;
    if (request.method === 'OPTIONS') return reply(response, 204, null);

    const token = request.headers.authorization?.replace(/^Bearer\s+/, '') ?? '';
    if (token !== professionalToken && token !== customerToken) {
      return reply(response, 401, {message: 'Synthetic session required'});
    }
    if (path === '/auth/v1/user') {
      return reply(response, 200, token === professionalToken ? professionalUser : customerUser);
    }

    if (token === professionalToken) {
      if (path === '/rest/v1/trades') {
        return reply(response, 200, [{id: tradeId, name: 'CCTV Installation'}]);
      }
      if (path === '/rest/v1/service_areas') {
        return reply(response, 200, [{id: areaId, area_name: 'Manchester Central', city: 'Manchester'}]);
      }
      if (path === '/rest/v1/professional_verification_submissions') {
        return reply(response, 200, []);
      }
      if (path === '/rest/v1/rpc/my_professional_onboarding_status') {
        onboardingAttempts += 1;
        // A non-retryable failure makes the explicit onboarding retry path observable.
        if (onboardingAttempts === 1) {
          return reply(response, 500, {message: 'Synthetic onboarding outage'});
        }
        return reply(response, 200, onboardingRows);
      }
      if (path === '/rest/v1/rpc/respond_to_vacancy_offer') {
        const body = await readBody(request);
        offerResponses.push(body);
        if (body.p_offer !== offerId || body.p_accept !== true) {
          return reply(response, 400, {message: 'Unexpected synthetic offer response'});
        }
        onboardingRows = onboardingRows.map(row =>
          row.application_id === offerApplicationId
            ? {...row, latest_offer_status: 'accepted'}
            : row
        );
        return reply(response, 200, null);
      }
      return reply(response, 200, []);
    }

    if (path === '/rest/v1/jobs') {
      return reply(response, 200, [{
        id: jobId,
        title: 'Synthetic CCTV installation',
        description: 'Install a synthetic camera system for this isolated rehearsal.',
        status: jobStatus,
        created_at: '2026-11-23T09:00:00Z',
        budget_pence: null,
        contact_preference: 'in_app_messages',
      }]);
    }
    if (path === '/rest/v1/rpc/customer_quotes') {
      return reply(response, 200, [
        {
          quote_id: availableQuoteId,
          job_id: jobId,
          business_name: 'Synthetic available professional',
          amount_pence: 22500,
          message: 'Includes synthetic installation and test.',
          availability_note: 'Thursday morning',
          status: bookingCreated ? 'accepted' : 'pending',
          created_at: '2026-11-23T10:00:00Z',
        },
        {
          quote_id: rejectedQuoteId,
          job_id: jobId,
          business_name: 'Synthetic rejected cheap quote',
          amount_pence: 9500,
          message: 'Rejected after independent quote review.',
          status: 'rejected',
          created_at: '2026-11-23T11:00:00Z',
        },
      ]);
    }
    if (path === '/rest/v1/rpc/customer_job_activity') {
      return reply(response, 200, []);
    }
    if (path === '/rest/v1/job_bookings') {
      if (!bookingCreated) return reply(response, 200, []);
      return reply(response, 200, [{
        id: bookingId,
        job_id: jobId,
        customer_id: customerUser.id,
        professional_id: 'eeeeeeee-0000-4000-8000-000000000051',
        status: 'booked',
        created_at: '2026-11-23T12:00:00Z',
      }]);
    }
    if (path === '/rest/v1/rpc/cancel_customer_job') {
      const body = await readBody(request);
      cancelAttempts += 1;
      cancelReasons.push(typeof body.p_reason === 'string' ? body.p_reason : null);
      if (body.p_job !== jobId) return reply(response, 400, {message: 'Unexpected synthetic job'});
      if (cancelAttempts === 1) return reply(response, 400, {message: 'Synthetic cancellation failure'});
      jobStatus = 'cancelled';
      return reply(response, 200, null);
    }
    if (path === '/rest/v1/rpc/reopen_customer_job') {
      const body = await readBody(request);
      reopenAttempts += 1;
      if (body.p_job !== jobId) return reply(response, 400, {message: 'Unexpected synthetic job'});
      if (reopenAttempts === 1) return reply(response, 400, {message: 'Synthetic reopen failure'});
      jobStatus = 'open';
      return reply(response, 200, null);
    }
    if (path === '/rest/v1/rpc/accept_job_quote') {
      const body = await readBody(request);
      acceptAttempts += 1;
      if (body.p_quote !== availableQuoteId) {
        return reply(response, 400, {message: 'Unexpected synthetic quote'});
      }
      if (acceptAttempts === 1) return reply(response, 500, {message: 'Synthetic acceptance outage'});
      bookingCreated += 1;
      jobStatus = 'booked';
      return reply(response, 200, bookingId);
    }
    return reply(response, 200, []);
  });

  for (let attempt = 0; ; attempt += 1) {
    try {
      await once(fixture.listen(54321, '127.0.0.1'), 'listening');
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || attempt >= 80) throw error;
      await delay(250);
    }
  }

  const sessionCookie = (token: string, user: {id: string; aud: string}) => ({
    name: 'sb-127-auth-token',
    url: baseURL,
    value: 'base64-' + Buffer.from(JSON.stringify({
      access_token: token,
      refresh_token: `${token}-refresh`,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user,
    })).toString('base64url'),
  });

  try {
    const professionalContext = await browser.newContext({baseURL});
    await professionalContext.addCookies([sessionCookie(professionalToken, professionalUser)]);
    const professionalPage = await professionalContext.newPage();
    await professionalPage.goto('/professional/apply');

    await expect(
      professionalPage.getByRole('alert').filter({hasText: 'Could not load your professional onboarding status'})
    ).toBeVisible();
    await expect(professionalPage.getByText(/Active \(Slot 2 of 5\)/)).toHaveCount(0);
    expect(onboardingAttempts).toBe(1);

    await professionalPage.getByRole('button', {name: 'Retry loading onboarding'}).click();
    await expect(professionalPage.getByText('Not approved', {exact: true})).toBeVisible();
    await expect(professionalPage.getByText(/Waiting list \(5\/5 slots full\)/)).toBeVisible();
    await expect(professionalPage.getByText(/Active \(Slot 2 of 5\)/)).toBeVisible();
    await expect(professionalPage.getByText(/payment never changes queue position/i)).toBeVisible();

    const summary = professionalPage.locator('[aria-label="Professional onboarding summary"] .card');
    await expect(summary.nth(1).locator('h3')).toHaveText('1');
    await expect(summary.nth(2).locator('h3')).toHaveText('1');

    const offerCard = professionalPage.locator('article.card').filter({hasText: 'Synthetic offer applicant'});
    await expect(offerCard.getByText(/Vacancy offer: offered/)).toBeVisible();
    await offerCard.getByRole('button', {name: 'Accept vacancy offer'}).click();
    await expect(professionalPage.getByRole('status').filter({hasText: 'You accepted the vacancy offer.'})).toBeVisible();
    await expect(offerCard.getByText(/Final authorised activation into one of the five slots is pending/)).toBeVisible();
    await expect(summary.nth(1).locator('h3')).toHaveText('1');
    expect(offerResponses).toEqual([{p_offer: offerId, p_accept: true}]);
    await professionalContext.close();

    const customerContext = await browser.newContext({baseURL});
    await customerContext.addCookies([sessionCookie(customerToken, customerUser)]);
    const customerPage = await customerContext.newPage();
    await customerPage.goto('/jobs');
    await expect(customerPage.getByRole('heading', {name: 'My jobs and quotes'})).toBeVisible();

    const quoteNames = await customerPage.locator('div.notice > h3').allTextContents();
    expect(quoteNames.indexOf('Synthetic available professional')).toBeLessThan(
      quoteNames.indexOf('Synthetic rejected cheap quote')
    );
    await expect(customerPage.getByRole('button', {name: 'Review and accept quote'})).toHaveCount(1);

    await customerPage.getByRole('button', {name: 'Cancel job', exact: true}).click();
    await customerPage.getByLabel('Optional note (max 240 chars)').fill('Synthetic cancellation reason');
    await customerPage.getByRole('button', {name: 'Confirm cancel job'}).click();
    await expect(customerPage.getByRole('alert').filter({hasText: 'Unable to cancel job. Try again.'})).toBeVisible();
    expect(cancelAttempts).toBe(1);
    expect(cancelReasons).toEqual(['Synthetic cancellation reason']);

    await customerPage.getByRole('button', {name: 'Confirm cancel job'}).click();
    await expect(customerPage.getByText('Job cancelled. Pending quotes on this job are no longer open for acceptance.')).toBeVisible();
    await expect(customerPage.getByRole('button', {name: 'Reopen job'})).toBeVisible();
    await expect(customerPage.getByRole('button', {name: 'Review and accept quote'})).toHaveCount(0);
    expect(cancelAttempts).toBe(2);

    await customerPage.getByRole('button', {name: 'Reopen job'}).click();
    await customerPage.getByRole('button', {name: 'Confirm reopen job'}).click();
    await expect(customerPage.getByRole('status').filter({hasText: 'Unable to reopen job'})).toBeVisible();
    await customerPage.getByRole('button', {name: 'Confirm reopen job'}).click();
    await expect(customerPage.getByText('Job reopened. Eligible local approved professionals can now see the brief again.')).toBeVisible();
    await expect(customerPage.getByRole('button', {name: 'Review and accept quote'})).toHaveCount(1);
    expect(reopenAttempts).toBe(2);

    await customerPage.getByRole('button', {name: 'Review and accept quote'}).click();
    const confirmation = customerPage.getByRole('group', {name: 'Confirm quote from Synthetic available professional'});
    await confirmation.getByRole('button', {name: 'Confirm and create booking'}).click();
    await expect(confirmation.getByRole('alert')).toContainText('Could not confirm the booking. Check your connection and try again.');
    expect(acceptAttempts).toBe(1);
    expect(bookingCreated).toBe(0);

    await confirmation.getByRole('button', {name: 'Confirm and create booking'}).click();
    await expect(customerPage.getByRole('link', {name: 'Open your confirmed booking'})).toHaveAttribute(
      'href',
      `/bookings?booking=${bookingId}`
    );
    await expect(customerPage.getByText(/No payment has been taken/)).toBeVisible();
    await expect(customerPage.getByRole('button', {name: 'Review and accept quote'})).toHaveCount(0);
    expect(acceptAttempts).toBe(2);
    expect(bookingCreated).toBe(1);

    await customerContext.close();
  } finally {
    const closed = once(fixture, 'close');
    fixture.close();
    fixture.closeAllConnections();
    await closed;
  }
});
