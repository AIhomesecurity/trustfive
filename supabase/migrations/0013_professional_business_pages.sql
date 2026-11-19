-- Reviewed public business pages linked to real approved professional slots.
-- The membership/subscription system is deliberately absent from approval.
begin;
create table public.professional_business_pages(
 application_id uuid primary key references public.professional_applications(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 display_name text not null check(char_length(btrim(display_name)) between 2 and 120),
 description text not null check(char_length(btrim(description)) between 30 and 4000),
 website_url text check(website_url is null or (
  char_length(website_url)<=255 and website_url~'^https://[^[:space:]]+$'
 )),
 public_phone text check(public_phone is null or char_length(public_phone) between 7 and 30),
 status text not null default 'draft'
  check(status in ('draft','submitted','published','hidden')),
 review_note text,
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.professional_business_pages enable row level security;

create or replace function public.is_active_approved_application(p_application uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.active_allocations alloc
  join public.professional_applications a on a.id=alloc.application_id
  join public.professional_assessments qa on qa.application_id=a.id
  where alloc.application_id=p_application
   and a.status='eligible' and qa.verification_state='verified'
 );
$$;
revoke all on function public.is_active_approved_application(uuid) from public;
grant execute on function public.is_active_approved_application(uuid) to anon,authenticated;

create policy "public sees vetted business pages" on public.professional_business_pages
 for select to anon,authenticated using(
  status='published' and public.is_active_approved_application(application_id));
create policy "owners see their private drafts" on public.professional_business_pages
 for select to authenticated using(owner_id=(select auth.uid()));
create policy "admins review all business drafts" on public.professional_business_pages
 for select to authenticated using((select public.is_trustfive_admin()));
create policy "owners create private business drafts" on public.professional_business_pages
 for insert to authenticated with check(
  owner_id=(select auth.uid()) and status='draft' and review_note is null
  and exists(select 1 from public.professional_applications a
    where a.id=application_id and a.user_id=(select auth.uid()))
 );
create policy "owners edit only private drafts" on public.professional_business_pages
 for update to authenticated using(
  owner_id=(select auth.uid()) and status='draft')
 with check(owner_id=(select auth.uid()) and status='draft');

create or replace function public.guard_business_page_ownership()
returns trigger language plpgsql set search_path=''
as $$
begin
 if tg_op='UPDATE' and
    (new.owner_id is distinct from old.owner_id
      or new.application_id is distinct from old.application_id) then
  raise exception 'Business page ownership is immutable';
 end if;
 new.updated_at=now();
 return new;
end $$;
create trigger guard_business_page before update on public.professional_business_pages
for each row execute function public.guard_business_page_ownership();

create or replace function public.submit_business_page(p_application uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 update public.professional_business_pages set status='submitted',updated_at=now()
  where application_id=p_application and owner_id=auth.uid() and status='draft';
 if not found then raise exception 'Draft not found or not owned by your account'; end if;
 insert into public.network_audit_events(actor_id,action,application_id)
 values(auth.uid(),'business_page_submitted',p_application);
end $$;
revoke all on function public.submit_business_page(uuid) from public,anon;
grant execute on function public.submit_business_page(uuid) to authenticated;

create or replace function public.review_business_page(
 p_application uuid,p_approve boolean,p_reason text
) returns void language plpgsql security definer set search_path=''
as $$
begin
 if not public.is_trustfive_admin() then
  raise exception 'Not authorised' using errcode='42501';
 end if;
 if char_length(btrim(coalesce(p_reason,'')))<20 then
  raise exception 'Document the evidence-based review (minimum 20 characters)';
 end if;
 if p_approve and not public.is_active_approved_application(p_application) then
  raise exception 'Only currently verified, active professionals may publish business pages';
 end if;
 update public.professional_business_pages
  set status=case when p_approve then 'published' else 'draft' end,
   review_note=btrim(p_reason),reviewed_by=auth.uid(),reviewed_at=now(),
   updated_at=now()
  where application_id=p_application and status in ('submitted','published');
 if not found then raise exception 'Business page is not awaiting review or published'; end if;
 insert into public.network_audit_events(actor_id,action,application_id,detail)
 values(auth.uid(),'business_page_reviewed',p_application,
  jsonb_build_object('approved',p_approve,'review_note',p_reason));
end $$;
revoke all on function public.review_business_page(uuid,boolean,text) from public,anon;
grant execute on function public.review_business_page(uuid,boolean,text) to authenticated;
commit;