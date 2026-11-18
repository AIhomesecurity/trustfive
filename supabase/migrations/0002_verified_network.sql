-- TrustFive marketplace foundations: apply AFTER 0001_core.sql.
-- Security note: professional approval, slot allocation and admin assignment
-- are not client-controlled. Only authorised humans may grant admin status.
begin;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create or replace function public.is_trustfive_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.platform_admins where user_id = (select auth.uid())); $$;
revoke all on function public.is_trustfive_admin() from public, anon;
grant execute on function public.is_trustfive_admin() to authenticated;

alter table public.professional_applications
  add column if not exists business_name text,
  add column if not exists about text,
  add column if not exists experience_years integer check (experience_years between 0 and 80);
create unique index if not exists application_one_per_person_trade_area
  on public.professional_applications(user_id, trade_id, area_id);

drop policy if exists "submit own applications" on public.professional_applications;
create policy "professional applications can be submitted" on public.professional_applications
for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'pending'
  and exists (select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.requested_role = 'professional')
);
create policy "admins read professional applications" on public.professional_applications
for select to authenticated using ((select public.is_trustfive_admin()));

create table if not exists public.professional_assessments (
  application_id uuid primary key references public.professional_applications(id) on delete cascade,
  verification_state text not null default 'pending'
    check (verification_state in ('pending','verified','expired','failed')),
  -- Each category has a fixed maximum; score is never related to payment.
  satisfaction smallint not null default 0 check (satisfaction between 0 and 30),
  workmanship smallint not null default 0 check (workmanship between 0 and 25),
  reliability smallint not null default 0 check (reliability between 0 and 15),
  compliance smallint not null default 0 check (compliance between 0 and 15),
  communication smallint not null default 0 check (communication between 0 and 10),
  complaint_history smallint not null default 0 check (complaint_history between 0 and 5),
  quality_score smallint generated always as
    (satisfaction + workmanship + reliability + compliance + communication + complaint_history) stored,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  next_review_at timestamptz
);
alter table public.professional_assessments enable row level security;
create policy "admins review assessments" on public.professional_assessments
for select to authenticated using ((select public.is_trustfive_admin()));

create table if not exists public.network_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  application_id uuid references public.professional_applications(id),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.network_audit_events enable row level security;
create policy "admins read network audits" on public.network_audit_events
for select to authenticated using ((select public.is_trustfive_admin()));

create table if not exists public.vacancy_offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.professional_applications(id),
  trade_id uuid not null references public.trades(id),
  area_id uuid not null references public.service_areas(id),
  status text not null default 'offered'
    check (status in ('offered','accepted','declined','expired','consumed')),
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  answered_at timestamptz
);
create unique index if not exists only_one_open_offer_per_application
on public.vacancy_offers(application_id) where status in ('offered','accepted');
alter table public.vacancy_offers enable row level security;
create policy "applicant reads own offers" on public.vacancy_offers for select
to authenticated using (exists (select 1 from public.professional_applications app
where app.id = application_id and app.user_id = (select auth.uid())));
create policy "admin reads vacancy offers" on public.vacancy_offers for select
to authenticated using ((select public.is_trustfive_admin()));

