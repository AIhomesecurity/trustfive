-- Never accept a manually selected territory that contradicts independently
-- verified geographic boundaries. Preserve legacy fallback until an area has
-- reviewed coverage, rather than inventing polygons.
begin;
create or replace function public.enforce_verified_job_territory()
returns trigger language plpgsql security definer set search_path=''
as $tf$
declare v_area uuid; v_country text; v_resolved uuid;
begin
 select j.area_id,a.country_code into v_area,v_country
 from public.jobs j join public.service_areas a on a.id=j.area_id
 where j.id=new.job_id;
 if v_area is null then raise exception 'Job has no valid service territory'; end if;
 if upper(new.country_code)<>v_country then
  raise exception 'Job-site country does not match territory';
 end if;
 if exists(
  select 1 from public.verified_service_territories v
  join public.service_areas a on a.id=v.area_id
  where a.country_code=v_country
 ) then
  v_resolved:=public.resolve_trustfive_territory(new.country_code,new.latitude,new.longitude);
  if v_resolved is null then
   raise exception 'This location is not yet covered by a verified TrustFive territory';
  end if;
  if v_resolved<>v_area then
   raise exception 'The selected territory does not match the verified job-site location';
  end if;
 end if;
 return new;
end
$tf$;
revoke all on function public.enforce_verified_job_territory() from public,anon,authenticated;
drop trigger if exists enforce_verified_job_territory on public.job_site_locations;
create trigger enforce_verified_job_territory before insert or update
on public.job_site_locations for each row
execute function public.enforce_verified_job_territory();
commit;