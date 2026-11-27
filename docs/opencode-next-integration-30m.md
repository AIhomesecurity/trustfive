# OpenCode next 30-minute integration rehearsal

Branch: `agent/opencode-next-integration-30m`, created from canonical
`feature/verified-marketplace-core` @ `4a4b697`. Draft PR only; no merge into
any integration or production branch.

## Source inventory actually inspected

| PR | Head SHA | Base | Role |
| --- | --- | --- | --- |
| #43 | `cc2619215fc2` | `feature/verified-marketplace-core` @ `6813699` | Marketplace rehearsal (#28/#31/#32/#36/#40) |
| #58 | `b1ae78e8fd12` | `feature/verified-marketplace-core` @ `71ac1d1` | Social integrated v2 |
| #59 | `b3d1465a8469` | #58 head | Group discovery |
| #60 | `4470c5870f86` | #59 head | Trade collaboration |
| #62 | `9e0604564d4c` | #60 head | Saved posts |

All five heads were fetched read-only and merged in this order into the new
branch: #43 → #58 → #59 → #60 → #62.

## Conflicts resolved (no source logic overwritten)

1. `tests/e2e/professional-quotes-anonymous-boundary.spec.ts` — #43 and the
   current feature tip added different comments above the same file-scope
   `test.use({storageState, trace, screenshot, video})`. Both comments were
   retained; the worker-scope fix is intact.
2. `.github/workflows/database-tests.yml` — #60 added the social trade
   collaboration contract at the same insertion point as #43's four marketplace
   contracts. Both blocks are retained, giving all 20 SQL contract steps
   (marketplace, privacy, five-slot, lifecycle, index, social collaboration and
   saved-posts RLS).
3. Duplicate `0035_*` migration versions inherited from the canonical base.
   Resolved by renumbering the dependent chain (below); no SQL body changed.

A pre-existing browser failure in `uk-coverage-release-gates.spec.ts` was not
introduced by these merges; it was fixed by cherry-picking the verified
reliability commit `7401b3f1f2252187888cc6bbac4820573209d678` from OpenCode's
own `agent/opencode-browser-reliability` branch. No other agent branch was
touched.

## Migration version mapping

Every body was compared by git object hash with its source branch and is
byte-identical.

| New version | Old version | Source | Body SHA |
| --- | --- | --- | --- |
| `0035_restrict_country_release_history_sequence.sql` | unchanged | feature | — |
| `0036_uk_nationwide_area_interest.sql` | `0035_…` | feature | `3635fd4f4b92` |
| `0037_job_contact_prefs_and_quote_availability.sql` | `0036_…` | #32 / #43 | `e857dec73684` |
| `0038_professional_onboarding_verification_and_suspension.sql` | `0036_…` | #31 / #43 | `5843138624cc` |
| `0039_targeted_marketplace_fk_indexes.sql` | `0036_…` | #28 / #43 | `b0b5593a0e2f` |
| `0040_marketplace_job_lifecycle_and_audit.sql` | `0037_…` | #36 / #43 | `63e951272f0e` |
| `0050_social_trade_collaboration_foundation.sql` | unchanged | #60 | `8666a51d5ae6` |
| `0051_social_saved_posts.sql` | unchanged | #62 | `3403a8978fba` |

`NO_DUPLICATE_VERSIONS` was verified mechanically after renumbering. Glob order
preserves the original dependency sequence; Social migrations remain after the
marketplace chain.

## Verification on the final SHA

- `npm ci --no-audit --no-fund`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- Lint: declared in `package.json` but unavailable (no ESLint dependency/config
  in this base); no lint result claimed.
- Disposable PostgreSQL 16 (`scripts/verify-integrated-rehearsal.ps1`):
  **61/61 steps PASS** — bootstrap + 42 migrations + 18 workflow contracts.
  Covers professional approval/suspension, five-slot and waiting-list fairness,
  quote availability/withdrawal, cancellation/reopening, customer privacy,
  audit logging, social collaboration RLS and saved-posts RLS.
- Full Playwright with no retries relied upon: **154 passed / 0 failed /
  4 opt-in staging skips**. No test was disabled or given a longer timeout.

## Remaining blockers

See `docs/opencode-next-integration-blockers.json` for the machine-checkable
manifest. Summary: owner must merge sequentially in dependency order and rerun
DB CI on each exact head; four authenticated staging specs need private storage
state; Vercel previews are failing/rate-limited on the Social PRs; Supabase
preview branches are skipped by configuration; lint gate lives in PR #35 and is
not in this base. No production merge, live SQL, customer data change or paid
API was used.
