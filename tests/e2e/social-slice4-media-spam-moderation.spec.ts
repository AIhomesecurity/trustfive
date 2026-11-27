import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test,type Page} from '@playwright/test';
import {
  assessSocialPostSafety,
  classifySocialWriteError,
  MAX_SOCIAL_IMAGE_BYTES,
  validateSocialMediaFile,
} from '../../lib/social-safety';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';
const resident = {id: 'aaaaaaaa-0000-4000-8000-000000000095', aud: 'authenticated'};
const moderator = {id: 'aaaaaaaa-0000-4000-8000-000000000096', aud: 'authenticated'};
const areaA = {id: '11111111-1111-4111-8111-111111111101', area_name: 'Didsbury', city: 'Manchester'};
const report1 = '66666666-6666-4666-8666-666666666601';
const report2 = '66666666-6666-4666-8666-666666666602';
const reportedPost1 = '77777777-7777-4777-8777-777777777701';
const reportedPost2 = '77777777-7777-4777-8777-777777777702';

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

test.describe('Slice 4 media privacy, spam and quota helper unit tests', () => {
  test('validates safe raster image types and rejects SVG, empty or oversized files', () => {
    const ok = validateSocialMediaFile({name: 'chimney.jpg', type: 'image/jpeg', size: 240_000});
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.stripMetadata).toBe(true);
      expect(ok.summary).toContain('GPS coordinates and EXIF camera metadata will be stripped');
    }

    const svg = validateSocialMediaFile({name: 'payload.svg', type: 'image/svg+xml', size: 1024});
    expect(svg.ok).toBe(false);
    if (!svg.ok) expect(svg.reason).toContain('Only JPEG, PNG or WebP');

    const empty = validateSocialMediaFile({name: 'empty.png', type: 'image/png', size: 0});
    expect(empty.ok).toBe(false);

    const huge = validateSocialMediaFile({
      name: 'huge.webp',
      type: 'image/webp',
      size: MAX_SOCIAL_IMAGE_BYTES + 1,
    });
    expect(huge.ok).toBe(false);
  });

  test('blocks websites, phones, emails, full UK postcodes, repeated-character flooding and classifies 23514 & P0001 errors', () => {
    const linkSpam = assessSocialPostSafety(
      'Check https://a.example or mytrade.co.uk for cheap deals!'
    );
    expect(linkSpam.blockingError).toContain('cannot be posted in TrustFive Social');
    expect(linkSpam.privacyWarnings.some(w => /Websites and external web links/i.test(w))).toBe(true);

    const flood = assessSocialPostSafety('Hello neighbours!!!!!!!!!!!!!!!!');
    expect(flood.blockingError).toContain('repeated characters');

    const leaky = assessSocialPostSafety('Pop round to M20 2WS or ring 07700 900123 anytime.');
    expect(leaky.blockingError).toContain('cannot be posted in TrustFive Social');
    expect(leaky.privacyWarnings).toHaveLength(2);

    const emailBypass = assessSocialPostSafety('Email me at plumber@example.co.uk or WhatsApp me');
    expect(emailBypass.blockingError).toContain('cannot be posted in TrustFive Social');

    expect(
      classifySocialWriteError(
        {code: '23514', message: 'new row violates check constraint "community_posts_contact_free"'},
        'fallback'
      )
    ).toContain('blocked in TrustFive Social');

    expect(
      classifySocialWriteError(
        {code: 'P0001', message: 'Posting limit reached. Please try again later.'},
        'fallback'
      )
    ).toContain('hourly posting limit');
    expect(classifySocialWriteError(new Error('network'), 'fallback')).toBe('fallback');
  });
});

