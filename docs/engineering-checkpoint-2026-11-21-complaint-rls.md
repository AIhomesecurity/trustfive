# TrustFive engineering checkpoint — 2026-11-21 (complaint/appeal RLS)

## Handoff state
- Target branch `feature/verified-marketplace-core` advanced to `70562a8` (notification deep-link path fixes + `0031_notification_record_deep_links.sql` + `tests/e2e/notification-target.spec.ts`).
- PR #14 was intentionally closed by the owner after its test file was integrated as `f286a96`; it was **not** reopened.
- Draft PR #15 (private-table/directory negative contract, commit `b7520e8`) is open against the target and its checks are green (`build` success, `database` success, `Supabase Preview` skipped). It is a separate branch and is not merged.

## Built in this run
- Branch `agent/aionui-complaint-appeal-rls`, created fresh from target HEAD `70562a8`.
- `tests/db/complaint-appeal-rls-contract.sql` (new) — transaction-rolled-back P0 negative RLS contract:
  - Isolated customer / professional / unrelated customer / admin, one completed booking and one filed complaint.
  - Anonymous sees no complaint or appeal; an unrelated signed-in customer cannot read or file a complaint, cannot resolve it, and cannot answer it.
  - The respondent can read and answer a complaint against them but cannot spoof the reporter; a non-admin cannot resolve a complaint.
  - Only an authorised admin can resolve with a documented reason; resolution never changes active allocations.
  - The reporter may appeal an investigated complaint; an unresolved complaint cannot be appealed; the respondent cannot read the reporter's appeal but may file their own (per the two-party policy in `0005`), one appeal per party; an unrelated customer can neither read nor file an appeal; a non-admin cannot resolve an appeal; only an admin decision is recorded.
  - Quota-trigger fixtures set `request.jwt.claim.sub` so `auth.uid()` is available; all fixtures roll back.
- `.github/workflows/database-tests.yml` — new CI step runs the contract.

## Independently verified at this commit
- Local PostgreSQL 16 (Docker): bootstrap + all migrations (including `0031`) + **all seven database test files in CI order passed**, including the new contract.
- `npx tsc --noEmit` exit 0; `npm run build` pass with CI Supabase env; `npm run test:e2e` **38/38 passed** (2 new notification-target tests included).
- GitHub Actions status for this branch's exact commit must be read back after push.

## Blocked / owner-only
- Authenticated staging customer → job → lead → quote → booking → consent → verified review still needs explicitly authorised isolated accounts (`docs/staging-authenticated-journey-acceptance.md`).
- Real professional coverage and independently reviewed territory boundaries cannot be invented; no fake approvals were created.
- The Codex review workflow remains inactive without `OPENAI_API_KEY`. No paid model or API was activated.

## Next implementable task
- Continue the P0 review of remaining `SECURITY DEFINER` grants individually (per `AGENTS.md`), then re-check the protected staging route once authorised identities are available.

## Safety
No production merge, live customer data, real approval, live payment or credential disclosure. All SQL fixtures are inside a rolled-back transaction.
