import {once} from 'node:events';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {expect, test} from '@playwright/test';
import {CURATED_UK_GUIDES} from '../../lib/curated-uk-guides';
import {
  calculateProfileCompleteness,
  tallyPollVotes,
  validateLocalListingDraft,
  validatePollDraft,
} from '../../lib/social-superapp';

const backend = 'http://127.0.0.1:54321';
const app = 'http://127.0.0.1:3112';
const user = {id: 'aaaaaaaa-0000-4000-8000-000000000091', aud: 'authenticated'};
const peerUserId = 'bbbbbbbb-0000-4000-8000-000000000092';
const token = 'synthetic-social-superapp-token';
const areaA = {id: '11111111-1111-4111-8111-111111111101', area_name: 'Didsbury', city: 'Manchester'};

test.describe('TrustFive Social Super-App domain helpers (LinkedIn × Nextdoor × Xing)', () => {
  test('computes LinkedIn/Xing profile completeness accurately', () => {
    const empty = calculateProfileCompleteness({});
    expect(empty.percent).toBe(0);
    expect(empty.missing.length).toBe(5);

    const full = calculateProfileCompleteness({
      display_name: 'Gary Pearce',
      headline: 'Lead CCTV & Starlink Installer',
      about: '25+ years hands-on UK commercial and domestic security and telecom installations.',
      skills: ['CCTV & Security', 'Starlink & Satellite'],
      offers_summary: '4K PoE CCTV, Starlink mounting and tidy Cat6 runs',
      looking_for_summary: 'Trusted local roofers and Part-P electricians for job swaps',
    });
    expect(full.percent).toBe(100);
    expect(full.missing).toEqual([]);
  });

  test('validates poll drafts, blocks off-platform contact details, and tallies votes', () => {
    expect(
      validatePollDraft({
        areaId: areaA.id,
        question: 'Which home security upgrade is best?',
        options: ['4K PoE CCTV', 'Wireless smart alarm'],
      })
    ).toBeNull();

    expect(
      validatePollDraft({
        areaId: areaA.id,
        question: 'Call 07860 244 274 to vote on security',
        options: ['Option A', 'Option B'],
      })
    ).toMatch(/phone|contact/i);

    const tally = tallyPollVotes(
      ['4K PoE CCTV', 'Wireless smart alarm'],
      [
        {voter_id: user.id, option_index: 0},
        {voter_id: peerUserId, option_index: 0},
        {voter_id: 'cccccccc-0000-4000-8000-000000000093', option_index: 1},
      ],
      user.id
    );
    expect(tally.totalVotes).toBe(3);
    expect(tally.userVoteIndex).toBe(0);
    expect(tally.breakdown[0]).toEqual({index: 0, label: '4K PoE CCTV', count: 2, percent: 67});
    expect(tally.breakdown[1]).toEqual({index: 1, label: 'Wireless smart alarm', count: 1, percent: 33});
  });

  test('validates local For Sale & Free drafts and ships clean-room UK guides', () => {
    expect(
      validateLocalListingDraft({
        areaId: areaA.id,
        title: 'Leftover white metro tiles',
        description: 'Half a box of white ceramic metro tiles, dry stored in garage.',
        priceGbp: 0,
      })
    ).toBeNull();

    expect(
      validateLocalListingDraft({
        areaId: areaA.id,
        title: 'Spare drill for sale',
        description: 'Visit https://example.com or email me@test.co.uk to buy.',
        priceGbp: 45,
      })
    ).toMatch(/website|link|email|contact/i);

    expect(CURATED_UK_GUIDES.length).toBeGreaterThanOrEqual(5);
    for (const guide of CURATED_UK_GUIDES) {
      expect(guide.keyTakeaways.length).toBeGreaterThanOrEqual(3);
      expect(guide.discussionPrompt.length).toBeGreaterThan(20);
    }
  });
});

