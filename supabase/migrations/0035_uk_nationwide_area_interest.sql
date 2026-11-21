-- UK-wide coverage interest is a *request*, not a professional approval,
-- an independently surveyed service territory or an active five-slot award.
-- It allows people anywhere in England, Scotland, Wales and Northern Ireland
-- to signal demand while official ward/territory boundaries await review.
begin;

create table public.uk_area_interest_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 outcode text not null check(outcode ~ '^[A-Z]{1,2}[0-9][A-Z0-9]?$'),
 requested_role text not null check(requested_role in ('customer','professional')),
 trade_id uuid references public.trades(id),
 status text not null default 'pending' check(status in ('pending','under_review','verified','rejected')),
 created_at timestamptz not null default now(),
 check (requested_role<>'professional' or trade_id is not null)
);
create unique index uk_area_interest_unique_request
 on public.uk_area_interest_requests(user_id,outcode,requested_role,
 coalesce(trade_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index uk_area_interest_pending_by_outcode
 on public.uk_area_interest_requests(outcode,created_at)
 where status='pending';
alter table public.uk_area_interest_requests enable row level security;
revoke all on public.uk_area_interest_requests from public,anon,authenticated;
grant select,insert on public.uk_area_interest_requests to authenticated;
create policy "user sees own UK coverage requests"
 on public.uk_area_interest_requests for select to authenticated
 using(user_id=(select auth.uid()));
create policy "user requests unapproved UK coverage"
 on public.uk_area_interest_requests for insert to authenticated
 with check(user_id=(select auth.uid()) and status='pending');

comment on table public.uk_area_interest_requests is
 'Countrywide postcode-district interest. Pending requests are not approved professional applications, real reviews, territory boundaries or provider listings. Administrative review must verify an actual official postcode before any expansion.';
commit;
