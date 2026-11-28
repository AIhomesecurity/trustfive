import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test,type Page} from '@playwright/test';
import {
  buildIdeabookJobBriefHref,
  parseIdeabookQuickAddParams,
  summarizeIdeabookBudget,
  validateIdeabookDraft,
  validateIdeabookItemDraft,
} from '../../lib/ideabooks';
import {calculateItemisedQuote, formatItemisedQuoteScope} from '../../lib/quote-itemiser';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';
const homeowner = {id: 'aaaaaaaa-0057-4000-8000-000000000101', aud: 'authenticated'};
const bookId = 'bbbbbbbb-0057-4000-8000-000000000001';
const itemId = 'cccccccc-0057-4000-8000-000000000001';
const leadJobId = 'dddddddd-0057-4000-8000-000000000001';
const allocId = 'eeeeeeee-0057-4000-8000-000000000001';

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

test.describe('REA Rated People + Houzz pure domain helpers', () => {
  test('summarises Ideabook budgets, converts Ideabooks to /jobs brief URLs and parses quick-add params', () => {
    expect(validateIdeabookDraft({title: 'Hi', targetBudgetGbp: 500})).toContain('at least 3 characters');
    expect(validateIdeabookItemDraft({title: 'Ok', estimatedGbp: 100})).toContain('at least 3 characters');

    const summary = summarizeIdeabookBudget(100000, [
      {estimated_pence: 65000},
      {estimated_pence: 20000},
    ]);
    expect(summary).toEqual({
      targetGbp: 1000,
      estimatedGbp: 850,
      remainingGbp: 150,
      overBudget: false,
      percentUsed: 85,
    });

    const over = summarizeIdeabookBudget(50000, [{estimated_pence: 75000}]);
    expect(over.overBudget).toBe(true);
    expect(over.remainingGbp).toBe(-250);

    const href = buildIdeabookJobBriefHref(
      {
        title: 'Driveway CCTV & Porch Lighting',
        room_type: 'security_smart_home',
        property_style: 'victorian_terrace',
        target_budget_pence: 120000,
        notes: 'Prefer black conduit along brick eaves.',
      },
      [{title: '4-camera PoE CCTV kit', estimated_pence: 89500, cost_guide_slug: 'cctv-installation', notes: ''}]
    );
    expect(href).toContain('/jobs?');
    expect(href).toContain('trade=cctv-installation');
    expect(href).toContain('budget=895');

    const parsedGuide = parseIdeabookQuickAddParams(
      '?addGuide=cctv-installation&title=CCTV%204-camera&est=895'
    );
    expect(parsedGuide).toEqual({
      kind: 'cost_guide',
      costGuideSlug: 'cctv-installation',
      showcaseId: '',
      title: 'CCTV 4-camera',
      estimatedGbp: 895,
    });
    expect(parseIdeabookQuickAddParams('?addGuide=../bad')).toBeNull();
  });

  test('calculates itemised quotes with optional 20% UK VAT and formats milestone scope text', () => {
    const withVat = calculateItemisedQuote({
      items: [
        {category: 'labour', description: 'First & second fix installation', amountGbp: 300},
        {category: 'materials', description: '4K PoE NVR & cameras', amountGbp: 450},
      ],
      includeVat: true,
    });
    expect(withVat).toEqual({
      subtotalGbp: 750,
      vatGbp: 150,
      totalGbp: 900,
      validItemCount: 2,
    });

    const formatted = formatItemisedQuoteScope({
      items: [
        {category: 'labour', description: 'Installation labour', amountGbp: 300},
        {category: 'materials', description: 'Materials', amountGbp: 200},
      ],
      includeVat: false,
      milestoneId: 'materials_balance',
      warrantyNote: '12-month workmanship guarantee',
    });
    expect(formatted).not.toBeNull();
    expect(formatted?.amountString).toBe('500.00');
    expect(formatted?.scopeText).toContain('Total quote: £500.00');
    expect(formatted?.scopeText).toContain('Materials cost agreed on start date');
  });
});

