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
