-- Always-fail-closed release decision: zero real-world review cannot become
-- a launch approval. SQL fixture signoffs below exist ONLY inside a rolled-back
-- test transaction and are never real legal, payment or vetting evidence.
do $tf$
begin
 if to_regprocedure('public.trustfive_admin_country_release_gate(text)') is null
    or to_regprocedure('public.record_country_release_signoff(text,text,boolean,text,text)') is null then
  raise exception 'Country release gate or review RPC missing';
 end if;
 if has_table_privilege('anon','public.country_release_signoffs','SELECT')
   or has_table_privilege('authenticated','public.country_release_signoffs','SELECT')
   or has_table_privilege('anon','public.country_release_signoffs','INSERT')
   or has_table_privilege('authenticated','public.country_release_signoffs','INSERT')
   or has_function_privilege('anon','public.record_country_release_signoff(text,text,boolean,text,text)','EXECUTE')
   or has_function_privilege('anon','public.trustfive_admin_country_release_gate(text)','EXECUTE') then
  raise exception 'Release evidence or private operations leaked to API role';
 end if;
 if not has_function_privilege('authenticated','public.trustfive_admin_country_release_gate(text)','EXECUTE') then
  raise exception 'Authorised launch reviewers cannot inspect release state';
 end if;
end $tf$;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
do $tf$
begin
 begin
  perform public.trustfive_admin_country_release_gate('GB');
  raise exception 'Non-admin could inspect private country approval state';
 exception when insufficient_privilege then null; end;
 begin
  perform public.record_country_release_signoff('GB','payments',true,
   repeat('not a real approval ',3),'Test reviewer');
  raise exception 'Non-admin could record release approval';
 exception when insufficient_privilege then null; end;
end $tf$;
rollback;

-- A client-controlled JWT payload claiming administrator status must never
-- replace the server-side admin membership check. No approval is persisted.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
select set_config('request.jwt.claims',
 '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated","app_metadata":{"role":"admin","is_admin":true},"user_metadata":{"role":"admin","is_admin":true}}',true);
do $forged_admin$
begin
 begin
  perform public.trustfive_admin_country_release_gate('GB');
  raise exception 'Forged JWT administrator claim inspected release gate';
 exception when insufficient_privilege then null; end;
 begin
  perform public.record_country_release_signoff('GB','payments',true,
   'CI FORGED CLAIM ONLY: not real release evidence','CI forged reviewer');
  raise exception 'Forged JWT administrator claim recorded release signoff';
 exception when insufficient_privilege then null; end;
end $forged_admin$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
do $tf$
declare
 gate text; status jsonb;
begin
 status:=public.trustfive_admin_country_release_gate('GB');
 if coalesce((status->>'eligibleForHumanReleaseReview')::boolean,true)
    or (status->>'productionAutomaticallyEnabled')::boolean is distinct from false then
  raise exception 'Unapproved UK country unexpectedly passed a release gate';
 end if;
 -- Fixture-only attestations exercise the review API. The entire transaction
 -- is rolled back, so none of these claims becomes real staging approval.
 foreach gate in array array[
   'legal_terms','privacy','payments','security','operational_support',
   'authenticated_acceptance'
 ] loop
  perform public.record_country_release_signoff('GB',gate,true,
   'ISOLATED CI TEST ONLY; deliberately not real proof or a review',
   'CI fixture reviewer');
 end loop;
 status:=public.trustfive_admin_country_release_gate('GB');
 if (status->>'humanApprovals')::integer<>6
    or jsonb_array_length(status->'missingApprovals')<>0 then
  raise exception 'Human evidence matrix failed to account for six test gates';
 end if;
 -- Required real reviewed boundaries and professional coverage cannot be
 -- manufactured by an unrelated legal/payment attestation.
 if (status->>'reviewedTerritories')::integer=0
    and (status->>'eligibleForHumanReleaseReview')::boolean then
  raise exception 'Fake CI attestations bypassed the geographic release gate';
 end if;
 perform public.record_country_release_signoff('GB','payments',false,
  'CI TEST ONLY: deliberately revoked payment evidence reference',
  'CI fixture reviewer');
 status:=public.trustfive_admin_country_release_gate('GB');
 if (status->>'humanApprovals')::integer<>5
    or not (status->'missingApprovals' ? 'payments')
    or (status->>'eligibleForHumanReleaseReview')::boolean then
  raise exception 'Revoked payment approval failed closed';
 end if;
end $tf$;
reset role;
do $history$
begin
 if (select count(*) from public.country_release_signoff_events
     where country_code='GB') <> 7 then
  raise exception 'Country release approval/revocation history was overwritten';
 end if;
 if (select count(*) from public.country_release_signoffs
     where country_code='GB') <> 6 then
  raise exception 'Current country release signoff state lost';
 end if;
