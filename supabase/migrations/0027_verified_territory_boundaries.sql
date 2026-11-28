-- Phase one: human-reviewed geographic territory boundaries and exact point lookup.
-- No synthetic regional boundaries are installed. Cities/postcodes alone are not
-- evidence of membership in a particular five-slot territory.
begin;
create table public.verified_service_territories (
 area_id uuid primary key references public.service_areas(id) on delete cascade,
 boundary polygon not null,
 evidence_note text not null check (char_length(btrim(evidence_note)) between 30 and 1000),
 verified_by uuid not null references auth.users(id),
 verified_at timestamptz not null default now(),
 check (npoints(boundary)>=3)
);
alter table public.verified_service_territories enable row level security;
revoke all on public.verified_service_territories from anon,authenticated;

create or replace function public.verify_service_territory(
 p_area uuid,p_boundary polygon,p_evidence text
) returns void language plpgsql security definer set search_path=''
as $tf$
begin
 if not public.is_trustfive_admin() then
  raise exception 'Only verified TrustFive administrators may register territory boundaries'
   using errcode='42501';
 end if;
 if not exists(select 1 from public.service_areas where id=p_area) then
  raise exception 'Unknown TrustFive territory';
 end if;
 if p_boundary is null or npoints(p_boundary)<3
   or char_length(btrim(coalesce(p_evidence,''))) not between 30 and 1000 then
  raise exception 'Provide a valid boundary and documented independent evidence';
 end if;
 -- Single global lock serializes boundary reviews. Reject even bounding-box
 -- overlap conservatively; this can reject some non-overlapping irregular shapes.
 perform pg_advisory_xact_lock(50321019);
 if exists (
   select 1 from public.verified_service_territories v
   where v.area_id<>p_area and v.boundary && p_boundary
 ) then
   raise exception 'Boundary overlaps an existing TrustFive territory bounding box';
 end if;
 insert into public.verified_service_territories(area_id,boundary,evidence_note,verified_by,verified_at)
 values(p_area,p_boundary,btrim(p_evidence),(select auth.uid()),now())
 on conflict(area_id) do update set
  boundary=excluded.boundary,evidence_note=excluded.evidence_note,
  verified_by=excluded.verified_by,verified_at=excluded.verified_at;
end;
$tf$;
revoke all on function public.verify_service_territory(uuid,polygon,text) from public,anon;
grant execute on function public.verify_service_territory(uuid,polygon,text) to authenticated;

create or replace function public.resolve_trustfive_territory(
 p_country text,p_lat double precision,p_lon double precision
) returns uuid language sql stable security definer set search_path=''
as $tf$
 select case when count(*)=1 then (array_agg(a.id))[1] else null::uuid end
 from public.verified_service_territories v
 join public.service_areas a on a.id=v.area_id
 where p_country is not null and upper(p_country)=a.country_code
   and p_lat between -90 and 90 and p_lon between -180 and 180
   and point(p_lon,p_lat) <@ v.boundary;
$tf$;
revoke all on function public.resolve_trustfive_territory(text,double precision,double precision) from public,anon;
grant execute on function public.resolve_trustfive_territory(text,double precision,double precision) to authenticated;
comment on function public.resolve_trustfive_territory(text,double precision,double precision)
is 'Maps a valid point to exactly one independently reviewed polygon, otherwise returns NULL; no guesses from city or postcode. Boundary data remains restricted.';
commit;