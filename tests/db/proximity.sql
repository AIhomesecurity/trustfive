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
reset role;
rollback;
