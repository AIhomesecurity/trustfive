import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test} from '@playwright/test';
import {
  filterComplaintsByStatus,
  formatComplaintCategoryLabel,
  NO_SHOW_STATEMENT_PREFIX,
  resolveComplaintSubmission,
  validateAdminDecisionNote,
} from '../../lib/booking-complaints';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';
const customerId = 'aaaaaaaa-0000-4000-8000-000000000051';
const proId = 'aaaaaaaa-0000-4000-8000-000000000052';
const adminId = 'aaaaaaaa-0000-4000-8000-000000000053';
const bookingId = 'bbbbbbbb-0000-4000-8000-000000000051';
const existingCase2Id = 'cccccccc-0000-4000-8000-000000000052';

test.describe('Booking complaints and no-show helpers', () => {
  test('maps no-show reports cleanly onto conduct category with prefix and validates bounds', () => {
    const short = resolveComplaintSubmission('no_show', 'Too short');
    expect(short.error).toContain('at least 30 characters');

    const valid = resolveComplaintSubmission(
      'no_show',
      'Confirmed 10:00–11:00 appointment was missed with no message or call received.'
    );
    expect(valid.error).toBeNull();
    expect(valid.dbCategory).toBe('conduct');
    expect(valid.statement.startsWith(NO_SHOW_STATEMENT_PREFIX)).toBe(true);
    expect(formatComplaintCategoryLabel(valid.dbCategory, valid.statement)).toBe(
      'No-show / missed appointment'
    );
  });

  test('filters open vs resolved complaints and validates admin evidence notes', () => {
    const rows = [
      {status: 'submitted'},
      {status: 'investigating'},
      {status: 'substantiated'},
      {status: 'unsubstantiated'},
    ];
    expect(filterComplaintsByStatus(rows, 'open')).toHaveLength(2);
    expect(filterComplaintsByStatus(rows, 'resolved')).toHaveLength(2);
    expect(validateAdminDecisionNote('Short note')).toContain('30 characters');
    expect(
      validateAdminDecisionNote('Reviewed dated appointment timestamps and both participant statements.')
    ).toBeNull();
  });
});

test.use({viewport: {width: 360, height: 800}, isMobile: true, hasTouch: true});

