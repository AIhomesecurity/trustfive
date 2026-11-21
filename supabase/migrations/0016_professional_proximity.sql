-- Private, independently verified professional coverage points for proximity search.
-- Never expose provider/home street addresses through this table or a directory RPC.
begin;
create table public.professional_service_locations (
 application_id uuid primary key references public.professional_applications(id) on delete cascade,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 service_radius_km integer not null default 25 check(service_radius_km between 1 and 200),
 verification_note text not null check(char_length(trim(verification_note)) between 20 and 500),
 verified_at timestamptz not null default now(),
 verified_by uuid references auth.users(id)
);
alter table public.professional_service_locations enable row level security;
-- No anon/authenticated table policies: trusted admins manage coverage locations,
-- and directory users see only computed distance, not professional coordinates.
revoke all on public.professional_service_locations from anon,authenticated;

create or replace function public.find_trustfive_professionals_nearby(
 p_lat double precision,p_lon double precision,p_trade uuid default null
) returns table(
 application_id uuid,business_name text,about text,trade_name text,
 area_name text,city text,country_code char(2),
 quality_score smallint,slot smallint,average_stars numeric,review_count bigint,
 distance_km numeric
) language sql stable security definer set search_path=''
as $trustfive$
 select p.application_id,p.business_name,p.about,p.trade_name,
   p.area_name,p.city,p.country_code,p.quality_score,p.slot,
   p.average_stars,p.review_count,
   round(d.distance_km::numeric,1)
 from public.find_trustfive_professionals_with_reviews(p_trade,null) p
 join public.professional_service_locations l on l.application_id=p.application_id
 cross join lateral (
  select (6371.0088 * 2 * asin(sqrt(least(1::double precision,
    power(sin(radians(l.latitude-p_lat)/2),2)
    + cos(radians(p_lat))*cos(radians(l.latitude))
      *power(sin(radians(l.longitude-p_lon)/2),2)
  ))))::double precision as distance_km
 ) d
 where p_lat between -90 and 90 and p_lon between -180 and 180
   and d.distance_km <= l.service_radius_km
 order by d.distance_km asc,p.quality_score desc,p.review_count desc,p.business_name asc
 limit 50;
$trustfive$;
revoke all on function public.find_trustfive_professionals_nearby(double precision,double precision,uuid) from public;
grant execute on function public.find_trustfive_professionals_nearby(double precision,double precision,uuid) to anon,authenticated;
comment on function public.find_trustfive_professionals_nearby(double precision,double precision,uuid)
 is 'Approved active local professionals by approximate straight-line distance from customer-selected location, with independent quality tie-breaks. Professional coverage coordinates remain private.';
commit;
