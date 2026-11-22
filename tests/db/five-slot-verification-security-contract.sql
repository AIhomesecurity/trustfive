-- Independent security & invariant regression contract for TrustFive
-- professional verification and five-slot marketplace rules.
--
-- Covers:
--   1. Hard five-slot cap per trade and area (constraints, triggers & capacity RPCs).
--   2. Sixth eligible applicant remains strictly on the waiting list until a vacancy opens.
--   3. Only authorised platform administrators may grant verification/approval or slots.
--   4. Rejected, withdrawn, deactivated/suspended and expired professionals cannot gain
--      or retain active marketplace status or directory visibility.
--   5. Paid business_memberships and community social activity (posts, comments, reactions)
--      never alter eligibility, waiting-list order, or public directory ranking.
--
-- Rollback-only fixtures; safe in any CI order and leaves zero persistent rows.

-- 1. Static schema, trigger, privilege & payment/social isolation audit ----------
do $static_audit$
declare
  v_fn record;
  v_forbidden text;
begin
  -- Active allocation table must enforce RLS + slot check + uniqueness + guard trigger
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'active_allocations' and c.relrowsecurity
  ) then
    raise exception 'public.active_allocations lost ROW LEVEL SECURITY';
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'active_allocations'
      and t.tgname = 'enforce_verified_active_slots' and not t.tgisinternal
  ) then
    raise exception 'enforce_verified_active_slots trigger is missing on active_allocations';
  end if;

  -- Anonymous role must have zero EXECUTE privileges on approval/slot-mutation RPCs
  for v_fn in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'review_professional_application',
        'offer_next_professional',
        'respond_to_vacancy_offer',
        'activate_professional',
        'deactivate_professional'
      )
  loop
    if has_function_privilege('anon', v_fn.oid, 'EXECUTE') then
      raise exception 'anon role unexpectedly has EXECUTE on %', v_fn.proname;
    end if;
  end loop;

  -- Payment and social tables must NEVER be referenced in approval, waitlist or ranking functions
  for v_fn in
    select p.proname, lower(p.prosrc) as src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'review_professional_application',
        'offer_next_professional',
        'activate_professional',
        'is_active_approved_application',
        'find_trustfive_professionals',
        'find_trustfive_professionals_with_reviews',
        'find_trustfive_professionals_nearby'
      )
  loop
    foreach v_forbidden in array array[
      'business_memberships',
      'stripe_webhook_events',
      'community_posts',
      'community_comments',
      'community_post_reactions'
    ] loop
      if position(v_forbidden in v_fn.src) > 0 then
        raise exception 'Function % illegally references %', v_fn.proname, v_forbidden;
      end if;
    end loop;
  end loop;
end
$static_audit$;

begin;

-- Seed isolated synthetic identities, trade and service area (rolled back at EOF)
insert into auth.users(id, raw_user_meta_data) values
  ('f5000000-0000-0000-0000-000000000001', '{"full_name":"FiveSlot Admin","requested_role":"customer"}'),
  ('f5000000-0000-0000-0000-000000000002', '{"full_name":"FiveSlot Customer One","requested_role":"customer"}'),
  ('f5000000-0000-0000-0000-000000000003', '{"full_name":"FiveSlot Customer Two","requested_role":"customer"}'),
  ('f5000000-0000-0000-0000-000000000011', '{"full_name":"Pro One","requested_role":"professional"}'),
  ('f5000000-0000-0000-0000-000000000012', '{"full_name":"Pro Two","requested_role":"professional"}'),
  ('f5000000-0000-0000-0000-000000000013', '{"full_name":"Pro Three","requested_role":"professional"}'),
  ('f5000000-0000-0000-0000-000000000014', '{"full_name":"Pro Four","requested_role":"professional"}'),
  ('f5000000-0000-0000-0000-000000000015', '{"full_name":"Pro Five","requested_role":"professional"}'),
  ('f5000000-0000-0000-0000-000000000016', '{"full_name":"Pro Six Waitlist PaidSocial","requested_role":"professional"}'),
  ('f5000000-0000-0000-0000-000000000017', '{"full_name":"Pro Seven Rejected","requested_role":"professional"}'),
  ('f5000000-0000-0000-0000-000000000018', '{"full_name":"Pro Eight Withdrawn","requested_role":"professional"}'),
  ('f5000000-0000-0000-0000-000000000019', '{"full_name":"Pro Nine HigherWaitlist Unpaid","requested_role":"professional"}');