-- An administrator must have verified real evidence OUTSIDE this function
-- before marking an application eligible. It does not perform external checks.
create or replace function public.review_professional_application(
  p_application uuid, p_verified boolean,
  p_satisfaction smallint, p_workmanship smallint, p_reliability smallint,
  p_compliance smallint, p_communication smallint, p_complaint_history smallint
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_trustfive_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  perform 1 from public.professional_applications where id = p_application for update;
  if not found then raise exception 'Application not found'; end if;
  if p_verified and (p_satisfaction + p_workmanship + p_reliability +
     p_compliance + p_communication + p_complaint_history < 70 or p_compliance < 10) then
    raise exception 'Verified approval requires a score of at least 70 and compliance >= 10';
  end if;
  if not p_verified and exists(select 1 from public.active_allocations
     where application_id=p_application) then
    raise exception 'Document deactivation and remove active slot before rejecting';
  end if;
  insert into public.professional_assessments(
    application_id,verification_state,satisfaction,workmanship,reliability,
    compliance,communication,complaint_history,reviewed_by,reviewed_at
  ) values(
    p_application,case when p_verified then 'verified' else 'failed' end,
    p_satisfaction,p_workmanship,p_reliability,p_compliance,p_communication,
    p_complaint_history,auth.uid(),now()
  ) on conflict (application_id) do update set
    verification_state=excluded.verification_state,satisfaction=excluded.satisfaction,
    workmanship=excluded.workmanship,reliability=excluded.reliability,
    compliance=excluded.compliance,communication=excluded.communication,
    complaint_history=excluded.complaint_history,reviewed_by=excluded.reviewed_by,
    reviewed_at=excluded.reviewed_at;
  update public.professional_applications
    set status = case when p_verified then 'eligible' else 'rejected' end
    where id = p_application;
  insert into public.network_audit_events(actor_id,action,application_id,detail)
    values(auth.uid(),'application_reviewed',p_application,
      jsonb_build_object('verification_passed',p_verified));
end $$;
revoke all on function public.review_professional_application(uuid,boolean,smallint,smallint,smallint,smallint,smallint,smallint) from public,anon;
grant execute on function public.review_professional_application(uuid,boolean,smallint,smallint,smallint,smallint,smallint,smallint) to authenticated;

create or replace function public.offer_next_professional(p_trade uuid,p_area uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_app uuid; v_offer uuid;
begin
  if not public.is_trustfive_admin() then
    raise exception 'Not authorised' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_trade::text || ':' || p_area::text,0));
  if (select count(*) from public.active_allocations where trade_id=p_trade and area_id=p_area) >= 5 then
    raise exception 'No vacancy available';
  end if;
  select a.id into v_app from public.professional_applications a
  join public.professional_assessments q on q.application_id=a.id
  where a.trade_id=p_trade and a.area_id=p_area
    and a.status='eligible' and q.verification_state='verified'
    and not exists(select 1 from public.active_allocations s where s.application_id=a.id)
    and not exists(select 1 from public.vacancy_offers o where o.application_id=a.id
      and (o.status='accepted' or (o.status='offered' and o.expires_at>now())))
  order by q.quality_score desc,a.submitted_at asc,a.id asc
  limit 1;
  if v_app is null then raise exception 'No eligible waiting-list applicant'; end if;
  -- Historical expired offers cannot hold applicants off the waiting list forever.
  update public.vacancy_offers set status='expired'
    where application_id=v_app and status='offered' and expires_at <= now();
  insert into public.vacancy_offers(application_id,trade_id,area_id)
    values(v_app,p_trade,p_area) returning id into v_offer;
  insert into public.network_audit_events(actor_id,action,application_id,detail)
    values(auth.uid(),'vacancy_offered',v_app,jsonb_build_object('offer_id',v_offer));
  return v_offer;
end $$;
revoke all on function public.offer_next_professional(uuid,uuid) from public,anon;
grant execute on function public.offer_next_professional(uuid,uuid) to authenticated;

create or replace function public.respond_to_vacancy_offer(p_offer uuid,p_accept boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_offer public.vacancy_offers%rowtype;
begin
  select * into v_offer from public.vacancy_offers where id=p_offer for update;
  if not found or not exists (
    select 1 from public.professional_applications
     where id=v_offer.application_id and user_id=auth.uid()
  ) then raise exception 'Offer not found or not authorised' using errcode='42501'; end if;
  if v_offer.status <> 'offered' or v_offer.expires_at <= now() then
    raise exception 'Offer has expired or has been answered';
  end if;
  update public.vacancy_offers
    set status=case when p_accept then 'accepted' else 'declined' end,answered_at=now()
    where id=p_offer;
  insert into public.network_audit_events(actor_id,action,application_id,detail)
    values(auth.uid(),'vacancy_answered',v_offer.application_id,
      jsonb_build_object('accepted',p_accept));
end $$;
revoke all on function public.respond_to_vacancy_offer(uuid,boolean) from public,anon;
grant execute on function public.respond_to_vacancy_offer(uuid,boolean) to authenticated;

-- A accepted offer is required; payment data is not part of eligibility.
create or replace function public.activate_professional(p_application uuid)
returns smallint language plpgsql security definer set search_path = ''
as $$
declare v_trade uuid;v_area uuid;v_slot smallint;v_offer uuid;
begin
  if not public.is_trustfive_admin() then
    raise exception 'Not authorised' using errcode='42501';
  end if;
  select trade_id,area_id into v_trade,v_area
    from public.professional_applications where id=p_application and status='eligible';
  if v_trade is null then raise exception 'Application is not eligible'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_trade::text || ':' || v_area::text,0));
  if exists(select 1 from public.active_allocations where application_id=p_application) then
    raise exception 'Application already active';
  end if;
  if not exists(select 1 from public.professional_assessments
    where application_id=p_application and verification_state='verified') then
    raise exception 'Verification incomplete';
  end if;
  select id into v_offer from public.vacancy_offers
    where application_id=p_application and trade_id=v_trade and area_id=v_area
      and status='accepted' and expires_at>now()
    order by offered_at desc limit 1 for update;
  if v_offer is null then raise exception 'Accepted, unexpired offer required'; end if;
  select g.slot into v_slot from generate_series(1,5) as g(slot)
    where not exists(select 1 from public.active_allocations x
      where x.trade_id=v_trade and x.area_id=v_area and x.slot=g.slot)
    order by g.slot limit 1;
  if v_slot is null then raise exception 'No free slot'; end if;
  insert into public.active_allocations(application_id,trade_id,area_id,slot)
    values(p_application,v_trade,v_area,v_slot);
  update public.vacancy_offers set status='consumed' where id=v_offer;
  insert into public.network_audit_events(actor_id,action,application_id,detail)
    values(auth.uid(),'professional_activated',p_application,jsonb_build_object('slot',v_slot));
  return v_slot;
