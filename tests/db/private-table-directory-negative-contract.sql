-- P0 deep negative-permission contract.
-- Pins the seven intentionally private RLS/no-policy tables and verifies that
-- the four anonymously callable SECURITY DEFINER directory helpers expose only
-- actively approved, independently verified professionals.
--
-- Run after bootstrap + all migrations. All fixtures live in one transaction
-- and are rolled back, so this file is safe to run alongside other suites.
begin;

-- 1. Pin the seven private tables -----------------------------------------
-- The Supabase advisor correctly flags these tables: they have RLS enabled
-- and deliberately no policies because no client role may read them directly.
do $private_tables$
declare
  expected text[] := array[
    'account_write_quotas','booking_address_consent_events','job_site_locations',
    'platform_admins','professional_service_locations','stripe_webhook_events',
    'verified_service_territories'];
  actual text[];
  t text;
  r text;
  p text;
begin
  select array_agg(c.relname order by c.relname) into actual
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity
    and not exists (select 1 from pg_policy pol where pol.polrelid=c.oid);
  if actual is distinct from expected then
    raise exception 'Unexpected RLS/no-policy table set: % (expected %)',actual,expected;
  end if;

  foreach t in array expected loop
    foreach r in array array['anon','authenticated']::text[] loop
      foreach p in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']::text[] loop
        if has_table_privilege(r,'public.'||t,p) then
          raise exception 'Private table % grants % to %',t,p,r;
        end if;
      end loop;
    end loop;
    -- Server-side/admin paths must keep working; this is not a blanket revoke.
    if not has_table_privilege('postgres','public.'||t,'SELECT') then
      raise exception 'Server-side access lost on private table %',t;
    end if;
  end loop;
end
$private_tables$;

-- Behavioural denial: a real SET ROLE anon SELECT must fail on every one.
set role anon;
do $anon_table_denial$
declare
  expected text[] := array[
    'account_write_quotas','booking_address_consent_events','job_site_locations',
    'platform_admins','professional_service_locations','stripe_webhook_events',
    'verified_service_territories'];
  t text;
begin
  foreach t in array expected loop
    begin
      execute 'select 1 from public.'||t||' limit 1';
      raise exception 'Anonymous SELECT succeeded on private table %',t;
    exception when insufficient_privilege then null;
    end;
  end loop;
end
$anon_table_denial$;
reset role;

-- The same must hold for an ordinary signed-in customer, not just anon.
set role authenticated;
do $auth_table_denial$
declare
  expected text[] := array[
    'account_write_quotas','booking_address_consent_events','job_site_locations',
    'platform_admins','professional_service_locations','stripe_webhook_events',
    'verified_service_territories'];
  t text;
begin
  foreach t in array expected loop
    begin
      execute 'select 1 from public.'||t||' limit 1';
      raise exception 'Authenticated SELECT succeeded on private table %',t;
    exception when insufficient_privilege then null;
    end;
  end loop;
end
$auth_table_denial$;
reset role;

-- 2. Isolated fixtures ----------------------------------------------------
-- A dedicated trade and area keep these assertions independent of the
-- five-slot fixtures created by flows.sql.
do $fixture$
declare
  v_admin uuid := '00000000-0000-0000-00aa-000000000001'::uuid;
  v_trade uuid;
  v_area uuid;
  i integer;
  v_user uuid;
  v_app uuid;
begin
  insert into auth.users(id,raw_user_meta_data) values
   (v_admin,'{"full_name":"Audit Admin","requested_role":"customer"}');
  for i in 1..3 loop
    v_user:=('00000000-0000-0000-00ac-00000000000'||i)::uuid;
    insert into auth.users(id,raw_user_meta_data)
    values (v_user,jsonb_build_object('full_name','Audit Professional '||i,'requested_role','professional'));
  end loop;
  insert into public.platform_admins(user_id) values (v_admin);

  insert into public.trades(slug,name)
  values ('permission-audit-trade','Permission Audit Trade') returning id into v_trade;
  insert into public.service_areas(country_code,city,area_name)
  values ('GB','Audit City','Audit Area') returning id into v_area;
  perform set_config('trustfive.audit_trade',v_trade::text,true);
  perform set_config('trustfive.audit_area',v_area::text,true);

  for i in 1..3 loop
    v_user:=('00000000-0000-0000-00ac-00000000000'||i)::uuid;
    v_app:=('00000000-0000-0000-00ab-00000000000'||i)::uuid;
    insert into public.professional_applications
      (id,user_id,trade_id,area_id,business_name,about,experience_years)
    values (v_app,v_user,v_trade,v_area,'Audit Pro '||i,
            'Independently audited test professional',5);
  end loop;
