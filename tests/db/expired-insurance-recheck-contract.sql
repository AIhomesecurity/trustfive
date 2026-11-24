-- Disposable database regression for vetting expiry rechecks and concurrent
-- five-slot activation. This test is run by .github/workflows/database-tests.yml
-- alongside the existing professional-onboarding-five-slot-contract.sql.
--
-- Coverage:
--   1. An active professional whose insurance_expires_on is in the past is
--      suspended by flag_expired_insurance_active_professionals(), their
--      slot is freed, and a professional_suspended audit event is recorded.
--   2. The freed slot can be offered to the next eligible waiting-list
--      applicant (fair promotion after expiry-driven suspension).
--   3. flag_expired_insurance_active_professionals() is admin-only.
--   4. flag_expired_insurance_active_professionals() is idempotent.
--   5. Concurrent activation safety: suspended pro cannot be re-activated;
--      pro without accepted offer cannot be activated.
--
-- All fixtures are strictly rolled back.

begin;

insert into auth.users(id, raw_user_meta_data) values
  ('20000000-0000-0000-0000-000000000001', '{"full_name":"Admin Recheck","requested_role":"customer"}'),
  ('20000000-0000-0000-0000-000000000011', '{"full_name":"Recheck Pro One","requested_role":"professional"}'),
  ('20000000-0000-0000-0000-000000000012', '{"full_name":"Recheck Pro Two","requested_role":"professional"}'),
  ('20000000-0000-0000-0000-000000000013', '{"full_name":"Recheck Pro Three","requested_role":"professional"}'),
  ('20000000-0000-0000-0000-000000000014', '{"full_name":"Recheck Pro Four","requested_role":"professional"}'),
  ('20000000-0000-0000-0000-000000000015', '{"full_name":"Recheck Pro Five","requested_role":"professional"}'),
  ('20000000-0000-0000-0000-000000000016', '{"full_name":"Recheck Pro Six Expired","requested_role":"professional"}'),
  ('20000000-0000-0000-0000-000000000017', '{"full_name":"Recheck Pro Seven Waitlist","requested_role":"professional"}')
on conflict (id) do nothing;

