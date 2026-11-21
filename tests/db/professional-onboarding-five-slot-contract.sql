-- Regression contract for Task 2:
-- 1. Strict RLS isolation on professional_verification_submissions & applications.
-- 2. Applicants cannot self-approve, mutate status, or tamper with verification status.
-- 3. Permitted profile updates work only for the owning applicant.
-- 4. Strict 5-professional limit per trade/area; 6th verified applicant stays waitlisted.
-- 5. Paid business_memberships never influence eligibility or waitlist selection.
-- 6. Admin suspension safely vacates active slot and promotes next waiting-list applicant.
-- All test fixtures are strictly rolled back.

begin;

-- Seed synthetic test identities (1 admin, 1 customer, 6 professional applicants)
insert into auth.users(id, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', '{"full_name":"Admin Reviewer","requested_role":"customer"}'),
  ('10000000-0000-0000-0000-000000000002', '{"full_name":"Regular Customer","requested_role":"customer"}'),
  ('10000000-0000-0000-0000-000000000011', '{"full_name":"Pro One","requested_role":"professional"}'),
  ('10000000-0000-0000-0000-000000000012', '{"full_name":"Pro Two","requested_role":"professional"}'),
  ('10000000-0000-0000-0000-000000000013', '{"full_name":"Pro Three","requested_role":"professional"}'),
  ('10000000-0000-0000-0000-000000000014', '{"full_name":"Pro Four","requested_role":"professional"}'),
  ('10000000-0000-0000-0000-000000000015', '{"full_name":"Pro Five","requested_role":"professional"}'),
  ('10000000-0000-0000-0000-000000000016', '{"full_name":"Pro Six Waitlist","requested_role":"professional"}')
on conflict (id) do nothing;

insert into public.platform_admins(user_id)
  values ('10000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;

-- Give Pro Six (lowest quality score) an active paid membership to prove payment
-- NEVER overtakes higher-quality unpaid applicants on the waiting list.
insert into public.business_memberships(user_id, stripe_customer_id, stripe_subscription_id, subscription_status, last_event_created_at)
  values ('10000000-0000-0000-0000-000000000016', 'cus_test_task2_pro6', 'sub_test_task2_pro6', 'active', now())
on conflict (user_id) do update set subscription_status = 'active';

-- Create a dedicated synthetic trade + area for this isolated 5-slot test
insert into public.trades(id, slug, name)
  values ('20000000-0000-0000-0000-000000000001', 'task2-test-trade', 'Task2 Test Trade');
insert into public.service_areas(id, country_code, region, city, area_name)
  values ('30000000-0000-0000-0000-000000000001', 'GB', 'Test Region', 'Test City', 'Task2 Five Slot Area');

-- 6 professionals apply
insert into public.professional_applications(id, user_id, trade_id, area_id, business_name, about, experience_years, status) values
  ('40000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Pro One Electrical', 'Qualified electrician with 10 years domestic and commercial testing.', 10, 'pending'),
  ('40000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Pro Two Electrical', 'Qualified electrician with 9 years domestic and commercial testing.', 9, 'pending'),
  ('40000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Pro Three Electrical', 'Qualified electrician with 8 years domestic and commercial testing.', 8, 'pending'),
  ('40000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Pro Four Electrical', 'Qualified electrician with 7 years domestic and commercial testing.', 7, 'pending'),
  ('40000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Pro Five Electrical', 'Qualified electrician with 6 years domestic and commercial testing.', 6, 'pending'),
  ('40000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Pro Six Paid Waitlist', 'Qualified electrician with 5 years domestic and commercial testing.', 5, 'pending');

-- Test as Pro One: submit private verification & update permitted profile, block self-approval
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);

do $tf$
declare
  v_sub uuid;
  v_name text;
  v_status text;
begin
  v_sub := public.submit_professional_verification(
    '40000000-0000-0000-0000-000000000011',
    'Hiscox UK',
    'POL-2026-9910',
    current_date + 180,
    'NICEIC',
    'NIC-12345',
    'NVQ Level 3 Electrical Installation, 18th Edition BS 7671, £5M public liability.'
  );
  if v_sub is null then raise exception 'Verification submission failed'; end if;

  -- Permitted profile update works and keeps status = pending
  perform public.update_my_professional_application_profile(
    '40000000-0000-0000-0000-000000000011',
    'Pro One Electrical Ltd',
    'Updated qualified electrician with 11 years testing and inspection experience.',
    11
  );
  select business_name, status into v_name, v_status
    from public.professional_applications where id = '40000000-0000-0000-0000-000000000011';
  if v_name <> 'Pro One Electrical Ltd' or v_status <> 'pending' then
    raise exception 'Profile update unexpected result: % / %', v_name, v_status;
  end if;

  -- Applicant MUST NOT self-approve or directly update verification_status
  begin
    update public.professional_verification_submissions set verification_status = 'verified'
      where application_id = '40000000-0000-0000-0000-000000000011';
    raise exception 'Applicant directly mutated verification_status';
  exception when insufficient_privilege then null; end;

  begin
    perform public.review_professional_verification('40000000-0000-0000-0000-000000000011', 'verified', 'self');
    raise exception 'Applicant invoked admin review_professional_verification';
  exception when insufficient_privilege then null; end;

  begin
    perform public.suspend_professional_application('40000000-0000-0000-0000-000000000012', 'Unauthorized attempt to suspend rival');
    raise exception 'Applicant invoked admin suspend_professional_application';
  exception when insufficient_privilege then null; end;

  -- Cross-account profile edit MUST fail
  begin
    perform public.update_my_professional_application_profile(
      '40000000-0000-0000-0000-000000000012',
      'Hijacked Name',
      'Attempting to overwrite another applicant profile details unlawfully.',
      2
    );
    raise exception 'Applicant edited another persons application';
  exception when insufficient_privilege then null; end;
end $tf$;

-- Test as Regular Customer: MUST see 0 verification submissions and 0 applications
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $tf$
declare v_count integer;
begin
  select count(*) into v_count from public.professional_verification_submissions;
  if v_count <> 0 then
    raise exception 'Customer read % confidential verification rows', v_count;
  end if;
  select count(*) into v_count from public.my_professional_onboarding_status();
  if v_count <> 0 then
    raise exception 'Customer received % onboarding status rows', v_count;
  end if;
end $tf$;

-- Switch to Admin: verify all 6 applicants (Pro 1..5 score 95..91; paid Pro 6 scores 80)
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $tf$
declare
  v_offer uuid;
  v_slot smallint;
  v_i integer;
  v_app uuid;
  v_user uuid;
  v_paid_offered boolean;
begin
  perform public.review_professional_verification('40000000-0000-0000-0000-000000000011', 'verified', 'Checked certificate');

  for v_i in 1..6 loop
    v_app := ('40000000-0000-0000-0000-00000000001' || v_i)::uuid;
    perform public.review_professional_application(
      v_app, true,
      (30 - v_i)::smallint, 25::smallint, 15::smallint, 15::smallint, 10::smallint,
      (case when v_i = 6 then 0 else 5 end)::smallint
    );
  end loop;

  -- Fill all 5 slots: Pro 1..5 must be selected (paid lower-scoring Pro 6 stays on waitlist)
  for v_i in 1..5 loop
    select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
    v_offer := public.offer_next_professional(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001'
    );
    select a.id, a.user_id into v_app, v_user
      from public.vacancy_offers o
      join public.professional_applications a on a.id = o.application_id
      where o.id = v_offer;

    if v_app = '40000000-0000-0000-0000-000000000016' then
      raise exception 'Paid lower-scoring applicant bypassed higher-scoring unpaid applicants';
    end if;

    -- Applicant accepts offer
    select set_config('request.jwt.claim.sub', v_user::text, true);
    perform public.respond_to_vacancy_offer(v_offer, true);

    -- Admin activates into slot 1..5
    select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
    v_slot := public.activate_professional(v_app);
    if v_slot <> v_i then
      raise exception 'Expected slot %, got %', v_i, v_slot;
    end if;
  end loop;

  -- 6th offer MUST fail because all 5 slots are active
  begin
    perform public.offer_next_professional(
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001'
    );
    raise exception '6th vacancy offer succeeded despite 5 active slots';
  exception when others then
    if sqlerrm not like '%No vacancy available%' then raise; end if;
  end;

  -- Verify Pro Six sees active_slots_filled = 5 and active_slot IS NULL via overview RPC
  select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000016', true);
  if not exists(
    select 1 from public.my_professional_onboarding_status()
    where application_id = '40000000-0000-0000-0000-000000000016'
      and application_status = 'eligible'
      and active_slot is null
      and active_slots_filled = 5
  ) then
    raise exception 'Waiting-list applicant did not see accurate 5/5 status';
  end if;

  -- Admin suspends Pro One: must vacate slot 1, mark suspended, and allow Pro Six to be offered
  select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  perform public.suspend_professional_application(
    '40000000-0000-0000-0000-000000000011',
    'Insurance certificate expired and requires re-verification before reactivation.'
  );

  if exists(select 1 from public.active_allocations where application_id = '40000000-0000-0000-0000-000000000011') then
    raise exception 'Suspended professional still holds an active slot';
  end if;
  if not exists(select 1 from public.professional_applications where id = '40000000-0000-0000-0000-000000000011' and status = 'suspended') then
    raise exception 'Suspended professional status not recorded';
  end if;

  -- Now Pro Six receives the vacated offer
  v_offer := public.offer_next_professional(
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001'
  );
  select exists(
    select 1 from public.vacancy_offers
    where id = v_offer and application_id = '40000000-0000-0000-0000-000000000016'
  ) into v_paid_offered;
  if not v_paid_offered then
    raise exception 'Waiting-list candidate Pro Six was not offered the vacated slot';
  end if;
end $tf$;

rollback;
select 'Task 2 professional onboarding, RLS, verification, suspension and five-slot contract passed' as result;
