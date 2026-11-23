import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect, test} from '@playwright/test';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';

// Distinct synthetic customer and professional identities; never touches shared or production data.
const customer = {
  id: 'aaaaaaaa-0000-4000-8000-000000000002',
  aud: 'authenticated',
};
const professional = {
  id: 'eeeeeeee-0000-4000-8000-000000000002',
  application_id: 'ffffffff-0000-4000-8000-000000000002',
  business_name: 'Synthetic North Security Ltd',
};
const trade = {
  id: '11111111-0000-4000-8000-000000000002',
  name: 'CCTV Installation',
  slug: 'cctv-installation',
};
const area = {
  id: '22222222-0000-4000-8000-000000000002',
  area_name: 'Manchester Central',
  city: 'Manchester',
  country_code: 'GB',
};
const jobId = 'bbbbbbbb-0000-4000-8000-000000000002';
const quoteId = 'cccccccc-0000-4000-8000-000000000002';
const bookingId = 'dddddddd-0000-4000-8000-000000000002';
const token = 'synthetic-customer-journey-token';

test.use({viewport: {width: 360, height: 740}, isMobile: true, hasTouch: true});

test('repeatable mobile customer journey: trade & area -> post job -> accept quote -> consent -> confirm completion -> failed review retry -> reload shows review once', async ({
  page,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_SUPABASE_URL !== backend,
    'Requires the isolated loopback application build.'
  );
  test.setTimeout(60000);
  page.setDefaultTimeout(10000);

  expect(customer.id).not.toBe(professional.id);

  type StoredReview = {
    booking_id: string;
    author_id: string;
    professional_id: string;
    stars: number;
    body: string;
    created_at: string;
  };

  let createdJob: {
    id: string;
    title: string;
    description: string;
    status: string;
    created_at: string;
    budget_pence: number | null;
    private_address: string;
  } | null = null;
  let quoteAccepted = 0;
  let bookingStatus: 'booked' | 'awaiting_customer' | 'completed' = 'booked';
  let completionConfirmCalls = 0;
  const consentChanges: boolean[] = [];
  let reviewAttempts = 0;
  let savedReview: StoredReview | null = null;

  let firstJobsRead = true;
  const fixture = createServer(async (request, response) => {
    const parsedUrl = new URL(request.url ?? '/', backend);
    const path = parsedUrl.pathname;
    const reply = (status: number, data: unknown) => {
      response.writeHead(status, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'content-type': 'application/json',
      });
      response.end(status === 204 ? '' : JSON.stringify(data));
    };

    if (request.method === 'OPTIONS') return reply(204, null);

    // Public catalog endpoints used on /services and /jobs
    if (path === '/rest/v1/trades') return reply(200, [trade]);
    if (path === '/rest/v1/service_areas') return reply(200, [area]);
    if (path === '/rest/v1/rpc/find_trustfive_professionals_with_reviews') {
      return reply(200, [
        {
          application_id: professional.application_id,
          business_name: professional.business_name,
          about: 'Independently assessed local installer.',
          trade_name: trade.name,
          area_name: area.area_name,
          city: area.city,
          quality_score: 94,
          slot: 1,
          average_stars: 4.9,
          review_count: 3,
        },
      ]);
    }

    if (request.headers.authorization !== 'Bearer ' + token) {
      return reply(401, {message: 'Synthetic session required'});
    }

    const readBody = async () => {
      let raw = '';
      for await (const chunk of request) raw += chunk;
      return raw ? JSON.parse(raw) : {};
    };

    switch (path) {
      case '/auth/v1/user':
        return reply(200, customer);

      case '/rest/v1/rpc/resolve_trustfive_territory':
        return reply(200, area.id);

      case '/rest/v1/rpc/set_job_contact_preference': {
        const body = await readBody();
        if (body.p_job !== jobId || body.p_preference !== 'phone_after_booking') {
          return reply(400, {message: 'Unexpected contact preference'});
        }
        return reply(500, {message: 'Synthetic contact preference outage'});
      }

      case '/rest/v1/rpc/create_job_with_private_location': {
        if (createdJob) return reply(409, {message: 'Unexpected duplicate job'});
        const body = await readBody();
        if (body.p_trade !== trade.id || body.p_area !== area.id) {
          return reply(400, {message: 'Unexpected trade or area selection'});
        }
        createdJob = {
          id: jobId,
          title: body.p_title,
          description: body.p_description,
          status: 'open',
          created_at: '2026-11-23T08:00:00Z',
          budget_pence: body.p_budget_pence ?? null,
          private_address: body.p_address,
        };
        return reply(200, jobId);
      }

      case '/rest/v1/jobs':
        if (!createdJob && firstJobsRead) {
          firstJobsRead = false;
          return reply(500, {message: 'Synthetic jobs read outage'});
        }
        return reply(
          200,
          createdJob
            ? [
                {
                  id: createdJob.id,
                  title: createdJob.title,
                  description: createdJob.description,
                  status:
                    bookingStatus === 'completed'
                      ? 'completed'
                      : quoteAccepted
                        ? 'booked'
                        : 'open',
                  created_at: createdJob.created_at,
                  budget_pence: createdJob.budget_pence,
                },
              ]
            : []
        );

      case '/rest/v1/rpc/customer_quotes':
        return reply(
          200,
          createdJob
            ? [
                {
                  quote_id: quoteId,
                  job_id: jobId,
                  business_name: professional.business_name,
                  amount_pence: 28500,
                  message: 'Includes two 4K cameras and weatherproof cabling.',
                  status: quoteAccepted ? 'accepted' : 'pending',
                  created_at: '2026-11-23T08:05:00Z',
                },
              ]
            : []
        );

      case '/rest/v1/rpc/accept_job_quote': {
        const body = await readBody();
        if (body.p_quote !== quoteId || quoteAccepted) {
          return reply(400, {message: 'Unexpected quote acceptance'});
        }
        quoteAccepted += 1;
        return reply(200, bookingId);
      }

      case '/rest/v1/job_bookings':
        return reply(
          200,
          quoteAccepted
            ? [
                {
                  id: bookingId,
                  job_id: jobId,
                  quote_id: quoteId,
                  customer_id: customer.id,
                  professional_id: professional.id,
                  status: bookingStatus,
                  created_at: '2026-11-23T08:10:00Z',
                },
              ]
            : []
        );

      case '/rest/v1/booking_appointments':
        return reply(200, []);

      case '/rest/v1/rpc/booking_job_site_address':
        return reply(200, [
          {
            address_label: createdJob?.private_address ?? '14 Synthetic Close, Manchester, M1 2AB',
            postcode: 'M1 2AB',
            sharing_enabled: consentChanges.at(-1) ?? false,
          },
        ]);

      case '/rest/v1/rpc/set_booking_address_sharing': {
        const body = await readBody();
        if (body.p_booking !== bookingId || typeof body.p_allow !== 'boolean') {
          return reply(400, {message: 'Unexpected synthetic consent request'});
        }
        consentChanges.push(body.p_allow);
        return reply(200, null);
      }

      case '/rest/v1/rpc/confirm_job_completed': {
        const body = await readBody();
        if (body.p_booking !== bookingId || bookingStatus !== 'awaiting_customer') {
          return reply(400, {message: 'Booking is not awaiting completion confirmation'});
        }
        completionConfirmCalls += 1;
        if (completionConfirmCalls === 1) return reply(503, {message: 'Synthetic completion outage'});
        bookingStatus = 'completed';
        return reply(200, null);
      }

      case '/rest/v1/booking_reviews': {
        if (request.method === 'GET') {
          return reply(200, savedReview ? [savedReview] : []);
        }
        if (request.method === 'POST') {
          reviewAttempts += 1;
          const body = await readBody();
          if (
            body.booking_id !== bookingId ||
            body.author_id !== customer.id ||
            body.professional_id !== professional.id ||
            body.author_id === body.professional_id
          ) {
            return reply(400, {message: 'Invalid synthetic review identities'});
          }
          if (reviewAttempts === 1) {
            return reply(500, {message: 'Synthetic temporary review outage'});
          }
          if (savedReview) {
            return reply(409, {code: '23505', message: 'Duplicate verified-booking review'});
          }
          savedReview = {
            booking_id: bookingId,
            author_id: customer.id,
            professional_id: professional.id,
            stars: Number(body.stars),
            body: String(body.body),
            created_at: '2026-11-23T08:20:00Z',
          };
          return reply(201, [savedReview]);
        }
        return reply(405, {message: 'Method not allowed'});
      }

      default:
        return reply(200, []);
    }
  });

  // Other signed-in browser specs can briefly own the fixture port.
  for (let attempt = 0; ; attempt++) {
    try {
      await once(fixture.listen(54321, '127.0.0.1'), 'listening');
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || attempt >= 80) throw error;
      await delay(250);
    }
  }

  const assertZeroHorizontalOverflow = async () => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  };

  try {
    const session = {
      access_token: token,
      refresh_token: 'synthetic-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: customer,
    };
    await page.context().addCookies([
      {
        name: 'sb-127-auth-token',
        value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
        url: app,
      },
    ]);

    // Synthetic UK address lookup; keeps external/paid geocoding services untouched.
    await page.route('**/api/address/search', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [
            {
              label: '14 Synthetic Close, Manchester, M1 2AB',
              latitude: 53.4808,
              longitude: -2.2426,
              postcode: 'M1 2AB',
              precision: 'address',
              country: 'GB',
            },
          ],
        }),
      });
    });

    // 1. Trade and area selection on /services -> carries both into /jobs
    await page.goto(`/services?area=${area.id}`);
    await expect(page.getByText(professional.business_name)).toBeVisible();
    await page.locator('#directory-trade').selectOption(trade.id);
    const describeJobLink = page.getByRole('link', {name: 'Describe your job →'});
    await expect(describeJobLink).toHaveAttribute(
      'href',
      `/jobs?trade=${trade.slug}&area=${area.id}`
    );
    await assertZeroHorizontalOverflow();
    await describeJobLink.click();

    // 2. Post a job with private address and automatic verified territory selection
    await expect(page).toHaveURL(`/jobs?trade=${trade.slug}&area=${area.id}`);
    const retryJobs = page.getByRole('button', {name: 'Retry loading jobs and quotes'});
    await expect(retryJobs).toBeVisible();
    await expect(page.getByLabel('Job title')).toHaveCount(0);
    await retryJobs.press('Enter');
    await expect(page.getByRole('combobox', {name: 'Trade', exact: true})).toHaveValue(trade.id);
    await page.getByLabel('Job title').fill('Install 4K driveway CCTV cameras');
    await page
      .getByLabel('What needs doing?')
      .fill('Supply and mount two external cameras with tidy cable routing.');

    await page.locator('#directory-address').fill('M1 2AB');
    const addressOption = page.getByRole('option', {
      name: /14 Synthetic Close, Manchester, M1 2AB/,
    });
    await expect(addressOption).toBeVisible();
    await addressOption.click();
    await expect(
      page.getByText('Verified territory selected automatically from your address.')
    ).toBeVisible();

    await page.getByLabel('How would you prefer to be contacted?', {exact: false}).selectOption('phone_after_booking');
    await page.getByRole('button', {name: 'Publish job request'}).click();
    await expect(page.getByText('Job published.', {exact: false})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Install 4K driveway CCTV cameras'})).toBeVisible();
    await expect(page.getByText('We could not confirm your contact preference.', {exact: false})).toBeVisible();
    await expect(page.getByLabel('Job title')).toHaveValue('');
    expect(createdJob).not.toBeNull();
    expect(page.url()).not.toContain('Synthetic Close');
    await assertZeroHorizontalOverflow();

    // 3. Accept the distinct professional's quote and open the confirmed booking
    const reviewQuote = page.getByRole('button', {name: 'Review and accept quote'});
    await expect(reviewQuote).toBeVisible();
    await reviewQuote.click();
    await page.getByRole('button', {name: 'Confirm and create booking'}).click();
    const openBookingLink = page.getByRole('link', {name: 'Open your confirmed booking'});
    await expect(openBookingLink).toBeVisible();
    await expect(openBookingLink).toHaveAttribute('href', `/bookings?booking=${bookingId}`);
    expect(quoteAccepted).toBe(1);
    await openBookingLink.click();

    // 4. Open booking on 360px mobile & verify PR #113 private address consent focus + toggle
    await expect(page).toHaveURL(`/bookings?booking=${bookingId}`);
    await expect(page.getByTestId(`booking-detail-${bookingId}`)).toBeVisible();
    await expect(
      page.getByRole('heading', {name: 'Install 4K driveway CCTV cameras'})
    ).toBeVisible();
    await assertZeroHorizontalOverflow();

    const shareButton = page.getByRole('button', {
      name: 'Share exact address with booked professional',
    });
    await shareButton.press('Enter');
    await expect(page.getByRole('button', {name: 'Keep private'})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(shareButton).toBeFocused();
    expect(consentChanges).toEqual([]);
    await shareButton.press('Enter');
    await page.getByRole('button', {name: 'Confirm share address'}).click();
    await expect(page.getByText('Sharing is active', {exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Turn off exact address sharing'}).click();
    await expect(shareButton).toBeVisible();
    expect(consentChanges).toEqual([true, false]);

    // 5. Distinct professional marks work ready -> customer confirms completion with 2-step focus guard
    bookingStatus = 'awaiting_customer';
    await page.getByRole('button', {name: 'Refresh', exact: true}).click();
    const completionSection = page.getByTestId('booking-section-completion');
    const reviewCompletionBtn = completionSection.getByRole('button', {
      name: 'Review job completion',
    });
    await expect(reviewCompletionBtn).toBeVisible();

    await reviewCompletionBtn.press('Enter');
    await expect(page.getByRole('button', {name: 'Not yet — go back'})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(reviewCompletionBtn).toBeFocused();
    expect(completionConfirmCalls).toBe(0);

    await reviewCompletionBtn.press('Enter');
    await page.getByRole('button', {name: 'Yes, work is completed'}).click();
    const completionPanel = page.getByTestId(`confirm-completion-panel-${bookingId}`);
    await expect(completionPanel.getByRole('alert')).toContainText('Synthetic completion outage');
    await expect(completionSection.getByRole('button', {name: 'Retry completion action'})).toHaveCount(0);
    await expect(completionSection.getByRole('button', {name: 'Leave verified-booking review'})).toHaveCount(0);
    expect(completionConfirmCalls).toBe(1);
    await completionPanel.getByRole('button', {name: 'Yes, work is completed'}).press('Enter');

    const leaveReviewBtn = completionSection.getByRole('button', {
      name: 'Leave verified-booking review',
    });
    await expect(leaveReviewBtn).toBeVisible();
    await expect(leaveReviewBtn).toBeFocused();
    expect(completionConfirmCalls).toBe(2);

    // 6. Verified review: Escape focus return -> failed submit preserves draft -> retry succeeds -> reload shows once
    await leaveReviewBtn.press('Enter');
    await expect(page.getByRole('heading', {name: 'Leave a verified-booking review'})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(leaveReviewBtn).toBeFocused();

    await leaveReviewBtn.press('Enter');
    const reviewText = 'Punctual arrival, tidy cable routing and clear handover testing.';
    const starsSelect = page.locator(`#review-stars-${bookingId}`);
    const bodyInput = page.locator(`#review-body-${bookingId}`);
    await starsSelect.selectOption('4');
    await bodyInput.fill(reviewText);

    // Attempt 1 fails transiently -> draft (both stars and text) MUST remain preserved in the form
    await page.getByRole('button', {name: 'Submit review'}).click();
    await expect(
      completionSection.getByText(
        'Synthetic temporary review outage — your draft is preserved above so you can retry safely.'
      )
    ).toBeVisible();
    await expect(starsSelect).toHaveValue('4');
    await expect(bodyInput).toHaveValue(reviewText);
    expect(reviewAttempts).toBe(1);
    expect(savedReview).toBeNull();

    // Attempt 2 retries with preserved draft and succeeds
    await page.getByRole('button', {name: 'Submit review'}).click();
    const submittedCard = page.getByTestId(`review-submitted-${bookingId}`);
    await expect(submittedCard).toBeVisible();
    await expect(submittedCard).toBeFocused();
    await expect(submittedCard).toContainText('Verified-booking review submitted.');
    await expect(submittedCard).toContainText('4/5 stars');
    await expect(submittedCard).toContainText(reviewText);
    await expect(page.getByTestId('booking-review-form')).toHaveCount(0);
    await expect(leaveReviewBtn).toHaveCount(0);
    expect(reviewAttempts).toBe(2);
    expect(savedReview).toMatchObject({
      booking_id: bookingId,
      author_id: customer.id,
      professional_id: professional.id,
      stars: 4,
      body: reviewText,
    });

    // 7. Full reload shows the submitted review exactly once with zero overflow on 360px mobile
    await page.reload();
    const reloadedCard = page.getByTestId(`review-submitted-${bookingId}`);
    await expect(reloadedCard).toHaveCount(1);
    await expect(reloadedCard).toBeVisible();
    await expect(reloadedCard).toContainText('4/5 stars');
    await expect(reloadedCard).toContainText(reviewText);
    await expect(page.getByText(reviewText)).toHaveCount(1);
    await expect(page.getByTestId('booking-review-form')).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Leave verified-booking review'})).toHaveCount(0);
    await assertZeroHorizontalOverflow();
  } finally {
    await new Promise<void>((resolve, reject) => {
      fixture.close(error => (error ? reject(error) : resolve()));
      fixture.closeAllConnections();
    });
  }
});
