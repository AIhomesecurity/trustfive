-- Country-scoped launch readiness is evidence-based and cannot be inferred
-- from a green build, a seed service area, or a successful Stripe test call.
-- A human administrator records the outcome of an independent review.
begin;

create table if not exists public.country_release_signoffs (
 country_code text not null check(country_code ~ '^[A-Z]{2}$'),
 gate text not null check(gate in (
  'legal_terms','privacy','payments','security','operational_support',
  'authenticated_acceptance'
 )),
 approved boolean not null,
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 30 and 1000),
 reviewer_name text not null check(char_length(btrim(reviewer_name)) between 3 and 120),
 recorded_by uuid not null references auth.users(id),
 recorded_at timestamptz not null default now(),
 primary key(country_code,gate)
);
alter table public.country_release_signoffs enable row level security;
revoke all on public.country_release_signoffs from public,anon,authenticated;
comment on table public.country_release_signoffs is
 'Restricted launch attestations; only authorised human administrators can record an independent review. Never contains customer identities, property details, payment keys or raw evidence.';

create or replace function public.record_country_release_signoff(
 p_country text,p_gate text,p_approved boolean,p_evidence_reference text,p_reviewer_name text
) returns boolean language plpgsql security definer set search_path=''
as $tf$
declare v_country text:=upper(btrim(coalesce(p_country,'')));
begin
 if (select auth.uid()) is null or not public.is_trustfive_admin() then
  raise exception 'Only TrustFive administrators can record independent release decisions'
    using errcode='42501';
 end if;
 if v_country !~ '^[A-Z]{2}$'
    or p_gate is null or p_gate not in (
     'legal_terms','privacy','payments','security','operational_support',
     'authenticated_acceptance'
    )
    or p_approved is null
    or char_length(btrim(coalesce(p_evidence_reference,''))) not between 30 and 1000
    or char_length(btrim(coalesce(p_reviewer_name,''))) not between 3 and 120 then
  raise exception 'Country, gate, decision, reviewer and independent evidence reference are required'
    using errcode='22023';
 end if;
 if not exists(select 1 from public.service_areas a where a.country_code=v_country) then
  raise exception 'Country has no configured TrustFive service area' using errcode='22023';
 end if;
 insert into public.country_release_signoffs
  (country_code,gate,approved,evidence_reference,reviewer_name,recorded_by,recorded_at)
 values (v_country,p_gate,p_approved,btrim(p_evidence_reference),
         btrim(p_reviewer_name),(select auth.uid()),now())
 on conflict(country_code,gate) do update
 set approved=excluded.approved,evidence_reference=excluded.evidence_reference,
     reviewer_name=excluded.reviewer_name,recorded_by=excluded.recorded_by,
     recorded_at=excluded.recorded_at;
 return true;
end;
$tf$;
revoke all on function public.record_country_release_signoff(text,text,boolean,text,text)
 from public,anon;
grant execute on function public.record_country_release_signoff(text,text,boolean,text,text)
 to authenticated;

create or replace function public.trustfive_admin_country_release_gate(p_country text)
returns jsonb language plpgsql stable security definer set search_path=''
as $tf$
declare
 v_country text:=upper(btrim(coalesce(p_country,'')));
 v_boundaries integer;
 v_vetted integer;
 v_signoffs integer;
 v_missing jsonb;
begin
 if (select auth.uid()) is null or not public.is_trustfive_admin() then
  raise exception 'Only TrustFive administrators can inspect release decisions'
    using errcode='42501';
 end if;
 if v_country !~ '^[A-Z]{2}$' then
  raise exception 'Valid two-letter country code required' using errcode='22023';
 end if;
 select count(*) into v_boundaries
 from public.verified_service_territories t
 join public.service_areas a on a.id=t.area_id
 where a.country_code=v_country;

 select count(*) into v_vetted
 from public.active_allocations alloc
 join public.service_areas a on a.id=alloc.area_id
 join public.verified_service_territories territory on territory.area_id=a.id
 join public.professional_applications app on app.id=alloc.application_id
 join public.professional_assessments qa on qa.application_id=app.id
 join public.professional_service_locations loc on loc.application_id=app.id
 where a.country_code=v_country and app.status='eligible'
   and qa.verification_state='verified';

 select count(*) into v_signoffs
 from public.country_release_signoffs s
 where s.country_code=v_country and s.approved;

 select coalesce(jsonb_agg(g.gate order by g.gate),'[]'::jsonb)
 into v_missing from (
  select unnest(array[
   'legal_terms','privacy','payments','security','operational_support',
   'authenticated_acceptance'
  ]) as gate
 ) g
 where not exists(
  select 1 from public.country_release_signoffs s
  where s.country_code=v_country and s.gate=g.gate and s.approved
 );

 return jsonb_build_object(
  'countryCode',v_country,
  'reviewedTerritories',v_boundaries,
  'verifiedProfessionalsWithServiceLocations',v_vetted,
  'humanApprovals',v_signoffs,
  'missingApprovals',v_missing,
  'eligibleForHumanReleaseReview',(v_boundaries>0 and v_vetted>0 and v_signoffs=6),
  'productionAutomaticallyEnabled',false
 );
end;
$tf$;
revoke all on function public.trustfive_admin_country_release_gate(text) from public,anon;
grant execute on function public.trustfive_admin_country_release_gate(text) to authenticated;
comment on function public.trustfive_admin_country_release_gate(text) is
 'Evidence-based administrator-only release report; not a deployment or live payment switch.';

do $tf$
begin
 if has_table_privilege('anon','public.country_release_signoffs','SELECT')
    or has_table_privilege('authenticated','public.country_release_signoffs','SELECT')
    or has_function_privilege('anon','public.trustfive_admin_country_release_gate(text)','EXECUTE')
    or has_function_privilege('anon','public.record_country_release_signoff(text,text,boolean,text,text)','EXECUTE')
 then raise exception 'Launch evidence inadvertently exposed to API roles'; end if;
end;
$tf$;
commit;
