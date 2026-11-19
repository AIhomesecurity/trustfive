# TrustFive engineering progress — 2026-11-19 19:00 UTC

## Verified current state
- PR #1 remains open and unmerged. Development branch: `feature/verified-marketplace-core`.
- CI for commit `40ec347`: Next.js build, types and HTTP smoke passed, browser suite **7 passed / 1 failed**. Failing case expected a sign-in link on `/jobs` although auth middleware redirects anonymous visitors before the page renders. Log: https://github.com/AIhomesecurity/trustfive/actions/runs/44593433947
- Root cause: `middleware.ts` redirected anonymous `/jobs?trade=...&area=...` to `/account` and dropped the original search state.
- Fixed middleware to preserve a local `next` value with the full pathname + search; updated Playwright assertions for the actual middleware behavior. Latest CI must confirm.
- Supabase staging `lkfkhjthdtcefrcaatsi`: no database changes made in this pass. GitHub database integration for earlier runner-only commits passed; not a substitute for live staging auth verification.
- A separate free coding-agent workflow was added to the **main** branch (GitHub schedules run there), and a bounded runner script was added to this development branch. It is not verified end-to-end and will skip AI execution until the owner adds `OPENROUTER_API_KEY` to Actions secrets.
- Main-branch Vercel builds show ERROR because `main` currently only contains a README and the scheduler workflow, not the Next.js app. Feature-branch Vercel preview is building; do not confuse the main error with a production application failure.

## Priority queue
1. **P0** Confirm CI and browser suite green for middleware redirect fix; test full signup/login callback, valid `next` redirects and malicious external URL rejection.
2. **P0** Verify protected Vercel preview actually serves app pages and Supabase Auth works end-to-end; never claim from BUILDING/READY alone.
3. **P0** Security audit of approved five-slot allocations, waiting list offers, independent verification, complaint appeals, RLS and definer permissions.
4. **P0** Free-agent runner hardening: verify CLI installation, free model selection, permissions, token isolation, draft PR and no-production guardrails in a manual dry run after the secret is installed. Review main-branch Vercel deployment configuration.
5. **P1** Improve professional directory trust signals, verified reviews, empty results and job/quote/booking user journey.
6. **P1** Improve community groups, feed, messaging, events and moderation with privacy/abuse testing.
7. **P2** Test-only Stripe billing and mobile/internationalization readiness.

## Next action
Check the latest GitHub Actions runs after commits `b504f2f` and `42b78af`. If browser suite fails, inspect the actual Playwright failure logs and fix the underlying behavior; do not skip the failing test.
