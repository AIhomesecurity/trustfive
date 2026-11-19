# TrustFive development checkpoint — 2026-11-19 20:01 UTC

## State inspected
- PR #1 remains open, mergeable, and unmerged; development branch was at `23da742f` when inspected.
- GitHub checks and database integration for `23da742f` both passed.
- Latest feature-branch Vercel deployment for `23da742f`: READY at https://trustfive-6kvlupkqh-trust-five.vercel.app (protected browser experience not independently authenticated).
- Supabase staging project `lkfkhjthdtcefrcaatsi`: zero verified professional service locations. Do not fabricate providers or ratings.
- Supabase security advisor reports four intentionally inaccessible RLS-without-policy tables and SECURITY DEFINER warnings; continue function-by-function auditing. RLS helpers used by public policy evaluation cannot simply be revoked without regression tests.
- Open issue: P0 job-site exact address and private lead delivery.

## Changes in this run
- Added `0023_private_job_site_location.sql`: private job-site location table with no anon/authenticated direct table access; atomic, authenticated `create_job_with_private_location` RPC; owner-only private address lookup. SQL validates address precision, coordinates, territory country and job inputs. No public RPC returns customer address.
- Added address suggestion selection to customer `/jobs` form and replaced direct public table insertion with private atomic RPC. The old TrustFive territory selection is deliberately retained until approved geographic boundaries can map coordinates into five-slot areas. Do not imply address selection alone establishes territory.
- Added database regression checks: anonymous permission denial, successful customer creation and owner lookup, unrelated professional denied address lookup.
- The initial migration failed on reserved SQL identifier `precision`; corrected it and successfully applied the migration to staging. No real jobs or accounts were created.
- CI for the latest changes must be inspected before claiming green. The Vercel READY preview above predates these commits.

## Highest priority next
1. Verify latest CI and database regression. Fix any SQL/test failures, especially if the new test exposes role grants or owner-only lookup issues.
2. Define and verify non-overlapping geographic territory polygons and server-side address-to-territory mapping. Remove manual territory selection only when this exists. Do not infer territory from city names or postcode centroid.
3. Deliver leads only to approved active professionals whose verified service coverage includes the job location; keep exact job-site addresses private until an explicit customer-authorised booking disclosure policy exists.
4. Add authenticated staging browser tests for address selection and job creation without fabricated production records.
5. Verify Vercel protected preview with authorised session and check security advisories again.

## Limitations
- Exact house autocomplete requires a configured geocoding/address provider; free UK postcode fallback gives a postcode centre, not a property.
- Distance is approximate straight-line distance, not travel time.
- Private job addresses are not yet available to booked professionals; disclosure requires a separate explicit consent workflow.
