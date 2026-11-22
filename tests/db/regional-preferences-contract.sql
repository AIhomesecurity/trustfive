-- Regional display preferences contract (Migration 0038).
-- Verifies strict RLS, zero anonymous privileges, zero direct client DML,
-- SECURITY DEFINER hardening, IANA timezone validation, cross-user isolation,
-- and zero unintended side effects on territories, release sign-offs or jobs.
-- Rollback-only fixtures; safe in any CI order.

do $catalogue$
declare
  v_fn oid;
  v_proconfig text[];
begin
  if to_regclass('public.user_regional_preferences') is null then
    raise exception 'public.user_regional_preferences table is missing';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_regional_preferences'
      and c.relrowsecurity
      and c.relforcerowsecurity
  ) then
    raise exception 'user_regional_preferences must have ENABLE + FORCE ROW LEVEL SECURITY';
  end if;

  if has_table_privilege('anon', 'public.user_regional_preferences', 'SELECT')
     or has_table_privilege('anon', 'public.user_regional_preferences', 'INSERT')
     or has_table_privilege('anon', 'public.user_regional_preferences', 'UPDATE')
     or has_table_privilege('anon', 'public.user_regional_preferences', 'DELETE') then
    raise exception 'anon role must have zero privileges on user_regional_preferences';
  end if;

  if not has_table_privilege('authenticated', 'public.user_regional_preferences', 'SELECT') then
    raise exception 'authenticated role must have SELECT on user_regional_preferences';
  end if;

  if has_table_privilege('authenticated', 'public.user_regional_preferences', 'INSERT')
     or has_table_privilege('authenticated', 'public.user_regional_preferences', 'UPDATE')
     or has_table_privilege('authenticated', 'public.user_regional_preferences', 'DELETE') then
    raise exception 'authenticated role must not have direct INSERT/UPDATE/DELETE on user_regional_preferences';
  end if;

  select p.oid, p.proconfig
  into v_fn, v_proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'save_my_regional_preferences'
    and p.prosecdef;

  if v_fn is null then
    raise exception 'SECURITY DEFINER function save_my_regional_preferences is missing';
  end if;

  if not (
    coalesce('search_path=' = any(v_proconfig), false)
    or coalesce('search_path=""' = any(v_proconfig), false)
  ) then
    raise exception 'save_my_regional_preferences must pin search_path = empty string';
  end if;

  if has_function_privilege('anon', v_fn, 'EXECUTE') then
    raise exception 'anon must not execute save_my_regional_preferences';
  end if;

  if not has_function_privilege('authenticated', v_fn, 'EXECUTE') then
    raise exception 'authenticated must be able to execute save_my_regional_preferences';
  end if;
end
$catalogue$;

begin;

insert into auth.users(id, raw_user_meta_data) values
  ('00000000-0000-0000-0038-000000000001', '{"full_name":"Intl User A","requested_role":"customer"}'),
  ('00000000-0000-0000-0038-000000000002', '{"full_name":"Intl User B","requested_role":"professional"}');

do $behaviour$
declare
  v_user_a uuid := '00000000-0000-0000-0038-000000000001';
  v_user_b uuid := '00000000-0000-0000-0038-000000000002';
  v_areas_before integer;
  v_slots_before integer;
  v_signoffs_before integer;
  v_jobs_before integer;
  v_saved public.user_regional_preferences;
  v_count integer;
  v_rejected boolean;