test('360px no-show dispute lifecycle: customer retry, respondent reply, isolated admin review and appeal', async ({page}) => {
  test.skip(process.env.NEXT_PUBLIC_SUPABASE_URL !== backend, 'Requires the isolated loopback application build.');
  test.setTimeout(60000);

  let failFirstSubmit = true;
  const complaints: Array<{
    id: string;
    booking_id: string;
    reporter_id: string;
    respondent_id: string;
    category: string;
    statement: string;
    respondent_statement: string | null;
    resolution_reason: string | null;
    status: string;
    created_at: string;
  }> = [
    {
      id: existingCase2Id,
      booking_id: bookingId,
      reporter_id: customerId,
      respondent_id: proId,
      category: 'billing',
      statement: 'Second separate billing dispute case that must stay isolated in admin review.',
      respondent_statement: null,
      resolution_reason: null,
      status: 'submitted',
      created_at: '2026-11-23T10:00:00Z',
    },
  ];
  const appeals: Array<{id: string; complaint_id: string; appellant_id: string; reason: string; status: string; review_note: string | null}> = [];
  const createdCaseId = 'cccccccc-0000-4000-8000-000000000051';

  const fixture = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', backend);
    const actor = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const reply = (status: number, data: unknown) => {
      res.writeHead(status, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
        'content-type': 'application/json',
      });
      res.end(status === 204 ? '' : JSON.stringify(data));
    };
    if (req.method === 'OPTIONS') return reply(204, null);
    if (![customerId, proId, adminId].includes(actor)) return reply(401, {message: 'Synthetic session required'});

    let bodyRaw = '';
    if (req.method === 'POST' || req.method === 'PATCH') {
      for await (const chunk of req) bodyRaw += chunk;
    }

    switch (url.pathname) {
      case '/auth/v1/user':
        return reply(200, {id: actor, aud: 'authenticated'});
      case '/rest/v1/rpc/is_trustfive_admin':
        return reply(200, actor === adminId);
      case '/rest/v1/job_bookings':
        return reply(200, [{id: bookingId, customer_id: customerId, professional_id: proId, status: 'booked'}]);
      case '/rest/v1/booking_complaints':
        if (req.method === 'GET') return reply(200, complaints);
        if (req.method === 'POST') {
          if (failFirstSubmit) {
            failFirstSubmit = false;
            return reply(503, {message: 'Synthetic complaint service interruption'});
          }
          const payload = JSON.parse(bodyRaw);
          if (payload.category !== 'conduct' || !String(payload.statement).startsWith(NO_SHOW_STATEMENT_PREFIX)) {
            return reply(400, {message: 'Expected mapped no-show payload'});
          }
          complaints.unshift({
            id: createdCaseId,
            booking_id: payload.booking_id,
            reporter_id: payload.reporter_id,
            respondent_id: payload.respondent_id,
            category: payload.category,
            statement: payload.statement,
            respondent_statement: null,
            resolution_reason: null,
            status: 'submitted',
            created_at: '2026-11-24T12:00:00Z',
          });
          return reply(201, null);
        }
        return reply(405, {message: 'Method not allowed'});
      case '/rest/v1/rpc/respond_to_booking_complaint': {
        const {p_complaint, p_response} = JSON.parse(bodyRaw);
        const target = complaints.find(c => c.id === p_complaint);
        if (!target || actor !== target.respondent_id) return reply(403, {message: 'Not respondent'});
        target.respondent_statement = p_response;
        target.status = 'investigating';
        return reply(200, null);
      }
      case '/rest/v1/rpc/resolve_booking_complaint': {
        if (actor !== adminId) return reply(403, {message: 'Not authorised'});
        const {p_complaint, p_outcome, p_reason} = JSON.parse(bodyRaw);
        const target = complaints.find(c => c.id === p_complaint);
        if (!target) return reply(404, {message: 'Missing complaint'});
        target.status = p_outcome;
        target.resolution_reason = p_reason;
        return reply(200, null);
      }
      case '/rest/v1/complaint_appeals':
        if (req.method === 'GET') return reply(200, appeals);
        if (req.method === 'POST') {
          const payload = JSON.parse(bodyRaw);
          appeals.push({
            id: 'dddddddd-0000-4000-8000-000000000051',
            complaint_id: payload.complaint_id,
            appellant_id: payload.appellant_id,
            reason: payload.reason,
            status: 'pending',
            review_note: null,
          });
          return reply(201, null);
        }
        return reply(405, {message: 'Method not allowed'});
      default:
        return reply(200, []);
    }
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

  async function signInAs(userId: string) {
    const session = {
      access_token: userId,
      refresh_token: 'synthetic-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: {id: userId, aud: 'authenticated'},
    };
    await page.context().clearCookies();
    await page.context().addCookies([
      {
        name: 'sb-127-auth-token',
        value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
        url: app,
      },
    ]);
  }

  try {
    // 1. Customer submits no-show dispute, recovers from transient 503 with draft intact.
    await signInAs(customerId);
    await page.goto('/support/complaints');
    await page.getByLabel('Related booking').selectOption(bookingId);
    await page.getByLabel('Concern type').selectOption('no_show');
    const description = 'Agreed 10:00–11:00 appointment was missed with no message or call from the tradesperson.';
    await page.getByLabel('Describe the issue').fill(description);
    await page.getByRole('button', {name: 'Submit for review'}).click();
    const submitAlert = page.locator('main').getByRole('alert');
    await expect(submitAlert).toContainText('Synthetic complaint service interruption');
    await expect(submitAlert).toBeFocused();
    await expect(page.getByLabel('Describe the issue')).toHaveValue(description);

    await page.getByRole('button', {name: 'Submit for review'}).click();
    await expect(page.getByText('Your confidential case has been recorded for human review.')).toBeVisible();
    await expect(page.getByRole('heading', {name: /No-show \/ missed appointment/})).toBeVisible();

    // 2. Respondent replies cleanly.
    await signInAs(proId);
    await page.goto('/support/complaints');
    const caseCard = page.getByRole('article').filter({hasText: 'No-show / missed appointment'});
    await caseCard.getByRole('button', {name: 'Respond to complaint'}).click();
    await caseCard.getByLabel('Your response').fill('Van breakdown on the M60; I messaged late and offered to reschedule.');
    await caseCard.getByRole('button', {name: 'Submit response'}).click();
    await expect(page.getByText('Your response was recorded for the independent reviewer.')).toBeVisible();

    // 3. Ordinary user is denied /admin/complaints.
    await page.goto('/admin/complaints');
    await expect(page.locator('main').getByRole('alert')).toContainText('Admin access required.');

    // 4. Admin sees both open cases; typing findings on Case #1 does NOT leak into Case #2.
    await signInAs(adminId);
    await page.goto('/admin/complaints');
    const card1 = page.locator(`#complaint-case-${createdCaseId}`);
    const card2 = page.locator(`#complaint-case-${existingCase2Id}`);
    await expect(card1).toBeVisible();
    await expect(card2).toBeVisible();

    const adminFindings = 'Reviewed confirmed appointment window and respondent reply; substantiated missed visit without timely notice.';
    await card1.getByLabel('Decision').selectOption('substantiated');
    await card1.getByLabel('Document findings and evidence').fill(adminFindings);
    await expect(card2.getByLabel('Document findings and evidence')).toHaveValue('');

    // Two-step confirmation with Escape cancel, then confirm.
    await card1.getByRole('button', {name: 'Record human decision'}).click();
    await expect(card1.getByRole('button', {name: 'Confirm human decision'})).toBeVisible();
    await card1.getByRole('button', {name: 'Cancel'}).click();
    await card1.getByRole('button', {name: 'Record human decision'}).click();
    await card1.getByRole('button', {name: 'Confirm human decision'}).click();
    await expect(page.getByText('Evidence-based complaint decision recorded.')).toBeVisible();

    // 5. Respondent appeals the resolved decision cleanly.
    await signInAs(proId);
    await page.goto('/support/complaints');
    await page.getByRole('button', {name: /Resolved 1/}).click();
    await page.getByRole('button', {name: 'Appeal decision'}).click();
    await page.getByLabel('Reason for appeal').fill('Submitting dated roadside recovery receipt as additional evidence for review.');
    await page.getByRole('button', {name: 'Submit appeal'}).click();
    await expect(page.getByText('Appeal submitted for independent human review.')).toBeVisible();
    await expect(page.getByText('Your appeal: pending')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  } finally {
    await new Promise<void>((resolve, reject) => {
      fixture.close(error => (error ? reject(error) : resolve()));
      fixture.closeAllConnections();
    });
  }
});
