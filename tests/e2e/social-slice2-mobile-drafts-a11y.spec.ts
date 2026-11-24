import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test,type Page} from '@playwright/test';
import {
  clearAllSocialDrafts,
  clearScopedDraft,
  clearSocialDraftsForOtherUsers,
  loadScopedDraft,
  saveScopedDraft,
} from '../../lib/social-draft-storage';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';
const user1 = {id: 'aaaaaaaa-0000-4000-8000-000000000081', aud: 'authenticated'};
const user2 = {id: 'aaaaaaaa-0000-4000-8000-000000000082', aud: 'authenticated'};
const areaA = {id: '11111111-1111-4111-8111-111111111101', area_name: 'Didsbury', city: 'Manchester'};
const areaB = {id: '11111111-1111-4111-8111-111111111102', area_name: 'Chorlton', city: 'Manchester'};
const savedPostId = '22222222-2222-4222-8222-222222222211';
const advicePostId = '22222222-2222-4222-8222-222222222212';
const groupId = '33333333-3333-4333-8333-333333333311';
const createdAt = '2026-11-24T10:00:00Z';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

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

test.describe('Slice 2 draft storage isolation unit tests', () => {
  test('isolates drafts by user and scope and clears other-account drafts cleanly', () => {
    const store = createMemoryStorage();
    saveScopedDraft(user1.id, 'feed', areaA.id, 'Didsbury feed draft', store);
    saveScopedDraft(user1.id, 'advice', areaA.id, 'Didsbury question draft', store);
    saveScopedDraft(user2.id, 'feed', areaA.id, 'User 2 private draft', store);

    expect(loadScopedDraft(user1.id, 'feed', areaA.id, store)).toBe('Didsbury feed draft');
    expect(loadScopedDraft(user1.id, 'feed', areaB.id, store)).toBe('');
    expect(loadScopedDraft(user1.id, 'advice', areaA.id, store)).toBe('Didsbury question draft');

    clearSocialDraftsForOtherUsers(user2.id, store);
    expect(loadScopedDraft(user1.id, 'feed', areaA.id, store)).toBe('');
    expect(loadScopedDraft(user2.id, 'feed', areaA.id, store)).toBe('User 2 private draft');

    clearScopedDraft(user2.id, 'feed', areaA.id, store);
    expect(loadScopedDraft(user2.id, 'feed', areaA.id, store)).toBe('');

    saveScopedDraft(user2.id, 'group', groupId, 'Group update draft', store);
    clearAllSocialDrafts(store);
    expect(loadScopedDraft(user2.id, 'group', groupId, store)).toBe('');
  });
});

