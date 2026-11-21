-- P0 complaint/appeal RLS negative contract.
-- Verifies that only the parties and independently authorised admins can
-- read or write complaint and appeal records, and that resolving them never
-- changes professional allocations. All fixtures roll back.
begin;

-- Isolated fixture: one customer, one professional, one unrelated customer,
-- one admin, plus a completed booking between the first two.
do $fixture$
declare
  v_customer uuid := '00000000-0000-0000-00b0-000000000001'::uuid;
  v_pro uuid := '00000000-0000-0000-00b0-000000000002'::uuid;
  v_outsider uuid := '00000000-0000-0000-00b0-000000000003'::uuid;
  v_admin uuid := '00000000-0000-0000-00b0-000000000004'::uuid;
  v_trade uuid;
  v_area uuid;
  v_job uuid := '00000000-0000-0000-00b1-000000000001'::uuid;
  v_quote uuid := '00000000-0000-0000-00b2-000000000001'::uuid;
  v_booking uuid := '00000000-0000-0000-00b3-000000000001'::uuid;
begin
  insert into auth.users(id,raw_user_meta_data) values
   (v_customer,'{"full_name":"Audit Customer","requested_role":"customer"}'),
   (v_pro,'{"full_name":"Audit Professional","requested_role":"professional"}'),
   (v_outsider,'{"full_name":"Audit Outsider","requested_role":"customer"}'),
   (v_admin,'{"full_name":"Audit Admin","requested_role":"customer"}');
  insert into public.platform_admins(user_id) values (v_admin);

  insert into public.trades(slug,name)
  values ('complaint-audit-trade','Complaint Audit Trade') returning id into v_trade;
  insert into public.service_areas(country_code,city,area_name)
  values ('GB','Complaint Audit City','Complaint Audit Area') returning id into v_area;

  -- The job and quote inserts fire account-write-quota triggers that call
  -- auth.uid(); running as superuser bypasses RLS but still needs the claim.
  perform set_config('request.jwt.claim.sub',v_customer::text,true);
  insert into public.jobs(id,customer_id,title,description,status,trade_id,area_id)
  values (v_job,v_customer,'Audit repair','Complaint audit fixture job.','completed',v_trade,v_area);
  insert into public.job_quotes(id,job_id,professional_id,amount_pence,message,status)
  values (v_quote,v_job,v_pro,15000,'Audited quote for the fixture job.','accepted');
  insert into public.job_bookings(id,quote_id,job_id,customer_id,professional_id,status)
  values (v_booking,v_quote,v_job,v_customer,v_pro,'completed');

  perform set_config('trustfive.ca_trade',v_trade::text,true);
  perform set_config('trustfive.ca_area',v_area::text,true);
  perform set_config('trustfive.ca_booking',v_booking::text,true);
end
$fixture$;

-- Customer files a valid complaint through real RLS.
set role authenticated;
do $file_complaint$
declare
  v_customer uuid := '00000000-0000-0000-00b0-000000000001'::uuid;
  v_pro uuid := '00000000-0000-0000-00b0-000000000002'::uuid;
  v_complaint uuid := '00000000-0000-0000-00b4-000000000001'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_customer::text,true);
  insert into public.booking_complaints(id,booking_id,reporter_id,respondent_id,category,statement)
  values (v_complaint,current_setting('trustfive.ca_booking')::uuid,
          v_customer,v_pro,'quality','The audited workmanship did not meet the agreed standard.');
  perform set_config('trustfive.ca_complaint',v_complaint::text,true);
end
$file_complaint$;

-- Anonymous visitors must see no complaint or appeal detail.
reset role;
set role anon;
do $anon_rls$
declare v_complaint uuid := current_setting('trustfive.ca_complaint')::uuid;
begin
  if exists (select 1 from public.booking_complaints where id=v_complaint) then
    raise exception 'Anonymous visitor read a complaint';
  end if;
  if exists (select 1 from public.complaint_appeals where complaint_id=v_complaint) then
    raise exception 'Anonymous visitor read an appeal';
  end if;
