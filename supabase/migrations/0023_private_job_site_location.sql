-- Customer job-site locations are private and cannot be queried by public directory users.
-- Exact address selection is never included in job descriptions or professional search RPCs.
begin;
create table public.job_site_locations (
 job_id uuid primary key references public.jobs(id) on delete cascade,
 address_label text not null check(char_length(trim(address_label)) between 5 and 250),
 postcode text,
 country_code text not null check(char_length(country_code)=2),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 precision text not null check(precision in ('address','postcode')),
 created_at timestamptz not null default now()
);
alter table public.job_site_locations enable row level security;
revoke all on public.job_site_locations from anon,authenticated;
-- A narrow owner-only RPC permits retrieval without giving professionals raw addresses.
create or replace function public.customer_job_site_location(p_job uuid)
returns table(address_label text,postcode text,country_code text,location_precision text)
language sql stable security definer set search_path=''
as $tf$
 select l.address_label,l.postcode,l.country_code,l.precision
 from public.job_site_locations l join public.jobs j on j.id=l.job_id
 where j.id=p_job and j.customer_id=(select auth.uid())
$tf$;
revoke all on function public.customer_job_site_location(uuid) from public,anon;
grant execute on function public.customer_job_site_location(uuid) to authenticated;

create or replace function public.create_job_with_private_location(
 p_title text,p_description text,p_trade uuid,p_area uuid,p_budget_pence bigint,
 p_address text,p_postcode text,p_country text,p_lat double precision,
 p_lon double precision,p_precision text
) returns uuid language plpgsql security definer set search_path=''
as $tf$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if char_length(trim(coalesce(p_title,''))) not between 5 and 120
   or char_length(trim(coalesce(p_description,''))) not between 15 and 3000 then
  raise exception 'Enter a valid job title and description';
 end if;
 if p_trade is null or not exists(select 1 from public.trades where id=p_trade)
   or p_area is null or not exists(select 1 from public.service_areas where id=p_area) then
  raise exception 'Select a valid trade and TrustFive territory';
 end if;
 if p_budget_pence is not null and (p_budget_pence<0 or p_budget_pence>1000000000) then
  raise exception 'Invalid job budget';
 end if;
 if char_length(trim(coalesce(p_address,''))) not between 5 and 250
   or p_lat is null or p_lon is null or p_lat not between -90 and 90
   or p_lon not between -180 and 180 or p_precision not in ('address','postcode')
   or char_length(coalesce(p_country,''))<>2 then
  raise exception 'Select a valid suggested job-site address';
 end if;
 if upper(p_country)<>(select country_code from public.service_areas where id=p_area) then
  raise exception 'Job address country does not match selected territory';
 end if;
 insert into public.jobs(customer_id,title,description,trade_id,area_id,budget_pence,status)
 values(auth.uid(),trim(p_title),trim(p_description),p_trade,p_area,p_budget_pence,'open')
 returning id into v_id;
 insert into public.job_site_locations(job_id,address_label,postcode,country_code,latitude,longitude,precision)
 values(v_id,trim(p_address),nullif(trim(coalesce(p_postcode,'')),''),upper(p_country),p_lat,p_lon,p_precision);
 return v_id;
end
$tf$;
revoke all on function public.create_job_with_private_location(text,text,uuid,uuid,bigint,text,text,text,double precision,double precision,text) from public,anon;
grant execute on function public.create_job_with_private_location(text,text,uuid,uuid,bigint,text,text,text,double precision,double precision,text) to authenticated;
commit;
