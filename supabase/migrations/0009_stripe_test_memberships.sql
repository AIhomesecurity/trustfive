-- Stripe TEST MODE professional software memberships.
-- Financial membership has NO connection to TrustFive eligibility or rankings.
-- Never grant authenticated users direct write access to these tables or this RPC.
begin;

create table public.business_memberships (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 stripe_customer_id text not null,
 stripe_subscription_id text not null unique,
 subscription_status text not null
  check(subscription_status in (
   'trialing','active','incomplete','incomplete_expired','past_due','unpaid','canceled','paused'
  )),
 last_event_created_at timestamptz not null,
 updated_at timestamptz not null default now()
);
alter table public.business_memberships enable row level security;
revoke insert,update,delete on public.business_memberships from anon,authenticated;
create policy "members see their own billing status"
 on public.business_memberships for select to authenticated
 using(user_id=(select auth.uid()));

create table public.stripe_webhook_events (
 event_id text primary key,
 event_created_at timestamptz not null,
 processed_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon,authenticated;

create or replace function public.apply_membership_stripe_event(
 p_event_id text,p_event_created_at timestamptz,
 p_user_id uuid,p_customer_id text,p_subscription_id text,p_status text
) returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if p_event_id is null or length(p_event_id) not between 6 and 160
   or p_event_created_at is null or p_user_id is null
   or p_customer_id is null or p_subscription_id is null then
  raise exception 'Invalid webhook event';
 end if;
 if p_status not in (
  'trialing','active','incomplete','incomplete_expired','past_due','unpaid','canceled','paused'
 ) then raise exception 'Unrecognised subscription state'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id) then
  raise exception 'Membership owner does not exist';
 end if;
 insert into public.stripe_webhook_events(event_id,event_created_at)
 values(p_event_id,p_event_created_at) on conflict do nothing;
 if not found then return false; end if;
 insert into public.business_memberships(
  user_id,stripe_customer_id,stripe_subscription_id,
  subscription_status,last_event_created_at
 ) values(
  p_user_id,p_customer_id,p_subscription_id,p_status,p_event_created_at
 ) on conflict(user_id) do update set
  stripe_customer_id=excluded.stripe_customer_id,
  stripe_subscription_id=excluded.stripe_subscription_id,
  subscription_status=excluded.subscription_status,
  last_event_created_at=excluded.last_event_created_at,
  updated_at=now()
 where excluded.last_event_created_at>=public.business_memberships.last_event_created_at
  and (
    excluded.stripe_subscription_id=public.business_memberships.stripe_subscription_id
    or public.business_memberships.subscription_status not in ('active','trialing')
  );
 return true;
end $$;
revoke all on function public.apply_membership_stripe_event(text,timestamptz,uuid,text,text,text)
 from public,anon,authenticated;
grant execute on function public.apply_membership_stripe_event(text,timestamptz,uuid,text,text,text)
 to service_role;

commit;