end
$anon_rls$;
reset role;

-- An unrelated signed-in customer can neither read nor file a complaint.
set role authenticated;
do $outsider_complaint$
declare
  v_outsider uuid := '00000000-0000-0000-00b0-000000000003'::uuid;
  v_pro uuid := '00000000-0000-0000-00b0-000000000002'::uuid;
  v_complaint uuid := current_setting('trustfive.ca_complaint')::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_outsider::text,true);
  if exists (select 1 from public.booking_complaints where id=v_complaint) then
    raise exception 'Unrelated customer read a complaint';
  end if;
  begin
    insert into public.booking_complaints(booking_id,reporter_id,respondent_id,category,statement)
    values (current_setting('trustfive.ca_booking')::uuid,v_outsider,v_pro,'quality',
            'An unrelated customer tried to file a complaint about this booking.');
    raise exception 'SENTINEL: unrelated customer filed a complaint';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;

  -- Non-admin cannot resolve a complaint.
  begin
    perform public.resolve_booking_complaint(v_complaint,'substantiated',
      'A non-admin supplied an evidence-based resolution reason without authority.');
    raise exception 'SENTINEL: non-admin resolved a complaint';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;

  -- An unrelated party cannot answer a complaint that is not theirs.
  begin
    perform public.respond_to_booking_complaint(v_complaint,
      'An unrelated customer attempted to answer the respondent statement.');
    raise exception 'SENTINEL: outsider answered a complaint';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;
end
$outsider_complaint$;
reset role;

-- The respondent may read and answer, but may not spoof the reporter.
set role authenticated;
do $respondent_complaint$
declare
  v_customer uuid := '00000000-0000-0000-00b0-000000000001'::uuid;
  v_pro uuid := '00000000-0000-0000-00b0-000000000002'::uuid;
  v_complaint uuid := current_setting('trustfive.ca_complaint')::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_pro::text,true);
  if not exists (select 1 from public.booking_complaints where id=v_complaint) then
    raise exception 'Respondent cannot read the complaint against them';
  end if;
  begin
    insert into public.booking_complaints(booking_id,reporter_id,respondent_id,category,statement)
    values (current_setting('trustfive.ca_booking')::uuid,v_customer,v_pro,'conduct',
            'The respondent tried to file a second complaint as the customer.');
    raise exception 'SENTINEL: respondent spoofed the reporter';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;
  perform public.respond_to_booking_complaint(v_complaint,
    'The respondent supplied a detailed, dated answer to the quality allegation.');
end
$respondent_complaint$;
reset role;

-- Admin resolves with a documented reason; no automatic slot change.
set role authenticated;
do $resolve_complaint$
declare
  v_admin uuid := '00000000-0000-0000-00b0-000000000004'::uuid;
  v_complaint uuid := current_setting('trustfive.ca_complaint')::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform public.resolve_booking_complaint(v_complaint,'unsubstantiated',
    'The documented evidence did not substantiate the alleged workmanship issue.');
  if not exists (select 1 from public.booking_complaints
                 where id=v_complaint and status='unsubstantiated') then
    raise exception 'Admin resolution was not recorded';
  end if;
end
$resolve_complaint$;
reset role;