insert into public.platform_admins(user_id)
  values ('f5000000-0000-0000-0000-000000000001');

insert into public.trades(id, slug, name)
  values ('f5000000-0000-0000-0001-000000000001', 'five-slot-audit-trade', 'Five Slot Audit Trade');

insert into public.service_areas(id, country_code, region, city, area_name)
  values ('f5000000-0000-0000-0002-000000000001', 'GB', 'Audit Region', 'Audit City', 'Five Slot Audit Area');

-- 2. Authorisation boundary tests (only platform_admins may approve or allocate) --
do $auth_boundaries$
declare
  v_trade uuid := 'f5000000-0000-0000-0001-000000000001';
  v_area  uuid := 'f5000000-0000-0000-0002-000000000001';
  v_admin uuid := 'f5000000-0000-0000-0000-000000000001';
  v_cust  uuid := 'f5000000-0000-0000-0000-000000000002';
  v_pro1  uuid := 'f5000000-0000-0000-0000-000000000011';
  v_app1  uuid := 'f5000000-0000-0000-0003-000000000011';
  v_rejected boolean;
  v_rows integer;
begin
  -- Professionals legitimately submit pending applications as authenticated role
  execute 'set local role authenticated';

  -- Customer (requested_role = 'customer') CANNOT submit a professional application
  perform set_config('request.jwt.claim.sub', v_cust::text, true);
  v_rejected := false;
  begin
    insert into public.professional_applications(id, user_id, trade_id, area_id, business_name, about, experience_years, status)
    values ('f5000000-0000-0000-0003-000000000099', v_cust, v_trade, v_area, 'Fake Pro', 'Not a pro account', 5, 'pending');
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Customer role was allowed to insert professional_application'; end if;

  -- Professional CANNOT insert directly with status = 'eligible'
  perform set_config('request.jwt.claim.sub', v_pro1::text, true);
  v_rejected := false;
  begin
    insert into public.professional_applications(id, user_id, trade_id, area_id, business_name, about, experience_years, status)
    values (v_app1, v_pro1, v_trade, v_area, 'Self Approved Co', 'Bypass attempt', 10, 'eligible');
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Applicant inserted pre-approved eligible application'; end if;

  -- Legitimate pending submission succeeds
  insert into public.professional_applications(id, user_id, trade_id, area_id, business_name, about, experience_years, status)
  values (v_app1, v_pro1, v_trade, v_area, 'Pro One Trade Ltd', 'Verified tradesperson one', 12, 'pending');

  -- Applicant CANNOT self-promote to platform_admins
  v_rejected := false;
  begin
    insert into public.platform_admins(user_id) values (v_pro1);
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Applicant inserted self into platform_admins'; end if;

  -- Applicant CANNOT self-review, offer, activate or directly update application status
  v_rejected := false;
  begin
    perform public.review_professional_application(v_app1, true, 30::smallint, 25::smallint, 15::smallint, 15::smallint, 10::smallint, 5::smallint);
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Applicant executed review_professional_application'; end if;

  v_rejected := false;
  begin
    perform public.offer_next_professional(v_trade, v_area);
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Applicant executed offer_next_professional'; end if;

  v_rejected := false;
  begin
    perform public.activate_professional(v_app1);
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Applicant executed activate_professional'; end if;

  v_rejected := false;
  begin
    insert into public.active_allocations(application_id, trade_id, area_id, slot)
    values (v_app1, v_trade, v_area, 1);
  exception when insufficient_privilege or raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Applicant inserted directly into active_allocations'; end if;

  -- Direct UPDATE on own application status must affect 0 rows under RLS
  update public.professional_applications set status = 'eligible' where id = v_app1;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'Applicant directly updated professional_applications status (% rows)', v_rows;
  end if;

  -- Regular customer CANNOT execute admin approval/offer/activate/deactivate RPCs
  perform set_config('request.jwt.claim.sub', v_cust::text, true);
  v_rejected := false;
  begin
    perform public.review_professional_application(v_app1, true, 25::smallint, 20::smallint, 12::smallint, 12::smallint, 8::smallint, 4::smallint);
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Customer executed review_professional_application'; end if;

  v_rejected := false;
  begin
    perform public.deactivate_professional(v_app1, 'Customer attempting unauthorised removal of professional');
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Customer executed deactivate_professional'; end if;

  -- Authorised admin is still enforced by score >= 70 and compliance >= 10 thresholds
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  v_rejected := false;
  begin
    perform public.review_professional_application(v_app1, true, 15::smallint, 15::smallint, 10::smallint, 10::smallint, 5::smallint, 2::smallint);
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Admin approved applicant below 70 quality score'; end if;

  v_rejected := false;
  begin
    perform public.review_professional_application(v_app1, true, 30::smallint, 25::smallint, 15::smallint, 9::smallint, 10::smallint, 5::smallint);
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Admin approved applicant with compliance < 10'; end if;

  execute 'reset role';
