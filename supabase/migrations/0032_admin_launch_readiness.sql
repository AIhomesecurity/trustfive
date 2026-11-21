-- Read-only administrator launch gates. Return aggregate counts only, with no
-- personal identities, private property locations, evidence or geometry.
-- A green CI build or an unvetted applicant is never launch readiness.
begin;

create or replace function public.trustfive_admin_launch_readiness()
returns jsonb
language plpgsql stable security definer set search_path=''
as $tf$
declare
 v_summary jsonb;
begin
 if (select auth.uid()) is null or not public.is_trustfive_admin() then
  raise exception 'Only authorised TrustFive administrators may view readiness evidence'
    using errcode='42501';
 end if;

 select jsonb_build_object(
  'catalogueTrades',(select count(*) from public.trades),
  'configuredAreas',(select count(*) from public.service_areas),
  'reviewedTerritories',(select count(*) from public.verified_service_territories),
  'verifiedActiveAllocations',(
    select count(*) from public.active_allocations a
    join public.professional_applications app on app.id=a.application_id
    join public.professional_assessments qa on qa.application_id=app.id
    where app.status='eligible' and qa.verification_state='verified'
  ),
  'verifiedProfessionalLocations',(
    select count(*) from public.professional_service_locations l
    join public.active_allocations a on a.application_id=l.application_id
    join public.professional_applications app on app.id=a.application_id
    join public.professional_assessments qa on qa.application_id=app.id
    where app.status='eligible' and qa.verification_state='verified'
  ),
  'customerJobs',(select count(*) from public.jobs),
  'confirmedBookings',(select count(*) from public.job_bookings),
  'completedBookings',(select count(*) from public.job_bookings b where b.status='completed'),
  'publishedVerifiedReviews',(
    select count(*) from public.booking_reviews r
    where r.moderation_status='published'
  ),
  'gateSummary','Operational launch still requires independent identity vetting, verified coverage, authenticated acceptance, payment approval, legal compliance and support sign-off.'
 ) into v_summary;
 return v_summary;
end;
$tf$;

revoke all on function public.trustfive_admin_launch_readiness() from public,anon;
grant execute on function public.trustfive_admin_launch_readiness() to authenticated;
comment on function public.trustfive_admin_launch_readiness()
is 'Administrator-only aggregate readiness evidence. Counts never substitute for real professional verification or signed-off production release.';

commit;
