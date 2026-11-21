# OpenCode mega engineering challenge — running report

Base of record: `feature/verified-marketplace-core` @ `995f9d0b3c3d477d36c2e5ba0ab899170082c1d4`.

This file is updated at every milestone. It is deliberately kept in the branch rather than only in an issue so the evidence survives independently of GitHub notifications.

## Scope guardrails

- No production merges, no direct pushes to `feature/verified-marketplace-core` or `main`.
- No changes to other agents' branches (`agent/agy-bookings-quotes`, `agent/gemini-professional-onboarding`, `agent/chatgpt-events-discovery-upgrade`, existing PR #26).
- No SQL/RLS changes in this slice. No payment, ranking or approval changes.
- Max-five independently approved active professionals per trade per defined area remains enforced in the database.

## Milestone 1 — repository audit + ESLint repair

### Full repository audit (completed)

**Audit scope.** Read-only static audit of the customer-search worktree at
`agent/opencode-customer-search@d42bbe3c` (PR #26 head), which is based on the
older integration tip `81a518c`. It does not include PRs #28/#31/#32/#34 or the
later fixes in PRs #35/#37/#38. Evidence is drawn from actual files read;
claims quoted from PR bodies are marked *claim*. Findings that have since been
resolved by later milestones are annotated below.

**Verdict.** Not production-ready as an integrated batch. The database core has
unusually strong contracts for the five-slot rule, private addresses, consent,
waitlist fairness, Stripe test isolation and release governance. The blocking
weakness is integration assurance: duplicate migration versions, divergent PR
bases, incomplete privilege pinning and no authenticated staging run.

#### Top ten risks (ranked)

| # | Severity | Risk and file/line evidence | Mitigation / status |
| --- | --- | --- | --- |
| 1 | Critical | **Migration version collision.** Two `0035_*` files already exist (`supabase/migrations/0035_restrict_country_release_history_sequence.sql`, `supabase/migrations/0035_uk_nationwide_area_interest.sql`); PRs #28/#31/#32 each add a different `0036_*`. CI applies by shell glob (`.github/workflows/database-tests.yml:43-48`), not a version-aware deploy path. | **Partially verified in milestone 3:** all 52 SQL steps pass in both unique-version and as-is glob order on disposable PostgreSQL 16. Still renumber to 0036/0037/0038 before versioned deploy; Supabase CLI behaviour was not tested. |
| 2 | Critical | **Private-table contract might break with PR #31.** `tests/db/private-table-directory-negative-contract.sql:13-44` pins a private-table set; PR #31 adds `professional_verification_submissions` without updating that contract (*claim*). | **Disproved in milestone 3:** the contract passes with PR #31's migration applied. No contract change needed. |
| 3 | High | **No reproducible green build/lint/test at the integration commit.** No lockfile; `package.json:5-26` defines `lint` but declares no ESLint; CI used `npm install`. | **Fixed in this PR (milestone 1):** lockfile committed, ESLint configured, all 15 violations fixed, CI uses `npm ci` and an explicit lint gate. |
| 4 | High | **Incomplete SECURITY DEFINER privilege matrix.** `tests/db/security-definer-grant-matrix.sql:11-41` pins the anonymous allowlist and `:59-75` trigger ACLs, but `:97-113` checks only four helpers for authenticated EXECUTE. Many definer RPCs are intentionally granted to `authenticated` (`supabase/migrations/0002_verified_network.sql:131-132,168-169,191-192,231-232,262-284`; `0004_quotes_bookings_messages.sql:230-231,244-245,261-262`). | Enumerate and pin the complete authenticated definer set in the grant-matrix contract; review each function's internal `auth.uid()`/`is_trustfive_admin()` guard. |
| 5 | High | **Auth fence not fail-closed and root list inconsistent.** `middleware.ts:6-7` calls `NextResponse.next()` when Supabase env vars are missing; `middleware.ts:12-14` omits `coverage`, while `lib/auth-return-path.ts:3-6` allows it. `/coverage` is intended to be public (`tests/e2e/uk-coverage-release-gates.spec.ts:4-12`). | Treat missing config as a deployment error, not an anonymous pass; document `/coverage` as public and add an explicit test for its sign-in-gated action. |
| 6 | Medium/High | **Privacy copy mismatch.** `components/address-search.tsx:45-50` says an address is "not stored in your directory search", but `lib/search-location-handoff.ts:3-6,29-49` writes label, coordinates, postcode, precision and country to `sessionStorage` for 30 minutes. | Change copy to "not sent to the public directory or stored server-side; kept temporarily in this browser tab only". Tab-scoped, validated, no private data in URLs (verified in PR #37 tests). |
| 7 | Medium | **Address API has no visible auth/quota/rate limit.** `app/api/address/search/route.ts:6-56` validates input and calls external providers with 5.5s timeouts; upstream abuse/cost depends on hosting/WAF configuration not inspected. | Add an edge/WAF rate limit and per-IP quota before exposing publicly at scale; do not assume provider limits. |
| 8 | Medium | **Client workflow guards are UX-only.** `lib/booking-completion-guard.ts:1-10`, `lib/professional-quote-guard.ts:1-12`, `lib/quote-confirmation.ts:1-22` check browser state only; correctness depends on complete RLS/RPC deployment. | Keep as honest preflights, never as authorisation. Re-run all DB contracts on the final integrated commit before relying on them. |
| 9 | Medium | **CI smoke checks are shallow.** `.github/workflows/ci.yml:29-55` checks fixed paths return HTTP 200 with placeholder keys; authenticated behaviour is only in opt-in specs (`tests/staging/authenticated-customer-smoke.spec.ts:3-10,25-28`). | Add anonymous protected-route redirect assertions to always-on CI; keep real-session acceptance owner-only and opt-in. |
| 10 | Medium | **Open PRs unverified/incomplete in the audited tree.** PR #34 body says browser/build were not verified; PR #31/#32 bodies cite validation at commits different from their current heads (*claims*). PR #32 heavily overlaps PR #26's jobs/quotes/bookings files. | Re-run CI and DB contracts at each PR's current head; rebase before integration and avoid batch merge. |

**Additional positive evidence.** Five-slot constraint and admin-only activation
(`supabase/migrations/0001_core.sql:12-17`), verified-only public directory
allowlists (`0002_verified_network.sql:286-306`; `0006_directory_ratings.sql:4-33`),
waitlist ordering independent of payment (`0002_verified_network.sql:134-169`),
consent-based private address disclosure with audit
(`0025_consent_booking_address.sql:4-53`, `0026_booking_address_consent_audit.sql`),
country release gates (`0033`-`0035`) and Stripe test-mode pinning
(`0009_stripe_test_memberships.sql:1-3,69-72`, `app/api/billing/checkout/route.ts:11-39`).

### ESLint repair (Phase 2)

**Problem.** `npm run lint` invoked `eslint .` but ESLint was not a declared dependency and there was no configuration, so the command failed on every machine and in CI (which did not call it). The repository also had no `package-lock.json`, while CI used `npm install`, so builds were not reproducible.

**Changes.**

- Added ESLint 9 flat configuration in `eslint.config.mjs`. The official Next.js 15 presets (`next/core-web-vitals`, `next/typescript`) are converted with `@eslint/eslintrc` `FlatCompat` because `eslint-config-next` 15.x still ships legacy eslintrc presets. These provide React, React Hooks, Next.js and TypeScript rules.
- Added focused `eslint-plugin-jsx-a11y` rules (alt text, valid anchors, ARIA props/roles/states, heading content, lang, iframe titles, scope, no redundant roles, no distracting elements, autofocus warning).
- Added `eslint-baseline.mjs` with an **empty** baseline array. No rule was globally disabled and no violation was baselined.
- Fixed all 15 reported violations instead of suppressing them:
  - 11 unescaped apostrophes in JSX copy (admin territories, billing, events, coverage, jobs, messages, schedule).
  - 2 unused variables (`catch(e)` in events, dead `updateArea` helper in services).
  - 1 invalid ARIA combination: the address input carried `aria-expanded` with an implicit `textbox` role; it now declares `role="combobox"` and `aria-autocomplete="list"`.
  - 1 `<img>` logo replaced with `next/image` (`unoptimized` for the local SVG so the image optimiser does not reject it).
- Added `package-lock.json` and switched CI from `npm install` to `npm ci --no-audit --no-fund`.
- Added an explicit `Lint source and tests` step to `.github/workflows/ci.yml` before type-checking and build.
- Ignored generated `next-env.d.ts` and lint scratch output.
- Cherry-picked the single-file Playwright collection fix from PR #37 (`tests/e2e/professional-quotes-anonymous-boundary.spec.ts`): worker-scoped `trace`/`screenshot`/`video` options must be at file scope. The base integration tip aborted the entire browser suite at collection, so its CI had been running zero tests. PR #37's CI at `c4e53a7` then reported 127 passed / 0 failed.

**Verification on this commit.**

| Command | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | PASS (319 packages installed from lockfile) |
| `npm run lint` | PASS (0 errors, 0 warnings) |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |

Initial lint baseline before fixes: 15 messages (12 errors, 3 warnings) across 10 files. All were corrected; no baselined or globally disabled rules.

### Later milestones in this challenge

- **Milestone 2 — `agent/opencode-mega-customer-journey` (PR #37):** 26 new Playwright tests, duplicate-submit guard, global reduced-motion, nested-redirect hardening, and repair of a describe-scoped Playwright option that had aborted full-suite collection. Full suite: 126 passed / 1 known environment failure / 4 skipped.
- **Milestone 3 — `agent/opencode-mega-migrations` (PR #38):** disposable PostgreSQL 16 harness proves all three `0036_*` PR migrations are mutually compatible (52/52 SQL steps in both orders) and recommends unique renumbering before versioned deploy.
- **Milestone 4 — release-readiness assessment:** PASS / PARTIAL / BLOCKED / FAIL evidence, owner-only actions, and the final recommendation. Kept in the running report so the evidence survives independently of GitHub notifications.

## Milestone 4 — release-readiness assessment

**Overall status: NO-GO for production merge or deployment.** The individual
slices have strong local evidence, but the integrated product is not ready:
migration versions collide, one browser-test collection defect must be present
in the merged result, real staging acceptance has not been performed, and
Vercel preview deployment is rate-limited. This is a review/recommendation, not
an authorisation to merge or deploy.

| Area | Status | Evidence |
| --- | --- | --- |
| Tooling and reproducible install | **PASS** | PR #35 @ `0685121`: `npm ci` PASS, `npm run lint` PASS 0/0, `npx tsc --noEmit` PASS, `npm run build` PASS; lockfile committed and CI uses `npm ci` + explicit lint gate. |
| Browser suite at the base integration commit | **FAIL → FIXED in PR #37** | `995f9d0` aborts Playwright collection (describe-scoped worker options in `professional-quotes-anonymous-boundary.spec.ts`). PR #37 @ `c4e53a7` repairs it; GitHub Actions `build` job reports **127 passed / 0 failed**. The same one-file fix is now also in PRs #35 and #38. |
| Customer journey, mobile, a11y, privacy and reliability tests | **PASS** | PR #37: 26 new deterministic Playwright checks plus the existing suite; 126 passed / 1 locally environment-dependent failure / 4 skipped locally, 127/0 in CI. |
| Migration SQL compatibility | **PASS (local disposable DB)** | PR #38 @ `467439f`: 52/52 `psql -v ON_ERROR_STOP=1` steps pass in both unique-version and original glob order on PostgreSQL 16, including all 14 DB contracts. |
| Migration version uniqueness / versioned deploy | **BLOCKED** | Three PRs add `0036_*`; two `0035_*` already exist. Shell-glob CI tolerates it, but Supabase CLI-style versioned deployment was not tested and typically rejects duplicates. Requires owner-approved renumbering. |
| Database invariants (five-slot, waitlist, RLS, consent, release gates) | **PASS locally / PARTIAL operationally** | DB contracts pass in GitHub Actions `database` jobs for PRs #35/#37/#38 and locally in PR #38. Live approvals, real territories and human evidence review remain owner-only. |
| SECURITY DEFINER privilege matrix | **PARTIAL** | Anonymous allowlist and trigger ACL pinned; complete authenticated EXECUTE matrix not pinned (audit risk 4). |
| Auth fence and `next=` handling | **PARTIAL** | `safeAuthReturnPath` hardened in PR #37 and tested; middleware still not fail-closed when env vars are missing, and `coverage` root is inconsistent (audit risk 5). |
| Privacy of addresses and PII in URLs | **PARTIAL** | Private job-site RLS, consent disclosure and no-address-in-URL tests pass; sessionStorage handoff copy is inaccurate (audit risk 6). |
| Performance | **PARTIAL** | PR #28 adds 14 targeted indexes and an EXPLAIN contract; staging Performance Advisor and production-scale load tests not performed. |
| Authenticated staging acceptance (real consented customer/professional) | **BLOCKED** | Opt-in specs skip without `TRUSTFIVE_STAGING_ACCEPTANCE=1` and a private storage-state file. No live Supabase project, real identity or approval was used in this challenge. |
| Vercel preview deployment | **BLOCKED (environment)** | `Vercel: failure` on PRs #35/#37/#38 with `Deployment rate limited — retry in 24 hours.` Not a source-code failure; retry after the window or with owner approval. |
| Supabase preview branches | **BLOCKED (configuration)** | GitHub check `Supabase Preview: skipped` — branch previews disabled / branch not associated. Owner action in Supabase integrations. |
| Live payments, production data, production merge | **BLOCKED by design** | Stripe is test-mode pinned; no live payment, production migration, approval or deployment was performed or proposed. |

### Go/no-go criteria before any production merge

1. Renumber PR #28/#31/#32 migrations to unique sequential versions and re-run
   database CI at each new head, then merge sequentially with DB CI after each
   merge.
2. Ensure the merged tree retains the Playwright file-scope fix from PR #37 and
   that the `build` CI job reports a passing browser suite on the exact
   integrated SHA.
3. Pin the complete authenticated SECURITY DEFINER execute matrix and make the
   missing-config auth path fail closed.
4. Correct the address-handoff privacy copy and add an always-on anonymous
   protected-route redirect assertion to CI.
5. Complete owner-controlled authenticated staging acceptance: sign-in,
   protected redirects, job → quote → booking → completion → review, private
   address consent, logout/session boundaries, with real consented test users
   only.
6. Retry Vercel preview after the rate-limit window; confirm Supabase preview
   policy; obtain explicit owner sign-off for country release gates before any
   consideration of live deployment.

### Next milestone

Final re-verification on the exact integrated commit once the owner completes the
criteria above. No production merge is proposed by this challenge.