test.describe('Houzz Project Ideabooks & Houzz Pro Itemised Quote Builder E2E', () => {
  test('signed-in homeowner creates an Ideabook, adds a saved cost guide item, converts to /jobs, and approved pro builds an itemised VAT quote on /quotes', async ({
    browser,
  }) => {
    test.skip(
      process.env.NEXT_PUBLIC_SUPABASE_URL !== backend,
      'Requires the isolated loopback application build.'
    );
    test.setTimeout(60000);

    const books: Array<Record<string, unknown>> = [];
    const items: Array<Record<string, unknown>> = [];

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
      if (id !== homeowner.id) return reply(401, {message: 'Synthetic session required'});
      if (url.pathname === '/auth/v1/user') return reply(200, {id, aud: 'authenticated'});

      const leaf = url.pathname.split('/').pop() ?? '';
      if (leaf === 'homeowner_ideabooks') {
        if (request.method === 'POST') {
          let raw = '';
          for await (const chunk of request) raw += chunk;
          const payload = JSON.parse(raw);
          const created = {
            id: bookId,
            owner_id: homeowner.id,
            title: payload.title,
            room_type: payload.room_type,
            property_style: payload.property_style,
            target_budget_pence: payload.target_budget_pence,
            notes: payload.notes ?? '',
            status: 'planning',
            created_at: '2026-11-26T22:00:00Z',
          };
          books.unshift(created);
          return reply(201, created);
        }
        return reply(200, books);
      }
      if (leaf === 'homeowner_ideabook_items') {
        if (request.method === 'POST') {
          let raw = '';
          for await (const chunk of request) raw += chunk;
          const payload = JSON.parse(raw);
          const created = {
            id: itemId,
            ideabook_id: payload.ideabook_id,
            item_kind: payload.item_kind,
            showcase_id: payload.showcase_id ?? null,
            cost_guide_slug: payload.cost_guide_slug ?? null,
            title: payload.title,
            estimated_pence: payload.estimated_pence ?? 0,
            notes: payload.notes ?? '',
            created_at: '2026-11-26T22:05:00Z',
          };
          items.push(created);
          return reply(201, created);
        }
        return reply(200, items);
      }
      if (leaf === 'open_jobs_for_professional') {
        return reply(200, [
          {
            job_id: leadJobId,
            title: 'Driveway CCTV & Porch Lighting',
            description: 'Victorian terrace needing 4 PoE cameras and tidy external conduit.',
            budget_pence: 95000,
            trade_name: 'CCTV Installation',
            area_name: 'Didsbury',
            allocation_id: allocId,
            created_at: '2026-11-26T21:00:00Z',
          },
        ]);
      }
      if (leaf === 'professional_quotes') return reply(200, []);
      if (leaf === 'job_bookings') return reply(200, []);
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
      await signIn(desktop, homeowner);
      await signIn(mobile, homeowner);

      // 1. Arrive on /ideabooks from a Cost Guide "Save to Ideabook" link, create board & save item.
      await desktop.goto(
        `${app}/ideabooks?addGuide=cctv-installation&title=4-Camera%20PoE%20CCTV&est=850`
      );
      await expect(desktop.getByTestId('ideabook-quick-add-banner')).toContainText('4-Camera PoE CCTV');

      await desktop.getByLabel('Project title').fill('Driveway CCTV & Security');
      await desktop.getByLabel('Target project budget (£)').fill('1200');
      await desktop.getByRole('button', {name: 'Create Project Ideabook'}).click();

      const panel = desktop.getByTestId('active-ideabook-panel');
      await expect(panel).toContainText('Driveway CCTV & Security');

      await desktop.getByRole('button', {name: 'Add item to Ideabook'}).click();
      await expect(panel).toContainText('4-Camera PoE CCTV');
      await expect(desktop.getByTestId('ideabook-budget-summary')).toContainText('£850');
      await expect(desktop.getByTestId('ideabook-budget-summary')).toContainText('£350 remaining');

      const toJobHref = await desktop.getByTestId('ideabook-to-job-link').getAttribute('href');
      expect(toJobHref).toContain('/jobs?');
      expect(toJobHref).toContain('trade=cctv-installation');
      expect(toJobHref).toContain('budget=850');

      // 2. Mobile 360px layout check on /ideabooks (zero horizontal overflow).
      await mobile.goto(`${app}/ideabooks`);
      await expect(mobile.getByTestId('active-ideabook-panel')).toBeVisible();
      const ideabooksOverflow = await mobile.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(ideabooksOverflow).toBeLessThanOrEqual(0);

      // 3. Approved professional uses Houzz Pro-style Itemised Quote & VAT Builder on /quotes.
      await desktop.goto(`${app}/quotes`);
      await desktop.getByRole('button', {name: 'Prepare a quote'}).click();
      await desktop
        .getByRole('button', {name: /Build itemised quote & milestones/i})
        .click();
      await desktop.getByLabel('Add UK VAT (20%)').check();
      await expect(desktop.getByTestId('quote-itemised-totals')).toContainText('£504.00');
      await desktop.getByRole('button', {name: 'Apply itemised breakdown to quote'}).click();
      await expect(desktop.getByLabel('Your quote (£)')).toHaveValue('504.00');
      await expect(desktop.getByLabel('Message and scope of work')).toContainText('VAT (20%): £84.00');
    } finally {
      await desktop.close();
      await mobile.close();
      await new Promise<void>(resolve => fixture.close(() => resolve()));
    }
  });
});