begin
  select count(*) into v_areas_before from public.service_areas;
  select count(*) into v_slots_before from public.active_allocations;
  select count(*) into v_signoffs_before from public.country_release_signoffs;
  select count(*) into v_jobs_before from public.jobs;

  execute 'set local role authenticated';

  -- 1. User A saves Japan / JPY / ja-JP / Asia/Tokyo
  perform set_config('request.jwt.claim.sub', v_user_a::text, true);
  v_saved := public.save_my_regional_preferences('JP', 'ja-JP', 'JPY', 'Asia/Tokyo');
  if v_saved.user_id <> v_user_a
     or v_saved.display_country_code <> 'JP'
     or v_saved.display_locale <> 'ja-JP'
     or v_saved.display_currency <> 'JPY'
     or v_saved.display_timezone <> 'Asia/Tokyo' then
    raise exception 'Unexpected saved row for User A: %', v_saved;
  end if;

  -- 2. User A updates to US / USD / en-US / America/New_York (upsert)
  v_saved := public.save_my_regional_preferences('us', 'en-US', 'usd', 'America/New_York');
  if v_saved.display_country_code <> 'US'
     or v_saved.display_currency <> 'USD'
     or v_saved.display_timezone <> 'America/New_York' then
    raise exception 'Upsert failed to normalise User A preferences: %', v_saved;
  end if;

  select count(*) into v_count from public.user_regional_preferences;
  if v_count <> 1 then
    raise exception 'User A expected exactly 1 visible row, got %', v_count;
  end if;

  -- 3. Reject invalid country, locale, currency and IANA timezone
  v_rejected := false;
  begin
    perform public.save_my_regional_preferences('XX', 'en-GB', 'GBP', 'Europe/London');
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Invalid country XX was accepted'; end if;

  v_rejected := false;
  begin
    perform public.save_my_regional_preferences('GB', 'xx-XX', 'GBP', 'Europe/London');
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Invalid locale xx-XX was accepted'; end if;

  v_rejected := false;
  begin
    perform public.save_my_regional_preferences('GB', 'en-GB', 'BTC', 'Europe/London');
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Invalid currency BTC was accepted'; end if;

  v_rejected := false;
  begin
    perform public.save_my_regional_preferences('GB', 'en-GB', 'GBP', 'Mars/Olympus_Mons');
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Invalid IANA timezone Mars/Olympus_Mons was accepted'; end if;

  -- 4. Direct DML must fail for authenticated role
  v_rejected := false;
  begin
    insert into public.user_regional_preferences(user_id, display_country_code)
    values (v_user_b, 'AU');
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Direct INSERT by authenticated unexpectedly succeeded'; end if;

  v_rejected := false;
  begin
    update public.user_regional_preferences set display_currency = 'JPY';
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Direct UPDATE by authenticated unexpectedly succeeded'; end if;

  v_rejected := false;
  begin
    delete from public.user_regional_preferences;
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Direct DELETE by authenticated unexpectedly succeeded'; end if;

  -- 5. Cross-user RLS isolation: User B cannot read User A's row
  perform set_config('request.jwt.claim.sub', v_user_b::text, true);
  select count(*) into v_count from public.user_regional_preferences;
  if v_count <> 0 then
    raise exception 'Cross-user leak: User B saw % rows belonging to User A', v_count;
  end if;

  v_saved := public.save_my_regional_preferences('AU', 'en-AU', 'AUD', 'Australia/Sydney');
  if v_saved.user_id <> v_user_b or v_saved.display_country_code <> 'AU' then
    raise exception 'User B save returned unexpected row: %', v_saved;
  end if;

  select count(*) into v_count from public.user_regional_preferences;
  if v_count <> 1 then
    raise exception 'User B should see only their own 1 row, saw %', v_count;
  end if;

  -- Verify User A still sees only their own US preference
  perform set_config('request.jwt.claim.sub', v_user_a::text, true);
  select count(*) into v_count
  from public.user_regional_preferences
  where user_id = v_user_a and display_country_code = 'US';
  if v_count <> 1 then
    raise exception 'User A row was unexpectedly modified or hidden';
  end if;

  -- 6. Empty auth claim must fail closed
  perform set_config('request.jwt.claim.sub', '', true);
  v_rejected := false;
  begin
    perform public.save_my_regional_preferences('GB', 'en-GB', 'GBP', 'Europe/London');
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Unauthenticated claim was allowed to save regional preferences'; end if;

  -- 7. Zero side effects on territories, five-slot allocations, release gates or jobs
  execute 'reset role';
  if (select count(*) from public.service_areas) <> v_areas_before
     or (select count(*) from public.active_allocations) <> v_slots_before
     or (select count(*) from public.country_release_signoffs) <> v_signoffs_before
     or (select count(*) from public.jobs) <> v_jobs_before then
    raise exception 'Saving regional display preferences mutated marketplace tables';
  end if;
end
$behaviour$;

rollback;

select 'Regional display preferences contract passed' as result;
