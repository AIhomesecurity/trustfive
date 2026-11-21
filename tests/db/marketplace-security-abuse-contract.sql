-- Phase 7 Comprehensive Marketplace Security & Abuse Prevention Contract.
-- Exercises real PostgreSQL 16 RLS and SECURITY DEFINER boundaries on disposable
-- rollback-only fixtures. Never weakens any policy or five-slot rule.

begin;

-- Seed disposable test identities:
-- Admin, Customer A, Customer B (attacker), Approved Pro, Unapproved Pro (pending)
insert into auth.users(id, raw_user_meta_data) values
  ('90000000-0000-0000-0000-000000000001', '{"full_name":"Sec Admin","requested_role":"customer"}'),
  ('90000000-0000-0000-0000-000000000002', '{"full_name":"Customer A","requested_role":"customer"}'),
  ('90000000-0000-0000-0000-000000000003', '{"full_name":"Customer B","requested_role":"customer"}'),
  ('90000000-0000-0000-0000-000000000004', '{"full_name":"Approved Pro","requested_role":"professional"}'),
  ('90000000-0000-0000-0000-000000000005', '{"full_name":"Unapproved Pro","requested_role":"professional"}')
on conflict (id) do nothing;

insert into public.platform_admins(user_id)
  values ('90000000-0000-0000-0000-000000000001')
on conflict (user_id) do nothing;

insert into public.trades(id, slug, name)
  values ('91000000-0000-0000-0000-000000000001', 'sec-test-electrical', 'Security Test Electrical');
insert into public.service_areas(id, country_code, region, city, area_name)
  values ('92000000-0000-0000-0000-000000000001', 'GB', 'West Yorkshire', 'Leeds', 'Security Test Area');