end
$fixture$;

set role authenticated;
do $approval$
declare
  v_admin uuid := '00000000-0000-0000-00aa-000000000001'::uuid;
  v_trade uuid := current_setting('trustfive.audit_trade')::uuid;
  v_area uuid := current_setting('trustfive.audit_area')::uuid;
  v_app uuid;
  v_offer uuid;
  v_active uuid;
  v_wait uuid;
  i integer;
begin
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  -- Two eligible, independently verified applicants; the third stays pending.
  for i in 1..2 loop
    v_app:=('00000000-0000-0000-00ab-00000000000'||i)::uuid;
    perform public.review_professional_application(v_app,true,
      25::smallint,20::smallint,12::smallint,12::smallint,8::smallint,4::smallint);
  end loop;

  v_offer:=public.offer_next_professional(v_trade,v_area);
  select application_id into v_active from public.vacancy_offers where id=v_offer;
  if v_active is null then raise exception 'Fixture produced no vacancy offer'; end if;
  perform set_config('request.jwt.claim.sub',
    (select user_id::text from public.professional_applications where id=v_active),true);
  perform public.respond_to_vacancy_offer(v_offer,true);
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform public.activate_professional(v_active);
  perform set_config('trustfive.audit_active',v_active::text,true);

  select a.id into v_wait from public.professional_applications a
  where a.trade_id=v_trade and a.area_id=v_area and a.status='eligible'
    and a.id<>v_active order by a.id limit 1;
  if v_wait is null then raise exception 'Fixture lost its verified waiting-list applicant'; end if;
  perform set_config('trustfive.audit_wait',v_wait::text,true);

  perform public.verify_professional_service_location(v_active,51.5,-0.12,25,
    'Independent reviewer documented this audit fixture coverage point.');
end
$approval$;
reset role;

-- 3. Anonymous directory behaviour ---------------------------------------
set role anon;
do $anon_directory$
declare
  v_trade uuid := current_setting('trustfive.audit_trade')::uuid;
  v_area uuid := current_setting('trustfive.audit_area')::uuid;
  v_active uuid := current_setting('trustfive.audit_active')::uuid;
  v_wait uuid := current_setting('trustfive.audit_wait')::uuid;
  v_pending uuid := '00000000-0000-0000-00ab-000000000003'::uuid;
  v_count integer;
  v_distance numeric;
