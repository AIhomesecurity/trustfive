-- Nationwide customer/professional interest is NOT an approved TradeFive
-- territory or vetted active slot. All fixtures are transaction-rolled-back.
do $tf$
begin
 if to_regclass('public.uk_area_interest_requests') is null then
  raise exception 'Nationwide area interest table missing';
 end if;
 if has_table_privilege('anon','public.uk_area_interest_requests','SELECT')
    or has_table_privilege('anon','public.uk_area_interest_requests','INSERT')
    or has_table_privilege('authenticated','public.uk_area_interest_requests','UPDATE')
    or has_table_privilege('authenticated','public.uk_area_interest_requests','DELETE') then
  raise exception 'Coverage request table has unsafe client grants';
 end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='uk_area_interest_requests'
    and c.relrowsecurity) then
  raise exception 'Coverage interest table lost RLS';
 end if;
end $tf$;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
do $tf$
declare
 v_trade uuid; v_areas_before integer; v_slots_before integer;
begin
 select id into v_trade from public.trades where slug='plumbing';
 select count(*) into v_areas_before from public.service_areas;
 select count(*) into v_slots_before from public.active_allocations;
 insert into public.uk_area_interest_requests(user_id,outcode,requested_role,status)
 values ('00000000-0000-0000-0000-000000000010','BT1','customer','pending');
 if not exists(select 1 from public.uk_area_interest_requests where outcode='BT1'
    and user_id='00000000-0000-0000-0000-000000000010') then
  raise exception 'Signed-in user could not see their own UK coverage request';
 end if;
 begin
  insert into public.uk_area_interest_requests(user_id,outcode,requested_role,trade_id,status)
  values ('00000000-0000-0000-0000-000000000010','CF10','professional',v_trade,'verified');
  raise exception 'Customer self-approved UK territory interest';
 exception when insufficient_privilege or check_violation then null; end;
 begin
  insert into public.uk_area_interest_requests(user_id,outcode,requested_role,trade_id,status)
  values ('00000000-0000-0000-0000-000000000099','G1','professional',v_trade,'pending');
  raise exception 'User inserted another persons coverage request';
 exception when insufficient_privilege or check_violation then null; end;
 if (select count(*) from public.service_areas)<>v_areas_before
    or (select count(*) from public.active_allocations)<>v_slots_before then
  raise exception 'Pending postcode interest somehow created a territory or active professional slot';
 end if;
end $tf$;
rollback;
select 'UK national pending-area interest ACLs passed' as result;
