-- Independent quality scores and customer-facing verified-booking star ratings.
-- Public scores NEVER depend on subscription payments or advertising.
begin;
create or replace function public.find_trustfive_professionals_with_reviews(
 p_trade uuid default null,p_area uuid default null
) returns table(
 application_id uuid,business_name text,about text,trade_name text,
 area_name text,city text,country_code char(2),
 quality_score smallint,slot smallint,average_stars numeric,review_count bigint
) language sql stable security definer set search_path=''
as $$
 select ap.id,coalesce(nullif(ap.business_name,''),'TrustFive professional'),
   ap.about,t.name,s.area_name,s.city,s.country_code,qa.quality_score,
   a.slot,coalesce(rv.average_stars,0),coalesce(rv.review_count,0)
 from public.active_allocations a
 join public.professional_applications ap on ap.id=a.application_id
 join public.professional_assessments qa on qa.application_id=ap.id
 join public.trades t on t.id=a.trade_id
 join public.service_areas s on s.id=a.area_id
 left join (
   select r.professional_id,
     round(avg(r.stars)::numeric,2) as average_stars,
     count(*)::bigint as review_count
   from public.booking_reviews r where r.moderation_status='published'
   group by r.professional_id
 ) rv on rv.professional_id=ap.user_id
 where ap.status='eligible' and qa.verification_state='verified'
   and (p_trade is null or a.trade_id=p_trade)
   and (p_area is null or a.area_id=p_area)
 order by qa.quality_score desc,ap.submitted_at asc limit 50;
$$;
revoke all on function public.find_trustfive_professionals_with_reviews(uuid,uuid) from public;
grant execute on function public.find_trustfive_professionals_with_reviews(uuid,uuid) to anon,authenticated;
commit;