begin
  -- Positive control: public discovery still works after the table revokes.
  select count(*) into v_count from public.find_trustfive_professionals(v_trade,v_area);
  if v_count<>1 then
    raise exception 'Directory returned % rows; expected only the active approved fixture',v_count;
  end if;
  if not exists (select 1 from public.find_trustfive_professionals(v_trade,v_area)
                 where application_id=v_active) then
    raise exception 'Active approved professional missing from public directory';
  end if;

  -- Negative: neither a verified waiting-list applicant nor a pending
  -- applicant may appear in any public directory, in any trade/area filter.
  if exists (select 1 from public.find_trustfive_professionals(v_trade,v_area)
             where application_id in (v_wait,v_pending)) then
    raise exception 'Directory leaked a waiting-list or unapproved applicant';
  end if;
  select count(*) into v_count from public.find_trustfive_professionals_with_reviews(v_trade,v_area);
  if v_count<>1 or exists (
      select 1 from public.find_trustfive_professionals_with_reviews(v_trade,v_area)
      where application_id in (v_wait,v_pending)) then
    raise exception 'Reviewed directory leaked an ineligible applicant';
  end if;
  select count(*),min(distance_km) into v_count,v_distance
  from public.find_trustfive_professionals_nearby(51.5,-0.12,v_trade);
  if v_count<>1 or v_distance is null or v_distance>25 then
    raise exception 'Nearby directory did not return exactly the covered professional';
  end if;
  if exists (
      select 1 from public.find_trustfive_professionals_nearby(51.5,-0.12,v_trade)
      where application_id in (v_wait,v_pending)) then
    raise exception 'Nearby directory leaked an ineligible applicant';
  end if;

  -- The approval helper must fail closed on NULL, unknown, waitlisted and
  -- never-reviewed applications, and open only for an active allocation.
  if public.is_active_approved_application(v_active) is not true then
    raise exception 'Approval helper denied an active approved professional';
  end if;
  if public.is_active_approved_application(v_wait) is distinct from false
     or public.is_active_approved_application(v_pending) is distinct from false
     or public.is_active_approved_application(null::uuid) is distinct from false
     or public.is_active_approved_application(gen_random_uuid()) is distinct from false then
    raise exception 'Approval helper failed open for an ineligible application';
  end if;

  -- Bogus filters and out-of-range coordinates must return nothing, not data.
  select count(*) into v_count from public.find_trustfive_professionals(gen_random_uuid(),v_area);
  if v_count<>0 then raise exception 'Unknown trade filter leaked directory rows'; end if;
  select count(*) into v_count from public.find_trustfive_professionals(v_trade,gen_random_uuid());
  if v_count<>0 then raise exception 'Unknown area filter leaked directory rows'; end if;
  select count(*) into v_count from public.find_trustfive_professionals_nearby(999,-0.12,v_trade);
  if v_count<>0 then raise exception 'Invalid latitude leaked nearby directory rows'; end if;
  select count(*) into v_count from public.find_trustfive_professionals_nearby(51.5,999,v_trade);
  if v_count<>0 then raise exception 'Invalid longitude leaked nearby directory rows'; end if;

  -- Private verification evidence and stored coordinates must not be exposed.
  if exists (
    select 1 from public.find_trustfive_professionals_nearby(51.5,-0.12,v_trade) r
    where row_to_json(r)::text like '%Independent reviewer%'
       or row_to_json(r)::text like '%51.5%'
  ) then raise exception 'Directory output leaked private verification evidence or coordinates'; end if;

  -- Admin-only RPCs stay admin-only; the public helpers are not a back door.
  if has_function_privilege('anon',
      'public.review_professional_application(uuid,boolean,smallint,smallint,smallint,smallint,smallint,smallint)','EXECUTE')
     or has_function_privilege('anon','public.activate_professional(uuid)','EXECUTE')
     or has_function_privilege('anon','public.offer_next_professional(uuid,uuid)','EXECUTE')
     or has_function_privilege('anon','public.respond_to_vacancy_offer(uuid,boolean)','EXECUTE')
     or has_function_privilege('anon',
        'public.verify_professional_service_location(uuid,double precision,double precision,integer,text)','EXECUTE')
     or has_function_privilege('anon','public.open_jobs_for_professional()','EXECUTE')
     or has_function_privilege('anon','public.booking_job_site_address(uuid)','EXECUTE')
     or has_function_privilege('anon','public.has_verified_trustfive_territories(text)','EXECUTE')
     or has_function_privilege('anon',
        'public.apply_membership_stripe_event(text,timestamptz,uuid,text,text,text)','EXECUTE') then
    raise exception 'An anonymous caller can execute an admin-only RPC';
  end if;
  begin
    perform public.activate_professional(v_active);
    raise exception 'Anonymous caller activated a professional';
  exception when insufficient_privilege then null;
  end;
end
$anon_directory$;
reset role;

-- 4. Every public SECURITY DEFINER function pins an empty search_path ------
do $definer_paths$
declare v_bad integer;
begin
  select count(*) into v_bad
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig,array[]::text[])) config
      where config in ('search_path=','search_path=""'));
  if v_bad>0 then
    raise exception '% SECURITY DEFINER functions lack a pinned empty search_path',v_bad;
  end if;
end
$definer_paths$;

rollback;
select 'Private table and directory negative-permission contracts passed' as result;
