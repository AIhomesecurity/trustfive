-- Executed after the TrustFive end-to-end database fixture creates real
-- approved test applications. Transaction prevents any test persistence.
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',false);

select public.verify_professional_service_location(
 '00000000-0000-0000-0001-000000000001'::uuid,51.5010,-0.1420,25,
 'Independent reviewer checked the operating location and documented reasonable travel coverage.'
);

do $trustfive$
declare v_count integer;v_distance numeric;v_trade uuid;
begin
 select id into v_trade from public.trades where slug='plumbing';
 select count(*),min(distance_km) into v_count,v_distance
 from public.find_trustfive_professionals_nearby(51.5010,-0.1420,v_trade);
 if v_count<1 or v_distance is null or v_distance>0.1 then
  raise exception 'Verified nearby professionals were not ranked near their coverage point';
 end if;
 if exists(select 1 from public.find_trustfive_professionals_nearby(40.7128,-74.0060,v_trade)) then
  raise exception 'Coverage radius did not exclude professionals thousands of kilometres away';
 end if;
end;
$trustfive$;

set role anon;
do $trustfive$
begin
 begin
  perform 1 from public.professional_service_locations;
  raise exception 'Anonymous user could read restricted professional coordinates';
 exception when insufficient_privilege then null;
 end;
end;
$trustfive$;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $trustfive$
begin
 begin
  perform public.verify_professional_service_location(
   '00000000-0000-0000-0001-000000000001'::uuid,51.6,-0.15,25,
   'An unauthorised professional should never alter another business service location.'
  );
  raise exception 'Nonadmin modified professional coverage coordinates';
 exception when insufficient_privilege then null;
 end;
end;
$trustfive$;

-- New private-location leads must be visible/quotable only inside verified radius.
-- Both jobs deliberately retain the legacy territory so this tests radius, not
-- the still-pending validated coordinate-to-territory mapping.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',false);
do $radius_leads$
declare v_trade uuid;v_area uuid;v_near uuid;v_far uuid;
begin
 select id into v_trade from public.trades where slug='plumbing';
 select id into v_area from public.service_areas where area_name='Central London';
 v_near:=public.create_job_with_private_location(
  'Nearby test repair','Fix a small leak at the nearby fixture property.',
  v_trade,v_area,12000,'10 Test Street, London, SW1A 2AA',
  'SW1A 2AA','GB',51.5034,-0.1276,'address');
 v_far:=public.create_job_with_private_location(
  'Far away test repair','Fix a small leak at the distant fixture property.',
  v_trade,v_area,12000,'100 Test Street, North London',
  null,'GB',51.9000,-0.1200,'address');
 perform set_config('trustfive.radius_near_job',v_near::text,false);
 perform set_config('trustfive.radius_far_job',v_far::text,false);
end $radius_leads$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $radius_leads$
declare v_near uuid:=current_setting('trustfive.radius_near_job')::uuid;
        v_far uuid:=current_setting('trustfive.radius_far_job')::uuid;
        v_allocation uuid;
begin
 select a.id into v_allocation
 from public.active_allocations a
 join public.professional_applications ap on ap.id=a.application_id
 where ap.user_id=auth.uid() and ap.id='00000000-0000-0000-0001-000000000001'::uuid;
 if v_allocation is null then raise exception 'Fixture lacks approved professional allocation'; end if;
 if not public.can_quote_on_job(v_near,v_allocation) then
  raise exception 'Verified provider cannot quote on nearby private-location job';
 end if;
 if public.can_quote_on_job(v_far,v_allocation) then
  raise exception 'Provider can quote beyond independently verified coverage';
 end if;
 if not exists(select 1 from public.open_jobs_for_professional() where job_id=v_near) then
  raise exception 'Nearby private job is missing from eligible provider leads';
 end if;
 if exists(select 1 from public.open_jobs_for_professional() where job_id=v_far) then
  raise exception 'Out-of-radius private job leaked into provider leads';
 end if;
end $radius_leads$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $radius_leads$
begin
 if exists(select 1 from public.open_jobs_for_professional()
           where job_id=current_setting('trustfive.radius_near_job')::uuid) then
  raise exception 'Unapproved professional can see private-location lead';
 end if;
end $radius_leads$;

reset role;
rollback;
