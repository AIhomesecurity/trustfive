-- TrustFive Social: minimal professional collaboration requests without customer leads.
-- No customer job, address, telephone, private message or quote references.
-- Registration to the trade network is NOT marketplace approval or an active slot.
-- Migration version intentionally isolated; coordinate final version with integration.
begin;

create table public.social_trade_requests (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.profiles(id) on delete cascade,
 trade_id uuid not null references public.trades(id),
 area_id uuid not null references public.service_areas(id),
 assistance_type text not null check(assistance_type in
  ('installation','repair','inspection','planning','specialist_support','other')),
 earliest_week date,
 status text not null default 'open' check(status in ('open','closed')),
 created_at timestamptz not null default now()
);
create index social_trade_requests_browse_idx
 on public.social_trade_requests(area_id,trade_id,status,created_at desc);
create index social_trade_requests_creator_idx
 on public.social_trade_requests(creator_id,created_at desc);

create table public.social_trade_interests (
 request_id uuid not null references public.social_trade_requests(id) on delete cascade,
 responder_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(request_id,responder_id)
);
create index social_trade_interests_responder_idx
 on public.social_trade_interests(responder_id,created_at desc);

alter table public.social_trade_requests enable row level security;
alter table public.social_trade_interests enable row level security;
revoke all on public.social_trade_requests,public.social_trade_interests from public,anon;
grant select,insert,update on public.social_trade_requests to authenticated;
grant select,insert,delete on public.social_trade_interests to authenticated;

-- A user must have applied for professional status and still be in the
-- pending/review/eligible pipeline. Merely setting a client-side role is
-- insufficient; this never grants verification or approval.
create policy "registered professionals browse open collaboration requests"
 on public.social_trade_requests for select to authenticated
 using(
  creator_id=(select auth.uid())
  or (status='open' and exists(
   select 1 from public.professional_applications a
   where a.user_id=(select auth.uid())
    and a.status in ('pending','under_review','eligible')
  ))
 );

create policy "registered professionals create their own structured requests"
 on public.social_trade_requests for insert to authenticated
 with check(
  creator_id=(select auth.uid()) and status='open'
  and exists(
   select 1 from public.professional_applications a
   where a.user_id=(select auth.uid())
    and a.status in ('pending','under_review','eligible')
  )
 );

create policy "request owner may close or reopen their own requests"
 on public.social_trade_requests for update to authenticated
 using(creator_id=(select auth.uid()))
 with check(creator_id=(select auth.uid()));

-- No arbitrary direct contact or customer message is stored in expressions of
-- interest: it is a yes/no intention visible only to involved parties.
create policy "request creator and responder read only their expressions"
 on public.social_trade_interests for select to authenticated
 using(
  responder_id=(select auth.uid()) or exists(
   select 1 from public.social_trade_requests r
   where r.id=request_id and r.creator_id=(select auth.uid())
  )
 );
create policy "registered professionals express interest in open requests"
 on public.social_trade_interests for insert to authenticated
 with check(
  responder_id=(select auth.uid())
  and exists(
   select 1 from public.social_trade_requests r
   where r.id=request_id and r.status='open'
    and r.creator_id<>(select auth.uid())
  )
  and exists(
   select 1 from public.professional_applications a
   where a.user_id=(select auth.uid())
    and a.status in ('pending','under_review','eligible')
  )
 );
create policy "responders may withdraw their own interest"
 on public.social_trade_interests for delete to authenticated
 using(responder_id=(select auth.uid()));

-- Server-side per-account quotas are an abuse backstop even if the UI is bypassed.
create trigger quota_social_trade_requests before insert on public.social_trade_requests
 for each row execute function public.enforce_account_write_quota('social_trade_request','5','day');
create trigger quota_social_trade_interests before insert on public.social_trade_interests
 for each row execute function public.enforce_account_write_quota('social_trade_interest','20','day');

commit;
