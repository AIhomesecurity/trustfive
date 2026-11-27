-- Migration 0058: LinkedIn x Nextdoor x Xing Super-App Social Primitives
-- Adds:
--   1. public.social_member_profiles (Headline, About, Skills, Xing Haves & Wants, Availability flags)
--   2. public.social_connections (LinkedIn/Xing member connections with personal intro note)
--   3. public.social_skill_endorsements (Peer skill endorsements; no self-endorsement)
--   4. public.social_polls & public.social_poll_votes (Interactive neighbourhood & trade polls)
--   5. public.social_local_listings (Nextdoor For Sale & Free / surplus trade materials & tools exchange)
--
-- Security & Honesty Invariants:
--   - All public/member-visible text columns enforce public.showcase_contact_free(...) (zero phones/URLs/emails/postcodes).
--   - Strictly authenticated-only RLS; anon role revoked on all tables.
--   - Never influences the 5-professional-per-trade-and-area cap, approval status, or waiting-list order.

create table if not exists public.social_member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 80 and public.showcase_contact_free(display_name)),
  headline text not null default '' check (char_length(headline) <= 140 and public.showcase_contact_free(headline)),
  about text not null default '' check (char_length(about) <= 1200 and public.showcase_contact_free(about)),
  area_id uuid references public.service_areas(id) on delete set null,
  skills text[] not null default '{}' check (coalesce(array_length(skills, 1), 0) <= 12),
  offers_summary text not null default '' check (char_length(offers_summary) <= 400 and public.showcase_contact_free(offers_summary)),
  looking_for_summary text not null default '' check (char_length(looking_for_summary) <= 400 and public.showcase_contact_free(looking_for_summary)),
  open_to_work boolean not null default false,
  open_to_referrals boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists social_member_profiles_area_idx
  on public.social_member_profiles (area_id, updated_at desc);

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  intro_note text not null default '' check (char_length(intro_note) <= 280 and public.showcase_contact_free(intro_note)),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_connections_no_self check (requester_id <> addressee_id),
  constraint social_connections_unique_pair unique (requester_id, addressee_id)
);

create index if not exists social_connections_addressee_idx
  on public.social_connections (addressee_id, status, created_at desc);

create table if not exists public.social_skill_endorsements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  endorser_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (char_length(trim(skill)) between 2 and 60 and public.showcase_contact_free(skill)),
  created_at timestamptz not null default now(),
  constraint social_skill_endorsements_no_self check (member_id <> endorser_id),
  constraint social_skill_endorsements_unique unique (member_id, endorser_id, skill)
);

create index if not exists social_skill_endorsements_member_idx
  on public.social_skill_endorsements (member_id, skill);

create table if not exists public.social_polls (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid not null references public.service_areas(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 10 and 220 and public.showcase_contact_free(question)),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 4),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists social_polls_area_created_idx
  on public.social_polls (area_id, created_at desc);

create table if not exists public.social_poll_votes (
  poll_id uuid not null references public.social_polls(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (poll_id, voter_id)
);

create table if not exists public.social_local_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid not null references public.service_areas(id) on delete cascade,
  category text not null default 'tools_materials'
    check (category in ('tools_materials', 'home_garden', 'free_giveaway', 'wanted')),
  title text not null check (char_length(trim(title)) between 5 and 120 and public.showcase_contact_free(title)),
  description text not null check (char_length(trim(description)) between 12 and 800 and public.showcase_contact_free(description)),
  price_pence integer not null default 0 check (price_pence >= 0 and price_pence <= 5000000),
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  created_at timestamptz not null default now()
);

create index if not exists social_local_listings_area_status_idx
  on public.social_local_listings (area_id, status, created_at desc);

-- Enable RLS on all 6 tables
alter table public.social_member_profiles enable row level security;
alter table public.social_connections enable row level security;
alter table public.social_skill_endorsements enable row level security;
alter table public.social_polls enable row level security;
alter table public.social_poll_votes enable row level security;
alter table public.social_local_listings enable row level security;

-- 1. social_member_profiles policies
drop policy if exists "authenticated read social member profiles" on public.social_member_profiles;
create policy "authenticated read social member profiles"
  on public.social_member_profiles for select to authenticated using (true);

