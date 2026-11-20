-- Read-only regression assertions for verified territory enforcement.
-- Run against migrated staging or the isolated CI integration database.
do $tf$
begin
 if not exists(
  select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='job_site_locations'
   and t.tgname='enforce_verified_job_territory' and not t.tgisinternal
 ) then raise exception 'Job-site territory enforcement trigger missing'; end if;
 if not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='enforce_verified_job_territory'
   and p.prosecdef and not has_function_privilege('anon',p.oid,'EXECUTE')
   and not has_function_privilege('authenticated',p.oid,'EXECUTE')
 ) then raise exception 'Private enforcement function is missing or publicly callable'; end if;
 if not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='resolve_trustfive_territory'
   and has_function_privilege('authenticated',p.oid,'EXECUTE')
   and not has_function_privilege('anon',p.oid,'EXECUTE')
 ) then raise exception 'Verified territory resolver permissions incorrect'; end if;
end
$tf$;
select 'Verified territory contract checks passed' as result;

-- Country-coverage signal added in migration 0029 must not expose boundaries
-- or become an anonymous enumeration endpoint. This is a read-only contract
-- test; it intentionally does not depend on any particular country being seeded.
do $tf$
declare v_proc oid;
begin
 select to_regprocedure('public.has_verified_trustfive_territories(text)')::oid into v_proc;
 if v_proc is null then
  raise exception 'Country coverage helper missing';
 end if;
 if not (select prosecdef from pg_proc where oid=v_proc) then
  raise exception 'Country coverage helper must use controlled SECURITY DEFINER context';
 end if;
 -- A SECURITY DEFINER helper must never inherit the caller's search_path:
 -- a writable schema earlier in the path could shadow unqualified objects.
 if not exists (
  select 1 from pg_proc
  where oid=v_proc and exists (
   select 1 from unnest(proconfig) as setting
   where replace(setting, chr(34), '')='search_path='
  )
 ) then
  raise exception 'Country coverage helper must pin an empty search_path';
 end if;
 if not exists (
  select 1 from pg_proc where oid=v_proc and provolatile='s'
 ) then
  raise exception 'Country coverage helper must remain STABLE (read-only contract)';
 end if;
 -- The anon role inherits PUBLIC privileges; testing anon also catches
 -- accidentally granted PUBLIC execution. PUBLIC is not a named SQL role.
 if has_function_privilege('anon',v_proc,'EXECUTE') then
  raise exception 'Country coverage helper exposed to anonymous callers';
 end if;
 if not has_function_privilege('authenticated',v_proc,'EXECUTE') then
  raise exception 'Authenticated customers cannot query country coverage';
 end if;
end
$tf$;

begin;
set local role authenticated;
do $tf$
begin
 if public.has_verified_trustfive_territories(null) is distinct from false
    or public.has_verified_trustfive_territories('') is distinct from false
    or public.has_verified_trustfive_territories('GBR') is distinct from false then
  raise exception 'Malformed country code unexpectedly has coverage';
 end if;
end
$tf$;
rollback;