-- The reporter may appeal; the other complaint party may not see that appeal
-- but may file an appeal of their own.
set role authenticated;
do $file_appeal$
declare
  v_customer uuid := '00000000-0000-0000-00b0-000000000001'::uuid;
  v_complaint uuid := current_setting('trustfive.ca_complaint')::uuid;
  v_appeal uuid := '00000000-0000-0000-00b5-000000000001'::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_customer::text,true);
  insert into public.complaint_appeals(id,complaint_id,appellant_id,reason)
  values (v_appeal,v_complaint,v_customer,
    'The reconsideration request includes additional dated correspondence.');
  perform set_config('trustfive.ca_appeal',v_appeal::text,true);

  -- An unresolved complaint cannot be appealed.
  insert into public.booking_complaints(id,booking_id,reporter_id,respondent_id,category,statement)
  values ('00000000-0000-0000-00b4-000000000002',
          current_setting('trustfive.ca_booking')::uuid,v_customer,
          '00000000-0000-0000-00b0-000000000002'::uuid,'billing',
          'A second, still unresolved billing complaint for the audit fixture.');
  begin
    insert into public.complaint_appeals(complaint_id,appellant_id,reason)
    values ('00000000-0000-0000-00b4-000000000002',v_customer,
      'This appeal should fail while the underlying complaint is unresolved.');
    raise exception 'SENTINEL: unresolved complaint was appealed';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;
end
$file_appeal$;
reset role;

set role authenticated;
do $appeal_outsider$
declare
  v_pro uuid := '00000000-0000-0000-00b0-000000000002'::uuid;
  v_outsider uuid := '00000000-0000-0000-00b0-000000000003'::uuid;
  v_complaint uuid := current_setting('trustfive.ca_complaint')::uuid;
  v_appeal uuid := current_setting('trustfive.ca_appeal')::uuid;
begin
  perform set_config('request.jwt.claim.sub',v_pro::text,true);
  -- The respondent is a complaint party and cannot read the reporter's appeal,
  -- but is entitled to file an appeal of their own.
  if exists (select 1 from public.complaint_appeals where id=v_appeal) then
    raise exception 'The other complaint party read a private appeal';
  end if;
  insert into public.complaint_appeals(complaint_id,appellant_id,reason)
  values (v_complaint,v_pro,'The respondent filed a detailed appeal of the allegation against them.');
  -- One appeal per complaint party: a duplicate must be rejected.
  begin
    insert into public.complaint_appeals(complaint_id,appellant_id,reason)
    values (v_complaint,v_pro,'The respondent attempted a second appeal for the same complaint.');
    raise exception 'SENTINEL: duplicate appeal was accepted';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;
  begin
    perform public.resolve_complaint_appeal(v_appeal,true,
      'A non-admin attempted to uphold the appeal without independent authority.');
    raise exception 'SENTINEL: non-admin resolved an appeal';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',v_outsider::text,true);
  if exists (select 1 from public.complaint_appeals where id=v_appeal) then
    raise exception 'Unrelated customer read a private appeal';
  end if;
  -- An unrelated customer is not a party and cannot file an appeal.
  begin
    insert into public.complaint_appeals(complaint_id,appellant_id,reason)
    values (v_complaint,v_outsider,'An unrelated customer tried to appeal a complaint they are not part of.');
    raise exception 'SENTINEL: unrelated party filed an appeal';
  exception when others then
    if sqlerrm like 'SENTINEL:%' then raise; end if;
  end;
end
$appeal_outsider$;
reset role;

-- Admin decides the appeal, and the fixture trade still has no allocations.
set role authenticated;
do $resolve_appeal$
declare
  v_admin uuid := '00000000-0000-0000-00b0-000000000004'::uuid;
  v_appeal uuid := current_setting('trustfive.ca_appeal')::uuid;
  v_allocations integer;
begin
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform public.resolve_complaint_appeal(v_appeal,false,
    'The reconsidered evidence did not justify reversing the original decision.');
  if not exists (select 1 from public.complaint_appeals
                 where id=v_appeal and status='denied') then
    raise exception 'Admin appeal decision was not recorded';
  end if;
  select count(*) into v_allocations from public.active_allocations
  where trade_id=current_setting('trustfive.ca_trade')::uuid
    and area_id=current_setting('trustfive.ca_area')::uuid;
  if v_allocations<>0 then
    raise exception 'Complaint/appeal resolution changed active allocations';
  end if;
end
$resolve_appeal$;
reset role;

rollback;
select 'Complaint and appeal RLS negative contract passed' as result;
