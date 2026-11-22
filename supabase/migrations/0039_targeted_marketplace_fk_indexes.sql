-- Targeted high-frequency foreign-key and composite indexes for TrustFive
-- marketplace discovery, five-slot waitlists, jobs, bookings, reviews,
-- appointments and community membership lookups (Issue #13).
--
-- Deliberately avoids blindly indexing all ~41 advisor foreign keys:
-- low-volume admin/audit FKs and already-covered leading-column unique keys
-- are omitted to keep write amplification low.
-- Does not alter any RLS policy, SECURITY DEFINER grant, or five-slot rule.
begin;

-- 1. Active allocations filtered by area_id (existing unique key leads with trade_id).
create index if not exists active_allocations_area_trade_idx
  on public.active_allocations(area_id, trade_id);

-- 2. Waitlist selection in offer_next_professional(p_trade, p_area).
create index if not exists professional_applications_waitlist_idx
  on public.professional_applications(trade_id, area_id, submitted_at, id)
  where status = 'eligible';

-- 3. Open vacancy offer expiry sweep and slot-capacity guard per trade/area.
create index if not exists vacancy_offers_open_trade_area_idx
  on public.vacancy_offers(trade_id, area_id, expires_at)
  where status in ('offered', 'accepted');

-- 4. Customer job dashboard RLS query (customer_id = auth.uid() order by created_at desc).
create index if not exists jobs_customer_created_idx
  on public.jobs(customer_id, created_at desc);

-- 5. Professional open-lead matching (open_jobs_for_professional).
create index if not exists jobs_open_trade_area_created_idx
  on public.jobs(trade_id, area_id, created_at desc)
  where status = 'open';

-- 6. Deactivation FK SET NULL lookup on job_quotes.professional_allocation_id.
create index if not exists job_quotes_allocation_idx
  on public.job_quotes(professional_allocation_id)
  where professional_allocation_id is not null;

-- 7. Customer bookings list and participant RLS check.
create index if not exists job_bookings_customer_created_idx
  on public.job_bookings(customer_id, created_at desc);

-- 8. Professional bookings list and confirm_booking_appointment overlap check.
create index if not exists job_bookings_professional_status_created_idx
  on public.job_bookings(professional_id, status, created_at desc);

-- 9. Public directory published reviews and rating aggregation per professional.
create index if not exists booking_reviews_professional_published_idx
  on public.booking_reviews(professional_id, created_at desc)
  where moderation_status = 'published';

-- 10. Customer own-review visibility RLS check.
create index if not exists booking_reviews_author_created_idx
  on public.booking_reviews(author_id, created_at desc);

-- 11. Appointment confirmation and proposal FK lookups (Issue #13 advisor finding).
create index if not exists booking_appointments_confirmed_by_idx
  on public.booking_appointments(confirmed_by)
  where confirmed_by is not null;

create index if not exists booking_appointments_proposed_by_idx
  on public.booking_appointments(proposed_by);

-- 12. User-scoped community group memberships RLS (PK leads with group_id).
create index if not exists community_group_memberships_user_idx
  on public.community_group_memberships(user_id, group_id);

-- 13. User-scoped community event RSVPs RLS (PK leads with event_id).
create index if not exists community_event_rsvps_user_idx
  on public.community_event_rsvps(user_id, event_id);

commit;
