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


-- Business-page review is a privileged mutation. An accidental PUBLIC/anon
-- grant would let unauthenticated clients reach the SECURITY DEFINER RPC;
-- even though its internal admin check currently rejects them, preserve
-- defence in depth and prevent future authorisation regressions.
do $tf$
declare
  v_review oid := to_regprocedure('public.review_business_page(uuid,boolean,text)')::oid;
  v_submit oid := to_regprocedure('public.submit_business_page(uuid)')::oid;
  v_active oid := to_regprocedure('public.is_active_approved_application(uuid)')::oid;
  v_proc oid;
begin
  if v_review is null or v_submit is null or v_active is null then
    raise exception 'Business-page privilege contract function missing';
  end if;
  if has_function_privilege('anon', v_review, 'EXECUTE')
     or has_function_privilege('anon', v_submit, 'EXECUTE') then
    raise exception 'Anonymous role can execute a business-page mutation RPC';
  end if;
  if not has_function_privilege('authenticated', v_review, 'EXECUTE')
     or not has_function_privilege('authenticated', v_submit, 'EXECUTE') then
    raise exception 'Authenticated business-page RPC permissions missing';
  end if;
  if not has_function_privilege('authenticated', v_active, 'EXECUTE') then
    raise exception 'Authenticated vetted-listing RLS helper is unavailable';
  end if;
  foreach v_proc in array array[v_review, v_submit, v_active] loop
    if not exists (
      select 1 from pg_proc p
      where p.oid=v_proc and p.prosecdef
        and exists (
          select 1 from unnest(p.proconfig) as setting
          where replace(setting, chr(34), '')='search_path='
        )
    ) then
      raise exception 'Business-page SECURITY DEFINER function % lacks pinned empty search_path', v_proc::regprocedure;
    end if;
  end loop;
end
$tf$;