test.describe('Slice 2 mobile feed, groups, saved posts and Q&A draft recovery & a11y', () => {
  test.use({viewport: {width: 360, height: 740}, isMobile: true, hasTouch: true});

  test('360px resident recovers drafts after reload, navigates empty states by keyboard, and returns to Saved & Advice tabs cleanly', async ({
    page,
  }) => {
    test.skip(
      process.env.NEXT_PUBLIC_SUPABASE_URL !== backend,
      'Requires the isolated loopback application build.'
    );
    test.setTimeout(60000);
    page.setDefaultTimeout(10000);

    let failNextGroupList = true;
    let failNextAdviceList = true;

    const fixture = createServer((request, response) => {
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
      if (id !== user1.id && id !== user2.id) return reply(401, {message: 'Synthetic session required'});
      if (url.pathname === '/auth/v1/user') return reply(200, {id, aud: 'authenticated'});

      const leaf = url.pathname.split('/').pop() ?? '';
      if (leaf === 'service_areas') {
        const idEq = url.searchParams.get('id')?.slice(3);
        if (idEq) {
          const match = [areaA, areaB].find(a => a.id === idEq) ?? null;
          return reply(200, request.headers.accept?.includes('object+json') ? match : match ? [match] : []);
        }
        return reply(200, [areaA, areaB]);
      }

      if (leaf === 'community_group_memberships') {
        const gEq = url.searchParams.get('group_id')?.slice(3);
        if (gEq === groupId) {
          const row = {group_id: groupId, user_id: id, role: 'member'};
          return reply(200, request.headers.accept?.includes('object+json') ? row : [row]);
        }
        return reply(200, []);
      }

      if (leaf === 'community_groups') {
        const idEq = url.searchParams.get('id')?.slice(3);
        const groupObj = {
          id: groupId,
          area_id: areaA.id,
          creator_id: user2.id,
          name: 'Didsbury Home & Garden',
          description: 'Sharing practical maintenance tips across Didsbury.',
          visibility: 'public',
          created_at: createdAt,
        };
        if (idEq) {
          return reply(200, request.headers.accept?.includes('object+json') ? groupObj : [groupObj]);
        }
        if (failNextGroupList) {
          return reply(500, {message: 'Synthetic group directory outage'});
        }
        return reply(200, [groupObj]);
      }

      if (leaf === 'community_group_posts') {
        return reply(200, []);
      }

      if (leaf === 'social_saved_posts') {
        return reply(200, [{post_id: savedPostId, saved_at: createdAt}]);
      }

      if (leaf === 'community_posts') {
        const idParam = url.searchParams.get('id');
        const allPosts = [
          {
            id: savedPostId,
            area_id: areaA.id,
            body: 'Saved loft insulation tips for Edwardian semis in Didsbury.',
            visibility: 'published',
            created_at: createdAt,
          },
          {
            id: advicePostId,
            area_id: areaA.id,
            body: 'Question about CCTV & security: What mounting height avoids streetlight glare?',
            visibility: 'published',
            created_at: createdAt,
          },
        ];
        if (idParam?.startsWith('eq.')) {
          const match = allPosts.find(p => p.id === idParam.slice(3)) ?? null;
          return reply(200, request.headers.accept?.includes('object+json') ? match : match ? [match] : []);
        }
        const bodyIlike = url.searchParams.get('body');
        if (bodyIlike?.includes('Question')) {
          if (failNextAdviceList) {
            return reply(500, {message: 'Synthetic advice outage'});
          }
          if (url.searchParams.get('area_id') === 'eq.' + areaB.id) {
            return reply(200, []);
          }
          return reply(200, [allPosts[1]]);
        }
        return reply(200, allPosts);
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
      await signIn(page, user1);

      // 1. Neighbourhood feed draft persists across full page reload and stays isolated per area.
      await page.goto('/community/social');
      const postArea = page.getByLabel('Neighbourhood to post in');
      const postBody = page.getByLabel('Write your community post');
      await postArea.selectOption(areaA.id);
      const feedDraft = 'Unsent Didsbury gutter repair question saved before reload';
      await postBody.fill(feedDraft);

      await page.reload();
      await page.getByLabel('Neighbourhood to post in').selectOption(areaA.id);
      await expect(page.getByLabel('Write your community post')).toHaveValue(feedDraft);
      await expect(page.getByText('Draft recovered for Didsbury.')).toBeVisible();
      // Switching to Area B never inherits Area A's recovered draft.
      await page.getByLabel('Neighbourhood to post in').selectOption(areaB.id);
      await expect(page.getByLabel('Write your community post')).toHaveValue('');

      // 2. Groups tab: error retry restores focus, empty "My groups only" has keyboard recovery.
      await page.getByRole('navigation', {name: 'Social network sections'}).getByRole('link', {name: 'Groups'}).click();
      const retryGroups = page.getByRole('button', {name: 'Retry groups'});
      await expect(retryGroups).toBeVisible();
      failNextGroupList = false;
      await retryGroups.press('Enter');
      await expect(page.getByRole('heading', {name: 'Trade Network & Community Groups'})).toBeFocused();
      await expect(page.getByText('Didsbury Home & Garden')).toBeVisible();

      await page.getByLabel('My groups only').check();
      await expect(page.getByText('No joined groups match these filters.')).toBeVisible();
      await page.getByRole('button', {name: 'Show all public groups'}).press('Enter');
      await expect(page.getByText('Didsbury Home & Garden')).toBeVisible();

      // Group conversation draft recovers across reload.
      await page.getByRole('link', {name: 'Open this group'}).click();
      await expect(page.getByRole('heading', {name: 'Didsbury Home & Garden'})).toBeVisible();
      const groupDraft = 'Checking if anyone has a spare hedge trimmer this weekend';
      await page.getByLabel('Group update').fill(groupDraft);
      await page.reload();
      await expect(page.getByLabel('Group update')).toHaveValue(groupDraft);

      // 3. Saved tab: permalink round-trip returns straight back to Saved tab.
      await page.goto('/community/social?tab=saved');
      await expect(page.getByText('Saved loft insulation tips')).toBeVisible();
      await page.getByRole('link', {name: 'Open discussion'}).click();
      await expect(page).toHaveURL(new RegExp(`/community/posts/${savedPostId}\\?from=`));
      await page.getByRole('link', {name: '← Back to neighbourhood feed'}).click();
      await expect(page).toHaveURL(/\/community\/social\?tab=saved/);
      await expect(page.getByRole('heading', {name: 'My saved discussions'})).toBeVisible();

      // 4. Advice (Q&A) tab: retry focus, area draft isolation + reload recovery, empty state CTA, permalink return.
      await page.getByRole('navigation', {name: 'Social network sections'}).getByRole('link', {name: 'Advice'}).click();
      const retryAdvice = page.getByRole('button', {name: 'Try again'});
      await expect(retryAdvice).toBeVisible();
      failNextAdviceList = false;
      await retryAdvice.press('Enter');
      await expect(page.getByRole('heading', {name: 'Browse published questions'})).toBeFocused();
      await expect(page.getByText('What mounting height avoids streetlight glare?')).toBeVisible();

      // Empty state CTA focuses question composer.
      const browseSection = page.getByRole('region', {name: 'Community questions'});
      await browseSection.getByRole('combobox', {name: 'Neighbourhood'}).selectOption(areaB.id);
      await expect(browseSection.getByText('No published questions match these filters.')).toBeVisible();
      await browseSection.getByRole('button', {name: 'Ask the first question'}).press('Enter');
      const askSection = page.getByRole('region', {name: 'Ask your neighbours'});
      await expect(askSection.getByRole('combobox', {name: 'Neighbourhood'})).toBeFocused();

      // Area-scoped Q&A draft persists across reload and stays isolated from Area B.
      await askSection.getByRole('combobox', {name: 'Neighbourhood'}).selectOption(areaA.id);
      const qaDraft = 'Do Victorian brick walls need specialist masonry plugs for brackets?';
      await askSection.getByLabel('Your question').fill(qaDraft);
      await page.reload();
      const askAfterReload = page.getByRole('region', {name: 'Ask your neighbours'});
      await askAfterReload.getByRole('combobox', {name: 'Neighbourhood'}).selectOption(areaA.id);
      await expect(askAfterReload.getByLabel('Your question')).toHaveValue(qaDraft);
      await askAfterReload.getByRole('combobox', {name: 'Neighbourhood'}).selectOption(areaB.id);
      await expect(askAfterReload.getByLabel('Your question')).toHaveValue('');

      // Permalink from Q&A returns straight to Advice tab.
      await page.getByRole('link', {name: 'Open question discussion'}).click();
      await expect(page).toHaveURL(new RegExp(`/community/posts/${advicePostId}\\?from=`));
      await page.getByRole('link', {name: '← Back to neighbourhood feed'}).click();
      await expect(page).toHaveURL(/\/community\/social\?tab=advice/);

      // 5. Account switch wipes previous user's drafts from sessionStorage.
      await signIn(page, user2);
      await page.goto('/community/social');
      await page.getByLabel('Neighbourhood to post in').selectOption(areaA.id);
      await expect(page.getByLabel('Write your community post')).toHaveValue('');

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        fixture.close(error => (error ? reject(error) : resolve()));
        fixture.closeAllConnections();
      });
    }
  });
});