end
$auth_boundaries$;

-- 3. Seed Pro 2..9 applications, fill 5 slots, verify waitlist, rejection,
--    withdrawal, deactivation, expiry, and payment/social independence ----------
insert into public.professional_applications(id, user_id, trade_id, area_id, business_name, about, experience_years, status, submitted_at) values
  ('f5000000-0000-0000-0003-000000000012', 'f5000000-0000-0000-0000-000000000012', 'f5000000-0000-0000-0001-000000000001', 'f5000000-0000-0000-0002-000000000001', 'Pro Two Trade Ltd',   'Verified tradesperson two',   11, 'pending', now() - interval '8 hours'),
  ('f5000000-0000-0000-0003-000000000013', 'f5000000-0000-0000-0000-000000000013', 'f5000000-0000-0000-0001-000000000001', 'f5000000-0000-0000-0002-000000000001', 'Pro Three Trade Ltd', 'Verified tradesperson three', 10, 'pending', now() - interval '7 hours'),
  ('f5000000-0000-0000-0003-000000000014', 'f5000000-0000-0000-0000-000000000014', 'f5000000-0000-0000-0001-000000000001', 'f5000000-0000-0000-0002-000000000001', 'Pro Four Trade Ltd',  'Verified tradesperson four',   9, 'pending', now() - interval '6 hours'),
  ('f5000000-0000-0000-0003-000000000015', 'f5000000-0000-0000-0000-000000000015', 'f5000000-0000-0000-0001-000000000001', 'f5000000-0000-0000-0002-000000000001', 'Pro Five Trade Ltd',  'Verified tradesperson five',   8, 'pending', now() - interval '5 hours'),
  ('f5000000-0000-0000-0003-000000000016', 'f5000000-0000-0000-0000-000000000016', 'f5000000-0000-0000-0001-000000000001', 'f5000000-0000-0000-0002-000000000001', 'Pro Six Paid Social', 'Waitlist paid & social pro',   7, 'pending', now() - interval '4 hours'),
  ('f5000000-0000-0000-0003-000000000017', 'f5000000-0000-0000-0000-000000000017', 'f5000000-0000-0000-0001-000000000001', 'f5000000-0000-0000-0002-000000000001', 'Pro Seven Rejected',  'Rejected applicant',           6, 'pending', now() - interval '3 hours'),
  ('f5000000-0000-0000-0003-000000000018', 'f5000000-0000-0000-0000-000000000018', 'f5000000-0000-0000-0001-000000000001', 'f5000000-0000-0000-0002-000000000001', 'Pro Eight Withdrawn', 'Withdrawn applicant',          5, 'withdrawn', now() - interval '2 hours'),
  ('f5000000-0000-0000-0003-000000000019', 'f5000000-0000-0000-0000-000000000019', 'f5000000-0000-0000-0001-000000000001', 'f5000000-0000-0000-0002-000000000001', 'Pro Nine Waitlist',   'Higher scoring unpaid pro',    8, 'pending', now() - interval '1 hour');

