-- Launch evidence is admin-only and must never reveal identity, customer
-- addresses, territory polygon geometry, applicant evidence or API secrets.
do $tf$
declare v_oid oid:=to_regprocedure('public.trustfive_admin_launch_readiness()')::oid;
begin
 if v_oid is null then raise exception 'Launch evidence RPC missing';end if;
 if has_function_privilege('anon',v_oid,'EXECUTE') then
  raise exception 'Launch evidence visible to anonymous visitors';
 end if;
 if not has_function_privilege('authenticated',v_oid,'EXECUTE') then
  raise exception 'Launch evidence RPC unavailable to authorised signed-in admin';
 end if;
 if not exists (
  select 1 from pg_proc p where p.oid=v_oid and p.prosecdef
   and exists (
    select 1 from unnest(p.proconfig) s
    where replace(s,chr(34),'')='search_path='
   )
 ) then raise exception 'Launch readiness privileged SQL path not pinned';end if;
end
$tf$;

begin;
set local role authenticated;
do $tf$
declare v_rejected boolean:=false;
begin
 begin
  perform public.trustfive_admin_launch_readiness();
 exception when insufficient_privilege then v_rejected:=true;
 end;
 if not v_rejected then
  raise exception 'Signed-in non-admin was able to view private readiness aggregates';
 end if;
end
$tf$;
rollback;

select 'Launch readiness admin authorization contract passed' as result;
