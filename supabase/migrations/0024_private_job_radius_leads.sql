-- Restrict private-location job leads to verified operating radii.
-- Preserve legacy area-only jobs during migration; these have no private job-site row.
-- IMPORTANT: verified territory polygon assignment is a separate P0 requirement.
begin;

create or replace function public.can_quote_on_job(p_job uuid,p_allocation uuid)
returns boolean language sql stable security definer set search_path=''
as $trustfive$
 select exists(
  select 1 from public.jobs j
  join public.active_allocations a on a.trade_id=j.trade_id and a.area_id=j.area_id
  join public.professional_applications app on app.id=a.application_id
  join public.professional_assessments assess on assess.application_id=app.id
  where j.id=p_job and a.id=p_allocation and j.status='open'
    and app.user_id=(select auth.uid()) and app.status='eligible'
    and assess.verification_state='verified'
    and (
      not exists(select 1 from public.job_site_locations jl where jl.job_id=j.id)
      or exists(
        select 1 from public.job_site_locations jl
        join public.professional_service_locations pl on pl.application_id=app.id
        where jl.job_id=j.id
          and (6371.0088 * 2 * asin(sqrt(least(1::double precision,
            power(sin(radians(pl.latitude-jl.latitude)/2),2)
            + cos(radians(jl.latitude))*cos(radians(pl.latitude))
              * power(sin(radians(pl.longitude-jl.longitude)/2),2)
          )))) <= pl.service_radius_km
      )
    )
 );
$trustfive$;
revoke all on function public.can_quote_on_job(uuid,uuid) from public,anon;
grant execute on function public.can_quote_on_job(uuid,uuid) to authenticated;

create or replace function public.open_jobs_for_professional()
returns table(
 job_id uuid,title text,description text,budget_pence bigint,
 trade_name text,area_name text,allocation_id uuid,created_at timestamptz
) language sql stable security definer set search_path=''
as $trustfive$
 select j.id,j.title,j.description,j.budget_pence,t.name,s.area_name,a.id,j.created_at
 from public.jobs j
 join public.active_allocations a on a.trade_id=j.trade_id and a.area_id=j.area_id
 join public.professional_applications ap on ap.id=a.application_id
 join public.professional_assessments qa on qa.application_id=ap.id
 join public.trades t on t.id=j.trade_id
 join public.service_areas s on s.id=j.area_id
 where ap.user_id=(select auth.uid()) and ap.status='eligible'
   and qa.verification_state='verified' and j.status='open'
   and (
     not exists(select 1 from public.job_site_locations jl where jl.job_id=j.id)
     or exists(
       select 1 from public.job_site_locations jl
       join public.professional_service_locations pl on pl.application_id=ap.id
       where jl.job_id=j.id
         and (6371.0088 * 2 * asin(sqrt(least(1::double precision,
           power(sin(radians(pl.latitude-jl.latitude)/2),2)
           + cos(radians(jl.latitude))*cos(radians(pl.latitude))
             * power(sin(radians(pl.longitude-jl.longitude)/2),2)
         )))) <= pl.service_radius_km
     )
   )
 order by j.created_at desc limit 100;
$trustfive$;
revoke all on function public.open_jobs_for_professional() from public,anon;
grant execute on function public.open_jobs_for_professional() to authenticated;

comment on function public.open_jobs_for_professional()
is 'Returns area-approved leads; private-address jobs additionally require independently verified operating-radius coverage. Does not expose full job-site address or coordinates. Legacy jobs without locations retain area-only matching.';
commit;