do $five_slot_and_invariants$
declare
  v_trade uuid := 'f5000000-0000-0000-0001-000000000001';
  v_area  uuid := 'f5000000-0000-0000-0002-000000000001';
  v_admin uuid := 'f5000000-0000-0000-0000-000000000001';
  v_cust1 uuid := 'f5000000-0000-0000-0000-000000000002';
  v_cust2 uuid := 'f5000000-0000-0000-0000-000000000003';
  v_pro5  uuid := 'f5000000-0000-0000-0000-000000000015';
  v_pro6  uuid := 'f5000000-0000-0000-0000-000000000016';
  v_pro7  uuid := 'f5000000-0000-0000-0000-000000000017';
  v_pro9  uuid := 'f5000000-0000-0000-0000-000000000019';
  v_app1  uuid := 'f5000000-0000-0000-0003-000000000011';
  v_app2  uuid := 'f5000000-0000-0000-0003-000000000012';
  v_app5  uuid := 'f5000000-0000-0000-0003-000000000015';
  v_app6  uuid := 'f5000000-0000-0000-0003-000000000016';
  v_app7  uuid := 'f5000000-0000-0000-0003-000000000017';
  v_app8  uuid := 'f5000000-0000-0000-0003-000000000018';
  v_app9  uuid := 'f5000000-0000-0000-0003-000000000019';
  v_i integer;
  v_app uuid;
  v_user uuid;
  v_offer uuid;
  v_slot smallint;
  v_rejected boolean;
  v_dir_before uuid[];
  v_rev_before uuid[];
  v_near_before uuid[];
  v_dir_after uuid[];
  v_rev_after uuid[];
  v_near_after uuid[];
  v_post1 uuid;
  v_post2 uuid;
  v_offered_app uuid;