insert into public.platform_admins(user_id)
  values ('20000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;

insert into public.trades(id, slug, name)
  values ('30000000-0000-0000-0000-000000000001', 'recheck-test-trade', 'Recheck Test Trade');
insert into public.service_areas(id, country_code, region, city, area_name)
  values ('40000000-0000-0000-0000-000000000001', 'GB', 'Recheck Region', 'Recheck City', 'Recheck Area');

insert into public.professional_applications(id, user_id, trade_id, area_id, business_name, about, experience_years, status) values
  ('50000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Recheck Pro One', 'Qualified electrician.', 10, 'pending'),
  ('50000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Recheck Pro Two', 'Qualified electrician.', 9, 'pending'),
  ('50000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Recheck Pro Three', 'Qualified electrician.', 8, 'pending'),
  ('50000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Recheck Pro Four', 'Qualified electrician.', 7, 'pending'),
  ('50000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Recheck Pro Five', 'Qualified electrician.', 6, 'pending'),
  ('50000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Recheck Pro Six Expired', 'Qualified electrician.', 5, 'pending'),
  ('50000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000017', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Recheck Pro Seven Waitlist', 'Qualified electrician.', 4, 'pending');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
do $tf$
declare
  v_offer uuid;
  v_slot smallint;
  v_i integer;
  v_app uuid;
  v_user uuid;
  v_suspended_count integer;
  v_pro_six_app uuid := '50000000-0000-0000-0000-000000000016';
  v_pro_seven_app uuid := '50000000-0000-0000-0000-000000000017';
  v_pro_one_app uuid := '50000000-0000-0000-0000-000000000011';
begin
  for v_i in 1..7 loop
    v_app := ('50000000-0000-0000-0000-0000000000' || v_i::text)::uuid;
    perform public.review_professional_verification(v_app, 'verified', 'Checked certificate');
    perform public.review_professional_application(
      v_app, true,
      (30 - v_i)::smallint, 25::smallint, 15::smallint, 15::smallint, 10::smallint,
      5::smallint
    );
  end loop;

  for v_i in 1..5 loop
    v_app := ('50000000-0000-0000-0000-0000000000' || v_i::text)::uuid;
    v_offer := public.offer_next_professional(
      '30000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001'
    );
    select a.id, a.user_id into v_app, v_user
      from public.vacancy_offers o
      join public.professional_applications a on a.id = o.application_id
      where o.id = v_offer;
    perform set_config('request.jwt.claim.sub', v_user::text, true);
    perform public.respond_to_vacancy_offer(v_offer, true);
    perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
    v_slot := public.activate_professional(v_app);
  end loop;

  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  if (select count(*) from public.active_allocations
      where trade_id='30000000-0000-0000-0000-000000000001'
        and area_id='40000000-0000-0000-0000-000000000001') <> 5 then
    raise exception 'Expected 5 active slots before recheck test';
  end if;

  -- TEST 1: Non-admin invocation is denied.
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000011', true);
  begin
    perform public.flag_expired_insurance_active_professionals();
    raise exception 'Non-admin was allowed to invoke flag_expired_insurance_active_professionals';
  exception when insufficient_privilege then null;
  end;

  -- TEST 2: No expired insurance yet, recheck finds 0.
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  v_suspended_count := public.flag_expired_insurance_active_professionals();
  if v_suspended_count <> 0 then
    raise exception 'Recheck found % expired-insurance pros before any insurance was expired', v_suspended_count;
  end if;

  -- SETUP: Suspend Pro One, activate Pro Six, backdate his insurance.
  perform public.suspend_professional_application(
    v_pro_one_app,
    'Suspended to free a slot for the recheck test setup.'
  );
  v_offer := public.offer_next_professional(
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001'
  );
  if not exists(select 1 from public.vacancy_offers where id = v_offer and application_id = v_pro_six_app) then
    raise exception 'Pro Six was not offered the vacated slot';
  end if;
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000016', true);
  perform public.respond_to_vacancy_offer(v_offer, true);
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  v_slot := public.activate_professional(v_pro_six_app);

  update public.professional_verification_submissions
    set insurance_expires_on = current_date - 1
    where application_id = v_pro_six_app;

  -- TEST 3: Recheck suspends Pro Six, frees slot, records audit event.
  v_suspended_count := public.flag_expired_insurance_active_professionals();
  if v_suspended_count <> 1 then
    raise exception 'Recheck should have suspended 1 pro, got %', v_suspended_count;
  end if;
  if exists(select 1 from public.active_allocations where application_id = v_pro_six_app) then
    raise exception 'Pro Six still holds a slot after insurance-expiry recheck';
  end if;
  if not exists(select 1 from public.professional_applications
      where id = v_pro_six_app and status = 'suspended') then
    raise exception 'Pro Six status is not suspended after recheck';
  end if;
  if not exists(select 1 from public.network_audit_events
      where application_id = v_pro_six_app and action = 'professional_suspended'
        and detail::text like '%Insurance expired on%') then
    raise exception 'Pro Six suspension audit event not recorded with insurance-expiry reason';
  end if;

  -- TEST 4: Idempotent. Second invocation finds 0.
  v_suspended_count := public.flag_expired_insurance_active_professionals();
  if v_suspended_count <> 0 then
    raise exception 'Recheck is not idempotent: second invocation suspended %', v_suspended_count;
  end if;

  -- TEST 5: Fair waiting-list promotion.
  v_offer := public.offer_next_professional(
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001'
  );
  if not exists(select 1 from public.vacancy_offers where id = v_offer and application_id = v_pro_seven_app) then
    raise exception 'Pro Seven was not offered the slot freed by insurance-expiry suspension';
  end if;

  -- TEST 6: Concurrent activation safety.
  begin
    perform public.activate_professional(v_pro_six_app);
    raise exception 'Suspended Pro Six was re-activated without re-verification';
  exception when others then
    if sqlerrm not like '%not eligible%' then raise; end if;
  end;
  begin
    perform public.activate_professional(v_pro_seven_app);
    raise exception 'Pro Seven activated without accepting the offer';
  exception when others then
    if sqlerrm not like '%Accepted, unexpired offer required%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000017', true);
  perform public.respond_to_vacancy_offer(v_offer, true);
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  v_slot := public.activate_professional(v_pro_seven_app);
  if v_slot is null or v_slot < 1 or v_slot > 5 then
    raise exception 'Pro Seven activated into invalid slot %', v_slot;
  end if;

  if (select count(*) from public.active_allocations
      where trade_id='30000000-0000-0000-0000-000000000001'
        and area_id='40000000-0000-0000-0000-000000000001') <> 5 then
    raise exception 'Final active slot count is not 5';
  end if;
end $tf$;

rollback;
select 'Vetting expiry recheck and concurrent activation regression passed' as result;
