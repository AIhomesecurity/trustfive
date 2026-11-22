-- Protect consent-based booking address disclosure and operating-radius leads.
-- These checks catch partial staging migration deployments and accidental
-- replay of 0025's older consent writer after 0026's audited version.
do $tf$
declare
 v_consent_writer text;
 v_quote_gate text;
 v_lead_gate text;
begin
 if not exists (
   select 1 from pg_attribute a
   join pg_class c on c.oid=a.attrelid
   join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='job_site_locations'
     and a.attname='share_with_booked_professional'
     and a.attnotnull and not a.attisdropped
 ) then raise exception 'Job address consent column missing or nullable'; end if;

 if to_regprocedure('public.booking_job_site_address(uuid)') is null
    or to_regprocedure('public.has_verified_trustfive_territories(text)') is null then
  raise exception 'Booking address/country coverage RPC contract missing';
 end if;
 if has_function_privilege('anon','public.booking_job_site_address(uuid)','EXECUTE')
    or has_function_privilege('anon','public.has_verified_trustfive_territories(text)','EXECUTE') then
  raise exception 'Private address or coverage RPC anonymously executable';
 end if;
 if not has_function_privilege('authenticated','public.booking_job_site_address(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.has_verified_trustfive_territories(text)','EXECUTE') then
  raise exception 'Authenticated booking or coverage RPC missing';
 end if;

 v_consent_writer:=lower(pg_get_functiondef('public.set_booking_address_sharing(uuid,boolean)'::regprocedure));
 if position('booking_address_consent_events' in v_consent_writer)=0
    or position('p_allow is null' in v_consent_writer)=0 then
  raise exception 'Address consent writer no longer records audited explicit choice';
 end if;

 v_quote_gate:=lower(pg_get_functiondef('public.can_quote_on_job(uuid,uuid)'::regprocedure));
 v_lead_gate:=lower(pg_get_functiondef('public.open_jobs_for_professional()'::regprocedure));
 if position('professional_service_locations' in v_quote_gate)=0
    or position('professional_service_locations' in v_lead_gate)=0 then
  raise exception 'Private-location leads or quote acceptance lost verified radius filtering';
 end if;
 if has_function_privilege('anon','public.open_jobs_for_professional()','EXECUTE') then
  raise exception 'Private job lead RPC accessible anonymously';
 end if;
end
$tf$;


-- Negative privilege regression: neither the consent mutator nor the
-- customer-only location reader may be exposed to anonymous callers.
-- This checks grants without ever selecting real customer property values.
do $tf$
declare v_signature text; v_proc oid;
begin
 foreach v_signature in array array[
  'public.set_booking_address_sharing(uuid,boolean)',
  'public.customer_job_site_location(uuid)'
 ] loop
  v_proc := to_regprocedure(v_signature)::oid;
  if v_proc is null then
   raise exception 'Private booking function missing: %',v_signature;
  end if;
  if has_function_privilege('anon',v_proc,'EXECUTE') then
   raise exception 'Anonymous execution granted on private booking function: %',v_signature;
  end if;
  if not has_function_privilege('authenticated',v_proc,'EXECUTE') then
   raise exception 'Authenticated private booking function grant missing: %',v_signature;
  end if;
 end loop;
end
$tf$;

-- Nobody can obtain a private job-site address without an authorised
-- booking/customer context; do not seed test users as genuine professionals.
begin;
set local role authenticated;
do $tf$
begin
 if exists(select 1 from public.booking_job_site_address('00000000-0000-0000-0000-000000000000'::uuid)) then
  raise exception 'Unknown booking unexpectedly revealed an address';
 end if;
end
$tf$;
rollback;
select 'Private booking address and radius contracts passed' as result;