drop policy if exists "members insert own social profile" on public.social_member_profiles;
create policy "members insert own social profile"
  on public.social_member_profiles for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "members update own social profile" on public.social_member_profiles;
create policy "members update own social profile"
  on public.social_member_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. social_connections policies
drop policy if exists "participants read own connections" on public.social_connections;
create policy "participants read own connections"
  on public.social_connections for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "members request connections" on public.social_connections;
create policy "members request connections"
  on public.social_connections for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

drop policy if exists "addressees respond to connection requests" on public.social_connections;
create policy "addressees respond to connection requests"
  on public.social_connections for update to authenticated
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid() and status in ('accepted', 'declined'));

drop policy if exists "participants delete own connections" on public.social_connections;
create policy "participants delete own connections"
  on public.social_connections for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- 3. social_skill_endorsements policies
drop policy if exists "authenticated read skill endorsements" on public.social_skill_endorsements;
create policy "authenticated read skill endorsements"
  on public.social_skill_endorsements for select to authenticated using (true);

drop policy if exists "members endorse other members skills" on public.social_skill_endorsements;
create policy "members endorse other members skills"
  on public.social_skill_endorsements for insert to authenticated
  with check (endorser_id = auth.uid() and member_id <> auth.uid());

drop policy if exists "endorsers remove own endorsements" on public.social_skill_endorsements;
create policy "endorsers remove own endorsements"
  on public.social_skill_endorsements for delete to authenticated
  using (endorser_id = auth.uid());

-- 4. social_polls & social_poll_votes policies
drop policy if exists "authenticated read social polls" on public.social_polls;
create policy "authenticated read social polls"
  on public.social_polls for select to authenticated using (true);

drop policy if exists "members create social polls" on public.social_polls;
create policy "members create social polls"
  on public.social_polls for insert to authenticated
  with check (author_id = auth.uid() and status = 'open');

drop policy if exists "authors close own polls" on public.social_polls;
create policy "authors close own polls"
  on public.social_polls for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists "authenticated read poll votes" on public.social_poll_votes;
create policy "authenticated read poll votes"
  on public.social_poll_votes for select to authenticated using (true);

drop policy if exists "members cast one vote per open poll" on public.social_poll_votes;
create policy "members cast one vote per open poll"
  on public.social_poll_votes for insert to authenticated
  with check (
    voter_id = auth.uid()
    and exists (select 1 from public.social_polls p where p.id = poll_id and p.status = 'open')
  );

drop policy if exists "members change own vote on open poll" on public.social_poll_votes;
create policy "members change own vote on open poll"
  on public.social_poll_votes for update to authenticated
  using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (select 1 from public.social_polls p where p.id = poll_id and p.status = 'open')
  );

-- 5. social_local_listings policies
drop policy if exists "authenticated read local listings" on public.social_local_listings;
create policy "authenticated read local listings"
  on public.social_local_listings for select to authenticated using (true);

drop policy if exists "members create local listings" on public.social_local_listings;
create policy "members create local listings"
  on public.social_local_listings for insert to authenticated
  with check (seller_id = auth.uid() and status = 'available');

drop policy if exists "sellers update own local listings" on public.social_local_listings;
create policy "sellers update own local listings"
  on public.social_local_listings for update to authenticated
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());

drop policy if exists "sellers delete own local listings" on public.social_local_listings;
create policy "sellers delete own local listings"
  on public.social_local_listings for delete to authenticated
  using (seller_id = auth.uid());

-- Grants (revoke anon strictly on all 6 tables)
grant select, insert, update on public.social_member_profiles to authenticated;
grant select, insert, update, delete on public.social_connections to authenticated;
grant select, insert, delete on public.social_skill_endorsements to authenticated;
grant select, insert, update on public.social_polls to authenticated;
grant select, insert, update on public.social_poll_votes to authenticated;
grant select, insert, update, delete on public.social_local_listings to authenticated;

revoke all on public.social_member_profiles from anon;
revoke all on public.social_connections from anon;
revoke all on public.social_skill_endorsements from anon;
revoke all on public.social_polls from anon;
revoke all on public.social_poll_votes from anon;
revoke all on public.social_local_listings from anon;
