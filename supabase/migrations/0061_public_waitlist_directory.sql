-- Public applicant discovery is opt-in and clearly separate from the approved directory.
-- No phone, website, exact address, queue rank, or non-TrustFive review is exposed.
begin;

create table public.professional_waitlist_profiles (
  application_id uuid primary key references public.professional_applications(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  summary text not null check (char_length(btrim(summary)) between 30 and 500),
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint waitlist_profile_contact_free check (
    public.showcase_contact_free(display_name) and public.showcase_contact_free(summary)
  )
);

create index professional_waitlist_profiles_public_idx
  on public.professional_waitlist_profiles(updated_at desc)
  where is_public;

alter table public.professional_waitlist_profiles enable row level security;
revoke all on public.professional_waitlist_profiles from public, anon, authenticated;

create or replace function public.my_waitlist_public_profiles()
returns table(application_id uuid, display_name text, summary text, is_public boolean)
language sql stable security definer set search_path = ''
as $$
  select p.application_id, p.display_name, p.summary, p.is_public
  from public.professional_waitlist_profiles p
  where p.owner_id = (select auth.uid())
  order by p.updated_at desc, p.application_id;
$$;
revoke all on function public.my_waitlist_public_profiles() from public, anon;
grant execute on function public.my_waitlist_public_profiles() to authenticated;

create or replace function public.set_my_waitlist_public_profile(
  p_application uuid,
  p_display_name text,
  p_summary text,
  p_is_public boolean
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_app public.professional_applications%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select * into v_app
  from public.professional_applications a
  where a.id = p_application and a.user_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'Application not found or not authorised' using errcode = '42501';
  end if;

  if p_is_public is false then
    delete from public.professional_waitlist_profiles
    where application_id = p_application and owner_id = (select auth.uid());
    return;
  end if;

  if v_app.status not in ('pending','under_review','eligible') then
    raise exception 'This application cannot join the public waiting-list directory';
  end if;
  if exists (select 1 from public.active_allocations x where x.application_id = p_application) then
    raise exception 'Active approved professionals belong in the approved directory';
  end if;
  if char_length(btrim(coalesce(p_display_name,''))) not between 2 and 100
     or char_length(btrim(coalesce(p_summary,''))) not between 30 and 500 then
    raise exception 'Enter a public name and a 30 to 500 character introduction';
  end if;
  if not public.showcase_contact_free(p_display_name)
     or not public.showcase_contact_free(p_summary) then
    raise exception 'Remove phone numbers, postcodes, email addresses and external links from the public profile';
  end if;

  insert into public.professional_waitlist_profiles(
    application_id, owner_id, display_name, summary, is_public, updated_at
  ) values (
    p_application, (select auth.uid()), btrim(p_display_name), btrim(p_summary), true, now()
  ) on conflict (application_id) do update set
    owner_id = excluded.owner_id,
    display_name = excluded.display_name,
    summary = excluded.summary,
    is_public = true,
    updated_at = now();
end;
$$;
revoke all on function public.set_my_waitlist_public_profile(uuid,text,text,boolean) from public, anon;
grant execute on function public.set_my_waitlist_public_profile(uuid,text,text,boolean) to authenticated;

create or replace function public.find_trustfive_waitlist_profiles(
  p_trade uuid default null,
  p_area uuid default null
) returns table(
  application_id uuid,
  display_name text,
  summary text,
  trade_id uuid,
  trade_name text,
  trade_slug text,
  area_id uuid,
  area_name text,
  city text,
  status_label text,
  experience_years integer,
  average_stars numeric,
  review_count bigint
) language sql stable security definer set search_path = ''
as $$
  select p.application_id,
    case when public.showcase_contact_free(p.display_name) then p.display_name else 'Independent trade applicant' end,
    case when public.showcase_contact_free(p.summary) then p.summary else null end,
    a.trade_id,t.name,t.slug,a.area_id,s.area_name,s.city,
    case when a.status = 'eligible' and qa.verification_state = 'verified'
      then 'Verified; waiting for an active place'
      else 'Independent review in progress' end,
    a.experience_years,
    coalesce(rv.average_stars,0),coalesce(rv.review_count,0)
  from public.professional_waitlist_profiles p
  join public.professional_applications a on a.id = p.application_id
  join public.trades t on t.id = a.trade_id
  join public.service_areas s on s.id = a.area_id
  left join public.professional_assessments qa on qa.application_id = a.id
  left join (
    select r.professional_id, round(avg(r.stars)::numeric,2) as average_stars,
      count(*)::bigint as review_count
    from public.booking_reviews r
    where r.moderation_status = 'published'
    group by r.professional_id
  ) rv on rv.professional_id = a.user_id
  where p.is_public
    and a.status in ('pending','under_review','eligible')
    and not exists (select 1 from public.active_allocations x where x.application_id = a.id)
    and (p_trade is null or a.trade_id = p_trade)
    and (p_area is null or a.area_id = p_area)
  order by lower(p.display_name), p.application_id
  limit 100;
$$;
revoke all on function public.find_trustfive_waitlist_profiles(uuid,uuid) from public;
grant execute on function public.find_trustfive_waitlist_profiles(uuid,uuid) to anon, authenticated;

commit;