-- Consent revocation must be enforced at address-read time, not merely when
-- a booking is first created. A later migration must not let professionals
-- see an address after the customer disables sharing or the booking closes.
-- Inspect function definition only; never select customer property values.
do $tf$
declare v_reader text;
begin
 v_reader := lower(pg_get_functiondef('public.booking_job_site_address(uuid)'::regprocedure));
 if position('share_with_booked_professional' in v_reader)=0
    or position('b.professional_id' in v_reader)=0
    or position('b.customer_id' in v_reader)=0
    or position('b.status' in v_reader)=0
    or position('awaiting_customer' in v_reader)=0
    or position('booked' in v_reader)=0
    or position('auth.uid()' in v_reader)=0 then
  raise exception 'Booking address reader lost live consent, booking-status or identity gate';
 end if;
end
$tf$;


-- A signed-in database role without a real auth.uid() must not receive a
-- customer-owned private address, even if a job UUID is supplied. This uses
-- an impossible fixture identifier and reads no actual customer address.
begin;
set local role authenticated;
do $tf$
begin
 if exists (
  select 1 from public.customer_job_site_location(
   '00000000-0000-0000-0000-000000000000'::uuid
  )
 ) then
  raise exception 'Unauthenticated customer context exposed private job-site data';
 end if;
end
$tf$;
rollback;

-- A role grant alone is not a signed-in identity. The booked-professional
-- reader must return no address with auth.uid() absent, even for a supplied
-- booking identifier. This uses no customer/property records or seeded users.
begin;
set local role authenticated;
do $tf$
begin
 if exists (
  select 1 from public.booking_job_site_address(
   '00000000-0000-0000-0000-000000000000'::uuid
  )
 ) then
  raise exception 'Missing auth identity exposed booked job-site address';
 end if;
end
$tf$;
rollback;

-- Consent audit rows reveal booking/customer relationships and sharing decisions.
-- They must remain server-only even if an authenticated client guesses an ID.
-- Check catalog permissions without selecting any private or audit records.
do $tf$
begin
 if not exists (
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='booking_address_consent_events'
    and c.relkind='r' and c.relrowsecurity
 ) then
  raise exception 'Booking consent audit table missing or RLS disabled';
 end if;
 if has_table_privilege('anon','public.booking_address_consent_events','SELECT')
    or has_table_privilege('authenticated','public.booking_address_consent_events','SELECT')
    or has_table_privilege('anon','public.booking_address_consent_events','INSERT')
    or has_table_privilege('authenticated','public.booking_address_consent_events','INSERT')
    or has_table_privilege('anon','public.booking_address_consent_events','UPDATE')
    or has_table_privilege('authenticated','public.booking_address_consent_events','UPDATE')
    or has_table_privilege('anon','public.booking_address_consent_events','DELETE')
    or has_table_privilege('authenticated','public.booking_address_consent_events','DELETE')
    or has_table_privilege('anon','public.booking_address_consent_events','TRUNCATE')
    or has_table_privilege('authenticated','public.booking_address_consent_events','TRUNCATE') then
  raise exception 'Client role has direct access to private booking consent audit';
 end if;
end
$tf$;

-- A consent writer must authorise the actual customer on each invocation.
-- Definition-only regression: no customer records or addresses are queried.
do $tf$
declare v_writer text;
begin
 v_writer := lower(pg_get_functiondef('public.set_booking_address_sharing(uuid,boolean)'::regprocedure));
 if position('auth.uid()' in v_writer)=0
    or position('customer_id' in v_writer)=0 then
  raise exception 'Booking consent writer lost authenticated customer ownership gate';
 end if;
end
$tf$;

-- Regression: property coordinates remain behind row-level security even
-- when a future migration changes address RPC grants. Catalog-only check.
do $tf$
begin
 if not exists (
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='job_site_locations'
    and c.relkind='r' and c.relrowsecurity
 ) then
  raise exception 'Private job-site location table missing or RLS disabled';
 end if;
end
$tf$;

