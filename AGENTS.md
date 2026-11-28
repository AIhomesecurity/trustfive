# TrustFive autonomous coding-agent instructions

## Mission
Build a safe, excellent UK-first / worldwide-ready trusted local-services marketplace, professional operating centre and neighbourhood social platform. Preserve the key rule: **never more than five independently approved active professionals per trade category per defined local area**. Qualified waiting-list applicants are not active listings. Approval, search order and waiting-list order must never be purchased.

## Existing sources of truth
- Repository: `AIhomesecurity/trustfive`
- Working branch: `feature/verified-marketplace-core`; draft PR #1. Do not merge into `main` without approval.
- Stack: Next.js, React, TypeScript, Supabase (PostgreSQL/Auth/RLS), Vercel, Stripe test mode.
- Staging Supabase: `lkfkhjthdtcefrcaatsi`. This is **not** the other existing Supabase project `niyfvoxiagvbonifuctv`.
- Vercel project: `trustfive` in team `trust-five`, preview deployment tied to feature branch.
- Read `docs/competitor-pages-ux-audit.md` and other project docs. Study accessible current public UX documentation if appropriate. Never copy competitor private source, assets or personal data.

## Continuation contract: don't stop after one task unless execution ends
For each available coding-agent run:
1. Sync branch and inspect actual open PR, latest commits, GitHub Actions and Vercel Preview status. Read existing instructions and backlog. Avoid duplicate development.
2. Identify the most consequential unfinished, feasible, reversible task. Fix broken workflows before adding new pages.
3. Implement original changes with tests and secure database migrations where needed. Validate TypeScript, Next.js build, browser tests and database tests.
4. Commit the changes to feature branch, review checks, fix regressions, and verify a protected staging route when accessible.
5. Record what was built, verified, blocked and next priorities. Choose another task within the remaining execution budget and repeat.
6. When a run reaches platform limits, leave clean commits and an explicit next action so another run resumes without needing the owner to choose work.

## Prioritized backlog
**P0** Verify Supabase email confirmations and callback allow-list for protected staging; authenticated signup/sign-in, customer-to-job-to-quote-to-booking tests including real permissions and recovery. The job flow must preserve selected trade and area through authentication.
**P0** Independently verify professional approvals, database five-slot transaction limits, no payment influence, fair waitlist and complaint/appeal RLS; review remaining SECURITY DEFINER grants individually.
**P0** Complete real provider profile data, live trust indicators and review proof, robust 0-results experience, privacy and abuse handling.
**P1** Build polished customer job-posting wizard, reliable job notifications and quotes; professional CRM/calendar/invoices/availability.
**P1** Improve neighbourhood feed, groups, events, messaging, reactions, reporting and moderation with privacy and realistic load/abuse tests.
**P1** Improve mobile responsive design, accessibility, performance and instrumentation of actual successful match/booking outcomes.
**P2** Stripe test-only subscriptions, webhook handling and Connect concepts; live-money activation requires separate owner approval.
**P2** Country/area configuration and mobile native applications only after core customer and professional journeys work securely.

## Definition of done
- Real source code, tests, and a reviewed commit exist.
- CI checks pass on that exact commit.
- Relevant staging URL/API is checked, not inferred from a build status.
- No fabricated listing, review or payment data; do not claim onboarding/payment is operational without end-to-end verification.
- Document known blockers, owner-only actions and the next implementable task.

## Guardrails
Never alter public production or existing production data, merge incomplete branches, publish unverified products, approve real professionals without independent review, reveal credentials, make purchases, activate live payments or perform irreversible operations without explicit approval. Use staging fixtures only when clearly identified and cleaned up. Do not circumvent external platform access restrictions. Do not suppress CI to disguise a failure.

## Scheduling limitation
This file preserves durable engineering intent but **does not create a persistent process**. A separate coding-agent runner (e.g. GitHub Copilot agent-powered workflows or another connected agent execution environment) must be configured and authorized to run regularly. ChatGPT reminders alone do not execute code continuously.
