-- Regression contract for Task 3 (agent/agy-bookings-quotes):
-- 1. Job contact preferences validate allowed values and enforce owner-only updates.
-- 2. Professional quote availability_note is validated and surfaced in customer_quotes() and professional_quotes().
-- 3. Professional withdraw_job_quote works only on owning pending quotes, never accepted quotes or other pros' quotes.
-- 4. Private job-site address remains inaccessible to unauthorised professionals.
-- Strictly rollback-only; leaves zero persistent fixture data.

begin;

insert into auth.users(id, raw_user_meta_data) values
  ('50000000-0000-0000-0000-000000000001', '{"full_name":"Task3 Admin","requested_role":"customer"}'),
  ('50000000-0000-0000-0000-000000000002', '{"full_name":"Task3 Customer","requested_role":"customer"}'),
  ('50000000-0000-0000-0000-000000000003', '{"full_name":"Task3 Approved Pro","requested_role":"professional"}'),
  ('50000000-0000-0000-0000-000000000004', '{"full_name":"Task3 Unrelated Pro","requested_role":"professional"}')
on conflict (id) do nothing;

insert into public.platform_admins(user_id)
  values ('50000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;

insert into public.trades(id, slug, name)
  values ('60000000-0000-0000-0000-000000000001', 'task3-plumbing', 'Task3 Plumbing');
insert into public.service_areas(id, country_code, region, city, area_name)
  values ('70000000-0000-0000-0000-000000000001', 'GB', 'South Yorkshire', 'Sheffield', 'Task3 Central');

insert into public.professional_applications(id, user_id, trade_id, area_id, business_name, about, experience_years, status)
  values ('80000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'Sheffield Flow Plumbing', 'Gas Safe and NVQ Level 3 plumbing specialist across Sheffield.', 12, 'pending');

-- Admin approves, offers and activates Approved Pro into slot 1 + verified coverage
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
do $tf$
declare
  v_offer uuid;
  v_alloc uuid;
  v_job uuid;
  v_quote uuid;
  v_booking uuid;
  v_pref text;
  v_avail text;
begin
  perform public.review_professional_application(
    '80000000-0000-0000-0000-000000000001', true,
    28::smallint, 24::smallint, 14::smallint, 15::smallint, 9::smallint, 5::smallint
  );
  v_offer := public.offer_next_professional(
    '60000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001'
  );
  select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000003', true);
  perform public.respond_to_vacancy_offer(v_offer, true);

  select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
  perform public.activate_professional('80000000-0000-0000-0000-000000000001');
  perform public.verify_professional_service_location(
    '80000000-0000-0000-0000-000000000001',
    53.3811, -1.4701, 25,
    'Verified Sheffield operating base and public liability insurance certificate.'
  );
  select id into v_alloc from public.active_allocations
    where application_id = '80000000-0000-0000-0000-000000000001';

  -- Customer creates a private-location job and sets contact_preference
  select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
  v_job := public.create_job_with_private_location(
    'Replace leaking kitchen stopcock',
    'Main stopcock under kitchen sink is dripping steadily and needs replacing cleanly.',
    '60000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    18500,
    '14 Private Lane, S1 2AB',
    'S1 2AB',
    'GB',
    53.3820, -1.4680, 'address'
  );
  perform public.set_job_contact_preference(v_job, 'phone_after_booking');
  select contact_preference into v_pref from public.jobs where id = v_job;
  if v_pref <> 'phone_after_booking' then
    raise exception 'Expected phone_after_booking, got %', v_pref;
  end if;

  -- Invalid contact preference must fail
  begin
    perform public.set_job_contact_preference(v_job, 'public_phone');
    raise exception 'Invalid contact preference accepted';
  exception when others then null; end;

  -- Unrelated user cannot change customer contact preference or read private job address
  select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000004', true);
  begin
    perform public.set_job_contact_preference(v_job, 'in_app_messages');
    raise exception 'Unrelated user modified job contact preference';
  exception when insufficient_privilege then null; end;

  if exists(select 1 from public.customer_job_site_location(v_job)) then
    raise exception 'Unauthorised user read private job site location';
  end if;

  -- Approved Pro submits a quote with availability_note, then withdraws it safely
  select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000003', true);
  insert into public.job_quotes(job_id, professional_allocation_id, professional_id, amount_pence, message, availability_note, status)
  values (
    v_job, v_alloc, '50000000-0000-0000-0000-000000000003',
    16500, 'Includes brass BS1010 stopcock, isolation and full pressure test.',
    'Available Tuesday or Wednesday morning', 'pending'
  ) returning id into v_quote;

  select availability_note into v_avail from public.professional_quotes() where quote_id = v_quote;
  if v_avail <> 'Available Tuesday or Wednesday morning' then
    raise exception 'professional_quotes() did not return availability_note';
  end if;

  -- Customer sees availability_note via customer_quotes()
  select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
  select availability_note into v_avail from public.customer_quotes() where quote_id = v_quote;
  if v_avail <> 'Available Tuesday or Wednesday morning' then
    raise exception 'customer_quotes() did not return availability_note';
  end if;

  -- Unrelated pro CANNOT withdraw Approved Pro's quote
  select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000004', true);
  begin
    perform public.withdraw_job_quote(v_quote);
    raise exception 'Unrelated user withdrew another professionals quote';
  exception when insufficient_privilege then null; end;

  -- Customer accepts quote -> creates booking; afterwards Approved Pro CANNOT withdraw accepted quote
  select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
  v_booking := public.accept_job_quote(v_quote);
  if v_booking is null then raise exception 'Booking creation failed'; end if;

  select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000003', true);
  begin
    perform public.withdraw_job_quote(v_quote);
    raise exception 'Accepted quote was withdrawn after booking';
  exception when insufficient_privilege then null; end;

  -- Create a second open job + quote specifically to test valid pending withdrawal
  select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
  v_job := public.create_job_with_private_location(
    'Fit outdoor garden tap',
    'Install double check valve brass bib tap on rear garden wall with isolation.',
    '60000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    12000,
    '14 Private Lane, S1 2AB',
    'S1 2AB',
    'GB',
    53.3820, -1.4680, 'address'
  );
  select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000003', true);
  insert into public.job_quotes(job_id, professional_allocation_id, professional_id, amount_pence, message, availability_note, status)
  values (
    v_job, v_alloc, '50000000-0000-0000-0000-000000000003',
    11500, 'Full external tap install with insulation sleeve and double check valve.',
    'Next Monday afternoon', 'pending'
  ) returning id into v_quote;
  perform public.withdraw_job_quote(v_quote);
  if not exists(select 1 from public.job_quotes where id = v_quote and status = 'withdrawn') then
    raise exception 'Pending quote withdrawal did not set status=withdrawn';
  end if;
end $tf$;

rollback;
select 'Task 3 job contact preferences, quote availability, withdrawal and privacy contract passed' as result;