-- Negative privilege regression: the consent writer executes with elevated
-- privileges, so it must keep a fixed empty search_path to prevent object
-- shadowing through caller-controlled schemas. Catalog-only, no private data.
do $tf$
declare v_proc oid; v_config text[];
begin
 v_proc := to_regprocedure('public.set_booking_address_sharing(uuid,boolean)')::oid;
 if v_proc is null then
  raise exception 'Audited booking consent writer missing';
 end if;
 select p.proconfig into v_config from pg_proc p where p.oid=v_proc;
 if not (select p.prosecdef from pg_proc p where p.oid=v_proc) then
  raise exception 'Booking consent writer lost SECURITY DEFINER contract';
 end if;
 -- PostgreSQL serialises an empty GUC as either search_path= or
 -- search_path="" depending on server/catalog formatting. Both mean an
 -- explicitly fixed empty path; no schema names may be present.
 if not (coalesce('search_path=' = any(v_config),false)
         or coalesce('search_path=""' = any(v_config),false)) then
  raise exception 'Booking consent writer must use empty fixed search_path';
 end if;
end
$tf$;

-- Negative table-ACL regression: client roles must not be able to truncate
-- private customer coordinates or create foreign-key references to them.
-- PostgreSQL TRUNCATE bypasses row-level security; REFERENCES could allow
-- schema-level relationships to private address records. Catalog only.
do $tf$
begin
 if has_table_privilege('anon','public.job_site_locations','TRUNCATE')
    or has_table_privilege('authenticated','public.job_site_locations','TRUNCATE')
    or has_table_privilege('anon','public.job_site_locations','REFERENCES')
    or has_table_privilege('authenticated','public.job_site_locations','REFERENCES') then
  raise exception 'Client role has unsafe TRUNCATE or REFERENCES grant on private job-site locations';
 end if;
end
$tf$;

-- Negative ACL regression: audit event rows must not be referenced by
-- client-created foreign keys. REFERENCES is independent of RLS and can
-- expose relationship existence through constraint behavior. Metadata only.
do $tf$
begin
 if has_table_privilege('anon','public.booking_address_consent_events','REFERENCES')
    or has_table_privilege('authenticated','public.booking_address_consent_events','REFERENCES') then
  raise exception 'Client role can reference private booking consent audit';
 end if;
end
$tf$;


-- Negative execution regression: a database role named authenticated is not
-- sufficient to mutate customer consent without a real auth.uid(). The writer
-- must fail before inspecting any booking or customer property data.
-- No fixtures, private address reads or persistent writes are involved.
begin;
set local role authenticated;
do $tf$
declare v_denied boolean := false;
begin
 begin
  perform public.set_booking_address_sharing(
   '00000000-0000-0000-0000-000000000000'::uuid, false
  );
 exception when sqlstate '42501' then
  v_denied := true;
 end;
 if not v_denied then
  raise exception 'Consent revocation accepted a missing authenticated identity';
 end if;
end
$tf$;
rollback;

-- A missing signed-in identity must also be unable to GRANT sharing.
-- Revocation-only checks do not catch asymmetric authorization mistakes
-- where consent=true takes a different path. Impossible UUID; no data reads.
begin;
set local role authenticated;
do $tf$
declare v_denied boolean := false;
begin
 begin
  perform public.set_booking_address_sharing(
   '00000000-0000-0000-0000-000000000000'::uuid, true
  );
 exception when sqlstate '42501' then
  v_denied := true;
 end;
 if not v_denied then
  raise exception 'Consent grant accepted a missing authenticated identity';
 end if;
end
$tf$;
rollback;

-- Column-level grants can expose consent audit fields even when table-level
-- privileges are revoked. Inspect ACLs only, without reading audit records.
do $tf$
declare v_column record;
begin
 for v_column in
  select a.attname
  from pg_attribute a
  where a.attrelid='public.booking_address_consent_events'::regclass
    and a.attnum > 0 and not a.attisdropped
 loop
  if has_column_privilege('anon','public.booking_address_consent_events',v_column.attname,'SELECT')
     or has_column_privilege('authenticated','public.booking_address_consent_events',v_column.attname,'SELECT')
     or has_column_privilege('anon','public.booking_address_consent_events',v_column.attname,'UPDATE')
     or has_column_privilege('authenticated','public.booking_address_consent_events',v_column.attname,'UPDATE') then
   raise exception 'Client role has column-level access to private consent audit: %',v_column.attname;
  end if;
 end loop;
