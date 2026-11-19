-- Run with psql -v ON_ERROR_STOP=1 after all migrations.
-- Every SQL exception that is not explicitly expected fails CI.
insert into auth.users(id,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000010','{"full_name":"Customer Test","requested_role":"customer"}'),
('00000000-0000-0000-0000-000000000099','{"full_name":"Admin Test","requested_role":"customer"}');
do $$
declare i int;v_user uuid;
begin
 for i in 1..6 loop
  v_user:=('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid;
  insert into auth.users(id,raw_user_meta_data)
  values(v_user,jsonb_build_object('full_name','Professional '||i,'requested_role','professional'));
 end loop;
end $$;
insert into public.platform_admins(user_id)
values ('00000000-0000-0000-0000-000000000099');

-- Reproduce real browser RLS calls by switching database role and claims.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$
declare v_trade uuid;v_area uuid;i int;v_user uuid;v_app uuid;
begin
 select id into v_trade from public.trades where slug='plumbing';
 select id into v_area from public.service_areas where area_name='Central London';
 for i in 1..6 loop
  v_user:=('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid;
  v_app:=('00000000-0000-0000-0001-'||lpad(i::text,12,'0'))::uuid;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  insert into public.professional_applications(id,user_id,trade_id,area_id,business_name,about,experience_years)
  values(v_app,v_user,v_trade,v_area,'Pro '||i,'Qualified plumbing professional',5);
 end loop;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',false);
do $$
declare a record;v_trade uuid;v_area uuid;v_offer uuid;v_app uuid;v_user uuid;i int;
begin
 for a in (select id from public.professional_applications order by id) loop
  perform public.review_professional_application(a.id,true,25::smallint,20::smallint,12::smallint,12::smallint,8::smallint,4::smallint);
 end loop;
 select id into v_trade from public.trades where slug='plumbing';
 select id into v_area from public.service_areas where area_name='Central London';
 for i in 1..5 loop
  v_offer:=public.offer_next_professional(v_trade,v_area);
  select app.id,app.user_id into v_app,v_user from public.vacancy_offers o
    join public.professional_applications app on app.id=o.application_id
    where o.id=v_offer;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform public.respond_to_vacancy_offer(v_offer,true);
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
  perform public.activate_professional(v_app);
 end loop;
 if (select count(*) from public.active_allocations where trade_id=v_trade and area_id=v_area)<>5 then
  raise exception 'Five-slot allocation invariant failed';
 end if;
 if (select count(*) from public.find_trustfive_professionals(v_trade,v_area))<>5 then
  raise exception 'Directory did not return exactly five active professionals';
 end if;
 begin
  perform public.offer_next_professional(v_trade,v_area);
  raise exception 'Sixth offer incorrectly succeeded';
 exception when others then
  if sqlerrm='Sixth offer incorrectly succeeded' then raise; end if;
  if sqlerrm not like '%No vacancy%' then raise; end if;
 end;
end $$;

-- Test real protected quote->booking->completion->review and private messages.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
insert into public.jobs(id,customer_id,title,description,status,trade_id,area_id,budget_pence)
select '00000000-0000-0000-0002-000000000001',
 '00000000-0000-0000-0000-000000000010',
 'Repair a leaky sink','Kitchen tap leaking, please provide a quote.','open',
 t.id,a.id,15000
from public.trades t cross join public.service_areas a
where t.slug='plumbing' and a.area_name='Central London';

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$
declare v_alloc uuid;
begin
 select aa.id into v_alloc from public.active_allocations aa
 join public.professional_applications ap on ap.id=aa.application_id
 where ap.user_id=auth.uid() limit 1;
 if v_alloc is null then raise exception 'Pro has no active slot'; end if;
 insert into public.job_quotes(id,job_id,professional_allocation_id,professional_id,amount_pence,message)
 values('00000000-0000-0000-0003-000000000001',
 '00000000-0000-0000-0002-000000000001',v_alloc,
 '00000000-0000-0000-0000-000000000001',12000,'Replace leaking kitchen connector');
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
do $$ declare v_booking uuid; begin
 v_booking:=public.accept_job_quote('00000000-0000-0000-0003-000000000001');
 if v_booking is null then raise exception 'Customer could not accept quote';end if;
end $$;
insert into public.quote_messages(quote_id,author_id,body) values
('00000000-0000-0000-0003-000000000001',
 '00000000-0000-0000-0000-000000000010','Please come after 10am');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin
 perform public.mark_job_ready_for_confirmation(
  (select id from public.job_bookings where quote_id='00000000-0000-0000-0003-000000000001'));
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
do $$ begin
 perform public.confirm_job_completed(
  (select id from public.job_bookings where quote_id='00000000-0000-0000-0003-000000000001'));
end $$;
insert into public.booking_reviews(booking_id,author_id,professional_id,stars,body)
select id,'00000000-0000-0000-0000-000000000010',
 '00000000-0000-0000-0000-000000000001',5,'Professional arrived on time and fixed the problem.'
from public.job_bookings;
do $$ begin
 if (select status from public.jobs where id='00000000-0000-0000-0002-000000000001')<>'completed' then
  raise exception 'Job completion not persisted';
 end if;
end $$;

do $$ begin
 if (select count(*) from public.find_trustfive_professionals_with_reviews(null,null)
 where review_count=1 and average_stars=5)<>1 then
   raise exception 'Completed-booking rating not reflected in directory';
 end if;
end $$;

-- A different professional must never view quote messages or customer details.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
 if (select count(*) from public.quote_messages)>0 then
  raise exception 'Message confidentiality broken';
 end if;
 if (select count(*) from public.job_quotes)>0 then
  raise exception 'Quote confidentiality broken';
 end if;
 begin
  perform public.review_professional_application(
   '00000000-0000-0000-0001-000000000006',true,25::smallint,20::smallint,12::smallint,12::smallint,8::smallint,4::smallint);
  raise exception 'Unauthorised admin approval succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;

-- A complaint does not automatically remove a professional or manipulate rankings.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
insert into public.booking_complaints(id,booking_id,reporter_id,respondent_id,category,statement)
select '00000000-0000-0000-0004-000000000001',b.id,
 '00000000-0000-0000-0000-000000000010',
 '00000000-0000-0000-0000-000000000001','quality',
 'There was a dispute about the quality of some repair work after the job was completed.'
from public.job_bookings b limit 1;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.respond_to_booking_complaint(
 '00000000-0000-0000-0004-000000000001',
 'I disagree with that description and can provide dated photographs of the completed work.');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',false);
select public.resolve_booking_complaint(
 '00000000-0000-0000-0004-000000000001','unsubstantiated',
 'The supplied statements did not independently substantiate the alleged workmanship issue.');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
insert into public.complaint_appeals(id,complaint_id,appellant_id,reason) values(
 '00000000-0000-0000-0005-000000000001',
 '00000000-0000-0000-0004-000000000001',
 '00000000-0000-0000-0000-000000000010',
 'The decision did not account for the additional dated correspondence I can provide.');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',false);
select public.resolve_complaint_appeal(
 '00000000-0000-0000-0005-000000000001',false,
 'After reconsidering the evidence, the appeal did not demonstrate a basis to reverse the outcome.');
do $$ begin
 if (select count(*) from public.find_trustfive_professionals(null,null))<>5 then
   raise exception 'Unsubstantiated complaint incorrectly changed active slots';
 end if;
end $$;


-- Private notifications: only recipients can read/mark their notifications.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
do $$
declare v_note uuid; v_result boolean;
begin
 if (select count(*) from public.account_notifications where kind='new_quote')<>1 then
  raise exception 'Customer quote notification missing';
 end if;
 select id into v_note from public.account_notifications where kind='new_quote' limit 1;
 perform set_config('trustfive.test_customer_notification',v_note::text,false);
 v_result:=public.mark_notification_read(v_note);
 if not v_result then raise exception 'Owner could not mark notification read'; end if;
 if not exists(select 1 from public.account_notifications
   where id=v_note and read_at is not null) then
  raise exception 'Notification read receipt not stored';
 end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$
begin
 if exists(select 1 from public.account_notifications where kind='new_quote') then
  raise exception 'Another user can read customer quote notification';
 end if;
 if public.mark_notification_read(
  current_setting('trustfive.test_customer_notification')::uuid) then
  raise exception 'Another user marked a notification read';
 end if;
end $$;

-- Community group membership and event RSVP permission checks.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
insert into public.community_groups(id,area_id,creator_id,name,description)
select '00000000-0000-0000-0006-000000000001',a.id,auth.uid(),
 'Central London gardeners','Neighbourhood group for small-space gardening and planting ideas'
from public.service_areas a where a.area_name='Central London';
do $$
begin
 if not exists(select 1 from public.community_group_memberships
  where group_id='00000000-0000-0000-0006-000000000001'
  and user_id=auth.uid() and role='owner') then
   raise exception 'Group creator membership not created';
 end if;
end $$;
insert into public.community_group_posts(id,group_id,author_id,body)
values ('00000000-0000-0000-0007-000000000001',
 '00000000-0000-0000-0006-000000000001',
 '00000000-0000-0000-0000-000000000010',
 'Come and join our weekend gardening club');

insert into public.community_events(id,area_id,host_id,title,description,venue_label,starts_at,ends_at)
select '00000000-0000-0000-0008-000000000001',a.id,auth.uid(),
 'Community planting day','Plant flowers together with neighbours at the garden','Community garden entrance',
 now()+interval '1 day',now()+interval '1 day 3 hours'
from public.service_areas a where a.area_name='Central London';

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$
begin
 if (select count(*) from public.community_group_posts)<>0 then
  raise exception 'Nonmember could read private group post';
 end if;
end $$;
insert into public.community_group_memberships(group_id,user_id,role)
values('00000000-0000-0000-0006-000000000001',
 '00000000-0000-0000-0000-000000000001','member');
insert into public.community_group_posts(group_id,author_id,body)
values('00000000-0000-0000-0006-000000000001',auth.uid(),
 'I can help with the planting plan.');
select public.set_event_response('00000000-0000-0000-0008-000000000001','going');
do $$
begin
 if not exists(select 1 from public.community_event_rsvps
  where event_id='00000000-0000-0000-0008-000000000001'
   and user_id=auth.uid() and status='going') then
  raise exception 'RSVP not recorded for account';
 end if;
 if (select count(*) from public.community_group_posts)<>2 then
  raise exception 'Member cannot see group-only posts';
 end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$
begin
 if exists(select 1 from public.community_event_rsvps) then
  raise exception 'User could view another user RSVP';
 end if;
 if exists(select 1 from public.community_group_posts) then
  raise exception 'User could view nonmember group posts';
 end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.set_event_response('00000000-0000-0000-0008-000000000001','none');
do $$
begin
 if exists(select 1 from public.community_event_rsvps where user_id=auth.uid()) then
  raise exception 'Cancellation did not remove RSVP';
 end if;
end $$;


-- Five pending offers must reserve all five slots; a sixth simultaneous promise is rejected.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',false);
do $$
declare v_trade uuid; v_area uuid; v_user uuid; v_id uuid; i int; a record;
begin
 select id into v_trade from public.trades where slug='electrical';
 select id into v_area from public.service_areas where area_name='Central London';
 for i in 1..6 loop
  v_user:=('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid;
  v_id:=('00000000-0000-0000-0009-'||lpad(i::text,12,'0'))::uuid;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  insert into public.professional_applications(id,user_id,trade_id,area_id,business_name,about)
  values(v_id,v_user,v_trade,v_area,'Electrical '||i,'Qualified electrician applying for an open place');
 end loop;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
 for a in (select id from public.professional_applications where trade_id=v_trade and area_id=v_area) loop
  perform public.review_professional_application(a.id,true,
   25::smallint,20::smallint,12::smallint,12::smallint,8::smallint,4::smallint);
 end loop;
 for i in 1..5 loop
  perform public.offer_next_professional(v_trade,v_area);
 end loop;
 if (select count(*) from public.vacancy_offers
   where trade_id=v_trade and area_id=v_area and status='offered')<>5 then
   raise exception 'Exactly five pending offers should exist';
 end if;
 begin
  perform public.offer_next_professional(v_trade,v_area);
  raise exception 'Sixth unfilled-slot offer incorrectly succeeded';
 exception when others then
  if sqlerrm='Sixth unfilled-slot offer incorrectly succeeded' then raise; end if;
  if sqlerrm not like 'No vacancy available:%' then raise; end if;
 end;
end $$;


-- A server-only signed-webhook function must deduplicate and avoid old-state overwrites.
reset role;
set role service_role;
do $$
declare first_result boolean;second_result boolean;
begin
 first_result:=public.apply_membership_stripe_event(
  'evt_trustfive_test_0001',now(),
  '00000000-0000-0000-0000-000000000001','cus_test_001','sub_test_001','active'
 );
 if first_result is not true then raise exception 'Stripe webhook first delivery was rejected'; end if;
 second_result:=public.apply_membership_stripe_event(
  'evt_trustfive_test_0001',now(),
  '00000000-0000-0000-0000-000000000001','cus_test_001','sub_test_001','active'
 );
 if second_result is not false then raise exception 'Replay was not deduplicated'; end if;
 perform public.apply_membership_stripe_event(
  'evt_trustfive_test_0002',now()-interval '1 day',
  '00000000-0000-0000-0000-000000000001','cus_test_001','sub_test_001','canceled'
 );
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$
begin
 if (select count(*) from public.business_memberships
 where subscription_status='active')<>1 then
  raise exception 'Stripe event ordering or owner membership visibility failed';
 end if;
 begin
  perform public.apply_membership_stripe_event(
   'evt_attacker_0001',now(),auth.uid(),'cus_attacker','sub_attacker','active'
  );
  raise exception 'Authenticated user was able to invoke billing webhook RPC';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$
begin
 if exists(select 1 from public.business_memberships) then
  raise exception 'Unrelated professional can read private billing status';
 end if;
end $$;

reset role;
select 'TrustFive full PostgreSQL access, billing, capacity and social workflow tests passed' as test_result;