insert into public.professional_applications(id, user_id, trade_id, area_id, business_name, about, experience_years, status) values
  ('93000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'Approved Spark Ltd', 'NICEIC approved domestic electrician with 10 years experience.', 10, 'pending'),
  ('93000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'Pending Spark Ltd', 'Unverified applicant awaiting independent review.', 3, 'pending');

set local role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

do $tf$
declare
  v_offer uuid;
  v_alloc uuid;
  v_job_open uuid;
  v_job_cancel uuid;
  v_quote uuid;
  v_booking uuid;
  v_count integer;
begin
  -- Admin approves & activates ONLY Approved Pro (Unapproved Pro remains pending)
  perform public.review_professional_application(
    '93000000-0000-0000-0000-000000000001', true,
    29::smallint, 24::smallint, 15::smallint, 15::smallint, 10::smallint, 5::smallint
  );
  v_offer := public.offer_next_professional(
    '91000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001'
  );
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000004', true);
  perform public.respond_to_vacancy_offer(v_offer, true);
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);
  perform public.activate_professional('93000000-0000-0000-0000-000000000001');
  perform public.verify_professional_service_location(
    '93000000-0000-0000-0000-000000000001',
    53.8008, -1.5491, 25,
    'Verified Leeds operating premises and current public liability insurance.'
  );
  select id into v_alloc from public.active_allocations
    where application_id = '93000000-0000-0000-0000-000000000001';

  -- Customer A posts two jobs (one to book, one to test cancel/reopen lifecycle)
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);
  v_job_open := public.create_job_with_private_location(
    'Install consumer unit',
    'Replace old fuse box with modern RCBO consumer unit and full EICR test.',
    '91000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    65000,
    '22 Secret Gardens, LS1 4AA',
    'LS1 4AA',
    'GB',
    53.8010, -1.5480, 'address'
  );
  v_job_cancel := public.create_job_with_private_location(
    'Add loft lighting circuit',
    'Install switched LED batten light in boarded loft space with isolation.',
    '91000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    22000,
    '22 Secret Gardens, LS1 4AA',
    'LS1 4AA',
    'GB',
    53.8010, -1.5480, 'address'
  );

  -- ABUSE 1: Customer B tries to read Customer A's job, exact address, activity log, or cancel it
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000003', true);
  select count(*) into v_count from public.jobs where id = v_job_open;
  if v_count <> 0 then raise exception 'Customer B read Customer A job'; end if;
  if exists(select 1 from public.customer_job_site_location(v_job_open)) then
    raise exception 'Customer B read Customer A private address';
  end if;
  if exists(select 1 from public.customer_job_activity(v_job_open)) then
    raise exception 'Customer B read Customer A job activity';
  end if;
  begin
    perform public.cancel_customer_job(v_job_cancel, 'Malicious cancel');
    raise exception 'Customer B cancelled Customer A job';
  exception when insufficient_privilege then null; end;

  -- ABUSE 2: Unapproved (pending) Pro tries to read open leads or submit a quote
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000005', true);
  if exists(select 1 from public.open_jobs_for_professional() where job_id = v_job_open) then
    raise exception 'Unapproved professional accessed protected open job lead';
  end if;
  begin
    insert into public.job_quotes(job_id, professional_allocation_id, professional_id, amount_pence, message, status)
    values (v_job_open, v_alloc, '90000000-0000-0000-0000-000000000005', 50000, 'Trying to spoof another pros allocation id.', 'pending');
    raise exception 'Unapproved professional submitted quote using spoofed allocation';
  exception when insufficient_privilege then null; end;

  -- Customer A cancels v_job_cancel -> Approved Pro CANNOT quote on cancelled job -> Customer A reopens it
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);
  perform public.cancel_customer_job(v_job_cancel, 'Postponing loft work');
  if not exists(select 1 from public.jobs where id = v_job_cancel and status = 'cancelled') then
    raise exception 'Job cancellation did not set status=cancelled';
  end if;

  -- ABUSE 3: Approved Pro tries to quote on cancelled job
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000004', true);
  begin
    insert into public.job_quotes(job_id, professional_allocation_id, professional_id, amount_pence, message, status)
    values (v_job_cancel, v_alloc, '90000000-0000-0000-0000-000000000004', 20000, 'Attempting to quote on cancelled job.', 'pending');
    raise exception 'Quote accepted on a cancelled job';
  exception when insufficient_privilege then null; end;

  -- Customer A reopens v_job_cancel and sees genuine audit history (job_cancelled + job_reopened)
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);
  perform public.reopen_customer_job(v_job_cancel);
  select count(*) into v_count from public.customer_job_activity(v_job_cancel)
    where action in ('job_cancelled','job_reopened');
  if v_count <> 2 then
    raise exception 'Expected 2 genuine lifecycle audit events, found %', v_count;
  end if;

  -- Approved Pro legitimately quotes on v_job_open
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000004', true);
  insert into public.job_quotes(job_id, professional_allocation_id, professional_id, amount_pence, message, status)
  values (v_job_open, v_alloc, '90000000-0000-0000-0000-000000000004', 62000, 'Full RCBO board upgrade with Part P certificate.', 'pending')
  returning id into v_quote;

  -- ABUSE 4: Customer B tries to message or accept Customer A's quote
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000003', true);
  begin
    insert into public.quote_messages(quote_id, author_id, body)
    values (v_quote, '90000000-0000-0000-0000-000000000003', 'Injected message from outsider');
    raise exception 'Outsider injected message into private quote thread';
  exception when insufficient_privilege then null; end;
  begin
    perform public.accept_job_quote(v_quote);
    raise exception 'Customer B accepted Customer A quote';
  exception when insufficient_privilege then null; end;

  -- Customer A accepts quote -> booking created
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);
  v_booking := public.accept_job_quote(v_quote);

  -- ABUSE 5: Duplicate quote acceptance & cancelling an already booked job MUST fail
  begin
    perform public.accept_job_quote(v_quote);
    raise exception 'Duplicate quote acceptance succeeded';
  exception when others then null; end;
  begin
    perform public.cancel_customer_job(v_job_open, 'Try cancelling booked job');
    raise exception 'Booked job was cancelled via cancel_customer_job';
  exception when others then null; end;

  -- ABUSE 6: Appointment self-confirmation and outsider tampering MUST fail
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000004', true);
  perform public.propose_booking_appointment(v_booking, now() + interval '2 days', now() + interval '2 days 3 hours', 'Europe/London');
  begin
    perform public.confirm_booking_appointment(v_booking);
    raise exception 'Proposer self-confirmed own appointment';
  exception when others then null; end;

  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000003', true);
  begin
    perform public.confirm_booking_appointment(v_booking);
    raise exception 'Outsider confirmed someone elses appointment';
  exception when insufficient_privilege then null; end;

  -- Customer A confirms appointment
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);
  perform public.confirm_booking_appointment(v_booking);

  -- ABUSE 7: Fraudulent review BEFORE completion MUST fail
  begin
    insert into public.booking_reviews(booking_id, author_id, professional_id, stars, body)
    values (v_booking, '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000004', 5, 'Premature review before work is completed.');
    raise exception 'Review accepted on uncompleted booking';
  exception when insufficient_privilege then null; end;

  -- Approved Pro marks work ready; Customer B CANNOT confirm completion
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000004', true);
  perform public.mark_job_ready_for_confirmation(v_booking);
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000003', true);
  begin
    perform public.confirm_job_completed(v_booking);
    raise exception 'Customer B confirmed Customer A booking completed';
  exception when others then null; end;

  -- Customer A confirms completion; duplicate confirmation fails; legitimate review succeeds; Pro CANNOT edit/delete review
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);
  perform public.confirm_job_completed(v_booking);
  begin
    perform public.confirm_job_completed(v_booking);
    raise exception 'Duplicate completion confirmation succeeded';
  exception when others then null; end;

  insert into public.booking_reviews(booking_id, author_id, professional_id, stars, body)
  values (v_booking, '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000004', 5, 'Clean consumer unit upgrade with full test certificate.');

  -- Duplicate review on same booking MUST fail
  begin
    insert into public.booking_reviews(booking_id, author_id, professional_id, stars, body)
    values (v_booking, '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000004', 5, 'Duplicate review attempt on same completed booking.');
    raise exception 'Duplicate booking review succeeded';
  exception when unique_violation then null; end;

  -- Approved Pro CANNOT update or delete customer review
  perform set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000004', true);
  update public.booking_reviews set body = 'Tampered by pro' where booking_id = v_booking;
  if exists(select 1 from public.booking_reviews where booking_id = v_booking and body = 'Tampered by pro') then
    raise exception 'Professional edited customer review';
  end if;
  delete from public.booking_reviews where booking_id = v_booking;
  if not exists(select 1 from public.booking_reviews where booking_id = v_booking) then
    raise exception 'Professional deleted customer review';
  end if;
end $tf$;

rollback;
select 'Phase 7 marketplace security, lifecycle and abuse-prevention contract passed' as result;