end
$tf$;

-- Column-level INSERT privileges can bypass a revoked table-level INSERT
-- grant. The consent audit must remain writable only through its audited
-- server-side function, including for columns added by later migrations.
-- Catalog-only regression: never read private consent events.
do $tf$
declare v_column record;
begin
 for v_column in
  select a.attname
  from pg_attribute a
  where a.attrelid='public.booking_address_consent_events'::regclass
    and a.attnum > 0 and not a.attisdropped
 loop
  if has_column_privilege('anon','public.booking_address_consent_events',v_column.attname,'INSERT')
     or has_column_privilege('authenticated','public.booking_address_consent_events',v_column.attname,'INSERT') then
   raise exception 'Client role has column-level INSERT on private consent audit: %',v_column.attname;
  end if;
 end loop;
end
$tf$;

-- The consent audit is private even if all grants and RLS remain intact:
-- table ownership lets a client role alter ACLs or disable RLS outright.
-- Catalog-only negative regression; no customer addresses or audit rows read.
do $consent_audit_owner$
declare v_owner oid;
begin
 select c.relowner into v_owner
 from pg_class c
 where c.oid='public.booking_address_consent_events'::regclass;
 if v_owner is null or v_owner in ('anon'::regrole::oid,'authenticated'::regrole::oid) then
  raise exception 'Private booking consent audit is owned by a client API role';
 end if;
end $consent_audit_owner$;

-- A client role must not inherit or SET ROLE to the privileged consent writer
-- owner. Such membership would permit replacing the SECURITY DEFINER body
-- and bypassing consent revocation checks. Catalog-only; no address reads.
do $consent_writer_owner_membership$
declare v_owner oid; v_role text;
begin
 select p.proowner into v_owner
 from pg_proc p
 where p.oid=to_regprocedure('public.set_booking_address_sharing(uuid,boolean)');
 if v_owner is null then
  raise exception 'Audited consent writer missing';
 end if;
 foreach v_role in array array['anon','authenticated'] loop
  if pg_has_role(v_role,v_owner,'MEMBER')
     or pg_has_role(v_role,v_owner,'USAGE') then
   raise exception 'API role % can inherit or assume privileged consent writer owner',v_role;
  end if;
 end loop;
end $consent_writer_owner_membership$;


-- The booked-address reader runs with elevated privileges. Neither API
-- role may own its function or assume the owning role, even if EXECUTE
-- grants and live consent predicates remain correct. Catalog only.
do $booking_reader_owner_membership$
declare v_owner oid; v_role text;
begin
 select p.proowner into v_owner
 from pg_proc p
 where p.oid=to_regprocedure('public.booking_job_site_address(uuid)');
 if v_owner is null then
  raise exception 'Privileged booking address reader missing';
 end if;
 foreach v_role in array array['anon','authenticated'] loop
  if pg_has_role(v_role,v_owner,'MEMBER')
     or pg_has_role(v_role,v_owner,'USAGE') then
   raise exception 'API role % can own or assume booking address reader owner',v_role;
  end if;
 end loop;
end $booking_reader_owner_membership$;


-- RLS and column grants cannot protect exact customer coordinates when a
-- client API role owns the table: owners can alter grants and disable RLS.
-- Catalog-only negative regression, never selects any private property data.
do $private_site_owner$
declare v_owner oid; v_role text;
begin
 select c.relowner into v_owner
 from pg_class c
 where c.oid='public.job_site_locations'::regclass;
 if v_owner is null then
  raise exception 'Private job-site locations table missing';
 end if;
 foreach v_role in array array['anon','authenticated'] loop
  if pg_has_role(v_role,v_owner,'MEMBER')
     or pg_has_role(v_role,v_owner,'USAGE') then
   raise exception 'API role % can own or assume private job-site locations owner',v_role;
  end if;
 end loop;
end $private_site_owner$;
