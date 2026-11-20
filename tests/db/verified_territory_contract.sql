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


-- Negative security contract: a reviewed polygon must not become a public
-- boundary-management or coordinate-enumeration endpoint. The territory
-- resolver is available to signed-in users only, and invalid coordinates
-- must never resolve to an area, regardless of configured country coverage.
do $tf$
declare
 v_verify oid := to_regprocedure('public.verify_service_territory(uuid,polygon,text)')::oid;
 v_resolve oid := to_regprocedure('public.resolve_trustfive_territory(text,double precision,double precision)')::oid;
begin
 if v_verify is null or v_resolve is null then
  raise exception 'Verified territory review/resolver function missing';
 end if;
 if has_table_privilege('anon','public.verified_service_territories','SELECT')
    or has_table_privilege('authenticated','public.verified_service_territories','SELECT')
    or has_table_privilege('authenticated','public.verified_service_territories','INSERT')
    or has_table_privilege('authenticated','public.verified_service_territories','UPDATE') then
  raise exception 'Reviewed territory boundaries exposed to API roles';
 end if;
 if has_function_privilege('anon',v_verify,'EXECUTE')
    or has_function_privilege('anon',v_resolve,'EXECUTE') then
  raise exception 'Anonymous role can review or enumerate verified territories';
 end if;
 if not has_function_privilege('authenticated',v_verify,'EXECUTE')
    or not has_function_privilege('authenticated',v_resolve,'EXECUTE') then
  raise exception 'Signed-in territory RPC contract missing';
 end if;
 if not exists (
  select 1 from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='job_site_locations'
    and t.tgname='enforce_verified_job_territory'
    and t.tgenabled='O' and not t.tgisinternal
 ) then
  raise exception 'Verified territory enforcement trigger is disabled';
 end if;
end
$tf$;

begin;
set local role authenticated;
do $tf$
begin
 if public.resolve_trustfive_territory('GB',91,0) is not null
    or public.resolve_trustfive_territory('GB',0,181) is not null
    or public.resolve_trustfive_territory('GB',null,0) is not null
    or public.resolve_trustfive_territory(null,0,0) is not null then
  raise exception 'Invalid or missing location unexpectedly resolved to a territory';
 end if;
end
$tf$;
rollback;


-- Harden the administrative review and point resolver contracts. Both use
-- SECURITY DEFINER to access private boundary records; neither may inherit
-- a caller-controlled search_path or permit anonymous invocation.
do $tf$
declare
 v_name text;
 v_proc oid;
begin
 foreach v_name in array array[
  'public.verify_service_territory(uuid,polygon,text)',
  'public.resolve_trustfive_territory(text,double precision,double precision)'
 ] loop
  v_proc := to_regprocedure(v_name)::oid;
  if v_proc is null then
   raise exception 'Missing verified territory RPC: %',v_name;
  end if;
  if not exists (
   select 1 from pg_proc p where p.oid=v_proc and p.prosecdef
    and exists (
     select 1 from unnest(p.proconfig) setting
     where replace(setting,chr(34),'')='search_path='
    )
  ) then
   raise exception 'Territory RPC lacks restricted SECURITY DEFINER search_path: %',v_name;
  end if;
  if has_function_privilege('anon',v_proc,'EXECUTE') then
   raise exception 'Territory RPC anonymously executable: %',v_name;
  end if;
 end loop;
 if not exists (
  select 1 from pg_proc
  where oid=to_regprocedure('public.resolve_trustfive_territory(text,double precision,double precision)')::oid
   and provolatile='s'
 ) then
  raise exception 'Territory resolver must remain STABLE';
 end if;
end
$tf$;
