-- Adjust nearby results to use proximity, independently assessed quality, and
-- actual completed-booking reviews. No paid promotions or fabricated ratings.
begin;
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
   p.average_stars,p.review_count,round(d.distance_km::numeric,1)
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
 -- Lower is better. Normalised capped distance contributes 55%, independently
 -- assessed quality 35%, genuine completed-booking rating 10%. Unreviewed
 -- businesses get neutral 50% of the rating component (not a fake rating).
 order by
   (least(d.distance_km/25.0,1.0)*0.55)
   + ((100.0-p.quality_score)/100.0*0.35)
   + (case when p.review_count>0 then ((5.0-p.average_stars)/5.0)*0.10 else 0.05 end)
   asc,
   d.distance_km asc,p.quality_score desc,p.review_count desc,p.business_name asc
 limit 50;
$trustfive$;
revoke all on function public.find_trustfive_professionals_nearby(double precision,double precision,uuid) from public;
grant execute on function public.find_trustfive_professionals_nearby(double precision,double precision,uuid) to anon,authenticated;
commit;
