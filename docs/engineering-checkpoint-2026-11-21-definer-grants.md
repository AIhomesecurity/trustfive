# TrustFive engineering checkpoint — 2026-11-21 (SECURITY DEFINER grant matrix)

## Handoff state
- Target branch `feature/verified-marketplace-core` remains at `70562a8`.
- Draft PR #15 (private-table/directory negative contract, `b7520e8`) is open with green checks.
- Draft PR #16 (complaint/appeal RLS negative contract, `b6327d2`) is open with green checks (`build` success, `database` success, `Supabase Preview` skipped).
- PR #14 was intentionally closed by the owner after its test file was integrated as `f286a96`; it was not reopened.

## Built in this run
- Branch `agent/aionui-definer-grant-matrix`, created fresh from target HEAD `70562a8`.
- `tests/db/security-definer-grant-matrix.sql` (new) — read-only catalogue contract implementing the `AGENTS.md` P0 item "review remaining SECURITY DEFINER grants individually":
  - Pins the complete anon EXECUTE allowlist to exactly four read-only helpers (`find_trustfive_professionals`, `find_trustfive_professionals_nearby`, `find_trustfive_professionals_with_reviews`, `is_active_approved_application`); adding any new anon-executable definer fails CI.
  - Requires every anon-reachable definer to be STABLE/IMMUTABLE (no anonymous write path through a SECURITY DEFINER boundary).
  - Asserts no SECURITY DEFINER function in `public` is executable by the PUBLIC pseudo-role (anon inherits PUBLIC).
  - Asserts no SECURITY DEFINER trigger function is client-executable by anon/authenticated/PUBLIC.
  - Keeps `apply_membership_stripe_event` service-role-only (no anon/authenticated EXECUTE) and confirms its service_role grant survives.
  - Confirms the four public helpers remain authenticated-executable.
- `.github/workflows/database-tests.yml` — new CI step for the contract.

## Independently verified at this commit
- Local PostgreSQL 16 (Docker): fresh bootstrap + all migrations (including `0031`) + all seven database test files in CI order passed (7/7). Note: `flows.sql` persists fixtures, so the database was recreated from scratch before the run, matching CI.
- `npx tsc --noEmit` exit 0; `npm run build` pass with CI Supabase env; `npm run test:e2e` 38/38 passed.
- GitHub Actions status for this branch's exact commit must be read back after push.

## Blocked / owner-only
- Authenticated staging customer → job → lead → quote → booking → consent → verified review still needs explicitly authorised isolated accounts (`docs/staging-authenticated-journey-acceptance.md`).
- Real professional coverage and independently reviewed territory boundaries cannot be invented; no fake approvals were created.
- The Codex review workflow remains inactive without `OPENAI_API_KEY`. No paid model or API was activated.

## Next implementable task
- Continue P0 abuse/privacy handling: add negative RLS coverage for neighbourhood/community moderation and notification visibility (builds on the `0031` deep-link path work), then re-check the protected staging route once authorised identities are available.

## Safety
No production merge, live customer data, real approval, live payment or credential disclosure. This PR is read-only catalogue assertions; no schema or data changes.
