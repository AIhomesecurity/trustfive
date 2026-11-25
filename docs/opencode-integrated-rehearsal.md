# OpenCode integrated rehearsal — #28 + #31 + #32 + #36 + #40

**Status: local rehearsal only, not a production merge candidate.** This branch
was created from `feature/verified-marketplace-core` at `a78611e` and integrates
the original sources of the five listed PRs into a disposable worktree. Nothing
was merged into `feature/verified-marketplace-core`, `main` or `master`; no live
database, Vercel deployment, paid API, credential or production data was used.

## Integrated commits

| Commit | Purpose |
| --- | --- |
| `a78611e` | Latest integration base at rehearsal start |
| `63cf281` | Merge PR #40 (`agent/agy-marketplace-job-management-ui`), which already carries the PR #32 quote/booking and PR #36 lifecycle code |
| `f177461` | Merge PR #31 (`agent/gemini-professional-onboarding`); resolved `.github/workflows/database-tests.yml` by keeping all contract checks |
| `e023822` | Merge PR #28 (`agent/antigravity-fk-indexes-issue-13`); resolved the same workflow by retaining all contract checks |
| `69d8f49` | Renumber the four competing PR migrations to unique monotonic versions |
| later | Add lockfile, verification script and this report |

## Migration version reconciliation

The four dependent migrations were applied with these unique versions, in the
same alphabetical/SQL order as the original branches:

| New version | Original version | Source PR/branch | Body comparison |
| --- | --- | --- | --- |
| `0036_job_contact_prefs_and_quote_availability.sql` | `0036_…` | #32 / `agent/agy-bookings-quotes` | byte-identical (`e857dec73684`) |
| `0037_professional_onboarding_verification_and_suspension.sql` | `0036_…` | #31 / `agent/gemini-professional-onboarding` | byte-identical (`5843138624cc`) |
| `0038_targeted_marketplace_fk_indexes.sql` | `0036_…` | #28 / `agent/antigravity-fk-indexes-issue-13` | byte-identical (`b0b5593a0e2f`) |
| `0039_marketplace_job_lifecycle_and_audit.sql` | `0037_…` | #36 / `agent/agy-marketplace-lifecycle-and-hardening` | byte-identical (`63e951272f0e`) |

Only the version prefix changed. No SQL body was edited, no migration was
dropped, and no duplicate version remains among the four new files. The two
pre-existing `0035_*` files are inherited from the integration base and were
not changed by this rehearsal.

## Conflict manifest (machine-verifiable)

Only `.github/workflows/database-tests.yml` conflicted:

| Merge | Conflict | Resolution |
| --- | --- | --- |
| #31 into #40 tree | Onboarding contract step vs job/quote and lifecycle steps | Retained `job-quote-booking-workflow-contract.sql`, `marketplace-security-abuse-contract.sql` and `professional-onboarding-five-slot-contract.sql` |
| #28 into merged tree | Index contract step vs the three retained steps | Added `query-plan-indexes-contract.sql` after all three |

The resulting workflow contains all four contract groups and no conflict
markers. `tests/e2e/professional-quotes-anonymous-boundary.spec.ts` retains the
file-scope `test.use({storageState, trace, screenshot, video})` repair from PR
#37, so Playwright collection succeeds.

## Verification on the rehearsal head

| Check | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | PASS after adding a generated `package-lock.json` (the base had no lockfile) |
| `npm run lint` | Not run: this base has no ESLint dependency or flat config; gate belongs to PR #35 and was not merged here |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npx playwright test` | 115 passed / 1 failed / 4 skipped |
| Disposable PostgreSQL 16 (`scripts/verify-integrated-rehearsal.ps1`) | **57/57 SQL steps PASS**: bootstrap + 38 migrations + 18 workflow contracts |

The single browser failure is the pre-existing environment-dependent
`tests/e2e/uk-coverage-release-gates.spec.ts:4` anchor
(`/account?next=%2Fcoverage` link), which also fails on the unmodified base and
is unrelated to these merges. Four staging-acceptance specs skip by design
without a private authenticated storage state. Neither skip was counted as a
pass.

The verification script reads the SQL contract list directly from
`.github/workflows/database-tests.yml`, applies every migration in glob order
with `ON_ERROR_STOP=1`, and removes its temporary Docker container afterwards.

## Release gates still owned by the project owner

- Authenticated staging acceptance with real consented customer/professional
  sessions was not performed.
- Vercel preview deployments have recently been rate-limited; no deployment was
  attempted from this branch.
- Live migrations, payment activation, professional approvals and production
  merges remain explicitly out of scope.