begin
  -- Give Pro 6 (lower waitlist score) and Pro 7 (rejected) paid Stripe memberships FIRST
  execute 'set local role service_role';
  perform public.apply_membership_stripe_event('evt_f5_pro6_active', now(), v_pro6, 'cus_f5_6', 'sub_f5_6', 'active');
  perform public.apply_membership_stripe_event('evt_f5_pro7_active', now(), v_pro7, 'cus_f5_7', 'sub_f5_7', 'active');
  execute 'reset role';

  -- Admin reviews Pro 1..5 (scores 96, 94, 92, 90, 86), Pro 6 (score 80), Pro 9 (score 84), rejects Pro 7
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  perform public.review_professional_application(v_app1, true, 30::smallint, 24::smallint, 14::smallint, 14::smallint, 9::smallint, 5::smallint); -- 96
  perform public.review_professional_application(v_app2, true, 29::smallint, 23::smallint, 14::smallint, 14::smallint, 9::smallint, 5::smallint); -- 94
  perform public.review_professional_application('f5000000-0000-0000-0003-000000000013', true, 28::smallint, 22::smallint, 14::smallint, 14::smallint, 9::smallint, 5::smallint); -- 92
  perform public.review_professional_application('f5000000-0000-0000-0003-000000000014', true, 27::smallint, 21::smallint, 14::smallint, 14::smallint, 9::smallint, 5::smallint); -- 90
  perform public.review_professional_application(v_app5, true, 25::smallint, 20::smallint, 13::smallint, 14::smallint, 9::smallint, 5::smallint); -- 86
  perform public.review_professional_application(v_app9, true, 24::smallint, 20::smallint, 13::smallint, 13::smallint, 9::smallint, 5::smallint); -- 84 (unpaid)
  perform public.review_professional_application(v_app6, true, 22::smallint, 19::smallint, 12::smallint, 13::smallint, 9::smallint, 5::smallint); -- 80 (paid + social)
  perform public.review_professional_application(v_app7, false, 10::smallint, 10::smallint, 8::smallint, 8::smallint, 5::smallint, 2::smallint); -- rejected

  -- Rival cannot answer another applicant's offer; fill all 5 slots strictly with Pro 1..5
  for v_i in 1..5 loop
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    v_offer := public.offer_next_professional(v_trade, v_area);

    -- On slot 5 (4 active + 1 open offer = 5), a 2nd simultaneous offer MUST fail capacity check
    if v_i = 5 then
      v_rejected := false;
      begin
        perform public.offer_next_professional(v_trade, v_area);
      exception when raise_exception then
        if sqlerrm like '%No vacancy available%' then v_rejected := true; end if;
      end;
      if not v_rejected then
        raise exception 'offer_next_professional allowed 6th reserved/active slot';
      end if;
    end if;

    select a.id, a.user_id into v_app, v_user
    from public.vacancy_offers o
    join public.professional_applications a on a.id = o.application_id
    where o.id = v_offer;

    if v_app in (v_app6, v_app7, v_app8, v_app9) then
      raise exception 'Unexpected applicant % offered ahead of top 5 verified applicants', v_app;
    end if;

    -- Rival Pro 6 cannot hijack v_offer
    perform set_config('request.jwt.claim.sub', v_pro6::text, true);
    v_rejected := false;
    begin
      perform public.respond_to_vacancy_offer(v_offer, true);
    exception when insufficient_privilege then v_rejected := true; end;
    if not v_rejected then raise exception 'Rival professional accepted another applicants offer'; end if;

    -- Owning applicant accepts offer
    perform set_config('request.jwt.claim.sub', v_user::text, true);
    perform public.respond_to_vacancy_offer(v_offer, true);

    -- Admin activates into slot v_i
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    v_slot := public.activate_professional(v_app);
    if v_slot <> v_i then
      raise exception 'Expected active slot %, got %', v_i, v_slot;
    end if;
  end loop;

  -- Verify strictly 5 active slots; 6th offer blocked; Pro 6 & Pro 9 remain waitlisted
  if (select count(*) from public.active_allocations where trade_id = v_trade and area_id = v_area) <> 5 then
    raise exception 'Expected exactly 5 active allocations';
  end if;

  v_rejected := false;
  begin
    perform public.offer_next_professional(v_trade, v_area);
  exception when raise_exception then
    if sqlerrm like '%No vacancy available%' then v_rejected := true; end if;
  end;
  if not v_rejected then raise exception '6th offer succeeded despite 5 active slots'; end if;

  if public.is_active_approved_application(v_app6) or public.is_active_approved_application(v_app9) then
    raise exception 'Waiting-list applicant reported as active approved';
  end if;
  if public.is_active_approved_application(v_app7) or public.is_active_approved_application(v_app8) then
    raise exception 'Rejected or withdrawn applicant reported as active approved';
  end if;

  -- Rejected / withdrawn applicants cannot be activated (even if an offer row existed)
  v_rejected := false;
  begin
    perform public.activate_professional(v_app7);
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Rejected applicant was activated'; end if;

  v_rejected := false;
  begin
    perform public.activate_professional(v_app8);
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Withdrawn applicant was activated'; end if;

  -- Even if a rejected applicant holds a prior unexpired accepted offer, activation + trigger still fail closed
  execute 'reset role';
  insert into public.vacancy_offers(application_id, trade_id, area_id, status, answered_at)
  values (v_app7, v_trade, v_area, 'accepted', now());
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  v_rejected := false;
  begin
    perform public.activate_professional(v_app7);
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then
    raise exception 'Rejected applicant with prior accepted offer was activated';
  end if;
  execute 'reset role';
  update public.vacancy_offers set status = 'expired' where application_id = v_app7;

  -- Seed identical verified proximity locations for Pro 1..5 so nearby ranking depends solely on quality score
  execute 'reset role';
  insert into public.professional_service_locations(application_id, latitude, longitude, service_radius_km, verification_note, verified_by)
  select a.application_id, 53.4808, -2.2426, 15, 'Independently verified audit centre point for ranking test', v_admin
  from public.active_allocations a
  where a.trade_id = v_trade and a.area_id = v_area;

  -- Even as superuser, physical schema/trigger constraints block slot=6, duplicate slot, or rejected insert
  v_rejected := false;
  begin
    insert into public.active_allocations(application_id, trade_id, area_id, slot)
    values (v_app6, v_trade, v_area, 6);
  exception when check_violation or raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Schema allowed slot = 6 in active_allocations'; end if;

  v_rejected := false;
  begin
    insert into public.active_allocations(application_id, trade_id, area_id, slot)
    values (v_app7, v_trade, v_area, 5);
  exception when unique_violation or raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Schema/trigger allowed rejected applicant into active_allocations'; end if;

  -- Capture baseline public directory rankings BEFORE payment & social activity
  execute 'set local role anon';
  select array_agg(application_id) into v_dir_before
    from public.find_trustfive_professionals(v_trade, v_area);
  select array_agg(application_id) into v_rev_before
    from public.find_trustfive_professionals_with_reviews(v_trade, v_area);
  select array_agg(application_id) into v_near_before
    from public.find_trustfive_professionals_nearby(53.4808, -2.2426, v_trade);

  if array_length(v_dir_before, 1) <> 5
     or array_length(v_rev_before, 1) <> 5
     or array_length(v_near_before, 1) <> 5 then
    raise exception 'Public directory RPCs did not return exactly 5 active professionals';
  end if;

  -- Verify Pro 5 (lowest quality score 86) is ranked 5th before payment/social boost attempt
  if v_dir_before[5] <> v_app5 or v_rev_before[5] <> v_app5 or v_near_before[5] <> v_app5 then
    raise exception 'Baseline ranking unexpected: Pro 5 was not ranked 5th';
  end if;

  -- Apply paid Stripe membership to lowest-ranked active Pro 5, cancel any membership on Pro 2
  execute 'reset role';
  execute 'set local role service_role';
  perform public.apply_membership_stripe_event('evt_f5_pro5_active', now(), v_pro5, 'cus_f5_5', 'sub_f5_5', 'active');
  perform public.apply_membership_stripe_event('evt_f5_pro2_canceled', now(), 'f5000000-0000-0000-0000-000000000012', 'cus_f5_2', 'sub_f5_2', 'canceled');
  execute 'reset role';

  -- Flood community social activity (posts, comments, reactions) for Pro 5 (lowest active) and Pro 6 (lowest waitlist)
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_pro5::text, true);
  insert into public.community_posts(author_id, area_id, body)
  values (v_pro5, v_area, 'Pro Five community post one with plenty of neighbourhood advice.')
  returning id into v_post1;
  insert into public.community_comments(post_id, author_id, body)
  values (v_post1, v_pro5, 'Helpful follow up tip from Pro Five.');

  perform set_config('request.jwt.claim.sub', v_pro6::text, true);
  insert into public.community_posts(author_id, area_id, body)
  values (v_pro6, v_area, 'Pro Six paid waitlist social post trying to boost visibility.')
  returning id into v_post2;

  perform set_config('request.jwt.claim.sub', v_cust1::text, true);
  insert into public.community_post_reactions(post_id, user_id, reaction) values
    (v_post1, v_cust1, 'like'),
    (v_post2, v_cust1, 'support');

  perform set_config('request.jwt.claim.sub', v_cust2::text, true);
  insert into public.community_post_reactions(post_id, user_id, reaction) values
    (v_post1, v_cust2, 'support'),
    (v_post2, v_cust2, 'like');

  -- Re-read all 3 public directory RPCs AFTER payment + social activity: order MUST be 100% identical
  execute 'set local role anon';
  select array_agg(application_id) into v_dir_after
    from public.find_trustfive_professionals(v_trade, v_area);
  select array_agg(application_id) into v_rev_after
    from public.find_trustfive_professionals_with_reviews(v_trade, v_area);
  select array_agg(application_id) into v_near_after
    from public.find_trustfive_professionals_nearby(53.4808, -2.2426, v_trade);

  if v_dir_after is distinct from v_dir_before
     or v_rev_after is distinct from v_rev_before
     or v_near_after is distinct from v_near_before then
    raise exception 'Payment or social activity altered public directory ranking!';
  end if;

  -- Admin cannot reject active Pro 1 without first deactivating; short deactivation reason blocked
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  v_rejected := false;
  begin
    perform public.review_professional_application(v_app1, false, 10::smallint, 10::smallint, 5::smallint, 5::smallint, 5::smallint, 0::smallint);
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Active professional was rejected without deactivation'; end if;

  v_rejected := false;
  begin
    perform public.deactivate_professional(v_app1, 'too short');
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Deactivation accepted an evidence-free short reason'; end if;

  -- Legitimate admin deactivation + rejection removes Pro 1 from active status & all directories
  perform public.deactivate_professional(v_app1, 'Evidence-backed suspension: public liability insurance lapsed during audit.');
  perform public.review_professional_application(v_app1, false, 10::smallint, 10::smallint, 5::smallint, 5::smallint, 5::smallint, 0::smallint);

  if public.is_active_approved_application(v_app1) then
    raise exception 'Deactivated/rejected Pro 1 still passes is_active_approved_application';
  end if;
  if exists(select 1 from public.find_trustfive_professionals(v_trade, v_area) where application_id = v_app1)
     or exists(select 1 from public.find_trustfive_professionals_with_reviews(v_trade, v_area) where application_id = v_app1)
     or exists(select 1 from public.find_trustfive_professionals_nearby(53.4808, -2.2426, v_trade) where application_id = v_app1) then
    raise exception 'Deactivated/rejected Pro 1 still visible in public directory';
  end if;

  -- Pro 1 cannot be re-activated using old consumed offer
  v_rejected := false;
  begin
    perform public.activate_professional(v_app1);
  exception when raise_exception then v_rejected := true; end;
  if not v_rejected then raise exception 'Deactivated/rejected Pro 1 regained active status'; end if;

  -- Vacated slot MUST go to unpaid, socially silent Pro 9 (score 84) BEFORE paid + socially active Pro 6 (score 80)
  v_offer := public.offer_next_professional(v_trade, v_area);
  select application_id into v_offered_app from public.vacancy_offers where id = v_offer;
  if v_offered_app <> v_app9 then
    raise exception 'Expected unpaid higher-scoring Pro 9 (score 84) to win vacated slot, got % (paid/social Pro 6 = %)', v_offered_app, v_app6;
  end if;

  -- Expired verification immediately removes active visibility even before deactivation
  execute 'reset role';
  update public.professional_assessments set verification_state = 'expired' where application_id = v_app2;
  if public.is_active_approved_application(v_app2)
     or exists(select 1 from public.find_trustfive_professionals(v_trade, v_area) where application_id = v_app2)
     or exists(select 1 from public.find_trustfive_professionals_with_reviews(v_trade, v_area) where application_id = v_app2)
     or exists(select 1 from public.find_trustfive_professionals_nearby(53.4808, -2.2426, v_trade) where application_id = v_app2) then
    raise exception 'Expired-verification professional remained visible in public directory';
  end if;
end
$five_slot_and_invariants$;

rollback;

select 'Five-slot verification, authorization, suspension/expiry and payment/social independence contract passed' as result;
