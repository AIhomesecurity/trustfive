import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect,test,type Page} from '@playwright/test';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';

const groupA = 'aaaaaaaa-0001-4000-8000-000000000001';
const groupB = 'aaaaaaaa-0002-4000-8000-000000000002';
const areaA = {id: '11111111-1111-4111-8111-111111111101', area_name: 'Didsbury', city: 'Manchester'};
const areaB = {id: '11111111-1111-4111-8111-111111111102', area_name: 'Chorlton', city: 'Manchester'};

const memberA = 'bbbbbbbb-0001-4000-8000-000000000001';
const memberB = 'bbbbbbbb-0002-4000-8000-000000000002';
const moderatorA = 'bbbbbbbb-0003-4000-8000-000000000003';
const moderatorB = 'bbbbbbbb-0004-4000-8000-000000000004';
const authorA = 'bbbbbbbb-0005-4000-8000-000000000005';
const authorB = 'bbbbbbbb-0006-4000-8000-000000000006';

const postA1 = 'cccccccc-0001-4000-8000-000000000001';
const postA2 = 'cccccccc-0001-4000-8000-000000000002';
const postB1 = 'cccccccc-0002-4000-8000-000000000001';
const feedPost1 = 'dddddddd-0001-4000-8000-000000000001';
const createdAt = '2026-11-24T09:00:00Z';

type GroupPost = {
  id: string;
  group_id: string;
  author_id: string;
  body: string;
  created_at: string;
  visibility: 'published' | 'hidden';
};

type GroupReport = {
  id: string;
  post_id: string;
  reporter_id: string;
  category: string;
  explanation: string | null;
  created_at: string;
  post_body: string;
};

async function signIn(page: Page, id: string) {
  const session = {
    access_token: id,
    refresh_token: 'synthetic-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user: {id, aud: 'authenticated'},
  };
  await page.context().addCookies([
    {
      name: 'sb-127-auth-token',
      value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
      url: app,
    },
  ]);
}

