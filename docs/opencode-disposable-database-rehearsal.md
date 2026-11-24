# Disposable PostgreSQL 16 release-candidate rehearsal

## Answer to the outstanding request

**Yes — the release candidate was run from an empty, disposable PostgreSQL 16
database.** Every migration from `supabase/migrations/` was replayed in order
from that empty database and every SQL contract in the database workflow passed.
No hosted Supabase project, shared database, Vercel deployment, live payment or
production merge was used.

## Exact base and command

- Base: `480b9324f53cd8b46e234f476025bb61d98533a1`
  (`agent/chatgpt-worker-recovery-smoke`, the release-candidate base used by the
  messaging and marketplace slices).
- One repeatable command, from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-integrated-rehearsal.ps1
```

The script starts a uniquely named `postgres:16` container with no published host
port, waits for readiness, applies `tests/db/bootstrap.sql` (a minimal
Supabase-compatible `auth` schema and client roles), replays all migrations from
`supabase/migrations/` in glob order with `ON_ERROR_STOP=1`, runs every `-f
tests/...sql` step from `.github/workflows/database-tests.yml` in workflow order,
and removes the container in a `finally` block.

## Verified counts

| Category | Count |
| --- | --- |
| Bootstrap steps | 1 |
| Migrations replayed from empty database | 42 (`0001_core.sql` … `0053_group_post_reporting.sql`) |
| SQL contract steps from the database workflow | 22 |
| **Total SQL steps** | **65** |
| **Failures** | **0** |

The baseline before this slice was 64/64 (1 bootstrap + 42 migrations + 21
contracts). The additional contract is described below.

## Highest-value missing assertion added

`tests/db/message-participant-entitlement-contract.sql` closes a real gap. The
existing suite proved an outsider cannot *inject* a message, but never asserted
the positive read entitlements. The new contract seeds a synthetic customer, a
booked professional, two unrelated signed-in accounts and a two-message quote
thread, then asserts exact read counts under real role and `auth.uid()`
simulation:

| Identity | Visible messages |
| --- | --- |
| Customer who owns the job | 2 |
| Booked professional on the quote | 2 |
| Unrelated signed-in customer | 0 |
| Unrelated signed-in professional | 0 |
| Anonymous visitor | 0 |

It also asserts that `public.can_access_quote` is true for the two participants
and false for both unrelated accounts. All fixtures are inside a transaction
that is rolled back, and no live records are read.

The contract was added to `.github/workflows/database-tests.yml` so CI and the
local runner execute the same step. This is a test/workflow change only: no
migration was changed, so no migration coordination is required.

## Contracts already covered in the same run

The full run includes the five-slot and waiting-list contract
(`professional-onboarding-five-slot-contract.sql`), which verifies: strict RLS
on verification submissions, no self-approval, payment-independent waiting-list
order, promotion after a vacancy is vacated, and that a sixth applicant is never
offered a place while 5/5 slots are active. It also includes the quote/booking
lifecycle, marketplace abuse, complaint/appeal, private-booking address,
directory security and social contracts.

## Safety and blockers

- Container names are randomised per run and always removed; no container was
  left behind by either verification run.
- No hosted connection string, service key, real professional, real customer,
  real booking, live payment, deployment or production merge was involved.
- Hosted staging verification remains blocked until Release Integration
  confirms the hosted database is isolated. This disposable rehearsal does not
  substitute for that confirmation; it proves the SQL contract baseline on the
  exact release-candidate tree.