end $$;
revoke all on function public.activate_professional(uuid) from public,anon;
grant execute on function public.activate_professional(uuid) to authenticated;

create or replace function public.deactivate_professional(p_application uuid,p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_trade uuid; v_area uuid;
begin
  if not public.is_trustfive_admin() then
    raise exception 'Not authorised' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,''))) < 15 then
    raise exception 'An evidence-based removal reason is required';
  end if;
  select trade_id,area_id into v_trade,v_area from public.active_allocations
    where application_id=p_application;
  if v_trade is null then raise exception 'Active allocation not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_trade::text || ':' || v_area::text,0));
  delete from public.active_allocations where application_id=p_application;
  insert into public.network_audit_events(actor_id,action,application_id,detail)
    values(auth.uid(),'professional_deactivated',p_application,jsonb_build_object('reason',p_reason));
end $$;
revoke all on function public.deactivate_professional(uuid,text) from public,anon;
grant execute on function public.deactivate_professional(uuid,text) to authenticated;

-- Public directory returns deliberately limited information; never user contact info.
create or replace function public.find_trustfive_professionals(p_trade uuid default null,p_area uuid default null)
returns table (
  application_id uuid,business_name text,about text,trade_name text,
  area_name text,city text,country_code char(2),quality_score smallint,slot smallint
) language sql stable security definer set search_path = ''
as $$
 select a.id,coalesce(nullif(a.business_name,''),'TrustFive professional'),a.about,
        t.name,s.area_name,s.city,s.country_code,q.quality_score,x.slot
 from public.active_allocations x
 join public.professional_applications a on a.id=x.application_id
 join public.professional_assessments q on q.application_id=a.id
 join public.trades t on t.id=x.trade_id
 join public.service_areas s on s.id=x.area_id
 where a.status='eligible' and q.verification_state='verified'
   and (p_trade is null or x.trade_id=p_trade)
   and (p_area is null or x.area_id=p_area)
 order by q.quality_score desc,a.submitted_at asc limit 50;
$$;
revoke all on function public.find_trustfive_professionals(uuid,uuid) from public;
grant execute on function public.find_trustfive_professionals(uuid,uuid) to anon,authenticated;

-- Job requests: customers may draft/open/cancel, but cannot self-confirm completion.
alter table public.jobs
  add column if not exists trade_id uuid references public.trades(id),
  add column if not exists area_id uuid references public.service_areas(id),
  add column if not exists budget_pence bigint check(budget_pence between 0 and 1000000000);
create or replace function public.guard_job_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op='UPDATE' and new.customer_id<>old.customer_id then
    raise exception 'Cannot transfer job ownership';
  end if;
  if new.status='open' and (new.trade_id is null or new.area_id is null) then
    raise exception 'Published jobs require a trade and service area';
  end if;
  if new.status in ('booked','completed') and not public.is_trustfive_admin() then
    raise exception 'Booking and completion require a verified workflow';
  end if;
  return new;
end $$;
create trigger guard_job_writes before insert or update on public.jobs
for each row execute function public.guard_job_mutation();

-- UK demo service areas and trade catalogue. Later areas should be curated.
insert into public.trades(slug,name) values
('plumbing','Plumbing'),('electrical','Electrical'),('cleaning','Cleaning'),
('handyman','Handyman'),('painting','Painting & decorating'),
('gardening','Gardening'),('moving','Moving & removals'),
('furniture-assembly','Furniture assembly'),('roofing','Roofing'),
('heating','Heating & boilers'),('carpentry','Carpentry'),
('home-security','Home security'),('bathrooms','Bathroom fitting'),
('kitchens','Kitchen fitting'),('flooring','Flooring'),
('windows','Windows & doors'),('landscaping','Landscaping'),
('pest-control','Pest control'),('appliance-repair','Appliance repair'),
('drainage','Drainage'),('plastering','Plastering')
on conflict (slug) do nothing;
insert into public.service_areas(country_code,region,city,area_name) values
('GB','Greater London','London','Central London'),
('GB','Greater London','London','North London'),
('GB','Greater Manchester','Manchester','Central Manchester'),
('GB','West Midlands','Birmingham','Central Birmingham')
on conflict (country_code,city,area_name) do nothing;

commit;