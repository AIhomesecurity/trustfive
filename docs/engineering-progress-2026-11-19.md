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


## 21:02 UTC autonomous CI and security pass
- Re-inspected PR #1 (draft, open, unmerged), recent commits, issue #11, GitHub Actions, Vercel preview and Supabase staging. Staging has no active allocations or real provider coverage to demonstrate customer matching; no synthetic businesses were inserted.
- Identified a hard CI regression introduced by the new private job-site SQL tests: three anonymous PL/pgSQL blocks were written with invalid single-dollar delimiters (`do $` / `end $;`). PostgreSQL reports syntax error at line 510. Corrected the blocks with explicit `$private_test$` delimiters in commit `7095ca6`. An earlier attempted correction (`63e8e3b`) did not survive GitHub content handling and remained red; latest checks must be inspected before marking fixed.
- Supabase staging security advisors: five intentionally private no-policy tables, four publicly callable definer directory/helper functions, and 33 authenticated-callable definer functions. Do not revoke the public approval helper indiscriminately: public business-page RLS invokes it. Continue targeted audit.
- Vercel preview for `08b5de6` is READY at https://trustfive-jr1ns6ate-trust-five.vercel.app; the current `7095ca6` build has not been verified. READY is not proof of a working protected session.
- The selected job-site address is privately stored but job leads are still filtered by a manually selected territory, not automatically verified polygon coverage; professionals' quote eligibility currently checks territory, not their verified service radius. This is the next P0 privacy-and-routing gap.

### Priority after CI is green
1. Gate new private-address job leads and quote eligibility by verified professional service radius; do not expose raw job coordinates or addresses, and preserve legacy job compatibility.
2. Replace manual territory selection with verified boundary mapping; no guessing by city or postcode string.
3. Verify complete customer/professional flows on the protected preview with authorised test accounts, plus security definer/RLS audits.
4. Harden address-provider reliability, abuse limits, accessibility and international coverage.


## 21:58 UTC — consent audit and current-state verification
- Rechecked PR #1 (open, draft, unmerged), branch commits, issues #1–#12, latest CI, Vercel preview and staging Supabase security advisors. Before this run, both GitHub checks and database integration were green at `1435732`; its matching preview was READY at https://trustfive-8hg89fyt9-trust-five.vercel.app. Protected authenticated browsing has not been verified.
- Staging has zero verified professional service coverage records, so real-world radius matching cannot yet be demonstrated; do not create fake businesses to fill this gap.
- Implemented migration `0026_booking_address_consent_audit.sql`: a server-only, RLS-protected, non-address consent event log; every changed booking-address sharing choice records who granted/revoked access and when, while repeated choices are idempotent. A null consent choice is rejected.
- Added SQL regression checks for anonymous/authenticated access denial, explicit choice, idempotent grant/revoke, and correct customer attribution. Applied the migration successfully to staging. CI for the newest commits must be checked before calling the test suite green.
- Security advisors continue to flag five intentionally private no-policy tables and four public callable directory/helper SECURITY DEFINER functions. Avoid blanket permission changes: the public approval helper is required by the business-page RLS policy.

### Prioritized next steps
1. Confirm both CI suites for the new consent audit and fix any failure. Check protected Vercel preview with an authorised browser session.
2. Finish issue #11: trustworthy automatic customer address-to-territory mapping; do not infer territory from postcode text or city alone. Retain manual territory fallback until reviewed geographic boundaries exist.
3. Verify real approved professional service-radius matching with owner-authorised staging test accounts, and audit denial of private address access after cancellation/completion.
4. Continue targeted SECURITY DEFINER/RLS audit, professional onboarding, notifications, and community moderation. Keep payment processing in test mode only.


## 22:55 UTC — verified territory enforcement
- Independently inspected PR #1 (open/draft), latest commits, issues #1–#12, branch checks, Vercel deployment and staging advisors. Baseline commit `dc648e69` passed application and database CI; its Vercel preview is READY at https://trustfive-3un2a4avp-trust-five.vercel.app, but authenticated browsing is not proven.
- Discovered an important staging drift: verified-territory migration 0027 was in GitHub and CI but absent from the staging project's live schema. Applied it after migration 0028; both migrations now applied successfully and the protected resolver/trigger contract query passed.
- Added database enforcement for private job-site coordinates: where a country has reviewed territory polygons, reject unknown/outside territory or a manually spoofed area, even when a client bypasses the UI. Legacy manual area fallback remains only in countries without any reviewed boundaries. No fake territory polygons or businesses were inserted.
- Customer job form now automatically resolves the territory from the selected address, locks verified matches and displays a warning for manual fallback. No raw address is published to professionals.
- New migration: `0028_enforce_job_territory_boundaries.sql`; new contract test: `tests/db/verified_territory_contract.sql`.
- Security advisor still reports intentional no-policy private tables and publicly callable definer functions; review grants individually. No production changes.