test('Slice 1: two-group membership visibility and signed-in report to hide/dismiss across ordinary members and moderators', async ({
  browser,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_SUPABASE_URL !== backend,
    'Requires the isolated loopback application build.'
  );
  test.setTimeout(60000);

  const memberships = new Set<string>([
    `${groupA}:${memberA}`,
    `${groupB}:${memberB}`,
    `${groupA}:${moderatorA}`,
    `${groupB}:${moderatorB}`,
  ]);

  const groupPosts: GroupPost[] = [
    {
      id: postA1,
      group_id: groupA,
      author_id: authorA,
      body: 'Group A spam flyer offering unverified doorstep cash work',
      created_at: createdAt,
      visibility: 'published',
    },
    {
      id: postA2,
      group_id: groupA,
      author_id: authorA,
      body: 'Group A Saturday community garden tidy-up reminder',
      created_at: createdAt,
      visibility: 'published',
    },
    {
      id: postB1,
      group_id: groupB,
      author_id: authorB,
      body: 'Group B discussion about local street lighting timings',
      created_at: createdAt,
      visibility: 'published',
    },
  ];

  const pendingReports: GroupReport[] = [];
  const reportedPairs = new Set<string>([`${postA2}:${memberA}`]);
  const decisions: Array<{moderator: string; postId: string; action: string}> = [];
  let failNextModeration = true;
  let unauthorizedPostReads = 0;
  let unauthorizedQueueReads = 0;

  const isModerator = (id: string) => id === moderatorA || id === moderatorB;
  const knownUsers = new Set([memberA, memberB, moderatorA, moderatorB]);

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
    if (!knownUsers.has(id)) return reply(401, {message: 'Synthetic session required'});
    if (url.pathname === '/auth/v1/user') return reply(200, {id, aud: 'authenticated'});

    const leaf = url.pathname.split('/').pop() ?? '';

    if (leaf === 'service_areas') {
      return reply(200, [areaA, areaB]);
    }

    if (leaf === 'community_groups') {
      const requested = url.searchParams.get('id')?.slice(3);
      const groupObj =
        requested === groupA
          ? {
              id: groupA,
              name: 'Didsbury Neighbours',
              description: 'Local residents in Didsbury.',
              area_id: areaA.id,
              creator_id: authorA,
              visibility: 'public',
              created_at: createdAt,
            }
          : requested === groupB
            ? {
                id: groupB,
                name: 'Chorlton Watch',
                description: 'Local residents in Chorlton.',
                area_id: areaB.id,
                creator_id: authorB,
                visibility: 'public',
                created_at: createdAt,
              }
            : null;
      const isSingle = request.headers.accept?.includes('object+json');
      return reply(200, isSingle ? groupObj : groupObj ? [groupObj] : []);
    }

    if (leaf === 'community_group_memberships') {
      if (request.method === 'POST') {
        let raw = '';
        for await (const chunk of request) raw += chunk;
        const payload = JSON.parse(raw);
        const row = Array.isArray(payload) ? payload[0] : payload;
        if (row.user_id !== id || row.role !== 'member') return reply(403, {message: 'Forbidden'});
        memberships.add(`${row.group_id}:${id}`);
        return reply(201, row);
      }
      if (request.method === 'DELETE') {
        const gId = url.searchParams.get('group_id')?.slice(3) ?? '';
        const key = `${gId}:${id}`;
        if (!memberships.has(key)) return reply(200, null);
        memberships.delete(key);
        const isSingle = request.headers.accept?.includes('object+json');
        return reply(200, isSingle ? {group_id: gId} : [{group_id: gId}]);
      }
      const gId = url.searchParams.get('group_id')?.slice(3) ?? '';
      const row = memberships.has(`${gId}:${id}`) ? {group_id: gId, user_id: id, role: 'member'} : null;
      const isSingle = request.headers.accept?.includes('object+json');
      return reply(200, isSingle ? row : row ? [row] : []);
    }

    if (leaf === 'community_group_posts') {
      const gId = url.searchParams.get('group_id')?.slice(3) ?? '';
      if (!memberships.has(`${gId}:${id}`)) {
        unauthorizedPostReads += 1;
        return reply(200, []);
      }
      return reply(
        200,
        groupPosts.filter(p => p.group_id === gId && p.visibility === 'published')
      );
    }

    if (leaf === 'community_group_post_reports' && request.method === 'POST') {
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const payload = JSON.parse(raw);
      const row = Array.isArray(payload) ? payload[0] : payload;
      const target = groupPosts.find(p => p.id === row.post_id && p.visibility === 'published');
      if (!target || row.reporter_id !== id || !memberships.has(`${target.group_id}:${id}`)) {
        return reply(403, {message: 'Forbidden'});
      }
      const pairKey = `${target.id}:${id}`;
      if (reportedPairs.has(pairKey)) {
        return reply(409, {code: '23505', message: 'duplicate key value violates unique constraint'});
      }
      reportedPairs.add(pairKey);
      pendingReports.push({
        id: `eeeeeeee-0000-4000-8000-00000000000${pendingReports.length + 1}`,
        post_id: target.id,
        reporter_id: id,
        category: row.category,
        explanation: row.explanation ?? null,
        created_at: createdAt,
        post_body: target.body,
      });
      return reply(201, null);
    }

    if (leaf === 'is_trustfive_admin') {
      return reply(200, isModerator(id));
    }

    if (leaf === 'pending_group_post_reports') {
      if (!isModerator(id)) {
        unauthorizedQueueReads += 1;
        return reply(403, {message: 'Not authorised'});
      }
      return reply(
        200,
        pendingReports.map(({id: rid, category, explanation, created_at, post_body}) => ({
          id: rid,
          category,
          explanation,
          created_at,
          post_body,
        }))
      );
    }

    if (leaf === 'moderate_group_post_report' && request.method === 'POST') {
      if (!isModerator(id)) return reply(403, {message: 'Not authorised'});
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw);
      if (failNextModeration) {
        failNextModeration = false;
        return reply(503, {message: 'Synthetic transient moderation outage'});
      }
      const idx = pendingReports.findIndex(r => r.id === body.p_report);
      if (idx < 0 || !['hide', 'dismiss'].includes(body.p_action)) {
        return reply(404, {message: 'Report no longer pending'});
      }
      const [resolved] = pendingReports.splice(idx, 1);
      if (body.p_action === 'hide') {
        const target = groupPosts.find(p => p.id === resolved.post_id);
        if (target) target.visibility = 'hidden';
      }
      decisions.push({moderator: id, postId: resolved.post_id, action: body.p_action});
      return reply(200, null);
    }

    if (leaf === 'community_posts') {
      return reply(200, [
        {
          id: feedPost1,
          area_id: areaA.id,
          body: 'Anyone recommend a good window cleaner near Didsbury village?',
          visibility: 'published',
          created_at: createdAt,
        },
      ]);
    }

    if (leaf === 'community_reports' && request.method === 'POST') {
      return reply(409, {code: '23505', message: 'duplicate key value violates unique constraint'});
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
    const memberAPage = await browser.newPage({
      viewport: {width: 360, height: 740},
      isMobile: true,
      hasTouch: true,
    });
    const memberBPage = await browser.newPage({
      viewport: {width: 360, height: 740},
      isMobile: true,
      hasTouch: true,
    });
    const modAPage = await browser.newPage({viewport: {width: 1280, height: 860}});
    const modBPage = await browser.newPage({viewport: {width: 1280, height: 860}});

    try {
      await Promise.all([
        signIn(memberAPage, memberA),
        signIn(memberBPage, memberB),
        signIn(modAPage, moderatorA),
        signIn(modBPage, moderatorB),
      ]);

      // 1. Cross-group visibility isolation & join/leave flow.
      await memberAPage.goto(`${app}/community/groups/${groupB}`);
      await expect(memberAPage.getByText('Join to access its members-only posts.', {exact: false})).toBeVisible();
      await expect(memberAPage.getByText('Group B discussion about local street lighting')).toHaveCount(0);

      // Member A joins Group B -> sees Group B posts -> leaves Group B -> posts immediately disappear.
      await memberAPage.getByRole('button', {name: 'Join group'}).click();
      await expect(memberAPage.getByText('Group B discussion about local street lighting')).toBeVisible();
      await memberAPage.getByRole('button', {name: 'Leave group'}).click();
      await memberAPage.getByRole('button', {name: 'Confirm leave'}).click();
      await expect(memberAPage.getByText('Group B discussion about local street lighting')).toHaveCount(0);

      // Member B cannot read Group A posts, and Moderator B (not in Group A) also sees join prompt on Group A.
      await memberBPage.goto(`${app}/community/groups/${groupA}`);
      await expect(memberBPage.getByText('Group A spam flyer')).toHaveCount(0);
      await modBPage.goto(`${app}/community/groups/${groupA}`);
      await expect(modBPage.getByText('Join to access its members-only posts.', {exact: false})).toBeVisible();
      await expect(modBPage.getByText('Group A spam flyer')).toHaveCount(0);
      expect(unauthorizedPostReads).toBe(0);

      // 2. Ordinary members in Group A and Group B report posts (including duplicate 23505 feedback).
      await memberAPage.goto(`${app}/community/groups/${groupA}`);
      const postA1Card = memberAPage.getByRole('article').filter({hasText: 'Group A spam flyer'});
      await postA1Card.getByRole('button', {name: 'Report group post'}).click();
      await postA1Card.getByRole('combobox', {name: 'Reason'}).selectOption('spam');
      await postA1Card.getByLabel('Details (optional)').fill('Unsolicited doorstep flyer');
      await postA1Card.getByRole('button', {name: 'Submit report'}).click();
      await expect(postA1Card.getByText('Report sent to TrustFive moderators.')).toBeFocused();

      // Duplicate report on postA2 gives friendly already-reported message.
      const postA2Card = memberAPage.getByRole('article').filter({hasText: 'Saturday community garden'});
      await postA2Card.getByRole('button', {name: 'Report group post'}).click();
      await postA2Card.getByRole('combobox', {name: 'Reason'}).selectOption('other');
      await postA2Card.getByRole('button', {name: 'Submit report'}).click();
      await expect(postA2Card.getByText('You already reported this post.')).toBeFocused();

      // Member B reports postB1 in Group B as privacy concern.
      await memberBPage.goto(`${app}/community/groups/${groupB}`);
      const postB1Card = memberBPage.getByRole('article').filter({hasText: 'local street lighting'});
      await postB1Card.getByRole('button', {name: 'Report group post'}).click();
      await postB1Card.getByRole('combobox', {name: 'Reason'}).selectOption('privacy');
      await postB1Card.getByRole('button', {name: 'Submit report'}).click();
      await expect(postB1Card.getByText('Report sent to TrustFive moderators.')).toBeFocused();

      // 3. Ordinary members cannot access /admin moderation queue.
      await memberBPage.goto(`${app}/admin`);
      await expect(memberBPage.getByRole('heading', {name: 'Access restricted'})).toBeVisible();
      await expect(memberBPage.getByRole('region', {name: 'Group post reports'})).toHaveCount(0);
      expect(unauthorizedQueueReads).toBe(0);

      // 4. Moderator A filters queue, recovers from a transient failure without losing pending items, then hides Group A post.
      await modAPage.goto(`${app}/admin`);
      const modAQueue = modAPage.getByRole('region', {name: 'Group post reports'});
      await modAQueue.getByRole('button', {name: 'Load group reports'}).click();
      await expect(modAQueue.getByRole('article')).toHaveCount(2);

      // Filter by Spam -> sees only Group A report; reset to All -> sees both.
      const catFilter = modAQueue.getByLabel('Filter group reports by category');
      await catFilter.selectOption('spam');
      await expect(modAQueue.getByRole('article')).toHaveCount(1);
      await expect(modAQueue.getByRole('article').first()).toContainText('Group A spam flyer');
      await catFilter.selectOption('all');
      await expect(modAQueue.getByRole('article')).toHaveCount(2);

      // First hide attempt fails transiently -> error alert focused AND pending queue stays intact!
      await modAQueue
        .getByRole('article')
        .filter({hasText: 'Group A spam flyer'})
        .getByRole('button', {name: 'Hide post'})
        .click();
      await modAQueue.getByRole('button', {name: 'Confirm hide post'}).click();
      await expect(modAQueue.getByRole('alert')).toContainText('Could not load or update group reports');
      await expect(modAQueue.getByRole('article')).toHaveCount(2);

      // Retry hide succeeds -> Group A post hidden, Group B report remains pending.
      await modAQueue
        .getByRole('article')
        .filter({hasText: 'Group A spam flyer'})
        .getByRole('button', {name: 'Hide post'})
        .click();
      await modAQueue.getByRole('button', {name: 'Confirm hide post'}).click();
      await expect(modAQueue.getByText('Post hidden and decision recorded.')).toBeFocused();
      await expect(modAQueue.getByRole('article')).toHaveCount(1);

      // 5. Moderator B opens /admin and dismisses Group B's report.
      await modBPage.goto(`${app}/admin`);
      const modBQueue = modBPage.getByRole('region', {name: 'Group post reports'});
      await modBQueue.getByRole('button', {name: 'Load group reports'}).click();
      await expect(modBQueue.getByRole('article')).toHaveCount(1);
      await modBQueue
        .getByRole('article')
        .filter({hasText: 'local street lighting'})
        .getByRole('button', {name: 'Dismiss report'})
        .click();
      await modBQueue.getByRole('button', {name: 'Confirm dismiss report'}).click();
      await expect(modBQueue.getByText('Report dismissed and decision recorded.')).toBeFocused();
      await expect(modBQueue.getByText('No pending group post reports.')).toBeVisible();

      expect(decisions).toEqual([
        {moderator: moderatorA, postId: postA1, action: 'hide'},
        {moderator: moderatorB, postId: postB1, action: 'dismiss'},
      ]);

      // 6. Verify final visibility for both ordinary members.
      await memberAPage.getByRole('button', {name: 'Refresh discussions'}).click();
      await expect(memberAPage.getByText('Group A spam flyer')).toHaveCount(0);
      await expect(memberAPage.getByText('Saturday community garden')).toBeVisible();

      await memberBPage.goto(`${app}/community/groups/${groupB}`);
      await expect(memberBPage.getByText('local street lighting')).toBeVisible();

      // 7. Neighbourhood feed post duplicate report (23505) & Escape keyboard dismissal.
      await memberAPage.goto(`${app}/community/social`);
      const feedCard = memberAPage.getByTestId(`social-post-card-${feedPost1}`);
      await feedCard.getByRole('button', {name: 'Read and reply'}).click();
      await feedCard.getByRole('button', {name: 'Report post'}).click();
      const reasonSelect = feedCard.getByRole('combobox', {name: 'Reason'});
      await expect(reasonSelect).toBeFocused();
      await reasonSelect.press('Escape');
      await expect(feedCard.getByRole('button', {name: 'Report post'})).toBeFocused();
      await feedCard.getByRole('button', {name: 'Report post'}).click();
      await feedCard.getByRole('button', {name: 'Submit report'}).click();
      await expect(feedCard.getByText('You already reported this post.')).toBeFocused();
    } finally {
      await Promise.all([
        memberAPage.close(),
        memberBPage.close(),
        modAPage.close(),
        modBPage.close(),
      ]);
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      fixture.close(error => (error ? reject(error) : resolve()));
      fixture.closeAllConnections();
    });
  }
});
