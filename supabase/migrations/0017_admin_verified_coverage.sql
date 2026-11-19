-- Only authorised human reviewers may verify a professional's approximate
-- service coverage point. A customer's exact address is never written here.
begin;
create or replace function public.verify_professional_service_location(
 p_application uuid,p_lat double precision,p_lon double precision,
 p_radius_km integer,p_verification_note text
) returns void language plpgsql security definer set search_path=''
as $trustfive$
begin
 if auth.uid() is null or not public.is_trustfive_admin() then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 if p_lat is null or p_lon is null or not (p_lat between -90 and 90)
   or not (p_lon between -180 and 180) then
  raise exception 'Invalid verified service coordinates';
 end if;
 if p_radius_km is null or p_radius_km not between 1 and 200 then
  raise exception 'Service radius must be 1 to 200 km';
 end if;
 if char_length(trim(coalesce(p_verification_note,''))) not between 20 and 500 then
  raise exception 'Document independent verification evidence (20–500 characters)';
 end if;
 if not public.is_active_approved_application(p_application) then
  raise exception 'Only actively approved businesses can receive verified service coverage';
 end if;
 insert into public.professional_service_locations
   (application_id,latitude,longitude,service_radius_km,verification_note,verified_at,verified_by)
 values (p_application,p_lat,p_lon,p_radius_km,trim(p_verification_note),now(),auth.uid())
 on conflict(application_id) do update set
  latitude=excluded.latitude,longitude=excluded.longitude,
  service_radius_km=excluded.service_radius_km,
  verification_note=excluded.verification_note,
  verified_at=now(),verified_by=auth.uid();
 insert into public.network_audit_events(actor_id,action,application_id,detail)
 values(auth.uid(),'service_location_verified',p_application,
  jsonb_build_object('service_radius_km',p_radius_km,'verification_updated',true));
end;
$trustfive$;
revoke all on function public.verify_professional_service_location(uuid,double precision,double precision,integer,text) from public,anon;
grant execute on function public.verify_professional_service_location(uuid,double precision,double precision,integer,text) to authenticated;
commit;
