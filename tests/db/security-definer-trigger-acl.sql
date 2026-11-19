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
