-- P0 "review remaining SECURITY DEFINER grants individually" contract.
-- Pins the complete EXECUTE privilege matrix for every SECURITY DEFINER
-- function in the public schema. Read-only catalogue assertions: no fixtures,
-- no role switches and no data mutation, so it is safe in any CI order.
-- Run with psql -v ON_ERROR_STOP=1 after bootstrap + all migrations.

-- 1. Anonymous callers may execute exactly four read-only helpers ----------
-- These are the deliberate public discovery surface and the boolean gate
-- used by public business-page RLS. Any new anon-executable definer function
-- must be added here explicitly, so a silent privilege escalation fails CI.
do $anon_allowlist$
declare
  expected text[] := array[
    'find_trustfive_professionals',
    'find_trustfive_professionals_nearby',
    'find_trustfive_professionals_with_reviews',
    'is_active_approved_application'];
  actual text[];
  v_unstable integer;
begin
  select array_agg(distinct p.proname order by p.proname) into actual
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and has_function_privilege('anon',p.oid,'EXECUTE');
  if actual is distinct from expected then
    raise exception 'Unexpected anon-executable SECURITY DEFINER set: % (expected %)',actual,expected;
  end if;

  -- Every anon-reachable definer must be a side-effect-free read (STABLE or
  -- IMMUTABLE). A VOLATILE helper would let anonymous visitors mutate data
  -- through a SECURITY DEFINER boundary.
  select count(*) into v_unstable
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and has_function_privilege('anon',p.oid,'EXECUTE')
    and p.provolatile not in ('s','i');
  if v_unstable>0 then
    raise exception '% anonymous SECURITY DEFINER helpers are volatile',v_unstable;
  end if;
end
$anon_allowlist$;

-- 2. No SECURITY DEFINER function is executable through PUBLIC -------------
-- anon inherits PUBLIC privileges. A blanket GRANT ... TO PUBLIC would give
-- every client role (and any future role) access to privileged functions.
do $public_grants$
declare v_bad integer;
begin
  select count(*) into v_bad
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and has_function_privilege('public',p.oid,'EXECUTE');
  if v_bad>0 then
    raise exception '% SECURITY DEFINER functions are executable by PUBLIC',v_bad;
  end if;
end
$public_grants$;

-- 3. SECURITY DEFINER trigger functions are never client-executable --------
-- Triggers must fire only from their owning table operations, never as RPCs.
do $trigger_grants$
declare v_bad integer;
begin
  select count(*) into v_bad
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and p.prorettype in ('pg_catalog.trigger'::regtype,'pg_catalog.event_trigger'::regtype)
    and (has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE')
      or has_function_privilege('public',p.oid,'EXECUTE'));
  if v_bad>0 then
    raise exception '% SECURITY DEFINER trigger functions are client-executable',v_bad;
  end if;
end
$trigger_grants$;

-- 4. Billing webhook RPC stays service-role-only ---------------------------
-- It writes membership state from Stripe events and must never be callable
-- from a browser, even by a signed-in customer.
do $billing_grant$
declare v_fn oid;
begin
  select p.oid into v_fn
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='apply_membership_stripe_event';
  if v_fn is null then raise exception 'Billing webhook RPC is missing'; end if;
  if has_function_privilege('anon',v_fn,'EXECUTE')
     or has_function_privilege('authenticated',v_fn,'EXECUTE') then
    raise exception 'Billing webhook RPC is executable by a client role';
  end if;
  if not has_function_privilege('service_role',v_fn,'EXECUTE') then
    raise exception 'Billing webhook RPC lost its service_role EXECUTE grant';
  end if;
end
$billing_grant$;

-- 5. The four anon helpers are also available to signed-in users ----------
-- Public directory and business-page reads must work in both auth states.
do $auth_helpers$
declare v_missing integer;
begin
  select count(*) into v_missing
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and p.proname in ('find_trustfive_professionals',
                      'find_trustfive_professionals_with_reviews',
                      'find_trustfive_professionals_nearby',
                      'is_active_approved_application')
    and not has_function_privilege('authenticated',p.oid,'EXECUTE');
  if v_missing>0 then
    raise exception '% public helpers are not executable by authenticated users',v_missing;
  end if;
end
$auth_helpers$;

select 'Security DEFINER grant matrix passed' as result;