end $history$;
rollback;

select 'Country release attestations remain private, audited and fail closed' as result;

-- History trigger and its immutable evidence table are server-owned. A forged
-- client session must not execute the trigger directly or modify audit history.
-- Catalog-only negative regression: no human approval records are read.
do $history_acl$
declare v_trigger oid; v_proc oid;
begin
 select t.oid,t.tgfoid into v_trigger,v_proc
 from pg_trigger t
 where t.tgrelid='public.country_release_signoffs'::regclass
   and t.tgname='audit_country_release_signoff_change'
   and not t.tgisinternal;
 if v_trigger is null
    or v_proc is distinct from to_regprocedure('public.log_country_release_signoff_change()')::oid then
  raise exception 'Country release history trigger missing or redirected';
 end if;
 if not (select p.prosecdef from pg_proc p where p.oid=v_proc)
    or not exists (
      select 1 from pg_proc p, unnest(coalesce(p.proconfig,array[]::text[])) c
      where p.oid=v_proc and c in ('search_path=','search_path=""')
    ) then
  raise exception 'Country release history trigger lost fixed SECURITY DEFINER path';
 end if;
 if has_function_privilege('anon',v_proc,'EXECUTE')
    or has_function_privilege('authenticated',v_proc,'EXECUTE') then
  raise exception 'Client role can execute release history trigger directly';
 end if;
 if exists (
   select 1 from (values ('anon'),('authenticated')) roles(role_name),
     (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES')) perms(priv)
   where has_table_privilege(roles.role_name,'public.country_release_signoff_events',perms.priv)
 ) then
  raise exception 'Client role gained release history table permissions';
 end if;
end $history_acl$;

-- Column ACLs are independent of whole-table ACLs. A future migration must
-- not expose reviewer identity, evidence references or release decisions via
-- per-column SELECT/INSERT/UPDATE grants, including on newly added columns.
-- Catalog-only: never inspect signoff records or claim human approval.
do $history_column_acl$
declare v_column record;
begin
 if not exists (
   select 1 from pg_class
   where oid='public.country_release_signoff_events'::regclass
     and relrowsecurity
 ) then
  raise exception 'Country release history lost row-level security';
 end if;
 for v_column in
  select attname from pg_attribute
  where attrelid='public.country_release_signoff_events'::regclass
    and attnum>0 and not attisdropped
 loop
  if has_column_privilege('anon','public.country_release_signoff_events',v_column.attname,'SELECT')
     or has_column_privilege('authenticated','public.country_release_signoff_events',v_column.attname,'SELECT')
     or has_column_privilege('anon','public.country_release_signoff_events',v_column.attname,'INSERT')
     or has_column_privilege('authenticated','public.country_release_signoff_events',v_column.attname,'INSERT')
     or has_column_privilege('anon','public.country_release_signoff_events',v_column.attname,'UPDATE')
     or has_column_privilege('authenticated','public.country_release_signoff_events',v_column.attname,'UPDATE') then
   raise exception 'Client role gained column privilege on private release history: %',v_column.attname;
  end if;
 end loop;
end $history_column_acl$;

-- Identity sequence privileges are separate from table and column grants.
-- API roles must not be able to advance, inspect or reset audit event IDs.
-- Catalog-only check; no audit evidence or customer information is read.
do $history_sequence_acl$
declare v_sequence text;
begin
 v_sequence:=pg_get_serial_sequence('public.country_release_signoff_events','id');
 if v_sequence is null then
  raise exception 'Country release audit identity sequence missing';
 end if;
 if has_sequence_privilege('anon',v_sequence,'USAGE')
    or has_sequence_privilege('anon',v_sequence,'SELECT')
    or has_sequence_privilege('anon',v_sequence,'UPDATE')
    or has_sequence_privilege('authenticated',v_sequence,'USAGE')
    or has_sequence_privilege('authenticated',v_sequence,'SELECT')
    or has_sequence_privilege('authenticated',v_sequence,'UPDATE') then
  raise exception 'Client role gained private release audit sequence privileges';
 end if;
end $history_sequence_acl$;


-- The immutable history is only useful when every INSERT and UPDATE is
-- audited. A disabled or narrowed trigger could silently erase revocations.
-- Inspect PostgreSQL trigger metadata only; never read human signoff records.
do $history_trigger_events$
declare v_enabled "char"; v_type integer;
begin
 select t.tgenabled,t.tgtype::integer into v_enabled,v_type
 from pg_trigger t
 where t.tgrelid='public.country_release_signoffs'::regclass
   and t.tgname='audit_country_release_signoff_change'
   and not t.tgisinternal;
 if not found or v_enabled not in ('O','A')
    or (v_type & 1) = 0  -- FOR EACH ROW
    or (v_type & 2) <> 0 -- AFTER, not BEFORE
    or (v_type & 4) = 0  -- INSERT
    or (v_type & 16) = 0 -- UPDATE (including approval revocation)
 then
  raise exception 'Country release audit trigger disabled or missing row-level INSERT/UPDATE coverage';
 end if;
end $history_trigger_events$;


-- A client must not mutate, truncate or reference the current human signoff
-- matrix directly. Row-level security does not protect TRUNCATE or REFERENCES,
-- and column grants can outlive a table-level revoke. Catalog-only checks.
do $signoff_acl$
declare v_role text; v_column record;
begin
 foreach v_role in array array['anon','authenticated'] loop
  if has_table_privilege(v_role,'public.country_release_signoffs','UPDATE')
     or has_table_privilege(v_role,'public.country_release_signoffs','DELETE')
     or has_table_privilege(v_role,'public.country_release_signoffs','TRUNCATE')
     or has_table_privilege(v_role,'public.country_release_signoffs','REFERENCES') then
   raise exception 'Client role % can directly modify or reference release signoffs',v_role;
  end if;
  for v_column in
   select attname from pg_attribute
   where attrelid='public.country_release_signoffs'::regclass
     and attnum>0 and not attisdropped
  loop
   if has_column_privilege(v_role,'public.country_release_signoffs',v_column.attname,'SELECT')
      or has_column_privilege(v_role,'public.country_release_signoffs',v_column.attname,'INSERT')
      or has_column_privilege(v_role,'public.country_release_signoffs',v_column.attname,'UPDATE')
      or has_column_privilege(v_role,'public.country_release_signoffs',v_column.attname,'REFERENCES') then
    raise exception 'Client role % has column access to release signoff %',v_role,v_column.attname;
   end if;
  end loop;
 end loop;
end $signoff_acl$;


-- Release signoffs must remain behind RLS even if a future migration
-- accidentally grants a table privilege. This checks metadata only and does
-- not read, create or approve any real country-release evidence.
do $signoff_rls$
begin
 if not exists (
  select 1 from pg_class
  where oid='public.country_release_signoffs'::regclass
    and relrowsecurity
 ) then
  raise exception 'Private country-release signoffs lost row-level security';
 end if;
end $signoff_rls$;


-- An audit trigger restricted by WHEN or UPDATE OF columns can silently miss
-- revocations or changes to evidence fields. Require unconditional coverage
-- of every UPDATE; catalog-only, no real release records are inspected.
do $history_unconditional$
declare v_when pg_node_tree; v_columns text;
begin
 select t.tgqual,t.tgattr::text into v_when,v_columns
 from pg_trigger t
 where t.tgrelid='public.country_release_signoffs'::regclass
   and t.tgname='audit_country_release_signoff_change'
   and not t.tgisinternal;
 if not found or v_when is not null or coalesce(trim(v_columns),'') <> '' then
  raise exception 'Country release audit trigger has a conditional or column-restricted event';
 end if;
end $history_unconditional$;


-- A future permissive RLS policy must not turn the release decision or
-- append-only audit log into client-readable/writable data. Even when table
-- grants remain revoked, reject policies targeting API roles as defense in depth.
-- Catalog-only: no country approvals or customer properties are inspected.
do $release_policy_boundary$
begin
 if exists (
  select 1
  from pg_policy p
  join pg_class c on c.oid=p.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in ('country_release_signoffs','country_release_signoff_events')
    and (
      0::oid = any(p.polroles) -- PUBLIC, including anon/authenticated
      or 'anon'::regrole::oid = any(p.polroles)
      or 'authenticated'::regrole::oid = any(p.polroles)
    )
 ) then
  raise exception 'Client-facing RLS policy added to private country release evidence';
 end if;
end $release_policy_boundary$;


-- The SECURITY DEFINER audit writer must remain owned by a server-side role.
-- An API-role owner could replace the trigger body and forge or suppress audit
-- evidence despite the existing EXECUTE revokes. Metadata-only negative test.
do $history_owner_boundary$
declare v_owner name;
begin
 select pg_get_userbyid(p.proowner) into v_owner
 from pg_proc p
 where p.oid='public.log_country_release_signoff_change()'::regprocedure;
 if v_owner is null or v_owner in ('anon','authenticated') then
  raise exception 'Private release audit writer is owned by an API client role';
 end if;
end $history_owner_boundary$;