test.describe('Slice 4 media upload privacy, spam controls and usable moderation queue', () => {
  test('360px resident sees anti-bypass blocks for phones/links/postcodes, DB quota message, media pre-check; moderator filters and confirms hiding reported posts', async ({
    browser,
  }) => {
    test.skip(
      process.env.NEXT_PUBLIC_SUPABASE_URL !== backend,
      'Requires the isolated loopback application build.'
    );
    test.setTimeout(60000);

    let insertAttempts = 0;
    const hiddenCommunityPosts: string[] = [];
    const communityReports = [
      {id: report1, post_id: reportedPost1, category: 'spam', created_at: '2026-11-24T10:00:00Z'},
      {id: report2, post_id: reportedPost2, category: 'privacy', created_at: '2026-11-24T10:15:00Z'},
    ];

    const fixture = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', backend);
      const id = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
      const reply = (status: number, data: unknown) => {
        response.writeHead(status, {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
          'content-type': 'application/json',
        });
        response.end(status === 204 ? '' : JSON.stringify(data));
      };

      if (request.method === 'OPTIONS') return reply(204, null);
      if (id !== resident.id && id !== moderator.id) {
        return reply(401, {message: 'Synthetic session required'});
      }
      if (url.pathname === '/auth/v1/user') return reply(200, {id, aud: 'authenticated'});

      const leaf = url.pathname.split('/').pop() ?? '';
      if (leaf === 'service_areas') return reply(200, [areaA]);
      if (leaf === 'is_trustfive_admin') return reply(200, id === moderator.id);
      if (leaf === 'community_reports') return reply(200, communityReports);
      if (leaf === 'moderate_community_report' && request.method === 'POST') {
        let raw = '';
        for await (const chunk of request) raw += chunk;
        const body = JSON.parse(raw);
        hiddenCommunityPosts.push(`${body.p_action}:${body.p_report}`);
        const idx = communityReports.findIndex(r => r.id === body.p_report);
        if (idx >= 0) communityReports.splice(idx, 1);
        return reply(200, null);
      }

      if (leaf === 'community_posts' && request.method === 'POST') {
        insertAttempts += 1;
        return reply(400, {
          code: 'P0001',
          message: 'Posting limit reached. Please try again later.',
        });
      }

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

    const mobilePage = await browser.newPage({
      viewport: {width: 360, height: 740},
      isMobile: true,
      hasTouch: true,
    });
    const adminPage = await browser.newPage({viewport: {width: 1280, height: 860}});

    try {
      await signIn(mobilePage, resident);
      await mobilePage.goto(`${app}/community/social`);
      await mobilePage.getByTestId('social-composer').getByText('Start a local conversation').click();

      await mobilePage.getByLabel('Neighbourhood to post in').selectOption(areaA.id);
      const bodyInput = mobilePage.getByLabel('Write your community post');

      // 1. Live anti-bypass notice & hard block for UK postcode, numeric and spelled-out phones.
      await bodyInput.fill('Pop over to M20 2WS or call 07700 900123 for spare tiles.');
      const privacyWarn = mobilePage.getByTestId('social-privacy-warning');
      await expect(privacyWarn).toContainText('Full UK postcodes');
      await expect(privacyWarn).toContainText('Telephone numbers');
      await expect(mobilePage.getByTestId('social-contact-block')).toContainText(
        'cannot be posted in TrustFive Social'
      );
      await expect(
        mobilePage.getByRole('button', {name: 'Publish neighbourhood post'})
      ).toBeDisabled();
      await bodyInput.fill('Call zero seven one two three four five six seven eight nine');
      await expect(mobilePage.getByTestId('social-contact-block')).toContainText(
        'including numbers written as words'
      );
      await expect(
        mobilePage.getByRole('button', {name: 'Publish neighbourhood post'})
      ).toBeDisabled();
      expect(insertAttempts).toBe(0);

      // 2. Client-side anti-bypass guard blocks external websites/domains & repeated-char spam locally.
      await bodyInput.fill('Look at https://one.example or mybuilder.co.uk right now');
      await expect(mobilePage.getByTestId('social-contact-block')).toContainText(
        'cannot be posted in TrustFive Social'
      );
      await expect(
        mobilePage.getByRole('button', {name: 'Publish neighbourhood post'})
      ).toBeDisabled();
      await bodyInput.fill(`Repeated ${'x'.repeat(12)} sequence should be removed`);
      await expect(mobilePage.getByTestId('social-contact-block')).toContainText(
        'repeated characters'
      );
      await expect(
        mobilePage.getByRole('button', {name: 'Publish neighbourhood post'})
      ).toBeDisabled();
      expect(insertAttempts).toBe(0);

      // 3. Valid post hitting DB 0011_account_write_quotas.sql (P0001) shows honest hourly limit & preserves draft.
      const validText = 'Does anyone know what time the Didsbury recycling centre closes on Sundays?';
      await bodyInput.fill(validText);
      await mobilePage.getByRole('button', {name: 'Publish neighbourhood post'}).click();
      expect(insertAttempts).toBe(1);
      await expect(mobilePage.getByTestId('social-composer').getByRole('alert')).toContainText(
        'hourly posting limit'
      );
      await expect(bodyInput).toHaveValue(validText);

      // 4. Photo & media privacy local pre-check blocks SVG and confirms EXIF stripping + gated storage on PNG.
      await mobilePage.getByRole('button', {name: 'Photo & media privacy'}).click();
      const fileInput = mobilePage.getByLabel('Check a photo locally (not uploaded)');
      await fileInput.setInputFiles({
        name: 'vector.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('<svg></svg>'),
      });
      await expect(mobilePage.getByTestId('social-composer')).toContainText(
        'Only JPEG, PNG or WebP images are permitted'
      );

      await fileInput.setInputFiles({
        name: 'gutter.png',
        mimeType: 'image/png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      });
      await expect(mobilePage.getByTestId('social-composer')).toContainText(
        'GPS coordinates and EXIF camera metadata will be stripped'
      );

      const mobileOverflow = await mobilePage.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(mobileOverflow).toBeLessThanOrEqual(0);

      // 4b. Dedicated /community/events and /community/groups pages enforce live contact-sharing blocks too.
      await mobilePage.goto(`${app}/community/events`);
      await mobilePage.getByLabel('Event title').fill('Local garden meetup');
      await mobilePage.getByLabel('About the event').fill('Bring tools and meet neighbours.');
      await mobilePage.getByLabel('Public meeting place').fill('Email events@example.test');
      await expect(mobilePage.getByTestId('social-contact-block')).toContainText(
        'cannot be posted in TrustFive Social'
      );
      await expect(mobilePage.getByRole('button', {name: 'Publish event'})).toBeDisabled();

      await mobilePage.goto(`${app}/community/groups`);
      await mobilePage.getByLabel('Group name').fill('Call me 07700 900123');
      await mobilePage
        .getByLabel('What is this group about?')
        .fill('Local neighbours discussing garden projects.');
      await expect(mobilePage.getByTestId('social-contact-block')).toContainText(
        'cannot be posted in TrustFive Social'
      );
      await expect(mobilePage.getByRole('button', {name: 'Create community group'})).toBeDisabled();

      // 5. Usable admin Community reports queue: category filter, Escape cancel, confirmed hide and dismiss.
      await signIn(adminPage, moderator);
      await adminPage.goto(`${app}/admin`);
      const communityQueue = adminPage.getByRole('region', {name: 'Community reports'});
      await expect(communityQueue.getByRole('article')).toHaveCount(2);

      const catSelect = communityQueue.getByLabel('Filter community reports by category');
      await catSelect.selectOption('privacy');
      await expect(communityQueue.getByRole('article')).toHaveCount(1);
      await expect(communityQueue.getByRole('article').first()).toContainText(reportedPost2);

      // Two-step confirmation + Escape cancel leaves post untouched.
      await communityQueue.getByRole('button', {name: 'Hide reported post pending investigation'}).click();
      const cancelBtn = communityQueue.getByRole('button', {name: 'Cancel', exact: true});
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.focus();
      await cancelBtn.press('Escape');
      await expect(communityQueue.getByRole('button', {name: 'Confirm hide community post'})).toHaveCount(0);
      expect(hiddenCommunityPosts).toHaveLength(0);

      // Confirm hide invokes moderate_community_report RPC cleanly.
      await communityQueue.getByRole('button', {name: 'Hide reported post pending investigation'}).click();
      await communityQueue.getByRole('button', {name: 'Confirm hide community post'}).click();
      await expect(adminPage.getByText('Post hidden and community report resolved.')).toBeVisible();

      // Switch back to All and dismiss remaining spam report.
      await catSelect.selectOption('all');
      await expect(communityQueue.getByRole('article')).toHaveCount(1);
      await communityQueue.getByRole('button', {name: 'Dismiss community report'}).click();
      await communityQueue.getByRole('button', {name: 'Confirm dismiss community report'}).click();
      await expect(adminPage.getByText('Community report dismissed and decision recorded.')).toBeVisible();
      expect(hiddenCommunityPosts).toEqual([`hide:${report2}`, `dismiss:${report1}`]);
    } finally {
      await Promise.all([mobilePage.close(), adminPage.close()]);
      await new Promise<void>((resolve, reject) => {
        fixture.close(error => (error ? reject(error) : resolve()));
        fixture.closeAllConnections();
      });
    }
  });
});
