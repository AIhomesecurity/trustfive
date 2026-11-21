# Mega milestone 3 — database migration integration

Base: `feature/verified-marketplace-core` @ `995f9d0b3c3d477d36c2e5ba0ab899170082c1d4`.
This branch does not modify any other agent's branch, PR, or production/Supabase project.

## Scope

Three open draft PRs each add a different `0036_*` migration:

| PR | Migration | Head verified |
| --- | --- | --- |
| #28 | `0036_targeted_marketplace_fk_indexes.sql` | `6704cbf07ac7` |
| #31 | `0036_professional_onboarding_verification_and_suspension.sql` | `99d04a98fc58` |
| #32 | `0036_job_contact_prefs_and_quote_availability.sql` | `ce324966d65d` |

The repository already contains two `0035_*` migrations
(`0035_restrict_country_release_history_sequence.sql`,
`0035_uk_nationwide_area_interest.sql`), so duplicate version prefixes are an
existing pattern in this codebase.

## Method

`scripts/verify-migration-integration.ps1` creates a disposable `postgres:16`
Docker container, applies `tests/db/bootstrap.sql`, then all repository
migrations plus the three PR migrations, then every SQL contract from
`tests/db/` and `tests/sql/`. Every step uses `psql -v ON_ERROR_STOP=1`; the
container and staged SQL are removed in a `finally` block. No live database,
Supabase project, credential, or production data is touched.

Two shapes were verified:

1. **Recommended merge shape** — PR migrations renumbered to unique test
   versions `0036_`, `0037_`, `0038_` in index → onboarding → bookings order.
2. **As-is CI glob shape** — original `0036_` names, applied in shell glob
   alphabetical order (bookings → onboarding → indexes).

Both runs: **52/52 steps PASS** — 35 base migrations, 3 PR migrations, 14 DB
contracts (including `flows.sql`, `security-definer-grant-matrix.sql`,
`private-table-directory-negative-contract.sql`, `private-booking-contract.sql`
and `country-release-signoff-contract.sql`).

## Findings

1. **SQL compatibility: PASS.** The three PR migrations can be applied in
   either order without errors and without breaking any existing database
   contract. There is no conflicting `ALTER TABLE`, function signature, policy
   name, index name, or grant that causes a failure.
2. **The previously flagged private-table concern is not reproduced.** PR #31
   creates `professional_verification_submissions` with RLS enabled and
   `revoke all ... from public, anon, authenticated`, but
   `tests/db/private-table-directory-negative-contract.sql` still passes. The
   contract pins a required private set rather than an exhaustive list, so no
   contract update is needed for that table.
3. **Version uniqueness remains a real release risk.** Three migrations share
   version `0036`. The repository's CI applies migrations through a shell glob,
   which tolerates this, but Supabase CLI-style versioned deploy tooling
   typically rejects duplicate version numbers. This was not reproducible
   locally because no Supabase deploy credentials were used.
4. **CI glob order is accidental, not contractual.** The as-is alphabetical
   order works today, but a future filename change could reorder destructive
   and dependent DDL. Unique sequential versions remove that hazard.
5. **Two `0035_*` migrations already exist at the integration base.** This is
   not a new regression from these PRs, but it confirms that the project has
   not yet adopted a strict one-version-one-file policy.
6. **CI collection fix is a prerequisite for green build checks.** At the base
   integration tip, `tests/e2e/professional-quotes-anonymous-boundary.spec.ts`
   puts worker-scoped `trace`/`screenshot`/`video` options inside `describe`,
   which aborts Playwright collection and fails the `build` job. The identical
   one-file fix validated in PR #37 is included in this branch so the migration
   slice can pass CI independently; merged integration must include that fix.

## Recommended merge plan (owner action)

1. Renumber before merging, in this order:
   - #28 → `0036_targeted_marketplace_fk_indexes.sql`
   - #31 → `0037_professional_onboarding_verification_and_suspension.sql`
   - #32 → `0038_job_contact_prefs_and_quote_availability.sql`
2. Rebase each PR onto the latest `feature/verified-marketplace-core` tip and
   run its own CI at the new head SHA. PR #31 and #32 bodies cite validation at
   older commits (`45e2187…`, `064c80f…`), so their current heads must be
   revalidated.
3. Merge #28, #31, #32 one at a time, running the full database workflow after
   each merge — not as an untested batch.
4. Re-run `scripts/verify-migration-integration.ps1` (or the CI database job)
   against the single integrated commit before any staging deployment.
5. Keep live migration, professional approval, payment activation and any
   production write strictly owner-approved. This slice provides local
   disposable-database evidence only.

## Reproduce

```powershell
pwsh scripts/verify-migration-integration.ps1
pwsh scripts/verify-migration-integration.ps1 -AsIs
```

Requires Docker Desktop with the `postgres:16` image available. The script
prints every step's exit code and a final `SUMMARY total=52 failures=0` line on
success, and removes its container even on failure.
