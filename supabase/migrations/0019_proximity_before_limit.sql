-- Rank from the entire eligible professional network BEFORE applying result limits.
-- The original generic directory RPC limits to 50 records globally, which would
-- otherwise discard nearer professionals when the service expands worldwide.
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
 select ap.id,coalesce(nullif(ap.business_name,''),'TrustFive professional'),
  ap.about,t.name,s.area_name,s.city,s.country_code,q.quality_score,
  a.slot,coalesce(rv.average_stars,0),coalesce(rv.review_count,0),
  round(d.distance_km::numeric,1)
 from public.professional_service_locations l
 join public.active_allocations a on a.application_id=l.application_id
 join public.professional_applications ap on ap.id=a.application_id
 join public.professional_assessments q on q.application_id=ap.id
 join public.trades t on t.id=a.trade_id
 join public.service_areas s on s.id=a.area_id
 left join lateral (
  select round(avg(r.stars)::numeric,2) average_stars,count(*)::bigint review_count
  from public.booking_reviews r
  where r.professional_id=ap.user_id and r.moderation_status='published'
 ) rv on true
 cross join lateral (
  select (6371.0088*2*asin(sqrt(least(1::double precision,
    power(sin(radians(l.latitude-p_lat)/2),2)
    +cos(radians(p_lat))*cos(radians(l.latitude))
      *power(sin(radians(l.longitude-p_lon)/2),2)
  ))))::double precision distance_km
 ) d
 where p_lat between -90 and 90 and p_lon between -180 and 180
   and ap.status='eligible' and q.verification_state='verified'
   and (p_trade is null or a.trade_id=p_trade)
   and d.distance_km<=l.service_radius_km
 order by
   (least(d.distance_km/25.0,1.0)*0.55)
   +((100.0-q.quality_score)/100.0*0.35)
   +(case when coalesce(rv.review_count,0)>0
     then ((5.0-coalesce(rv.average_stars,0))/5.0)*0.10 else 0.05 end) asc,
   d.distance_km asc,q.quality_score desc,coalesce(rv.review_count,0) desc,
   coalesce(nullif(ap.business_name,''),'TrustFive professional') asc
 limit 50;
$trustfive$;
revoke all on function public.find_trustfive_professionals_nearby(double precision,double precision,uuid) from public;
grant execute on function public.find_trustfive_professionals_nearby(double precision,double precision,uuid) to anon,authenticated;
commit;
