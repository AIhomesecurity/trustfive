-- Synthetic, transactional regression ONLY. Never apply this fixture to live
-- staging or production: no real geography or approved providers are created.
-- It tests the same admin RPC that the boundary-review screen invokes.
begin;

insert into auth.users(id,raw_user_meta_data) values
 ('00000000-0000-0000-00d0-000000000001','{"full_name":"Fixture Admin","requested_role":"customer"}'),
 ('00000000-0000-0000-00d0-000000000002','{"full_name":"Fixture Outsider","requested_role":"customer"}');

insert into public.platform_admins(user_id)
values ('00000000-0000-0000-00d0-000000000001');

insert into public.service_areas(id,country_code,city,area_name)
values
 ('00000000-0000-0000-00d1-000000000001','ZZ','CI Fixture City','CI Polygon A'),
 ('00000000-0000-0000-00d1-000000000002','ZZ','CI Fixture City','CI Polygon B');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-00d0-000000000002',true);
do $tf$
declare denied boolean:=false;
begin
 begin
  perform public.verify_service_territory(
    '00000000-0000-0000-00d1-000000000001'::uuid,
    '((1,1),(3,1),(3,3),(1,3))'::polygon,
    'Test-only boundary; this is not real verification evidence.');
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then raise exception 'Outsider registered a territory';end if;
end
$tf$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-00d0-000000000001',true);
select public.verify_service_territory(
 '00000000-0000-0000-00d1-000000000001'::uuid,
 '((1,1),(3,1),(3,3),(1,3))'::polygon,
 'Isolated CI fixture only: synthetic sample polygon with reviewed test evidence.');

do $tf$
declare
 v_area uuid:='00000000-0000-0000-00d1-000000000001';
 v_rejected boolean:=false;
begin
 if public.resolve_trustfive_territory('ZZ',2,2) is distinct from v_area then
  raise exception 'Reviewed territory did not resolve inside its polygon';
 end if;
 if public.resolve_trustfive_territory('ZZ',6,6) is not null then
  raise exception 'Outside location resolved to an unrelated area';
 end if;
 if public.has_verified_trustfive_territories('ZZ') is not true then
  raise exception 'Country coverage flag did not reflect reviewed polygon';
 end if;
 begin
  perform public.verify_service_territory(
    '00000000-0000-0000-00d1-000000000002'::uuid,
    '((2,2),(4,2),(4,4),(2,4))'::polygon,
    'Isolated CI fixture only: overlapping synthetic territory, expect rejection.');
 exception when others then
  if sqlerrm like 'Boundary overlaps%' then v_rejected:=true;
  else raise;end if;
 end;
 if not v_rejected then
  raise exception 'Overlapping reviewed territories were accepted';
 end if;
end
$tf$;

reset role;
rollback;

select 'Territory reviewer, overlap and point-matching contracts passed' as result;
