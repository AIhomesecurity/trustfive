# OpenCode 30-minute integration sprint

Branch: `agent/opencode-sprint-integration`, from
`feature/verified-marketplace-core` @ `841c9ab`. Draft PR only; no merge.

## Why PR #43 was not mergeable

GitHub reported `mergeable=false`, `mergeable_state=dirty`. Local simulation
showed one textual conflict in
`tests/e2e/professional-quotes-anonymous-boundary.spec.ts`: the newer feature tip
and PR #43 each added a different explanatory comment above the same file-scope
`test.use({storageState, trace, screenshot, video})` line. Both comments were
retained. No source logic was lost.

PR #43 also still contained the base's two colliding `0035_*` migration
versions. Those were resolved here by shifting the whole dependent chain.

## Migration version mapping

| New | Old | Source |
| --- | --- | --- |
| `0035_restrict_country_release_history_sequence.sql` | unchanged | integration base |
| `0036_uk_nationwide_area_interest.sql` | `0035_uk_nationwide_area_interest.sql` | integration base |
| `0037_job_contact_prefs_and_quote_availability.sql` | `0036_…` | PR #32 |
| `0038_professional_onboarding_verification_and_suspension.sql` | `0036_…` | PR #31 |
| `0039_targeted_marketplace_fk_indexes.sql` | `0036_…` | PR #28 |
| `0040_marketplace_job_lifecycle_and_audit.sql` | `0037_…` | PR #36 |

Each SQL body is byte-identical to its source (verified with git object hashes).
No duplicate version remains. Order preserves the original glob sequence.

## Other integrations

- All four database workflow contract groups retained: index, onboarding,
  job/quote, lifecycle.
- Playwright file-scope worker-option fix retained.
- PR #44's hermetic coverage copy and keyboard-accessible address picker were
  cherry-picked to remove the remaining browser-test failure.

## Verification

- Disposable PostgreSQL 16: **57/57 SQL steps PASS** (bootstrap + 40 migrations
  + 18 contracts).
- `npm ci`, `npx tsc --noEmit`, `npm run build`: PASS.
- Lint: not available on this base (no ESLint dependency/config); not faked.
- Full Playwright: see final checkpoint; the previous coverage failure is fixed.
