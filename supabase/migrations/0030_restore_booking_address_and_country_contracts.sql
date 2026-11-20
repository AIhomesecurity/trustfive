-- Repair installations whose migrations 0025/0029 were skipped while 0026's
-- newer consent-audit writer was applied. Do not replay 0025's older writer:
-- it would overwrite the 0026 audit trail. No user data is modified here.
begin;

alter table public.job_site_locations
 add column if not exists share_with_booked_professional boolean not null default false;

-- Disclosure remains restricted to the job customer, or to the booked
-- professional after explicit customer consent while the booking is active.
create or replace function public.booking_job_site_address(p_booking uuid)
returns table(address_label text,postcode text,sharing_enabled boolean)
language sql stable security definer set search_path=''
as $tf$
 select l.address_label,l.postcode,l.share_with_booked_professional
 from public.job_bookings b
 join public.job_site_locations l on l.job_id=b.job_id
 where b.id=p_booking and (select auth.uid()) is not null
   and (
     b.customer_id=(select auth.uid())
     or (b.professional_id=(select auth.uid())
       and b.status in ('booked','awaiting_customer')
       and l.share_with_booked_professional)
   );
$tf$;
revoke all on function public.booking_job_site_address(uuid) from public,anon;
grant execute on function public.booking_job_site_address(uuid) to authenticated;
comment on function public.booking_job_site_address(uuid)
is 'Private customer job address; booked professionals require explicit active-booking consent. No anonymous access.';

-- Only expose a country-level yes/no coverage flag. Territory polygons and
-- individual private addresses are never returned by this routine.
create or replace function public.has_verified_trustfive_territories(p_country text)
returns boolean language sql stable security definer set search_path=''
as $tf$
 select coalesce(
   char_length(coalesce(p_country,''))=2
   and exists(
     select 1 from public.verified_service_territories v
     join public.service_areas a on a.id=v.area_id
     where a.country_code=upper(p_country)
   ),false
 );
$tf$;
revoke all on function public.has_verified_trustfive_territories(text) from public,anon;
grant execute on function public.has_verified_trustfive_territories(text) to authenticated;
comment on function public.has_verified_trustfive_territories(text)
is 'Signed-in users only; boolean country coverage signal, no polygon coordinates.';

-- Narrow contract assertions catch an accidental PUBLIC/anonymous grant.
do $verify$
begin
 if has_function_privilege('anon','public.booking_job_site_address(uuid)','EXECUTE')
    or has_function_privilege('anon','public.has_verified_trustfive_territories(text)','EXECUTE')
    or not has_function_privilege('authenticated','public.booking_job_site_address(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.has_verified_trustfive_territories(text)','EXECUTE')
 then raise exception 'Private booking/territory RPC permissions are unsafe'; end if;
end;
$verify$;
commit;