### Updated prioritized queue
1. **P0** Confirm CI for the new UI and migration, fix any regressions; wire territory contract SQL into CI test runner.
2. **P0** Human-verify real service-area polygons and professional coverage locations; until then exact proximity cannot be demonstrated with real approved providers.
3. **P0** Improve unknown territory UX and avoid fallback selection when verified country boundaries exist but do not cover an address.
4. **P0** Verify protected Vercel preview using authorised browser session; READY alone is not enough.
5. **P1** Complete customer-to-quote-to-booking auth tests and individual SECURITY DEFINER/RLS audit; improve mobile/community and test-only payment flows.


## 2026-11-20 01:56 UTC — CI territory contract correction
- Re-inspected PR #1 (open/draft), master issue #12, branch commit history, latest CI, Vercel previews, staging Supabase data and security advisors. No production merge.
- The latest application CI on `f4aab740` succeeded, but database integration failed at `tests/db/verified_territory_contract.sql:48` with `role "PUBLIC" does not exist`. The test incorrectly passed `PUBLIC` as a named role to `has_function_privilege`; PostgreSQL PUBLIC is a grant pseudo-role, not a login role. Since `anon` inherits PUBLIC grants, checking `has_function_privilege('anon',...)` covers both direct anonymous and PUBLIC execution. Corrected the test in commit `eb915548`. Fresh CI queued; not yet claimed green.
- Vercel previously READY at https://trustfive-fcx9de740-trust-five.vercel.app for `f4aab740`; deployment of `eb915548` was BUILDING when inspected. A READY build does not prove authenticated protected-preview access.
- Staging contains **zero** verified professional service locations, **zero** reviewed territories and **zero** active providers. Real-world proximity matching remains blocked on independent evidence and approved onboarding, not synthetic fixtures.
- Security advisors report seven private RLS tables intentionally without direct policies and four anonymously callable SECURITY DEFINER functions. Review each public directory/helper function's output and permissions; do not blanket-grant private tables. Advisor: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Lovable paid Trade Finder is READY (prototype commit `a83baf2c`); free Experience Lab is blocked by exhausted credits. Neither is synchronized with canonical GitHub. No quota spent or demo listings imported.

### Immediate priorities
1. Confirm fresh database CI green after `eb915548`; if red, inspect logs and correct the precise regression.
2. Human-verify actual territory polygons and professional coverage, then exercise authenticated private-location/quote flow.
3. Audit exposed directory SECURITY DEFINER functions and tighten only demonstrably unnecessary privileges.
4. Verify protected Vercel preview with authorised access, followed by mobile address-search and community interaction checks.


## 2026-11-20 03:01 UTC — Country coverage contract regression repair
- Inspected current PR #1 (open/draft), tracker #12, branch commits, CI logs, staging counts and security advisors, Vercel previews, and both separate Lovable projects before editing. The latest app checks passed at `3ee2d4a2`, while database CI failed at the country coverage helper's empty-search-path assertion.
- Root cause: PostgreSQL serializes an explicitly empty `search_path` with quotation marks in `pg_proc.proconfig` on this runner. The contract asserted only the unquoted spelling `search_path=`, producing a false failure. Updated the test to accept either serialized representation **without allowing a nonempty search_path**. Commit `f837930b`. New CI was running at checkpoint; do not mark green before observing results.
- Latest previously READY Vercel deployment: https://trustfive-clyp9rlom-trust-five.vercel.app (`3ee2d4a2`). New `f837930b` deployment was BUILDING. Protected authenticated preview remains untested.
- Staging still has zero active professionals, zero verified professional locations and zero reviewed territories. The country coverage RPC migration `0029` is present in the branch but not yet in staging; align after passing CI, without creating synthetic data.
- Supabase security advisor still reports seven RLS tables without direct policies (private by design) and four anonymously executable SECURITY DEFINER directory functions. Audit each function rather than removing intentional public discovery blindly.
- Paid Lovable Trade Finder remains READY at prototype SHA `a83baf2c`, free Experience Lab still reports out_of_credits; no new generations, credits, demo data or GitHub sync.

### Updated immediate backlog
1. Confirm database CI after `f837930b`; if red, inspect exact failing assertion and fix it.
2. Apply tested country coverage helper to staging and validate its permissions and negative-input behavior.
3. Obtain independently verified territory boundaries and professional coverage; maintain zero-fabrication rule.
4. Verify authenticated protected Vercel preview and complete customer-to-professional booking path.
5. Audit public directory SECURITY DEFINER functions, rate limiting and community permissions.
