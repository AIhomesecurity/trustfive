# Targeted Marketplace Foreign-Key Indexes (Issue #13)

## Design Rationale
Supabase's `0001_unindexed_foreign_keys` advisor flagged ~41 unindexed foreign keys across the TrustFive schema. Rather than adding 41 blanket single-column indexes (which inflate write amplification on low-volume audit/admin tables and duplicate existing leading-column unique indexes), migration `supabase/migrations/0036_targeted_marketplace_fk_indexes.sql` introduces **14 targeted composite and partial indexes** mapped directly to high-frequency marketplace queries, RLS filters, five-slot waitlists, appointment conflict checks, and FK cascades.

## Targeted Indexes Added in `0036_targeted_marketplace_fk_indexes.sql`

| Table | Index | Columns / Predicate | Primary Query Path |
| --- | --- | --- | --- |
| `active_allocations` | `active_allocations_area_trade_idx` | `(area_id, trade_id)` | Area-filtered directory lookup (`find_trustfive_professionals(null, p_area)`) where unique `(trade_id, area_id, slot)` cannot lead with `area_id`. |
| `professional_applications` | `professional_applications_waitlist_idx` | `(trade_id, area_id, submitted_at, id) WHERE status = 'eligible'` | Deterministic five-slot waitlist selection in `offer_next_professional`. |
| `vacancy_offers` | `vacancy_offers_open_trade_area_idx` | `(trade_id, area_id, expires_at) WHERE status IN ('offered','accepted')` | Open offer expiry sweeps and slot reservation checks. |
| `jobs` | `jobs_customer_created_idx` | `(customer_id, created_at DESC)` | Customer `/jobs` workspace and own-job RLS predicate. |
| `jobs` | `jobs_open_trade_area_created_idx` | `(trade_id, area_id, created_at DESC) WHERE status = 'open'` | Professional open-lead discovery (`open_jobs_for_professional`). |
| `job_quotes` | `job_quotes_allocation_idx` | `(professional_allocation_id) WHERE professional_allocation_id IS NOT NULL` | FK `ON DELETE SET NULL` scan avoidance during `deactivate_professional`. |
| `job_bookings` | `job_bookings_customer_created_idx` | `(customer_id, created_at DESC)` | Customer `/bookings` page and participant RLS predicate. |
| `job_bookings` | `job_bookings_professional_status_created_idx` | `(professional_id, status, created_at DESC)` | Professional `/bookings` page and `confirm_booking_appointment` double-booking overlap check. |
| `booking_reviews` | `booking_reviews_professional_published_idx` | `(professional_id, created_at DESC) WHERE moderation_status = 'published'` | Public directory rating summaries and published review feeds. |
| `booking_reviews` | `booking_reviews_author_created_idx` | `(author_id, created_at DESC)` | Customer own-review visibility RLS predicate. |
| `booking_appointments` | `booking_appointments_confirmed_by_idx` | `(confirmed_by) WHERE confirmed_by IS NOT NULL` | Confirmation actor FK lookup (advisor finding). |
| `booking_appointments` | `booking_appointments_proposed_by_idx` | `(proposed_by)` | Proposal actor FK lookup. |
| `community_group_memberships` | `community_group_memberships_user_idx` | `(user_id, group_id)` | Member RLS lookup (`user_id = auth.uid()`), since PK leads with `group_id`. |
| `community_event_rsvps` | `community_event_rsvps_user_idx` | `(user_id, event_id)` | Member RSVP RLS lookup (`user_id = auth.uid()`), since PK leads with `event_id`. |

## Intentionally Deferred Low-Volume Foreign Keys
Admin-only audit/log tables (`network_audit_events.actor_id`, `marketplace_audit_events.*`, `professional_assessments.reviewed_by`, `country_release_signoffs.*`) and single-row reference lookups are intentionally left unindexed until real staging query telemetry proves read contention exceeds write overhead.

## Verification
- Automated PostgreSQL 16 contract: `tests/db/query-plan-indexes-contract.sql` validates `indisvalid`/`indisready` status and verifies `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` selects every targeted index on its corresponding query path inside a rollback-only transaction.
- All existing RLS, five-slot, proximity, booking consent, complaint/appeal, and country release SQL contracts run unchanged in `.github/workflows/database-tests.yml`.
- **Remaining staging task**: After applying migration `0036` to staging (`lkfkhjthdtcefrcaatsi`), re-run Supabase Performance Advisor on staging to confirm remaining advisor warnings match only the intentionally deferred audit/admin FKs.
