# TrustFive Marketplace Production-Readiness Assessment (Phase 12)

Assessment date: `2026-11-21`  
Target development branch: `feature/verified-marketplace-core`  
Rule invariant: **Never claim production readiness until CI, database contracts, staging authenticated verification and owner legal/payment approvals genuinely pass.**

## Marketplace Scorecard

| Area | Status | Evidence & Notes |
| --- | --- | --- |
| Job posting | **PASS** | 3-step customer wizard (`app/jobs/page.tsx`, PR #32), private location RPC (`0023_private_job_site_location.sql`), contact preferences (`0036_job_contact_prefs_and_quote_availability.sql`), unbooked cancel/reopen + audit history (`0037_marketplace_job_lifecycle_and_audit.sql`). |
| Address privacy | **PASS** | `job_site_locations` revoked from `anon`/`authenticated`; explicit booking consent (`0025`, `0026`, `0030`) verified in `tests/db/private-booking-contract.sql` and `tests/db/marketplace-security-abuse-contract.sql`. |
| Trade selection | **PASS** | Database-backed taxonomy (`public.trades`), quick picker (`components/trade-quick-pick.tsx`), zero fabricated providers (`tests/e2e/public-routes.spec.ts`). |
| Professional eligibility | **PASS** | Strict 5-slot DB limit (`active_allocations`, `pg_advisory_xact_lock`), private verification submissions, explicit `suspended` status, payment-independent waitlist (`PR #31`, `tests/db/professional-onboarding-five-slot-contract.sql`). |
| Lead access | **PASS** | `open_jobs_for_professional()` requires active verified allocation + verified service radius (`0024_private_job_radius_leads.sql`); unapproved pros receive 0 leads (`tests/db/marketplace-security-abuse-contract.sql`). |
| Quotes | **PASS** | Price, scope, structured `availability_note`, duplicate prevention, and owner-only pending `withdraw_job_quote` (`PR #32`, `tests/db/job-quote-booking-workflow-contract.sql`). |
| Quote comparison | **PASS** | `lib/quote-comparison.ts` (PR #32 `ce32496`) excludes withdrawn quotes from summaries, returns `null` bounds for all-withdrawn/zero lists, and sinks withdrawn quotes below available quotes. |
| Quote acceptance | **PASS** | Explicit two-step confirmation on `/jobs`, atomic `accept_job_quote`, duplicate/cross-customer acceptance blocked (`tests/db/marketplace-security-abuse-contract.sql`). |
| Booking creation | **PASS** | Unique `quote_id` and `job_id` constraints on `job_bookings`; atomic transition from `open` -> `booked` (`0004_quotes_bookings_messages.sql`). |
| Appointments | **PASS** | Mutual proposal/confirmation (`0012_booking_appointments.sql`), professional overlap lock, explicit IANA timezone formatting (`lib/appointment-schedule.ts`, `app/schedule/page.tsx`) without silent browser-timezone conversion. |
| Completion | **PASS** | Two-party handshake (`mark_job_ready_for_confirmation` -> `confirm_job_completed`), customer confirmation UI guard, duplicate/outsider confirmation rejected. |
| Reviews | **PASS** | Restricted to customer on `completed` bookings (`booking_reviews` unique `booking_id`), professionals blocked from editing/deleting reviews (`tests/db/marketplace-security-abuse-contract.sql`). |
| Messaging | **PASS** | Participant-only `can_access_quote`, URL tampering guard, deterministic chronological sorting/deduping, duplicate-send lock, draft retention on failure, pre-booking contact caution (`app/messages/page.tsx`, `lib/marketplace-messages.ts`). |
| RLS permissions | **PASS** | 15+ PostgreSQL 16 SQL contracts including `security-definer-grant-matrix.sql`, `private-table-directory-negative-contract.sql`, `complaint-appeal-rls-contract.sql`, and `marketplace-security-abuse-contract.sql`. |
| Mobile accessibility | **PASS** | Tested at `320px`, `360px`, `390px`, `768px`, `1024px`, `1280px` with `<= 1px` horizontal overflow (`tests/e2e/marketplace-lifecycle-security-mobile.spec.ts`, `tests/e2e/directory-responsive-quality.spec.ts`). |
| Error handling | **PASS** | Honest load/retry error banners, draft preservation on message send failure, isolated private-address batch fallback (`loadBookingSiteBatch`). |
| Performance | **PARTIAL** | Bounded `.limit()` queries across bookings/appointments/complaints/messages + 14 targeted FK indexes in PR #28 (`0036_targeted_marketplace_fk_indexes.sql`); requires post-merge staging `EXPLAIN` and Supabase Performance Advisor confirmation on `lkfkhjthdtcefrcaatsi`. |
| Migration readiness | **PARTIAL** | PRs #28, #31, and #32 currently each add a `0036_*.sql` migration and append to `.github/workflows/database-tests.yml`; integration into `feature/verified-marketplace-core` requires sequential numbering (`0036`, `0037`, `0038`, `0039`) and preserving all DB CI steps. |
| Automated tests | **PASS** | TypeScript (`tsc --noEmit`), Next.js production build (33 routes), Node geo tests, Playwright browser/unit suites, and PostgreSQL 16 integration CI all automated and green across draft PRs #27, #28, #29, #31, #32. |
| Authenticated staging | **BLOCKED** | Opt-in signed-in staging acceptance suites (`tests/staging/*`, `tests/e2e/authorised-customer-*.spec.ts`, `tests/e2e/uk-coverage-signed-in-acceptance.spec.ts`) are implemented and skip cleanly, but require owner-supplied private staging storage-state / consented test accounts on staging (`lkfkhjthdtcefrcaatsi`). |
| International readiness | **PARTIAL** | Core booking, appointment (`timezone_name` IANA preservation), territory (`country_code`), and five-slot rules are country-agnostic; currency formatting (`£`/GBP) and `postcodes.io` lookup are currently UK-first and require locale/currency configuration per country release before non-UK expansion. |

## Open Owner-Only Blockers Before Production Launch
1. **Sequential migration integration** on `feature/verified-marketplace-core` across open draft PRs (#28, #31, #32, and this PR).
2. **Real authorised staging E2E execution** with private local Playwright storage-state for customer and professional staging accounts on `lkfkhjthdtcefrcaatsi`.
3. **Independent human GIS boundary review** and **genuine vetting of real professionals** (zero synthetic approvals).
4. **Owner legal, GDPR/privacy, and Stripe live-mode sign-off** (Stripe remains strictly test-mode with `event.livemode` blocked in PR #29).
