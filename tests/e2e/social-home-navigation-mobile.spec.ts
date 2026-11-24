import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test} from '@playwright/test';
import {
  buildSocialFeedHref,
  buildSocialPostHref,
  classifySocialPostKind,
  getAreaDraft,
  parseSocialFeedParams,
  safeSocialReturnHref,
  setAreaDraft,
} from '../../lib/social-feed-url';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';
const user = {id: 'aaaaaaaa-0000-4000-8000-000000000077', aud: 'authenticated'};
const token = 'synthetic-social-home-token';
const areaA = {id: '11111111-1111-4111-8111-111111111101', area_name: 'Didsbury', city: 'Manchester'};
const areaB = {id: '11111111-1111-4111-8111-111111111102', area_name: 'Chorlton', city: 'Manchester'};
const postQuestionId = '22222222-2222-4222-8222-222222222201';
const postDiscussionId = '22222222-2222-4222-8222-222222222202';
const postAreaBId = '22222222-2222-4222-8222-222222222203';
const createdA = '2026-11-23T09:15:00Z';
const createdB = '2026-11-23T08:40:00Z';

test.describe('TrustFive Social URL, draft isolation and card classification helpers', () => {
  test('parses and builds clean neighbourhood feed URLs while rejecting invalid values', () => {
    const valid = new URLSearchParams({
      area: areaA.id,
      q: '  roofing repairs  ',
      order: 'oldest',
      page: '2',
    });
    expect(parseSocialFeedParams(valid)).toEqual({
      areaId: areaA.id,
      search: 'roofing repairs',
      order: 'oldest',
      page: 2,
    });
    expect(
      buildSocialFeedHref('neighbourhood', {
        areaId: areaA.id,
        search: 'roofing repairs',
        order: 'oldest',
        page: 2,
      })
    ).toBe(`/community/social?area=${areaA.id}&q=roofing+repairs&order=oldest&page=2`);

    const bad = new URLSearchParams({
      area: 'not-a-uuid',
      order: 'sideways',
      page: '9999',
    });
    expect(parseSocialFeedParams(bad)).toEqual({
      areaId: '',
      search: '',
      order: 'recent',
      page: 0,
    });
    expect(buildSocialFeedHref('neighbourhood', {areaId: '', search: '', order: 'recent', page: 0})).toBe(
      '/community/social'
    );
    expect(buildSocialFeedHref('events', {areaId: areaA.id})).toBe('/community/social?tab=events');
  });

  test('validates safe return links and rejects external or non-Social paths', () => {
    const filtered = `/community/social?area=${areaA.id}&q=roofing`;
    expect(safeSocialReturnHref(filtered)).toBe(filtered);
    expect(safeSocialReturnHref('/community?area=' + areaA.id)).toBe('/community?area=' + areaA.id);
    expect(safeSocialReturnHref('https://evil.example/phish')).toBe('/community/social');
    expect(safeSocialReturnHref('//evil.example')).toBe('/community/social');
    expect(safeSocialReturnHref('/bookings')).toBe('/community/social');
    expect(buildSocialPostHref(postQuestionId, filtered)).toBe(
      `/community/posts/${postQuestionId}?from=${encodeURIComponent(filtered)}`
    );
    expect(buildSocialPostHref(postQuestionId, '/community/social')).toBe(`/community/posts/${postQuestionId}`);
  });

  test('classifies Questions separately from general Discussions and isolates drafts per area', () => {
    expect(classifySocialPostKind('Anyone know a reliable slate roofer around Didsbury?')).toBe('question');
    expect(classifySocialPostKind('Looking for recommendations for gutter clearing before winter')).toBe('question');
    expect(classifySocialPostKind('Local park volunteers are meeting near the pavilion at 10am Saturday.')).toBe(
      'discussion'
    );

    let drafts: Record<string, string> = {};
    drafts = setAreaDraft(drafts, areaA.id, 'Draft only for Didsbury');
    expect(getAreaDraft(drafts, areaA.id)).toBe('Draft only for Didsbury');
    expect(getAreaDraft(drafts, areaB.id)).toBe('');
    expect(getAreaDraft(drafts, '')).toBe('');
    drafts = setAreaDraft(drafts, areaA.id, '');
    expect(getAreaDraft(drafts, areaA.id)).toBe('');
  });
});