test.describe('TrustFive Social Super-App end-to-end journeys', () => {
  test('signed-in member uses Polls, Curated UK Guides, People/Skills Network, and For Sale & Free cleanly on desktop and 360px mobile', async ({
    page,
  }) => {
    test.skip(
      process.env.NEXT_PUBLIC_SUPABASE_URL !== backend,
      'Requires the isolated loopback application build.'
    );
    test.setTimeout(60000);
    page.setDefaultTimeout(10000);

    const polls: Array<Record<string, unknown>> = [];
    const pollVotes: Array<Record<string, unknown>> = [];
    const memberProfiles: Array<Record<string, unknown>> = [
      {
        user_id: peerUserId,
        display_name: 'Sam Patel · Local Spark',
        headline: 'NAPIT Approved Electrician · Consumer Units & EV Chargers',
        about: 'Domestic and small commercial electrical work across South Manchester.',
        area_id: areaA.id,
        skills: ['Electrical & EV Chargers', 'Smart Alarms'],
        offers_summary: 'EICR inspections, RCBO boards and EV charger installs',
        looking_for_summary: 'Reliable CCTV and Wi-Fi installers for referral swaps',
        open_to_work: true,
        open_to_referrals: true,
        updated_at: '2026-11-26T10:00:00Z',
      },
    ];
    const connections: Array<Record<string, unknown>> = [];
    const endorsements: Array<Record<string, unknown>> = [];
    const listings: Array<Record<string, unknown>> = [];
    let counter = 0;

    const fixture = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', backend);
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
      if (url.pathname === '/auth/v1/user') {
        return request.headers.authorization === 'Bearer ' + token
          ? reply(200, user)
          : reply(401, {message: 'Not signed in'});
      }
      if (request.headers.authorization !== 'Bearer ' + token) {
        return reply(401, {message: 'Synthetic session required'});
      }

      const readBody = async () => {
        const chunks: Buffer[] = [];
        for await (const c of request) chunks.push(Buffer.from(c));
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed[0] : parsed;
      };

      if (url.pathname === '/rest/v1/service_areas') return reply(200, [areaA]);
      if (url.pathname === '/rest/v1/profiles') {
        return reply(200, {full_name: 'Gary Pearce', requested_role: 'professional'});
      }
      if (url.pathname === '/rest/v1/social_polls') {
        if (request.method === 'POST') {
          const row = await readBody();
          counter += 1;
          const created = {
            id: `44444444-4444-4444-8444-44444444440${counter}`,
            author_id: row.author_id,
            area_id: row.area_id,
            question: row.question,
            options: row.options,
            status: 'open',
            created_at: new Date().toISOString(),
          };
          polls.unshift(created);
          return reply(201, [created]);
        }
        return reply(200, polls);
      }
      if (url.pathname === '/rest/v1/social_poll_votes') {
        if (request.method === 'POST') {
          const row = await readBody();
          const idx = pollVotes.findIndex((v) => v.poll_id === row.poll_id && v.voter_id === row.voter_id);
          if (idx >= 0) pollVotes[idx] = row;
          else pollVotes.push(row);
          return reply(201, [row]);
        }
        return reply(200, pollVotes);
      }
      if (url.pathname === '/rest/v1/rpc/social_poll_summary') {
        return reply(200, polls.map((poll) => {
          const votes = pollVotes.filter((vote) => vote.poll_id === poll.id);
          const vote_counts: Record<string, number> = {};
          for (const vote of votes) {
            const option = String(vote.option_index);
            vote_counts[option] = (vote_counts[option] ?? 0) + 1;
          }
          const mine = votes.find((vote) => vote.voter_id === user.id);
          return {
            poll_id: poll.id,
            vote_counts,
            my_option_index: mine ? Number(mine.option_index) : null,
            total_votes: votes.length,
          };
        }));
      }
      if (url.pathname === '/rest/v1/social_member_profiles') {
        if (request.method === 'POST') {
          const row = await readBody();
          const idx = memberProfiles.findIndex((p) => p.user_id === row.user_id);
          const next = {...row, updated_at: new Date().toISOString()};
          if (idx >= 0) memberProfiles[idx] = next;
          else memberProfiles.unshift(next);
          return reply(201, [next]);
        }
        return reply(200, memberProfiles);
      }
      if (url.pathname === '/rest/v1/social_connections') {
        if (request.method === 'POST') {
          const row = await readBody();
          counter += 1;
          const created = {
            id: `55555555-5555-4555-8555-55555555550${counter}`,
            ...row,
            status: 'pending',
            created_at: new Date().toISOString(),
          };
          connections.unshift(created);
          return reply(201, [created]);
        }
        return reply(200, connections);
      }
      if (url.pathname === '/rest/v1/social_skill_endorsements') {
        if (request.method === 'POST') {
          const row = await readBody();
          counter += 1;
          const created = {id: `66666666-6666-4666-8666-66666666660${counter}`, ...row};
          endorsements.push(created);
          return reply(201, [created]);
        }
        return reply(200, endorsements);
      }
      if (url.pathname === '/rest/v1/social_local_listings') {
        if (request.method === 'POST') {
          const row = await readBody();
          counter += 1;
          const created = {
            id: `77777777-7777-4777-8777-77777777770${counter}`,
            ...row,
            status: 'available',
            created_at: new Date().toISOString(),
          };
          listings.unshift(created);
          return reply(201, [created]);
        }
        if (request.method === 'PATCH') {
          const row = await readBody();
          const idEq = url.searchParams.get('id')?.replace(/^eq\./, '');
          const match = listings.find((item) => item.id === idEq);
          if (match) Object.assign(match, row);
          return reply(200, match ? [match] : []);
        }
        return reply(200, listings);
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

      // 1. Feed: Live Poll creation + voting + Curated UK Guides discuss button
      await page.setViewportSize({width: 1440, height: 900});
      await page.goto('/community/social');
      await expect(page.getByTestId('social-polls-panel')).toBeVisible();
      await expect(page.getByTestId('social-curated-guides')).toBeVisible();

      await page.getByRole('button', {name: '+ Create a poll'}).click();
      await page.locator('#poll-area').selectOption(areaA.id);
      await page.locator('#poll-question').fill('Which winter home check should neighbours prioritise first?');
      await page.locator('#poll-opt-1').fill('Roof tiles & gutter clearing');
      await page.locator('#poll-opt-2').fill('Annual boiler pressure check');
      await page.getByRole('button', {name: 'Publish poll'}).click();

      await expect(page.getByText('Which winter home check should neighbours prioritise first?')).toBeVisible();
      await page.getByRole('button', {name: /Roof tiles & gutter clearing/}).click();
      await expect(page.getByRole('button', {name: /✓ Roof tiles & gutter clearing/})).toContainText('100%');

      // Curated UK guide 1-click discussion pre-fill
      await page.getByRole('button', {name: 'Discuss in your neighbourhood'}).first().click();
      await expect(page.getByLabel('Write your community post')).toHaveValue(/CCTV/i);

      // 2. People tab: LinkedIn × Xing Profile + Skill Endorsements + Peer Connection
      await page.goto('/community/social?tab=network');
      await expect(page.getByTestId('social-member-network')).toBeVisible();
      await page.getByTestId('social-member-network').locator('.social-member-profile-summary').click();
      await page.locator('#sp-display-name').fill('Gary Pearce · ADI Communications');
      await page.locator('#sp-area').selectOption(areaA.id);
      await page.locator('#sp-headline').fill('Lead CCTV, Starlink & Network Installer · 25+ Years UK Experience');
      await page.locator('#sp-about').fill('Hands-on UK commercial and domestic security, satellite broadband and Cat6 installations.');
      await page.getByRole('button', {name: '+ CCTV & Security'}).click();
      await page.locator('#sp-offers').fill('4K PoE CCTV, Starlink mounting and Cat6 cabling');
      await page.locator('#sp-looking-for').fill('Trusted local electricians and roofers for clean job swaps');
      await expect(page.getByTestId('profile-completeness-meter')).toContainText('100%');
      await page.getByRole('button', {name: 'Save TrustFive Social profile'}).click();
      await expect(page.getByText('Your LinkedIn & Xing-style TrustFive profile is saved!')).toBeVisible();

      // Endorse peer skill and send connection request with note
      await page.getByRole('button', {name: '+ Electrical & EV Chargers (0)'}).click();
      await expect(page.getByRole('button', {name: '✓ Electrical & EV Chargers (1)'})).toBeVisible();
      await page.getByPlaceholder('Add a personal intro note (optional, no phones/links)').fill(
        'Great to connect locally for South Manchester trade referrals.'
      );
      await page.getByRole('button', {name: 'Connect', exact: true}).click();
      await expect(page.getByText('Connection: pending')).toBeVisible();

      // 3. For Sale & Free tab: local exchange posting, anti-bypass firewall & status update
      await page.goto('/community/social?tab=exchange');
      await expect(page.getByTestId('social-local-exchange')).toBeVisible();
      await page.locator('#ex-area').selectOption(areaA.id);
      await page.locator('#ex-category').selectOption('free_giveaway');
      await page.locator('#ex-title').fill('Half reel of outdoor Cat6 cable (free)');
      await page.locator('#ex-desc').fill('Call 07860 244 274 to collect from my driveway.');
      await page.getByRole('button', {name: 'Post to local exchange'}).click();
      await expect(page.getByTestId('social-local-exchange').getByRole('alert')).toContainText(/phone|contact/i);

      await page.locator('#ex-desc').fill('Dry-stored outdoor Cat6 cable left over from a garden office install, free to a local trade or neighbour.');
      await page.getByRole('button', {name: 'Post to local exchange'}).click();
      await expect(page.getByText('Half reel of outdoor Cat6 cable (free)')).toBeVisible();
      await expect(page.getByText('FREE · available')).toBeVisible();
      await page.getByRole('button', {name: 'Mark reserved'}).click();
      await expect(page.getByText('FREE · reserved')).toBeVisible();

      // 4. 360px Mobile zero-horizontal-overflow check across Feed, People, and For Sale & Free
      await page.setViewportSize({width: 360, height: 740});
      for (const path of ['/community/social', '/community/social?tab=network', '/community/social?tab=exchange']) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `Overflow on ${path} at 360px`).toBeLessThanOrEqual(0);
      }
    } finally {
      await new Promise<void>((resolve) => fixture.close(() => resolve()));
    }
  });
});
