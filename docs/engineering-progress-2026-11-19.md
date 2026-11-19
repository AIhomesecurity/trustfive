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

## 19:57 UTC autonomous audit and changes
- Inspected PR #1 (open, unmerged; head `3e62cd5` at audit), open issues #1–#11, GitHub Actions (latest pre-run checks and database integration green), Vercel preview (READY for `3e62cd5`, but READY does **not** prove an authenticated browser session), Supabase staging and security advisors.
- Staging has no verified professional service coverage rows, so live proximity results cannot yet be demonstrated with real providers. Do not create fake business data to populate it.
- Security advisor: four intentional no-policy private tables; three anonymous-callable public directory SECURITY DEFINER functions plus the boolean approval helper, and 30 authenticated-callable definer functions. Review each grant and its exposed fields; avoid blanket revocation.
- **Important negative regression:** revoking anonymous EXECUTE on `is_active_approved_application(uuid)` caused `SELECT public.professional_business_pages` under role `anon` to fail with SQLSTATE 42501, because public RLS policy evaluation invokes this helper. Immediately restored grants and verified anonymous business-page query works. Migration `0020_restrict_approval_helper_rpc.sql` was corrected to retain the required grants. Never use privilege-advisor counts alone as proof a revocation is safe.
- Added a database regression test to check the RLS helper grant and execute a real anonymous SELECT of business pages.
- Improved customer address finder so submitting ambiguous autocomplete suggestions never silently selects the first property; user must explicitly choose the correct address. Added Playwright regression test.
- No production merge, domains, paid API keys, real accounts or live payment changes.

### Updated next priorities
1. Confirm CI for latest commits and fix any browser/database failures.
2. Finish issue #11: private job-site address storage and securely restricted lead delivery, preserving strict five-slot allocation by verified territory. The /jobs page still uses the legacy area dropdown and does not yet meet exact-address acceptance criteria.
3. Audit each public directory SECURITY DEFINER function's returned fields, RLS interaction and grants; prefer targeted safe changes with negative role tests.
4. Verify protected Vercel preview with an authorised session; READY is a deployment status, not proof of end-to-end customer success.
