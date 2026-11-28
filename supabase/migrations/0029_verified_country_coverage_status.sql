-- Let authenticated customers distinguish an unsupported country from a
-- country with reviewed territories that do not cover their location.
-- Returns a boolean only; never exposes restricted boundary coordinates.
begin;
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
is 'Boolean coverage-configuration signal for signed-in customer UX, without revealing territory geometry.';
commit;
