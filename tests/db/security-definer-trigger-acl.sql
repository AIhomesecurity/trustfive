-- Public API roles must never invoke internal SECURITY DEFINER trigger helpers.
-- Their PostgreSQL trigger execution is separate from direct EXECUTE privileges.
do $$
declare exposed integer;
begin
  select count(*) into exposed
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.prosecdef
    and p.prorettype in ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)
    and (
      has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE')
    );
  if exposed > 0 then
    raise exception 'Unsafe publicly executable SECURITY DEFINER triggers: %', exposed;
  end if;
end;
$$;

-- Public business listings must remain queryable under anon RLS even though
-- their approval predicate is implemented as a SECURITY DEFINER helper.
-- The helper returns only a boolean; do not expose applicant private fields.
do $$
begin
 if not has_function_privilege('anon',
  'public.is_active_approved_application(uuid)','EXECUTE') then
  raise exception 'Anonymous business page RLS helper cannot execute';
 end if;
end $$;

begin;
set local role anon;
do $$
declare visible_count bigint;
begin
 select count(*) into visible_count from public.professional_business_pages;
 if visible_count < 0 then raise exception 'Impossible public count'; end if;
end $$;
rollback;
