-- Verify that all 14 targeted Issue #13 marketplace FK indexes exist, are valid,
-- and are selectable by the PostgreSQL 16 query planner for their hot-path queries.
-- Strictly rollback-only; leaves zero persistent fixture data.

do $tf$
declare
  v_expected text[] := array[
    'active_allocations_area_trade_idx',
    'professional_applications_waitlist_idx',
    'vacancy_offers_open_trade_area_idx',
    'jobs_customer_created_idx',
    'jobs_open_trade_area_created_idx',
    'job_quotes_allocation_idx',
    'job_bookings_customer_created_idx',
    'job_bookings_professional_status_created_idx',
    'booking_reviews_professional_published_idx',
    'booking_reviews_author_created_idx',
    'booking_appointments_confirmed_by_idx',
    'booking_appointments_proposed_by_idx',
    'community_group_memberships_user_idx',
    'community_event_rsvps_user_idx'
  ];
  v_idx text;
  v_valid boolean;
begin
  foreach v_idx in array v_expected loop
    select (i.indisvalid and i.indisready) into v_valid
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_index i on i.indexrelid = c.oid
    where n.nspname = 'public' and c.relname = v_idx;

    if coalesce(v_valid, false) is not true then
      raise exception 'Targeted index public.% is missing or invalid', v_idx;
    end if;
  end loop;
end $tf$;

begin;
-- Force index consideration even on small CI test tables to verify planner
-- compatibility, predicate alignment, and zero broken partial-index expressions.
set local enable_seqscan = off;

do $tf$
declare
  v_plan text;
  v_trade uuid;
  v_area uuid;
  v_user uuid := '00000000-0000-0000-0000-000000000010';
  v_alloc uuid := '00000000-0000-0000-0000-000000000020';
begin
  select id into v_trade from public.trades limit 1;
  select id into v_area from public.service_areas limit 1;

  -- 1. active_allocations filtered by area_id
  execute format(
    'explain (analyze, buffers, format json) select id, trade_id from public.active_allocations where area_id = %L',
    v_area
  ) into v_plan;
  if position('active_allocations_area_trade_idx' in v_plan) = 0 then
    raise exception 'Expected active_allocations_area_trade_idx in plan: %', v_plan;
  end if;

  -- 2. Waitlist selection in offer_next_professional
  execute format(
    'explain (analyze, buffers, format json) select id from public.professional_applications where trade_id = %L and area_id = %L and status = ''eligible'' order by submitted_at asc, id asc limit 5',
    v_trade, v_area
  ) into v_plan;
  if position('professional_applications_waitlist_idx' in v_plan) = 0 then
    raise exception 'Expected professional_applications_waitlist_idx in plan: %', v_plan;
  end if;

  -- 3. Open vacancy offer sweep
  execute format(
    'explain (analyze, buffers, format json) select id from public.vacancy_offers where trade_id = %L and area_id = %L and status in (''offered'',''accepted'') and expires_at <= now()',
    v_trade, v_area
  ) into v_plan;
  if position('vacancy_offers_open_trade_area_idx' in v_plan) = 0 then
    raise exception 'Expected vacancy_offers_open_trade_area_idx in plan: %', v_plan;
  end if;

  -- 4. Customer jobs list
  execute format(
    'explain (analyze, buffers, format json) select id from public.jobs where customer_id = %L order by created_at desc limit 20',
    v_user
  ) into v_plan;
  if position('jobs_customer_created_idx' in v_plan) = 0 then
    raise exception 'Expected jobs_customer_created_idx in plan: %', v_plan;
  end if;

  -- 5. Open jobs for professional lead matching
  execute format(
    'explain (analyze, buffers, format json) select id from public.jobs where trade_id = %L and area_id = %L and status = ''open'' order by created_at desc limit 20',
    v_trade, v_area
  ) into v_plan;
  if position('jobs_open_trade_area_created_idx' in v_plan) = 0 then
    raise exception 'Expected jobs_open_trade_area_created_idx in plan: %', v_plan;
  end if;

  -- 6. Quotes by allocation (deactivation FK path)
  execute format(
    'explain (analyze, buffers, format json) select id from public.job_quotes where professional_allocation_id = %L',
    v_alloc
  ) into v_plan;
  if position('job_quotes_allocation_idx' in v_plan) = 0 then
    raise exception 'Expected job_quotes_allocation_idx in plan: %', v_plan;
  end if;

  -- 7. Customer bookings
  execute format(
    'explain (analyze, buffers, format json) select id from public.job_bookings where customer_id = %L order by created_at desc limit 20',
    v_user
  ) into v_plan;
  if position('job_bookings_customer_created_idx' in v_plan) = 0 then
    raise exception 'Expected job_bookings_customer_created_idx in plan: %', v_plan;
  end if;

  -- 8. Professional active bookings overlap check
  execute format(
    'explain (analyze, buffers, format json) select id from public.job_bookings where professional_id = %L and status in (''booked'',''awaiting_customer'') order by created_at desc',
    v_user
  ) into v_plan;
  if position('job_bookings_professional_status_created_idx' in v_plan) = 0 then
    raise exception 'Expected job_bookings_professional_status_created_idx in plan: %', v_plan;
  end if;

  -- 9. Published professional reviews
  execute format(
    'explain (analyze, buffers, format json) select id, stars from public.booking_reviews where professional_id = %L and moderation_status = ''published'' order by created_at desc',
    v_user
  ) into v_plan;
  if position('booking_reviews_professional_published_idx' in v_plan) = 0 then
    raise exception 'Expected booking_reviews_professional_published_idx in plan: %', v_plan;
  end if;

  -- 10. Customer own reviews
  execute format(
    'explain (analyze, buffers, format json) select id from public.booking_reviews where author_id = %L order by created_at desc',
    v_user
  ) into v_plan;
  if position('booking_reviews_author_created_idx' in v_plan) = 0 then
    raise exception 'Expected booking_reviews_author_created_idx in plan: %', v_plan;
  end if;

  -- 11. Appointment confirmed_by and proposed_by FKs
  execute format(
    'explain (analyze, buffers, format json) select booking_id from public.booking_appointments where confirmed_by = %L',
    v_user
  ) into v_plan;
  if position('booking_appointments_confirmed_by_idx' in v_plan) = 0 then
    raise exception 'Expected booking_appointments_confirmed_by_idx in plan: %', v_plan;
  end if;

  execute format(
    'explain (analyze, buffers, format json) select booking_id from public.booking_appointments where proposed_by = %L',
    v_user
  ) into v_plan;
  if position('booking_appointments_proposed_by_idx' in v_plan) = 0 then
    raise exception 'Expected booking_appointments_proposed_by_idx in plan: %', v_plan;
  end if;

  -- 12. User community group memberships
  execute format(
    'explain (analyze, buffers, format json) select group_id from public.community_group_memberships where user_id = %L',
    v_user
  ) into v_plan;
  if position('community_group_memberships_user_idx' in v_plan) = 0 then
    raise exception 'Expected community_group_memberships_user_idx in plan: %', v_plan;
  end if;

  -- 13. User community event RSVPs
  execute format(
    'explain (analyze, buffers, format json) select event_id from public.community_event_rsvps where user_id = %L',
    v_user
  ) into v_plan;
  if position('community_event_rsvps_user_idx' in v_plan) = 0 then
    raise exception 'Expected community_event_rsvps_user_idx in plan: %', v_plan;
  end if;
end $tf$;
rollback;

select 'All 14 targeted marketplace FK indexes verified via EXPLAIN (ANALYZE, BUFFERS)' as result;