test.describe('TrustFive Social home, mobile navigation and neighbourhood privacy', () => {
  test.use({viewport: {width: 360, height: 740}, isMobile: true, hasTouch: true});

  test('360px resident selects neighbourhood, isolates drafts, publishes, opens discussion and returns with exact filters intact', async ({
    page,
  }) => {
    test.skip(
      process.env.NEXT_PUBLIC_SUPABASE_URL !== backend,
      'Requires the isolated loopback application build.'
    );
    test.setTimeout(60000);
    page.setDefaultTimeout(10000);

    type StoredPost = {
      id: string;
      area_id: string;
      body: string;
      visibility: string;
      created_at: string;
    };

    const posts: StoredPost[] = [
      {
        id: postQuestionId,
        area_id: areaA.id,
        body: 'Can anyone recommend a local slate roofing specialist for a terraced house?',
        visibility: 'published',
        created_at: createdA,
      },
      {
        id: postDiscussionId,
        area_id: areaA.id,
        body: 'Saturday litter pick starts by the park gates at 10am — spare gloves available.',
        visibility: 'published',
        created_at: createdB,
      },
      {
        id: postAreaBId,
        area_id: areaB.id,
        body: 'Chorlton community orchard pruning morning is on this Sunday at 11am.',
        visibility: 'published',
        created_at: createdB,
      },
    ];

    let failNextInsert = true;
    let failNextFeedRead = false;
    let holdAreaAReads = false;
    let releaseAreaA = () => {};
    let areaAHeldPromise = Promise.resolve();
    let createdCounter = 0;

    const fixture = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', backend);
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
      const authed = request.headers.authorization === 'Bearer ' + token;
      if (url.pathname === '/auth/v1/user') {
        return authed ? reply(200, user) : reply(401, {message: 'Not signed in'});
      }
      if (!authed) return reply(401, {message: 'Synthetic session required'});

      if (url.pathname === '/rest/v1/service_areas') {
        const idEq = url.searchParams.get('id');
        if (idEq?.startsWith('eq.')) {
          const match = [areaA, areaB].find(a => a.id === idEq.slice(3));
          return reply(200, match ?? null);
        }
        return reply(200, [areaA, areaB]);
      }

      if (url.pathname === '/rest/v1/community_comments') {
        return reply(200, []);
      }

      if (url.pathname === '/rest/v1/social_saved_posts') {
        return reply(200, []);
      }

      if (url.pathname === '/rest/v1/community_posts' && request.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const bodyJson = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const row = Array.isArray(bodyJson) ? bodyJson[0] : bodyJson;
        if (failNextInsert) {
          failNextInsert = false;
          return reply(500, {message: 'Synthetic publish error'});
        }
        createdCounter += 1;
        const inserted: StoredPost = {
          id: `33333333-3333-4333-8333-33333333330${createdCounter}`,
          area_id: String(row.area_id),
          body: String(row.body),
          visibility: 'published',
          created_at: '2026-11-23T10:30:00Z',
        };
        posts.unshift(inserted);
        return reply(201, inserted);
      }

      if (url.pathname === '/rest/v1/community_posts' && request.method === 'GET') {
        if (failNextFeedRead) {
          failNextFeedRead = false;
          return reply(500, {message: 'Synthetic feed read failure'});
        }
        const idEq = url.searchParams.get('id');
        if (idEq?.startsWith('eq.')) {
          const found = posts.find(p => p.id === idEq.slice(3)) ?? null;
          const isSingle = request.headers.accept?.includes('application/vnd.pgrst.object+json');
          return reply(200, isSingle ? found : found ? [found] : []);
        }

        const areaEq = url.searchParams.get('area_id');
        if (holdAreaAReads && areaEq === 'eq.' + areaA.id) {
          await areaAHeldPromise;
        }

        let matched = posts.filter(p => p.visibility === 'published');
        if (areaEq?.startsWith('eq.')) {
          matched = matched.filter(p => p.area_id === areaEq.slice(3));
        }
        const bodyIlike = url.searchParams.get('body');
        if (bodyIlike?.startsWith('ilike.')) {
          const needle = bodyIlike.slice(6).replace(/%/g, '').toLowerCase();
          matched = matched.filter(p => p.body.toLowerCase().includes(needle));
        }
        return reply(200, matched);
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

    try {
      // 1. Anonymous visitor on a filtered Social URL is redirected to /account preserving exact filters, with 0px overflow.
      await page.goto(`/community/social?area=${areaA.id}&q=roofing`);
      await expect(page).toHaveURL(
        url =>
          url.pathname === '/account' &&
          url.searchParams.get('next') === `/community/social?area=${areaA.id}&q=roofing`
      );
      const signedOutOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(signedOutOverflow).toBeLessThanOrEqual(0);

      // 2. Sign in with synthetic cookie and visit /community/social.
      const session = {
        access_token: token,
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

      await page.goto('/community/social');
      const tabsNav = page.getByRole('navigation', {name: 'Social network sections'});
      for (const label of ['Feed', 'Groups', 'Events', 'Advice', 'Saved']) {
        const tabLink = tabsNav.getByRole('link', {name: label, exact: true});
        await expect(tabLink).toBeVisible();
        const box = await tabLink.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      // Scope bar shows browsing vs posting + honest pilot discovery notice.
      const scopeBar = page.getByTestId('social-scope-bar');
      await expect(scopeBar).toContainText('Browsing: All pilot neighbourhoods');
      await expect(scopeBar).toContainText('Posting to: Choose a neighbourhood below');
      await expect(scopeBar).toContainText('Pilot discovery:');

      // Distinct Question vs Discussion visual cards.
      const questionCard = page.getByTestId(`social-post-card-${postQuestionId}`);
      const discussionCard = page.getByTestId(`social-post-card-${postDiscussionId}`);
      await expect(questionCard).toHaveAttribute('data-post-kind', 'question');
      await expect(questionCard).toContainText('? Question');
      await expect(discussionCard).toHaveAttribute('data-post-kind', 'discussion');
      await expect(discussionCard).toContainText('Discussion');

      // 3. Per-neighbourhood draft isolation & failed-write draft preservation.
      const postAreaSelect = page.getByLabel('Neighbourhood to post in');
      const postBodyInput = page.getByLabel('Write your community post');
      await expect(postBodyInput).toBeDisabled();

      await postAreaSelect.selectOption(areaA.id);
      await expect(scopeBar).toContainText('Posting to: Didsbury, Manchester');
      const didsburyDraft = 'Who can recommend a local chimney sweep for Didsbury before autumn?';
      await postBodyInput.fill(didsburyDraft);

      // Switching posting area to Chorlton must NEVER reuse Didsbury's draft.
      await postAreaSelect.selectOption(areaB.id);
      await expect(scopeBar).toContainText('Posting to: Chorlton, Manchester');
      await expect(postBodyInput).toHaveValue('');

      // Switching back to Didsbury restores Didsbury's own draft.
      await postAreaSelect.selectOption(areaA.id);
      await expect(postBodyInput).toHaveValue(didsburyDraft);

      // First publish attempt fails -> draft preserved safely.
      await page.getByRole('button', {name: 'Publish neighbourhood post'}).click();
      await expect(page.getByTestId('social-composer').getByRole('alert')).toContainText(
        'your draft is preserved'
      );
      await expect(postBodyInput).toHaveValue(didsburyDraft);

      // Retry publish -> succeeds, clears draft, switches feed to Didsbury, shows new Question post.
      await page.getByRole('button', {name: 'Publish neighbourhood post'}).click();
      await expect(page.getByText('Your neighbourhood post was published.')).toBeVisible();
      await expect(postBodyInput).toHaveValue('');
      await expect(page.getByText(didsburyDraft)).toBeVisible();
      await expect(page.getByRole('combobox', {name: 'Neighbourhood', exact: true})).toHaveValue(areaA.id);
      await expect(page).toHaveURL(new RegExp(`area=${areaA.id}`));

      // 4. Stale-request race: switching from delayed Area A to fast Area B clears stale posts and ignores late response.
      const filterArea = page.getByRole('combobox', {name: 'Neighbourhood', exact: true});
      await filterArea.selectOption(areaB.id);
      await expect(page.getByText('Chorlton community orchard pruning morning')).toBeVisible();

      holdAreaAReads = true;
      areaAHeldPromise = new Promise<void>(resolve => {
        releaseAreaA = resolve;
      });
      const areaAStarted = page.waitForRequest(
        r => r.url().includes('/rest/v1/community_posts') && r.url().includes('area_id=eq.' + areaA.id)
      );
      await filterArea.selectOption(areaA.id);
      await areaAStarted;
      // Area B post must be cleared immediately while Area A loads (no stale flash).
      await expect(page.getByText('Chorlton community orchard pruning morning')).toHaveCount(0);

      // Switch back to Area B before Area A finishes.
      await filterArea.selectOption(areaB.id);
      await expect(page.getByText('Chorlton community orchard pruning morning')).toBeVisible();

      // Release delayed Area A response; Area B feed must remain intact.
      const areaAResponse = page.waitForResponse(
        r => r.url().includes('/rest/v1/community_posts') && r.url().includes('area_id=eq.' + areaA.id)
      );
      holdAreaAReads = false;
      releaseAreaA();
      await (await areaAResponse).finished();
      await expect(page.getByText('Chorlton community orchard pruning morning')).toBeVisible();
      await expect(page.getByText(didsburyDraft)).toHaveCount(0);

      // 5. Filter feed (Didsbury + "roofing"), open permalink, return via Link AND Browser Back.
      await filterArea.selectOption(areaA.id);
      await page.getByLabel('Search published posts').fill('roofing');
      await page.getByRole('button', {name: 'Search posts'}).click();
      await expect(page).toHaveURL(new RegExp(`area=${areaA.id}`));
      await expect(page).toHaveURL(/q=roofing/);
      await expect(questionCard).toBeVisible();
      await expect(discussionCard).toHaveCount(0);

      // Open discussion permalink and return via "← Back to neighbourhood feed".
      await questionCard.getByRole('link', {name: 'Open this discussion →'}).click();
      await expect(page).toHaveURL(new RegExp(`/community/posts/${postQuestionId}\\?from=`));
      await expect(page.getByRole('heading', {name: 'Neighbourhood conversation'})).toBeVisible();
      await expect(page.getByText('Can anyone recommend a local slate roofing specialist')).toBeVisible();
      await page.getByRole('link', {name: '← Back to neighbourhood feed'}).click();
      await expect(page).toHaveURL(new RegExp(`/community/social\\?area=${areaA.id}&q=roofing`));
      await expect(page.getByRole('combobox', {name: 'Neighbourhood', exact: true})).toHaveValue(areaA.id);
      await expect(page.getByLabel('Search published posts')).toHaveValue('roofing');
      await expect(page.getByTestId(`social-post-card-${postQuestionId}`)).toBeVisible();

      // Open again and verify Browser Back restores exact neighbourhood and search filters.
      await page
        .getByTestId(`social-post-card-${postQuestionId}`)
        .getByRole('link', {name: 'Open this discussion →'})
        .click();
      await expect(page).toHaveURL(new RegExp(`/community/posts/${postQuestionId}`));
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/community/social\\?area=${areaA.id}&q=roofing`));
      await expect(page.getByRole('combobox', {name: 'Neighbourhood', exact: true})).toHaveValue(areaA.id);
      await expect(page.getByLabel('Search published posts')).toHaveValue('roofing');
      await expect(page.getByTestId(`social-post-card-${postQuestionId}`)).toBeVisible();

      // 6. Empty state and feed error retry recovery.
      await page.getByLabel('Search published posts').fill('zzzz-no-match');
      await page.getByRole('button', {name: 'Search posts'}).click();
      await expect(page.getByTestId('social-feed-empty')).toContainText('No published posts match');
      await page.getByRole('button', {name: 'Show all neighbourhoods'}).click();
      await expect(page.getByRole('combobox', {name: 'Neighbourhood', exact: true})).toHaveValue('');

      failNextFeedRead = true;
      await filterArea.selectOption(areaA.id);
      await expect(page.getByTestId('social-feed-error')).toBeVisible();
      await page.getByRole('button', {name: 'Retry loading posts'}).press('Enter');
      await expect(page.getByRole('heading', {name: 'Neighbourhood conversations'})).toBeFocused();
      await expect(page.getByTestId(`social-post-card-${postQuestionId}`)).toBeVisible();

      // 7. Zero horizontal overflow at 360px, 320px, and 1280px.
      for (const viewport of [
        {width: 360, height: 740},
        {width: 320, height: 700},
        {width: 1280, height: 860},
      ]) {
        await page.setViewportSize(viewport);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        expect(overflow, `overflow at ${viewport.width}px`).toBeLessThanOrEqual(0);
      }
    } finally {
      releaseAreaA();
      await new Promise<void>((resolve, reject) => {
        fixture.close(error => (error ? reject(error) : resolve()));
        fixture.closeAllConnections();
      });
    }
  });
});
