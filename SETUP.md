# Setup Guide

This repo contains the **TrustFive merged platform** — a Checkatrade-style trades marketplace with five-slot network + B2B platform + full community social layer.

## What's in this repo

### Core files (pushed)
- `README.md` — full architecture documentation
- `package.json` — dependencies (Next.js 16, Prisma, shadcn/ui, Zustand, TanStack Query, Socket.io)
- `prisma/schema.prisma` — **60+ models** including TrustFive core (District, TradeSlot, TradeApproval, CollabRequest, CollabInterest, SupportCase) + all social/community models
- `src/lib/db.ts`, `src/lib/api.ts`, `src/lib/utils.ts` — Prisma client, fetch helper, cn()
- `src/stores/app-store.ts` — Zustand store with 20 section keys
- `src/app/layout.tsx` — root layout with TrustFive metadata
- `src/app/page.tsx` — single-page app shell rendering all 20 sections
- `src/components/shell/sidebar.tsx` — TrustFive-branded sidebar (TrustFive → Community → Professional → You)
- `src/components/shell/mobile-nav.tsx` — mobile bottom nav (Find, Book, Community, Chat, Me)

### TrustFive API routes (pushed)
- `src/app/api/trade-slots/route.ts` — five-slot availability
- `src/app/api/trade-approval/apply/route.ts` — apply for a slot (enforces 5-cap)
- `src/app/api/collab-requests/route.ts` — B2B collaboration requests
- `src/app/api/collab-requests/interest/route.ts` — express interest
- `src/app/api/support-cases/route.ts` — booking disputes
- `src/app/api/districts/route.ts` — district directory

### Section components (to add)
The following section components need to be created in `src/components/sections/`:

**TrustFive core:**
- `trade-finder.tsx` — Trade Finder with five-slot map, search, apply, question wizard
- `b2b.tsx` — B2B collaboration requests
- `support.tsx` — Support cases + FAQ

**Community (social layer):**
- `feed.tsx` — Community feed (posts, reactions, comments, stories)
- `network.tsx` — Connections, haves/wants, skills
- `groups.tsx` — Community groups
- `events.tsx` — Events with RSVP
- `pages.tsx` — Business/tradesperson pages
- `messages.tsx` — Real-time chat (Socket.io)
- `marketplace.tsx` — Buy/sell locally
- `map.tsx` — Neighbourhood map + alerts
- `notifications.tsx` — Notification centre

**Professional:**
- `jobs.tsx` — Job board
- `services.tsx` — Book a service (post job → quotes → hire → pay)
- `learning.tsx` — Courses + assessments + certificates
- `fundraisers.tsx` — Donation campaigns
- `coaching.tsx` — Mentor booking
- `more.tsx` — 12 tools (Ads, Premium, Resume, Salary, Referrals, Memories, 2FA, Safety Check, Auto-bid, Business, Translation, Digest)

**You:**
- `profile.tsx` — Dual-mode profile (Personal + Pro/Tradesperson)
- `admin.tsx` — Moderation queue, reports

### Additional API routes (to add)
Social: `posts`, `reactions`, `comments`, `stories`, `listings`, `jobs`, `service-jobs`, `quotes`, `bookings`, `groups`, `events`, `pages`, `conversations`, `messages`, `notifications`, `reports`, `search`, `users`, `me`, `categories`, `neighbourhoods`, `help-requests`, `alerts`, `credits`, `verification`, `network`, `trust`, `courses`, `assessments`, `fundraisers`, `mentors`, `referrals`

### UI components
Install shadcn/ui (New York style):
```sh
npx shadcn@latest init
npx shadcn@latest add button card input textarea label badge avatar select tabs dialog separator progress switch tooltip scroll-area dropdown-menu accordion alert-dialog
```

## Getting started

```sh
# Clone
git clone https://github.com/AIhomesecurity/trustfive.git
cd trustfive

# Install dependencies
bun install  # or npm install

# Set up the database
echo 'DATABASE_URL="file:./db/custom.db"' > .env
bun run db:push

# Start the dev server
bun run dev

# Seed demo data
curl http://localhost:3000/api/seed

# Open
open http://localhost:3000
```

## The five-slot rule

TrustFive's key differentiator: **only 5 approved providers per trade per district.**

- A tradesperson applies for a slot (trade + district)
- If < 5 approved, they're approved immediately (rank 1-5)
- If all 5 filled, they're waitlisted (rank 6+)
- When an approved provider is revoked (separate marketplace review), next waitlisted is promoted

This caps supply per trade per area, so:
- Every approved pro gets enough work
- Customers get a vetted shortlist, not an overwhelming directory
- Competition is on trust and quality, not price wars

## Security boundaries (from TrustFive prototype)

1. **Marketplace approval ≠ social verification** — social actions never affect five-slot approval
2. **No exact addresses on social tables** — district-level only (town or outward postcode)
3. **B2B requests have no customer columns** — tradesperson-to-tradesperson only
4. **Status transitions are server-side** — CollabRequest, TradeApproval, SupportCase
5. **Moderation is human-reviewed and reversible** — no automatic penalties
6. **Five-slot rule enforced at DB level** — TradeSlot.maxSlots = 5

## License

Proprietary — AIhomesecurity / ADI Communications LTD
