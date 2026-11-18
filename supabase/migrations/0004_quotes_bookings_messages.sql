-- TrustFive quoting, bookings, participant-only messaging and completion reviews.
-- This does NOT integrate payments, provide escrow, or verify professional identity.
begin;

create table public.job_quotes (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 professional_allocation_id uuid not null references public.active_allocations(id),
 professional_id uuid not null references public.profiles(id),
 amount_pence bigint not null check(amount_pence between 100 and 1000000000),
 message text not null check(char_length(btrim(message)) between 10 and 3000),
 status text not null default 'pending'
   check(status in ('pending','accepted','rejected','withdrawn')),
 created_at timestamptz not null default now(),
 unique(job_id,professional_id)
);
create index job_quotes_job_idx on public.job_quotes(job_id,created_at);
create index job_quotes_professional_idx on public.job_quotes(professional_id,created_at desc);
alter table public.job_quotes enable row level security;

create or replace function public.can_quote_on_job(p_job uuid,p_allocation uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
 select 1 from public.jobs j
 join public.active_allocations a on a.trade_id=j.trade_id and a.area_id=j.area_id
 join public.professional_applications app on app.id=a.application_id
 join public.professional_assessments assess on assess.application_id=app.id
 where j.id=p_job and a.id=p_allocation and j.status='open'
   and app.user_id=auth.uid() and app.status='eligible'
   and assess.verification_state='verified'
 );
$$;
revoke all on function public.can_quote_on_job(uuid,uuid) from public,anon;
grant execute on function public.can_quote_on_job(uuid,uuid) to authenticated;

create or replace function public.can_access_quote(p_quote uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.job_quotes q join public.jobs j on j.id=q.job_id
  where q.id=p_quote and (q.professional_id=auth.uid() or j.customer_id=auth.uid())
 );
$$;
revoke all on function public.can_access_quote(uuid) from public,anon;
grant execute on function public.can_access_quote(uuid) to authenticated;

create policy "quote participants read" on public.job_quotes for select
to authenticated using ((select auth.uid())=professional_id or public.can_access_quote(id));
create policy "verified professionals quote matching open jobs" on public.job_quotes for insert
to authenticated with check(
  status='pending' and professional_id=(select auth.uid())
  and public.can_quote_on_job(job_id,professional_allocation_id)
);

