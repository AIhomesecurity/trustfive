# TrustFive Platform

**Unified trades marketplace with B2B platform, five-slot network, and integrated community social layer.**

TrustFive merges a Checkatrade-style trades marketplace (with the unique **five-slot network**: only 5 approved providers per trade per district) with a full community social platform (feed, groups, events, messaging, marketplace, jobs, learning, coaching, fundraisers). Tradespeople get a B2B network to find subcontractors. Customers get a vetted, trusted way to find local pros — plus a community to belong to.

## The merge

This repo combines two codebases:

| Source | Role in TrustFive |
|---|---|
| **AIhomesecurity/trustfive** (TanStack Start prototype) | The core trade concepts: five-slot network, Trade Finder question wizard, B2B collaboration requests, strict privacy boundaries (district-level, no exact addresses), booking support. Ported as Prisma models + Next.js API routes + React sections. |
| **Nexus social platform** (Next.js 16) | The community social layer: feed, network, groups, events, pages, messages, marketplace, jobs, profile, notifications, admin, learning, coaching, fundraisers, and the "More" tools hub. Replaces the TrustFive prototype's SocialHub. |

## The five-slot rule

> **Only 5 approved providers per trade per district.**

A tradesperson applies for a slot (trade + district). If fewer than 5 are approved, they're approved immediately (rank 1-5). If all 5 slots are filled, they're waitlisted (rank 6+). When an approved provider is revoked (through a separate marketplace review, not a single support case), the next waitlisted provider is promoted.

## TrustFive security boundaries (preserved from the prototype)

1. **Marketplace approval is separate from social verification.** Social actions never create, revoke, or imply marketplace approval.
2. **No exact addresses on social tables.** Locations are district-level (town or outward postcode district).
3. **B2B requests have no customer columns.** `CollabRequest` and `CollabInterest` store only tradesperson-to-tradesperson data.
4. **Status transitions are server-side.** `CollabRequest.status`, `TradeApproval.status`, and `SupportCase.status` can only be changed by API routes.
5. **Moderation is human-reviewed and reversible.** No automatic penalties on marketplace approval.
6. **The five-slot rule is enforced at the database level.** `TradeSlot.maxSlots` defaults to 5.

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style) + Lucide icons
- **Database**: Prisma ORM with SQLite (swappable to Postgres + PostGIS)
- **Realtime**: Socket.io (mini-service on port 3003)
- **State**: Zustand (client) + TanStack Query (server)

## Getting started

```sh
bun install
bun run db:push
bun run dev
# In another terminal:
cd mini-services/chat-service && bun install && bun --hot index.ts
# Seed demo data:
curl http://localhost:3000/api/seed
```

## The 20 sections

### TrustFive core (the marketplace)
- **Trade Finder** — search approved pros, five-slot map, apply for a slot, guided question wizard
- **Book a Service** — post job, receive quotes, hire, pay (escrow), review
- **B2B Network** — tradespeople posting for subcontractors
- **Support** — booking disputes, FAQ

### Community (the social layer)
- Community Feed, Network, Groups, Events, Pages, Messages, Notifications, Marketplace, Neighbourhood Map

### Professional
- Jobs, Learning, Coaching, Fundraisers, More (12 tools: Ads, Premium, Resume, Salary, Referrals, Memories, 2FA, Safety Check, Auto-bid, Business, Translation, Digest)

### You
- Profile (dual-mode Personal + Pro/Tradesperson), Admin (moderation)

## License

Proprietary — AIhomesecurity / ADI Communications LTD.
