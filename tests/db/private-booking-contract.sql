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