create table public.job_bookings (
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null unique references public.job_quotes(id),
 job_id uuid not null unique references public.jobs(id),
 customer_id uuid not null references public.profiles(id),
 professional_id uuid not null references public.profiles(id),
 status text not null default 'booked'
  check(status in ('booked','awaiting_customer','completed','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.job_bookings enable row level security;
create policy "booking participants read" on public.job_bookings for select
to authenticated using(customer_id=(select auth.uid()) or professional_id=(select auth.uid()));

create table public.quote_messages (
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null references public.job_quotes(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index quote_messages_quote_idx on public.quote_messages(quote_id,created_at);
alter table public.quote_messages enable row level security;
create policy "quote participants read messages" on public.quote_messages for select
to authenticated using(public.can_access_quote(quote_id));
create policy "quote participants send messages" on public.quote_messages for insert
to authenticated with check(author_id=(select auth.uid()) and public.can_access_quote(quote_id));

create table public.booking_reviews (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null unique references public.job_bookings(id),
 author_id uuid not null references public.profiles(id),
 professional_id uuid not null references public.profiles(id),
 stars smallint not null check(stars between 1 and 5),
 body text not null check(char_length(btrim(body)) between 10 and 1500),
 moderation_status text not null default 'published'
   check(moderation_status in ('published','hidden','removed')),
 created_at timestamptz not null default now()
);
alter table public.booking_reviews enable row level security;
create policy "published verified booking reviews are readable"
on public.booking_reviews for select to anon,authenticated
using(moderation_status='published' or author_id=(select auth.uid()));
create policy "customers review confirmed completed bookings"
on public.booking_reviews for insert to authenticated with check(
 author_id=(select auth.uid()) and moderation_status='published'
 and exists(select 1 from public.job_bookings b
  where b.id=booking_id and b.status='completed' and b.customer_id=(select auth.uid())
  and b.professional_id=professional_id and b.professional_id<>b.customer_id)
);

create table public.marketplace_audit_events (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id),
 action text not null,
 job_id uuid references public.jobs(id),
 quote_id uuid references public.job_quotes(id),
 created_at timestamptz not null default now()
);
alter table public.marketplace_audit_events enable row level security;
create policy "admins inspect marketplace audit" on public.marketplace_audit_events
for select to authenticated using((select public.is_trustfive_admin()));

-- Customers can edit open/draft jobs. Only privileged, server-owned functions
-- may promote a booking to booked/completed, never a direct browser update.
create or replace function public.guard_job_mutation()
returns trigger language plpgsql set search_path=''
as $$
begin
 if tg_op='UPDATE' and new.customer_id<>old.customer_id then
  raise exception 'Cannot transfer job ownership';
 end if;
 if tg_op='UPDATE' and old.status in ('booked','completed') and new.status<>old.status
   and current_user<>'postgres' and not public.is_trustfive_admin() then
  raise exception 'Booked jobs require a verified workflow';
 end if;
 if new.status='open' and (new.trade_id is null or new.area_id is null) then
  raise exception 'Published jobs need trade and area';
 end if;
 if new.status in ('booked','completed') and current_user<>'postgres'
   and not public.is_trustfive_admin() then
  raise exception 'Booking and completion require trusted workflow';
 end if;
 return new;
end $$;

-- Qualified professionals can read lead briefs ONLY in approved trade/areas,
-- without accessing customer phone/email or other private profile fields.
create or replace function public.open_jobs_for_professional()
returns table(
 job_id uuid,title text,description text,budget_pence bigint,
 trade_name text,area_name text,allocation_id uuid,created_at timestamptz
) language sql stable security definer set search_path=''
as $$
 select j.id,j.title,j.description,j.budget_pence,t.name,s.area_name,a.id,j.created_at
 from public.jobs j
 join public.active_allocations a on a.trade_id=j.trade_id and a.area_id=j.area_id
 join public.professional_applications ap on ap.id=a.application_id
 join public.professional_assessments qa on qa.application_id=ap.id
 join public.trades t on t.id=j.trade_id
 join public.service_areas s on s.id=j.area_id
 where ap.user_id=auth.uid() and ap.status='eligible'
   and qa.verification_state='verified' and j.status='open'
 order by j.created_at desc limit 100;
$$;
revoke all on function public.open_jobs_for_professional() from public,anon;
grant execute on function public.open_jobs_for_professional() to authenticated;

create or replace function public.customer_quotes()
returns table(quote_id uuid,job_id uuid,business_name text,
 amount_pence bigint,message text,status text,created_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select q.id,q.job_id,coalesce(ap.business_name,'TrustFive professional'),
   q.amount_pence,q.message,q.status,q.created_at
 from public.job_quotes q
 join public.jobs j on j.id=q.job_id
 join public.active_allocations a on a.id=q.professional_allocation_id
 join public.professional_applications ap on ap.id=a.application_id
 where j.customer_id=auth.uid()
 order by q.created_at desc limit 150;
$$;
revoke all on function public.customer_quotes() from public,anon;
grant execute on function public.customer_quotes() to authenticated;

create or replace function public.professional_quotes()
returns table(quote_id uuid,job_id uuid,job_title text,
 amount_pence bigint,message text,status text,created_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select q.id,q.job_id,j.title,q.amount_pence,q.message,q.status,q.created_at
 from public.job_quotes q join public.jobs j on j.id=q.job_id
 where q.professional_id=auth.uid()
 order by q.created_at desc limit 150;
$$;
revoke all on function public.professional_quotes() from public,anon;
grant execute on function public.professional_quotes() to authenticated;

create or replace function public.accept_job_quote(p_quote uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_quote public.job_quotes%rowtype;
declare v_job public.jobs%rowtype;
declare v_booking uuid;
begin
 select * into v_quote from public.job_quotes where id=p_quote;
 if not found then raise exception 'Quote not found'; end if;
 select * into v_job from public.jobs where id=v_quote.job_id for update;
 if v_job.customer_id is distinct from auth.uid() then
   raise exception 'Not authorised' using errcode='42501';
 end if;
 if v_job.status<>'open' or v_quote.status<>'pending' then
   raise exception 'Job or quote is no longer available';
 end if;
 if not exists(select 1 from public.active_allocations a
   join public.professional_applications ap on ap.id=a.application_id
   join public.professional_assessments qa on qa.application_id=ap.id
   where a.id=v_quote.professional_allocation_id
   and ap.user_id=v_quote.professional_id
   and ap.status='eligible' and qa.verification_state='verified') then
   raise exception 'Professional is no longer approved';
 end if;
 update public.job_quotes set status='accepted' where id=p_quote;
 update public.job_quotes set status='rejected'
  where job_id=v_quote.job_id and id<>p_quote and status='pending';
 update public.jobs set status='booked' where id=v_quote.job_id;
 insert into public.job_bookings(quote_id,job_id,customer_id,professional_id)
 values(v_quote.id,v_job.id,v_job.customer_id,v_quote.professional_id)
 returning id into v_booking;
 insert into public.marketplace_audit_events(actor_id,action,job_id,quote_id)
 values(auth.uid(),'quote_accepted',v_job.id,v_quote.id);
 return v_booking;
end $$;
revoke all on function public.accept_job_quote(uuid) from public,anon;
grant execute on function public.accept_job_quote(uuid) to authenticated;

create or replace function public.mark_job_ready_for_confirmation(p_booking uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 update public.job_bookings set status='awaiting_customer',updated_at=now()
 where id=p_booking and professional_id=auth.uid() and status='booked';
 if not found then raise exception 'Booking is not available for this action'; end if;
 insert into public.marketplace_audit_events(actor_id,action,job_id,quote_id)
 select auth.uid(),'work_marked_ready',job_id,quote_id
 from public.job_bookings where id=p_booking;
end $$;
revoke all on function public.mark_job_ready_for_confirmation(uuid) from public,anon;
grant execute on function public.mark_job_ready_for_confirmation(uuid) to authenticated;

create or replace function public.confirm_job_completed(p_booking uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_job uuid;
begin
 select job_id into v_job from public.job_bookings
 where id=p_booking and customer_id=auth.uid() and status='awaiting_customer'
 for update;
 if v_job is null then raise exception 'Booking is not awaiting your confirmation'; end if;
 update public.job_bookings set status='completed',updated_at=now() where id=p_booking;
 update public.jobs set status='completed' where id=v_job;
 insert into public.marketplace_audit_events(actor_id,action,job_id)
 values(auth.uid(),'job_completion_confirmed',v_job);
end $$;
revoke all on function public.confirm_job_completed(uuid) from public,anon;
grant execute on function public.confirm_job_completed(uuid) to authenticated;

commit;